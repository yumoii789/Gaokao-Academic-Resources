'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Question } from '@/types';

type AiState = 'idle' | 'streaming' | 'done' | 'error';

export default function QuestionCard({ question }: { question: Question }) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [aiState, setAiState] = useState<AiState>('idle');
  const [aiText, setAiText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  async function askAi() {
    if (aiState === 'streaming') {
      abortRef.current?.abort();
      setAiState('done');
      return;
    }
    if (aiState === 'done') {
      setAiText('');
    }
    setAiState('streaming');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: question.content,
          context: '科目: ' + question.subject + ' | 年份: ' + question.year + ' | 知识点: ' + question.knowledgePoints.join('、'),
        }),
      });
      if (!res.ok || !res.body) throw new Error('AI service unavailable');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';

      while (true) {
        const step = await reader.read();
        if (step.done) break;
        buffer += decoder.decode(step.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
            if (delta) {
              text += delta;
              setAiText(text);
            }
          } catch { /* 忽略不完整 JSON 行 */ }
        }
      }
      setAiState(text ? 'done' : 'error');
      if (!text) setAiText('');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setAiState('error');
        setAiText('');
      }
    }
  }

  const subjectColor = question.tags.includes('春季高考') ? 'emerald' : 'indigo';

  return (
    <div className="glass-card p-6 rounded-2xl mb-6">
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-mono text-slate-400">#{question.questionId}</span>
        <div className="flex gap-2">
          {question.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full">{tag}</span>
          ))}
        </div>
      </div>

      <div className="academic-title text-lg leading-relaxed mb-4">
        {question.content}
      </div>

      {question.imagePath && (
        <img src={question.imagePath} alt="题目配图" className="rounded-lg mb-4 max-w-full h-auto border border-slate-100" />
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setShowAnalysis(!showAnalysis)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          {showAnalysis ? '隐藏解析' : '查看解析'}
        </button>
        <button
          onClick={askAi}
          className={
            'px-4 py-2 text-sm font-medium rounded-lg border transition-colors ' +
            (aiState === 'streaming'
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 hover:bg-slate-50')
          }
        >
          {aiState === 'streaming' ? '■ 停止' : aiState === 'done' ? '↻ 重新引导' : '✦ AI 引导'}
        </button>
      </div>

      {showAnalysis && (
        <div className="mt-4 p-4 bg-slate-50 rounded-xl text-sm leading-loose text-slate-700 animate-in fade-in slide-in-from-top-2">
          <div className={'font-bold mb-2 ' + (subjectColor === 'emerald' ? 'text-emerald-900' : 'text-indigo-900')}>
            标准答案：{question.answer}
          </div>
          <div className="whitespace-pre-wrap">{question.analysis}</div>
        </div>
      )}

      {(aiState === 'streaming' || aiState === 'done') && aiText && (
        <div className="mt-4 p-4 rounded-xl text-sm leading-loose text-slate-700 bg-gradient-to-br from-indigo-50/60 to-transparent border border-indigo-100 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="font-bold text-indigo-900 text-xs font-mono">AI 助教 · 启发式引导</span>
          </div>
          <div className="whitespace-pre-wrap">
            {aiText}
            {aiState === 'streaming' && <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse align-text-bottom" />}
          </div>
        </div>
      )}

      {aiState === 'error' && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
          AI 服务暂时不可用，请稍后再试。
        </div>
      )}
    </div>
  );
}
