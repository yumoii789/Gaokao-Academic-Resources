'use client';

import React, { useEffect, useState } from 'react';
import type { Paper, Question } from '@/types';
import QuestionCard from './QuestionCard';

export default function StructuredPaper({ paper, onShowOriginal }: { paper: Paper; onShowOriginal: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const info = paper.structured;

  useEffect(() => {
    if (!info) return;
    let cancelled = false;
    setStatus('loading');
    fetch(info.file)
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        setQuestions(data.questions || []);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; };
  }, [info]);

  if (!info) return null;
  return (
    <div>
      <div className='glass-card mb-6 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3'>
        <div className='text-xs leading-5 text-slate-500'>
          <span className='font-semibold text-slate-700'>原卷逐题 · {info.count} 题</span>
          <span className='ml-2'>文本页 {info.textPages} · OCR页 {info.ocrPages} · 待校对 {info.reviewCount}</span>
        </div>
        <button onClick={onShowOriginal} className='px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 text-indigo-600 hover:bg-indigo-50'>
          查看原卷
        </button>
      </div>
      {status === 'loading' && <div className='py-20 text-center text-slate-400'>正在加载逐题数据…</div>}
      {status === 'error' && (
        <div className='py-16 text-center text-slate-500'>
          <p>逐题数据加载失败。</p>
          <button onClick={onShowOriginal} className='mt-4 text-indigo-600 underline'>改为查看原卷</button>
        </div>
      )}
      {status === 'ready' && questions.map((q, i) => (
        <QuestionCard key={q.questionId} question={q} index={i} />
      ))}
    </div>
  );
}
