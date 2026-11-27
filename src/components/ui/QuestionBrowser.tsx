'use client';

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { Paper, Question } from '@/types';
import QuestionCard from './QuestionCard';
import StructuredPaper from './StructuredPaper';

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

function pdfMirrorCandidates(repository: string, path: string): string[] {
  const encoded = encodePath(path);
  return [
    'https://cdn.jsdelivr.net/gh/' + repository + '@main/' + encoded,
    'https://fastly.jsdelivr.net/gh/' + repository + '@main/' + encoded,
    'https://raw.gitmirror.com/' + repository + '/main/' + encoded,
    'https://raw.githubusercontent.com/' + repository + '/main/' + encoded,
  ];
}

async function probeMirror(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const head = await fetch(url, { method: 'HEAD', signal: controller.signal });
    if (head.ok) return true;
    const ranged = await fetch(url, { headers: { Range: 'bytes=0-255' }, signal: controller.signal });
    return ranged.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function PdfMirrorFrame({ repository, path, title, onResolved }: {
  repository: string;
  path: string;
  title: string;
  onResolved: (url: string) => void;
}) {
  const candidates = useMemo(() => pdfMirrorCandidates(repository, path), [repository, path]);
  const [probeState, setProbeState] = useState<'probing' | 'ready' | 'failed'>('probing');
  const [mirrorUrl, setMirrorUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    setProbeState('probing');
    setMirrorUrl('');
    (async () => {
      for (const candidate of candidates) {
        const ok = await probeMirror(candidate);
        if (cancelled) return;
        if (ok) {
          setMirrorUrl(candidate);
          setProbeState('ready');
          onResolved(candidate);
          return;
        }
      }
      if (!cancelled) setProbeState('failed');
    })();
    return () => {
      cancelled = true;
    };
  }, [candidates, onResolved]);

  if (probeState === 'ready') {
    return (
      <iframe
        key={mirrorUrl}
        src={mirrorUrl}
        title={title}
        className='w-full h-[72vh] min-h-[560px] bg-slate-100'
      />
    );
  }
  return (
    <div className='flex h-[72vh] min-h-[560px] flex-col items-center justify-center bg-slate-100 text-sm text-slate-500'>
      <div className='mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500' />
      <p>
        {probeState === 'probing'
          ? '正在选择可用的镜像源…'
          : '各镜像源暂时都不可用，可点击上方「打开 PDF」重试，或稍后再试。'}
      </p>
    </div>
  );
}

type SearchItem = [number, string, number, string];
type SearchIndex = {
  papers: { id: string; name: string; year: number; subject: string; track: string }[];
  items: SearchItem[];
};

function searchSnippet(text: string, query: string) {
  const lower = text.toLowerCase();
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const positions = tokens.map(token => lower.indexOf(token)).filter(index => index >= 0);
  const start = Math.max(0, (positions[0] || 0) - 48);
  return (start > 0 ? '…' : '') + text.slice(start, start + 180) + (start + 180 < text.length ? '…' : '');
}

export default function QuestionBrowser({
  questions,
  papers,
  accent,
}: {
  questions: Question[];
  papers: Paper[];
  accent: string;
}) {
  const [view, setView] = useState<'paper' | 'questions' | 'search'>('paper');
  const [subject, setSubject] = useState('全部');
  const [year, setYear] = useState<number | '全部'>('全部');
  const [paperId, setPaperId] = useState<string | null>(null);
  const [paperQuery, setPaperQuery] = useState('');
  const [inlineViewer, setInlineViewer] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [pdfMirrorUrl, setPdfMirrorUrl] = useState('');

  useEffect(() => {
    setPdfMirrorUrl('');
  }, [paperId]);
  const [questionQuery, setQuestionQuery] = useState('');
  const deferredQuery = useDeferredValue(questionQuery);
  const [searchData, setSearchData] = useState<SearchIndex | null>(null);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [focusQuestionId, setFocusQuestionId] = useState<string | null>(null);

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
  const allowedPaperIds = useMemo(() => new Set(papers.map(p => p.paperId)), [papers]);
  useEffect(() => {
    if (view !== 'search' || deferredQuery.trim().length < 2 || searchData) return;
    let cancelled = false;
    setSearchStatus('loading');
    fetch('/Gaokao-Academic-Resources/data/search-index.json')
      .then(response => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(data => {
        if (cancelled) return;
        setSearchData(data);
        setSearchStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setSearchStatus('error');
      });
    return () => { cancelled = true; };
  }, [view, deferredQuery, searchData, searchAttempt]);

  const searchResults = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    if (!searchData || query.length < 2) return { total: 0, items: [] as { paper: SearchIndex['papers'][number]; id: string; number: number; text: string }[] };
    const tokens = query.split(/\s+/).filter(Boolean);
    const hits: { paper: SearchIndex['papers'][number]; id: string; number: number; text: string; score: number }[] = [];
    for (const item of searchData.items) {
      const paper = searchData.papers[item[0]];
      if (!allowedPaperIds.has(paper.id)) continue;
      if (subject !== '全部' && paper.subject !== subject) continue;
      if (year !== '全部' && paper.year !== year) continue;
      const text = item[3].toLowerCase();
      const paperName = paper.name.toLowerCase();
      if (!tokens.every(token => text.includes(token) || paperName.includes(token))) continue;
      const score = (text.includes(query) ? 0 : 8) + (paperName.includes(query) ? 1 : 0) - paper.year / 10000;
      hits.push({ paper, id: item[1], number: item[2], text: item[3], score });
    }
    hits.sort((a, b) => a.score - b.score || b.paper.year - a.paper.year || a.id.localeCompare(b.id));
    return { total: hits.length, items: hits.slice(0, 50).map(({ score: _score, ...item }) => item) };
  }, [searchData, deferredQuery, allowedPaperIds, subject, year]);

  function openSearchResult(paperId: string, questionId: string) {
    setPaperId(paperId);
    setFocusQuestionId(questionId);
    setView('paper');
    setShowOriginal(false);
  }

  const activePaper = view === 'paper'
    ? paperChoices.find(p => p.paperId === paperId) || paperChoices[0] || null
    : null;
  useEffect(() => {
    setShowOriginal(false);
    setInlineViewer(false);
  }, [activePaper?.paperId]);

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
      <div className='flex flex-wrap gap-2 mb-3'>
        <button onClick={() => { setView('paper'); setFocusQuestionId(null); }} className={pill(view === 'paper')}>按试卷</button>
        <button onClick={() => { setView('questions'); setFocusQuestionId(null); }} className={pill(view === 'questions')}>逐题练习</button>
        <button onClick={() => { setView('search'); setPaperId(null); setFocusQuestionId(null); }} className={pill(view === 'search')}>全站搜题</button>
      </div>
      <input
        value={paperQuery}
        onChange={e => { setPaperQuery(e.target.value); setPaperId(null); }}
        placeholder='搜索地区或卷名'
        aria-label='搜索试卷'
        className='w-full mb-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
      />
      {view === 'search' && (
        <div className='mb-3'>
          <input
            value={questionQuery}
            onChange={event => setQuestionQuery(event.target.value)}
            placeholder='输入题干关键词（至少 2 字）'
            aria-label='搜索题目全文'
            enterKeyHint='search'
            className='w-full px-3 py-2 text-base md:text-sm bg-white border border-indigo-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
          />
          <p className='mt-2 text-xs leading-5 text-slate-500'>支持题干、地区与卷名组合搜索，首次检索才加载全文索引。</p>
        </div>
      )}
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
  const githubUrl = source
    ? 'https://github.com/' + source.repository + '/blob/main/' + encodePath(source.path)
    : '';
  const pdfOpenUrl = pdfMirrorUrl || githubUrl;

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
                : view === 'search'
                  ? deferredQuery.trim().length < 2 ? '输入关键词开始搜题' : '题目检索 (' + searchResults.total + ')'
                  : view === 'paper'
                    ? '没有匹配的试卷'
                    : subject === '全部' && year === '全部'
                    ? '所有题目 (' + shown.length + ')'
                    : '筛选结果 (' + shown.length + ' / ' + questions.length + ')'}
            </h2>
            <div className='text-xs text-slate-400 font-mono shrink-0'>
              {view === 'search' ? '全文索引' : view === 'paper' ? '完整试卷' : '逐题练习'}
            </div>
          </div>

          {view === 'search' && (
            <div>
              {deferredQuery.trim().length < 2 && (
                <div className='rounded-2xl border border-slate-200 bg-white/70 px-6 py-12 text-center'>
                  <p className='font-medium text-slate-700'>输入至少两个字，检索全部结构化题目</p>
                  <p className='mt-2 text-sm text-slate-500'>例如“曲柄摇杆”“余弦定理”或“湖南 霍尔元件”。</p>
                </div>
              )}
              {deferredQuery.trim().length >= 2 && searchStatus === 'loading' && (
                <div className='space-y-4' aria-label='正在加载全文索引'>
                  {[0, 1, 2].map(item => <div key={item} className='h-28 animate-pulse rounded-2xl bg-slate-100' />)}
                </div>
              )}
              {searchStatus === 'error' && (
                <div className='rounded-2xl border border-red-100 bg-red-50 px-6 py-8 text-center'>
                  <p className='text-sm text-red-700'>全文索引加载失败，请检查网络后重试。</p>
                  <button onClick={() => setSearchAttempt(value => value + 1)} className='mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm text-white'>重新加载</button>
                </div>
              )}
              {deferredQuery.trim().length >= 2 && searchStatus === 'ready' && searchResults.total === 0 && (
                <div className='py-16 text-center'>
                  <p className='text-lg text-slate-600'>没有找到匹配题目</p>
                  <p className='mt-2 text-sm text-slate-500'>可减少关键词，或重置科目与年份筛选。</p>
                </div>
              )}
              <div className='space-y-4'>
                {searchResults.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => openSearchResult(item.paper.id, item.id)}
                    className='w-full rounded-2xl border border-slate-200 bg-white/80 p-5 text-left transition-colors hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
                  >
                    <span className='block text-xs font-semibold text-indigo-700'>{item.paper.year} · {item.paper.name} · 第 {item.number} 题</span>
                    <span className='mt-2 block text-sm leading-7 text-slate-700'>{searchSnippet(item.text, deferredQuery.trim())}</span>
                    <span className='mt-3 block text-xs font-medium text-slate-500'>打开试卷并定位到此题 →</span>
                  </button>
                ))}
              </div>
              {searchResults.total > 50 && <p className='mt-5 text-center text-xs text-slate-500'>按相关度展示前 50 条，可添加关键词缩小范围。</p>}
            </div>
          )}

          {source && activePaper?.structured && !showOriginal && (
            <StructuredPaper paper={activePaper} focusQuestionId={focusQuestionId} onShowOriginal={() => setShowOriginal(true)} />
          )}

          {source && (!activePaper?.structured || showOriginal) && (
            <div className='glass-card rounded-2xl overflow-hidden'>
              <div className='flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-white/80'>
                <div className='text-xs text-slate-500'>
                  PDF · {(source.bytes / 1024 / 1024).toFixed(1)} MB · 来源 {source.repository}
                </div>
                <div className='flex gap-3 text-xs font-medium'>
                  {showOriginal && activePaper?.structured && (
                    <button onClick={() => setShowOriginal(false)} className='text-indigo-600 hover:underline'>返回逐题</button>
                  )}
                  <button onClick={() => setInlineViewer(v => !v)} className='text-indigo-600 hover:underline'>
                    {inlineViewer ? '关闭内嵌' : '在线阅读'}
                  </button>
                  <a href={pdfOpenUrl} target='_blank' rel='noreferrer' className='text-indigo-600 hover:underline'>打开 PDF</a>
                  <a href={githubUrl} target='_blank' rel='noreferrer' className='text-slate-500 hover:underline'>GitHub 原卷</a>
                </div>
              </div>
              {inlineViewer ? (
                <PdfMirrorFrame
                  key={source.repository + ':' + source.path}
                  repository={source.repository}
                  path={source.path}
                  title={(activePaper?.name || '试卷') + ' PDF'}
                  onResolved={setPdfMirrorUrl}
                />
              ) : (
                <div className='flex min-h-[380px] flex-col items-center justify-center bg-gradient-to-br from-indigo-50/70 to-white px-6 py-12 text-center'>
                  <div className='mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-indigo-600 shadow-sm border border-indigo-100'>PDF</div>
                  <h3 className='text-lg font-semibold text-slate-800'>{activePaper?.name}</h3>
                  <p className='mt-2 max-w-md text-sm leading-6 text-slate-500'>
                    完整原卷包含该卷全部题目。原文件保留在来源仓库，点击后按需加载，不占用本站存储。
                  </p>
                  <button
                    onClick={() => setInlineViewer(true)}
                    className='mt-6 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400'
                  >
                    在线加载原卷
                  </button>
                </div>
              )}
              <p className='px-4 py-3 text-xs leading-5 text-slate-400 bg-white/70'>
                内嵌阅读器会自动在多个镜像源（jsDelivr / fastly / gitmirror / GitHub）中选择可用的一条；若全部失败，请点击“打开 PDF”或“GitHub 原卷”手动重试。
              </p>
            </div>
          )}

          {view !== 'search' && !source && (
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
