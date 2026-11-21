'use client';

import React, { useMemo, useState } from 'react';
import type { Question } from '@/types';
import QuestionCard from './QuestionCard';

type SubjectFilter = '全部' | '数学' | '物理';

export default function QuestionBrowser({ questions, accent }: { questions: Question[]; accent: string }) {
  const [subject, setSubject] = useState<SubjectFilter>('全部');
  const [year, setYear] = useState<number | '全部'>('全部');

  const years = useMemo(
    () => Array.from(new Set(questions.map(q => q.year))).sort((a, b) => b - a),
    [questions]
  );

  const filtered = useMemo(
    () => questions.filter(q =>
      (subject === '全部' || q.subject === subject) && (year === '全部' || q.year === year)
    ),
    [questions, subject, year]
  );

  const pill = (active: boolean) =>
    'px-3 py-1.5 text-sm rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 transition-colors whitespace-nowrap ' +
    (active
      ? 'border-transparent text-white ' + accent
      : 'border-slate-200 text-slate-600 hover:border-slate-400');

  const subjectBlock = (
    <div>
      <h3 className='text-xs font-bold uppercase tracking-widest text-slate-400 mb-3'>筛选科目</h3>
      <div className='flex md:flex-col gap-2'>
        {(['全部', '数学', '物理'] as SubjectFilter[]).map(s => (
          <button key={s} onClick={() => setSubject(s)} className={pill(subject === s)}>{s}</button>
        ))}
      </div>
    </div>
  );

  const yearBlock = (
    <div>
      <h3 className='text-xs font-bold uppercase tracking-widest text-slate-400 mb-3'>年份</h3>
      <div className='flex flex-wrap md:grid md:grid-cols-2 gap-2'>
        <button onClick={() => setYear('全部')} className={pill(year === '全部')}>全部</button>
        {years.map(y => (
          <button key={y} onClick={() => setYear(y)} className={pill(year === y)}>{y}</button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* 移动端筛选条 */}
      <div className='md:hidden mb-8 space-y-4 bg-white/70 border border-slate-100 rounded-2xl p-4'>
        {subjectBlock}
        {yearBlock}
      </div>

      <div className='flex flex-col md:flex-row gap-8'>
        {/* 桌面侧栏 */}
        <aside className='w-64 shrink-0 hidden md:block'>
          <div className='sticky top-12 space-y-8'>
            {subjectBlock}
            {yearBlock}
          </div>
        </aside>

        {/* 题目流 */}
        <section className='flex-1 min-w-0'>
          <div className='flex justify-between items-center mb-8'>
            <h2 className='text-xl font-semibold text-slate-800'>
              {subject === '全部' && year === '全部'
                ? '所有题目 (' + filtered.length + ')'
                : '筛选结果 (' + filtered.length + ' / ' + questions.length + ')'}
            </h2>
            <div className='text-xs text-slate-400 font-mono'>Sorted by: Newest</div>
          </div>

          <div className='space-y-6'>
            {filtered.map(q => (
              <QuestionCard key={q.questionId} question={q} />
            ))}
            {filtered.length === 0 && (
              <div className='py-16 text-center text-slate-400'>
                <p className='text-lg mb-2'>该筛选条件下暂无题目</p>
                <p className='text-sm'>试试放宽科目或年份条件。</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}