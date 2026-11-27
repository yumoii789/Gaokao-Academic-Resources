'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Question } from '@/types';
import { streamTutor, type TutorMessage, type TutorContent } from '@/lib/ai';
import { loadAiConfig } from '@/lib/ai-config';
import MathText from './MathText';
import FormattedText from './FormattedText';

type AiState = 'idle' | 'streaming' | 'done' | 'error';
type AiMode = 'hint' | 'explain';
type AnalysisSource = 'source' | 'ai' | 'none';
type ChatTurn = { role: 'user' | 'assistant'; text: string };

const ANALYSIS_LABELS: Record<AnalysisSource, { answer: string; analysis: string }> = {
  source: { answer: '原卷答案', analysis: '原卷解析' },
  ai: { answer: '参考答案', analysis: 'AI 生成解析（非官方）' },
  none: { answer: '参考答案', analysis: '参考解析（非官方）' },
};

export default function QuestionCard({ question, index, highlighted = false }: { question: Question; index?: number; highlighted?: boolean }) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [aiState, setAiState] = useState<AiState>('idle');
  const [aiMode, setAiMode] = useState<AiMode>('hint');
  const [aiTurns, setAiTurns] = useState<ChatTurn[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiError, setAiError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    setShowAnalysis(false);
    setAiState('idle');
    setAiMode('hint');
    setAiTurns([]);
    setAiInput('');
    setAiError('');
    if (question.analysisSource === 'none' || !question.analysisSource) {
      try {
        const cached = window.localStorage.getItem('gaokao:ai-analysis:' + question.questionId);
        if (cached) {
          setAiMode('explain');
          setAiTurns([{ role: 'assistant', text: cached }]);
          setAiState('done');
        }
      } catch { /* 存储不可用时仍可在线生成。 */ }
    }
    return () => abortRef.current?.abort();
  }, [question.questionId, question.analysisSource]);

  function firstUserContent(images: string[]): TutorContent {
    const text = [
      '科目：' + question.subject,
      '年份：' + question.year,
      '知识点：' + question.knowledgePoints.join('、'),
      '题目：',
      question.content,
    ].join('\n');
    if (images.length === 0) return text;
    return [
      { type: 'text', text },
      ...images.map(src => ({ type: 'image_url' as const, image_url: { url: new URL(src, window.location.origin).href } })),
    ];
  }

  function updateStreaming(value: string) {
    setAiTurns(prev => {
      const next = prev.slice();
      const last = next[next.length - 1];
      if (last && last.role === 'assistant') next[next.length - 1] = { ...last, text: value };
      else next.push({ role: 'assistant', text: value });
      return next;
    });
  }

  function buildMessages(mode: AiMode | 'follow', userTurns: TutorMessage[]): TutorMessage[] {
    const systemPrompt = mode === 'hint'
      ? '你是高考启发式助教。先指出审题关键，再给一个引导问题和一个提示，不直接给最终答案，控制在250字内。多轮追问时继续引导，除非用户明确要求完整解答。'
      : mode === 'explain'
        ? '你是高考解析老师。按“审题—知识点—逐步推导—答案核验”讲解。若题干缺失或OCR可疑，必须明确指出，不得编造。'
        : '你是高考助教。基于本题题干、图片与此前对话回答用户追问，简洁准确，不得编造。';
    return [{ role: 'system', content: systemPrompt }, ...userTurns];
  }

  async function runTurn(messages: TutorMessage[], controller: AbortController): Promise<string> {
    try {
      const text = await streamTutor(messages, value => {
        if (!controller.signal.aborted) updateStreaming(value);
      }, controller.signal);
      if (!controller.signal.aborted) setAiState(text ? 'done' : 'error');
      return controller.signal.aborted ? '' : text;
    } catch (error) {
      if ((error as Error).name !== 'AbortError' && !controller.signal.aborted) {
        setAiState('error');
        setAiError((error as Error).message);
        setAiTurns(prev => {
          const next = prev.slice();
          if (next[next.length - 1]?.role === 'assistant' && !next[next.length - 1].text) next.pop();
          return next;
        });
      }
      return '';
    }
  }

  async function askAi(mode: AiMode) {
    if (aiState === 'streaming') {
      abortRef.current?.abort();
      setAiState('done');
      return;
    }
    setAiMode(mode);
    setAiError('');
    const images = loadAiConfig().includeImages ? imageList : [];
    setAiTurns([{ role: 'user', text: mode === 'hint' ? '（引导我思考这道题）' : '（请逐步解析这道题）' }]);
    setAiState('streaming');
    const controller = new AbortController();
    abortRef.current = controller;
    const text = await runTurn(buildMessages(mode, [{ role: 'user', content: firstUserContent(images) }]), controller);
    if (text && mode === 'explain') {
      try { window.localStorage.setItem('gaokao:ai-analysis:' + question.questionId, text); } catch { /* 忽略存储配额。 */ }
    }
  }

  async function sendFollowUp() {
    const input = aiInput.trim();
    if (!input || aiState === 'streaming') return;
    setAiInput('');
    setAiError('');
    const images = loadAiConfig().includeImages ? imageList : [];
    // 重建完整上下文：首轮真实题目内容 + 已有 AI 回复 + 追问。
    const userTurns: TutorMessage[] = [
      { role: 'user', content: firstUserContent(images) },
      ...aiTurns.filter(t => t.role === 'assistant' && t.text).map(t => ({ role: 'assistant' as const, content: t.text })),
      { role: 'user', content: input },
    ];
    setAiTurns(prev => [...prev, { role: 'user', text: input }, { role: 'assistant', text: '' }]);
    setAiState('streaming');
    const controller = new AbortController();
    abortRef.current = controller;
    await runTurn(buildMessages('follow', userTurns), controller);
  }

  function toggleAnalysis() {
    if (showAnalysis) {
      setShowAnalysis(false);
      return;
    }
    setShowAnalysis(true);
    const missing = source === 'none' || !question.analysis || /原卷未提供|未提供人工/.test(question.analysis);
    if (missing && (aiMode !== 'explain' || aiState === 'idle' || aiState === 'error')) void askAi('explain');
  }

  const subjectColor = question.tags.includes('春季高考') ? 'emerald' : 'indigo';

  const imageList = question.imagePaths && question.imagePaths.length > 0
    ? question.imagePaths
    : question.imagePath
      ? [question.imagePath]
      : [];
  const images = imageList.filter(Boolean);
  const source: AnalysisSource = question.analysisSource ?? 'none';
  const labels = ANALYSIS_LABELS[source];
  const questionNumber = question.provenance?.questionNumber
    ?? (typeof index === 'number' ? index + 1 : null);
  const imageAlt = (position: number) => {
    const seq = '配图 ' + (position + 1) + '/' + images.length;
    return questionNumber != null ? '第 ' + questionNumber + ' 题' + seq : '#' + question.questionId + ' ' + seq;
  };

  const imageBlock = images.length > 0 ? (
    <div className={images.length > 1 ? 'grid gap-2 mb-4' : 'mb-4'}>
      {images.map((src, imgIndex) => (
        <img
          key={src + '-' + imgIndex}
          src={src}
          alt={imageAlt(imgIndex)}
          loading="lazy"
          className={'rounded-lg h-auto max-w-full border border-slate-100' + (images.length > 1 ? ' w-full' : '')}
        />
      ))}
    </div>
  ) : null;
  const ocrFirst = question.provenance?.extraction === 'ocr' && images.length > 0;

  return (
    <div id={'question-' + question.questionId} className={'glass-card p-6 rounded-2xl mb-6' + (highlighted ? ' ring-2 ring-indigo-300' : '')}>
      <div className="flex justify-between items-start gap-3 mb-4">
        <span className="flex items-center gap-2 shrink-0 pt-1">
          {typeof index === 'number' && (
            <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-md">第 {index + 1} 题</span>
          )}
          <span className="text-xs font-mono text-slate-400">#{question.questionId}</span>
        </span>
        <div className="flex gap-2 flex-wrap justify-end">
          {question.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full">{tag}</span>
          ))}
        </div>
      </div>

      {ocrFirst && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">OCR 文字待校对，请以下方原卷图为准。</div>
      )}
      {ocrFirst && imageBlock}

      <MathText text={question.content} className="academic-title text-lg leading-relaxed mb-4 block" />

      {!ocrFirst && imageBlock}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={toggleAnalysis}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 transition-colors"
        >
          {showAnalysis ? '隐藏解析' : '查看解析'}
        </button>
        <button
          onClick={() => askAi('hint')}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 transition-colors"
        >
          {aiState === 'streaming' ? '■ 停止' : aiState === 'done' && aiMode === 'hint' ? '↻ 重新引导' : '✦ AI 引导'}
        </button>
        <button
          onClick={() => askAi('explain')}
          disabled={aiState === 'streaming'}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 transition-colors"
        >
          {aiState === 'done' && aiMode === 'explain' ? '↻ 重新解析' : '✦ AI 解析'}
        </button>
      </div>

      {showAnalysis && source !== 'none' && question.analysis && !/原卷未提供|未提供人工/.test(question.analysis) && (
        <div className="mt-4 p-4 bg-slate-50 rounded-xl text-sm leading-loose text-slate-700 animate-in fade-in slide-in-from-top-2">
          {source === 'ai' && (
            <div className="font-bold text-xs text-amber-700 mb-2">AI 生成解析（非官方）</div>
          )}
          {question.answer && !/暂无结构化答案|未提供/.test(question.answer) && (
            <div className={'font-bold mb-2 ' + (subjectColor === 'emerald' ? 'text-emerald-900' : 'text-indigo-900')}>
              {labels.answer}：<MathText text={question.answer} />
            </div>
          )}
          {source !== 'ai' && (
            <div className={'text-xs font-bold mb-1 ' + (subjectColor === 'emerald' ? 'text-emerald-700' : 'text-indigo-700')}>
              {labels.analysis}
            </div>
          )}
          <MathText text={question.analysis} className="whitespace-pre-wrap" />
        </div>
      )}

      {aiTurns.length > 0 && (
        <div className="mt-4 space-y-3">
          {aiTurns.map((turn, turnIndex) => (
            <div key={turnIndex} className={turn.role === 'user' ? 'flex justify-end' : ''}>
              {turn.role === 'user' ? (
                <div className="max-w-[85%] px-3 py-2 rounded-xl bg-slate-100 text-sm text-slate-700 whitespace-pre-wrap">{turn.text}</div>
              ) : (
                <div className="p-4 rounded-xl text-sm leading-loose text-slate-700 bg-gradient-to-br from-indigo-50/60 to-transparent border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="font-bold text-indigo-900 text-xs font-mono">AI 助教 · {aiMode === 'hint' ? '启发式引导' : '逐步解析（非官方）'}</span>
                  </div>
                  <div className="whitespace-pre-wrap">
                    <FormattedText text={turn.text} />
                    {aiState === 'streaming' && turnIndex === aiTurns.length - 1 && <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse align-text-bottom" />}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {aiState === 'done' && aiTurns.length > 0 && (
        <div className="mt-3 flex gap-2">
          <input
            value={aiInput}
            onChange={event => setAiInput(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') void sendFollowUp(); }}
            placeholder="继续追问（多轮对话）…"
            className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
          <button
            onClick={() => void sendFollowUp()}
            disabled={!aiInput.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
          >
            发送
          </button>
        </div>
      )}

      {showAnalysis && aiState === 'streaming' && aiTurns.every(t => t.role === 'user' || !t.text) && (
        <div className="mt-4 p-4 rounded-xl bg-indigo-50/60 text-sm text-indigo-600">AI 正在生成解析…</div>
      )}

      {aiState === 'error' && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
          {aiError || 'AI 服务暂不可用，请检查网络后重试。'}
        </div>
      )}
    </div>
  );
}
