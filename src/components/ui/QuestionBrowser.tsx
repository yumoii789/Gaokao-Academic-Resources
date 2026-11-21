'use client';

import React, { useMemo, useState } from 'react';
import type { Paper, Question } from '@/types';
import QuestionCard from './QuestionCard';

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export default function QuestionBrowser({
  questions,
  papers,
  accent,
}: {
  questions: Question[];
  papers: Paper[];
  accent: string;
}) {
  const [view, setView] = useState<'paper' | 'questions'>('paper');
  const [subject, setSubject] = useState('全部');
  const [year, setYear] = useState<number | '全部'>('全部');
  const [paperId, setPaperId] = useState<string | null>(null);
  const [paperQuery, setPaperQuery] = useState('');

  const byId = useMemo(() => new Map(questions.map(q => [q.questionId, q])), [questions]);
  const years = useMemo(
    () => Array.from(new Set([...questions.map(q => q.year), ...papers.map(p => p.year)])).sort((a, b) => b - a),
    [questions, papers]
  );
  const subjects = useMemo(
    () => Array.from(new Set([...questions.map(q => q.subject), ...papers.map(p => p.subject)])),
    [questions, papers]
  );
  const paperChoices = useMemo(() => {
    const query = paperQuery.trim().toLowerCase();
    return papers.filter(p =>
      (subject === '全部' || p.subject === subject) &&
      (year === '全部' || p.year === year) &&
      (!query || (p.name + ' ' + (p.source?.path || '')).toLowerCase().includes(query))
    );
  }, [papers, subject, year, paperQuery]);
  const activePaper = view === 'paper'
    ? paperChoices.find(p => p.paperId === paperId) || paperChoices[0] || null
    : null;
  const filtered = useMemo(
    () => questions.filter(q =>
      (subject === '全部' || q.subject === subject) && (year === '全部' || q.year === year)
    ),
    [questions, subject, year]
  );
  const shown: Question[] = activePaper
    ? activePaper.questionIds.map(id => byId.get(id)).filter((q): q is Question => Boolean(q))
    : filtered;

  const pill = (active: boolean) =>
    'px-3 py-1.5 text-sm rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 transition-colors text-left ' +
    (active
      ? 'border-transparent text-white ' + accent
      : 'border-slate-200 text-slate-600 hover:border-slate-400');

  const subjectBlock = (
    <div>
      <h3 className='text-xs font-bold uppercase tracking-widest text-slate-400 mb-3'>科目</h3>
      <div className='flex flex-wrap md:flex-col gap-2'>
        {['全部', ...subjects].map(s => (
          <button key={s} onClick={() => { setSubject(s); setPaperId(null); }} className={pill(subject === s)}>{s}</button>
        ))}
      </div>
    </div>
  );

  const yearBlock = (
    <div>
      <h3 className='text-xs font-bold uppercase tracking-widest text-slate-400 mb-3'>年份</h3>
      <div className='flex flex-wrap gap-2 md:max-h-64 md:overflow-y-auto md:pr-1'>
        <button onClick={() => { setYear('全部'); setPaperId(null); }} className={pill(year === '全部')}>全部</button>
        {years.map(y => (
          <button key={y} onClick={() => { setYear(y); setPaperId(null); }} className={pill(year === y)}>{y}</button>
        ))}
      </div>
    </div>
  );

  const paperBlock = (
    <div>
      <div className='flex items-baseline justify-between mb-3'>
        <h3 className='text-xs font-bold uppercase tracking-widest text-slate-400'>试卷</h3>
        <span className='text-[10px] font-mono text-slate-400'>{papers.length} 份</span>
      </div>
      <div className='flex gap-2 mb-3'>
        <button onClick={() => setView('paper')} className={pill(view === 'paper')}>按试卷</button>
        <button onClick={() => setView('questions')} className={pill(view === 'questions')}>逐题练习</button>
      </div>
      <input
        value={paperQuery}
        onChange={e => { setPaperQuery(e.target.value); setPaperId(null); }}
        placeholder='搜索地区或卷名'
        aria-label='搜索试卷'
        className='w-full mb-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
      />
      <select
        value={activePaper?.paperId || ''}
        onChange={e => { setPaperId(e.target.value || null); setView('paper'); }}
        aria-label='选择试卷'
        className='w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
      >
        <option value=''>选择试卷（{paperChoices.length}）</option>
        {paperChoices.map(p => (
          <option key={p.paperId} value={p.paperId}>
            {p.year} · {p.name}{p.source ? ' · PDF' : ' · ' + p.questionIds.length + '题'}
          </option>
        ))}
      </select>
    </div>
  );

  const source = activePaper?.source;
  const cdnUrl = source
    ? 'https://cdn.jsdelivr.net/gh/' + source.repository + '@main/' + encodePath(source.path)
    : '';
  const rawUrl = source
    ? 'https://raw.githubusercontent.com/' + source.repository + '/main/' + encodePath(source.path)
    : '';
  const githubUrl = source
    ? 'https://github.com/' + source.repository + '/blob/main/' + encodePath(source.path)
    : '';

  return (
    <>
      <div className='md:hidden mb-8 space-y-4 bg-white/70 border border-slate-100 rounded-2xl p-4'>
        {paperBlock}
        {subjectBlock}
        {yearBlock}
      </div>

      <div className='flex flex-col md:flex-row gap-8'>
        <aside className='w-64 shrink-0 hidden md:block'>
          <div className='sticky top-12 space-y-8'>
            {paperBlock}
            {subjectBlock}
            {yearBlock}
          </div>
        </aside>

        <section className='flex-1 min-w-0'>
          <div className='flex justify-between items-baseline mb-6 gap-4'>
            <h2 className='text-xl font-semibold text-slate-800'>
              {activePaper
                ? activePaper.year + ' · ' + activePaper.name
                : view === 'paper'
                  ? '没有匹配的试卷'
                  : subject === '全部' && year === '全部'
                    ? '所有题目 (' + shown.length + ')'
                    : '筛选结果 (' + shown.length + ' / ' + questions.length + ')'}
            </h2>
            <div className='text-xs text-slate-400 font-mono shrink-0'>
              {view === 'paper' ? '完整试卷' : '逐题练习'}
            </div>
          </div>

          {source && (
            <div className='glass-card rounded-2xl overflow-hidden'>
              <div className='flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-white/80'>
                <div className='text-xs text-slate-500'>
                  PDF · {(source.bytes / 1024 / 1024).toFixed(1)} MB · 来源 {source.repository}
                </div>
                <div className='flex gap-3 text-xs font-medium'>
                  <a href={rawUrl} target='_blank' rel='noreferrer' className='text-indigo-600 hover:underline'>打开 PDF</a>
                  <a href={githubUrl} target='_blank' rel='noreferrer' className='text-slate-500 hover:underline'>GitHub 原卷</a>
                </div>
              </div>
              <iframe
                key={cdnUrl}
                src={cdnUrl}
                title={activePaper?.name + ' PDF'}
                className='w-full h-[72vh] min-h-[560px] bg-slate-100'
              />
              <p className='px-4 py-3 text-xs leading-5 text-slate-400 bg-white/70'>
                若内嵌阅读器未加载，请使用上方“打开 PDF”或“GitHub 原卷”。整份原卷包含该卷全部题目。
              </p>
            </div>
          )}

          {!source && (
            <div className='space-y-6'>
              {shown.map((q, i) => (
                <QuestionCard key={q.questionId} question={q} index={activePaper ? i : undefined} />
              ))}
              {(view === 'questions' || activePaper) && shown.length === 0 && (
                <div className='py-16 text-center text-slate-400'>
                  <p className='text-lg mb-2'>该筛选条件下暂无逐题练习</p>
                  <p className='text-sm'>可切换到“按试卷”阅读完整原卷，或放宽筛选条件。</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
