'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Question } from '@/types';
import { streamTutor } from '@/lib/ai';
import MathText from './MathText';
import FormattedText from './FormattedText';

type AiState = 'idle' | 'streaming' | 'done' | 'error';
type AiMode = 'hint' | 'explain';

export default function QuestionCard({ question, index }: { question: Question; index?: number }) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [aiState, setAiState] = useState<AiState>('idle');
  const [aiMode, setAiMode] = useState<AiMode>('hint');
  const [aiText, setAiText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function askAi(mode: AiMode) {
    if (aiState === 'streaming') {
      abortRef.current?.abort();
      setAiState('done');
      return;
    }
    setAiMode(mode);
    setAiText('');
    setAiState('streaming');
    const controller = new AbortController();
    abortRef.current = controller;
    const systemPrompt = mode === 'hint'
      ? '你是高考启发式助教。先指出审题关键，再给一个引导问题和一个提示，不直接给最终答案，控制在250字内。'
      : '你是高考解析老师。按“审题—知识点—逐步推导—答案核验”讲解。若题干缺失或OCR可疑，必须明确指出，不得编造。';
    try {
      const text = await streamTutor([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            '科目：' + question.subject,
            '年份：' + question.year,
            '知识点：' + question.knowledgePoints.join('、'),
            '题目：',
            question.content,
          ].join('\n'),
        },
      ], value => {
        if (!controller.signal.aborted) setAiText(value);
      }, controller.signal);
      if (!controller.signal.aborted) setAiState(text ? 'done' : 'error');
    } catch (error) {
      if ((error as Error).name !== 'AbortError' && !controller.signal.aborted) {
        setAiState('error');
        setAiText('');
      }
    }
  }

  const subjectColor = question.tags.includes('春季高考') ? 'emerald' : 'indigo';

  return (
    <div className="glass-card p-6 rounded-2xl mb-6">
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

      <MathText text={question.content} className="academic-title text-lg leading-relaxed mb-4 block" />

      {question.imagePath && (
        <img src={question.imagePath} alt="题目配图" className="rounded-lg mb-4 max-w-full h-auto border border-slate-100" />
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowAnalysis(!showAnalysis)}
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

      {showAnalysis && (
        <div className="mt-4 p-4 bg-slate-50 rounded-xl text-sm leading-loose text-slate-700 animate-in fade-in slide-in-from-top-2">
          <div className={'font-bold mb-2 ' + (subjectColor === 'emerald' ? 'text-emerald-900' : 'text-indigo-900')}>
            标准答案：<MathText text={question.answer} />
          </div>
          <MathText text={question.analysis} className="whitespace-pre-wrap" />
        </div>
      )}

      {(aiState === 'streaming' || aiState === 'done') && aiText && (
        <div className="mt-4 p-4 rounded-xl text-sm leading-loose text-slate-700 bg-gradient-to-br from-indigo-50/60 to-transparent border border-indigo-100 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="font-bold text-indigo-900 text-xs font-mono">AI 助教 · {aiMode === 'hint' ? '启发式引导' : '逐步解析'}</span>
          </div>
          <div className="whitespace-pre-wrap">
            <FormattedText text={aiText} />
            {aiState === 'streaming' && <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse align-text-bottom" />}
          </div>
        </div>
      )}

      {aiState === 'error' && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
          AI 服务暂不可用，请检查网络后重试。
        </div>
      )}
    </div>
  );
}
