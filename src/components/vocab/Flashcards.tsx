'use client';

// 闪卡复习 —— 原 /vocab 页面的完整移植：品牌、交互、进度键
// （xiaomo-vocab-progress-v1 / xiaomo-vocab-index）完全保留；
// 由词汇室 Hub 以视图开关挂载，新增 onBack 返回与空数据/空筛选保护。
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SEED_WORDS } from '@/lib/vocab/seed';

const PROGRESS_KEY = 'xiaomo-vocab-progress-v1';
const INDEX_KEY = 'xiaomo-vocab-index';

interface WordProgress {
  known: boolean;
  reviewedAt: number;
}

type ProgressMap = Record<string, WordProgress>;
type DiffFilter = 'all' | 1 | 2 | 3;

const DIFF_LABEL: Record<number, string> = { 1: '基础', 2: '进阶', 3: '冲刺' };
const DIFF_ACTIVE: Record<number, string> = {
  1: 'bg-emerald-600 border-emerald-600 text-white',
  2: 'bg-amber-600 border-amber-600 text-white',
  3: 'bg-rose-500 border-rose-500 text-white',
};
const DIFF_TEXT: Record<number, string> = { 1: 'text-emerald-600', 2: 'text-amber-600', 3: 'text-rose-500' };

// 例句从 senses[0].exampleEn 派生（VocabWord 无 example 字段），空 senses 返回 ''
function wordExample(w: { senses: { exampleEn: string }[] }): string {
  const s = w.senses[0];
  return s && s.exampleEn ? s.exampleEn : '';
}

function loadProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function Flashcards({ onBack }: { onBack: () => void }) {
  const words = SEED_WORDS;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [filter, setFilter] = useState<DiffFilter>('all');

  // 挂载后从 localStorage 恢复进度与位置（避免 SSR/CSR 不匹配）
  useEffect(() => {
    setProgress(loadProgress());
    const savedIndex = parseInt(localStorage.getItem(INDEX_KEY) || '0', 10);
    if (!isNaN(savedIndex) && savedIndex >= 0 && savedIndex < words.length) {
      setCurrentIndex(savedIndex);
    }
    setHydrated(true);
  }, [words.length]);

  // 位置持久化
  useEffect(() => {
    if (hydrated) localStorage.setItem(INDEX_KEY, String(currentIndex));
  }, [currentIndex, hydrated]);

  const filtered = useMemo(
    () => (filter === 'all' ? words : words.filter((w) => w.difficulty === filter)),
    [words, filter]
  );

  const switchFilter = useCallback((f: DiffFilter) => {
    setFilter(f);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, []);

  const markWord = useCallback((word: string, known: boolean) => {
    setProgress((prev) => {
      const next = { ...prev, [word]: { known, reviewedAt: Date.now() } };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({});
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(INDEX_KEY);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, []);

  const go = useCallback(
    (delta: number) => {
      setIsFlipped(false);
      setCurrentIndex((prev) => Math.min(filtered.length - 1, Math.max(0, prev + delta)));
    },
    [filtered.length]
  );

  // 数据驱动的难度统计（全量视角）
  const diffStats = useMemo(() => {
    const levels = Array.from(new Set(words.map((w) => w.difficulty))).sort((a, b) => a - b);
    return levels.map((lv) => {
      const ws = words.filter((w) => w.difficulty === lv);
      return {
        level: lv,
        label: DIFF_LABEL[lv] || 'L' + lv,
        total: ws.length,
        known: ws.filter((w) => progress[w.word]?.known).length,
      };
    });
  }, [words, progress]);

  // 防越界：数据或筛选变化后索引可能超出范围
  const safeIndex = Math.min(currentIndex, Math.max(0, filtered.length - 1));
  const currentWord = filtered[safeIndex];
  const knownInFilter = filtered.filter((w) => progress[w.word]?.known).length;
  const percent = filtered.length ? Math.round((knownInFilter / filtered.length) * 100) : 0;
  const isKnown = currentWord ? progress[currentWord.word]?.known : undefined;

  return (
    <div className='min-h-screen bg-[#fffdfa] text-[#1a1a1a]'>
      <header className='pt-12 pb-8 px-6 max-w-4xl mx-auto text-center'>
        <button onClick={onBack} className='text-xs text-slate-400 hover:text-amber-600 transition-colors'>← 返回词汇室</button>
        <h1 className='academic-title text-4xl md:text-5xl font-bold text-amber-700 mt-4 mb-4'>Vocabulary Studio</h1>
        <p className='text-slate-500 text-lg leading-relaxed'>把词汇记忆变成一场探索之旅。</p>
      </header>

      <main className='max-w-xl mx-auto px-6 pb-24'>
        {/* 词书统计 + 难度筛选（数据驱动） */}
        <div className='glass-card rounded-2xl p-5 mb-6'>
          <div className='flex justify-between items-baseline mb-3'>
            <h2 className='text-sm font-medium text-slate-600'>词书 · {words[0]?.book}</h2>
            <span className='font-mono text-xs text-slate-400'>共 {words.length} 词</span>
          </div>
          <div className='grid grid-cols-3 gap-2 mb-4'>
            {diffStats.map((s) => (
              <div key={s.level} className='rounded-xl border border-amber-100 bg-white/70 p-3'>
                <div className='flex items-baseline justify-between'>
                  <span className={'text-xs font-medium ' + (DIFF_TEXT[s.level] || 'text-slate-500')}>{s.label}</span>
                  <span className='font-mono text-[10px] text-slate-400'>{s.known}/{s.total}</span>
                </div>
                <div className='mt-2 h-1.5 bg-amber-50 rounded-full overflow-hidden'>
                  <div
                    className='h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-400 to-amber-600'
                    style={{ width: (s.total ? Math.round((s.known / s.total) * 100) : 0) + '%' }}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* 难度筛选 */}
          <div className='flex items-center gap-2 flex-wrap' role='group' aria-label='按难度筛选单词'>
            <span className='text-xs text-slate-400 mr-1'>筛选</span>
            {(['all', 1, 2, 3] as DiffFilter[]).map((f) => {
              const active = filter === f;
              const label = f === 'all' ? '全部' : DIFF_LABEL[f];
              const count = f === 'all' ? words.length : words.filter((w) => w.difficulty === f).length;
              const activeCls = f === 'all' ? 'bg-amber-600 border-amber-600 text-white' : DIFF_ACTIVE[f];
              return (
                <button
                  key={String(f)}
                  onClick={() => switchFilter(f)}
                  aria-pressed={active}
                  className={
                    'px-3 py-1 rounded-full border text-xs font-medium transition-all ' +
                    (active
                      ? activeCls
                      : 'border-amber-100 text-slate-500 hover:border-amber-300 hover:text-amber-700')
                  }
                >
                  {label} · {count}
                </button>
              );
            })}
          </div>
        </div>

        {/* 进度条（当前筛选范围内） */}
        <div className='glass-card rounded-2xl p-4 mb-8'>
          <div className='flex justify-between items-center mb-2 text-xs'>
            <span className='font-mono text-slate-400'>
              已掌握 {knownInFilter} / {filtered.length}
            </span>
            <div className='flex items-center gap-3'>
              <span className='font-mono text-amber-600 font-bold'>{percent}%</span>
              {hydrated && knownInFilter > 0 && (
                <button onClick={resetProgress} className='text-slate-400 hover:text-red-500 transition-colors underline underline-offset-2'>
                  重置
                </button>
              )}
            </div>
          </div>
          <div
            className='h-4 -my-1 bg-amber-50 rounded-full overflow-hidden cursor-pointer'
            title='点击跳转到对应位置'
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              setIsFlipped(false);
              setCurrentIndex(Math.floor(ratio * filtered.length));
            }}
          >
            <div
              className='h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-500'
              style={{ width: percent + '%' }}
            />
          </div>
        </div>

        {currentWord ? (
          <>
            {/* 3D 翻卡 */}
            <div
              role='button'
              tabIndex={0}
              aria-pressed={isFlipped}
              aria-label={'单词卡：' + currentWord.word + (isFlipped ? '，当前显示释义' : '，按回车查看释义')}
              className='relative h-96 w-full perspective-1000 cursor-pointer mb-10 rounded-3xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300'
              onClick={() => setIsFlipped(!isFlipped)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsFlipped(!isFlipped); }
              }}
            >
              <div className={'relative w-full h-full transition-all duration-500 preserve-3d ' + (isFlipped ? 'rotate-y-180' : '')}>
                <div className='absolute inset-0 backface-hidden glass-card rounded-3xl flex flex-col items-center justify-center p-12 border-amber-100 bg-white'>
                  {hydrated && isKnown && (
                    <span className='absolute top-5 right-5 flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full border border-emerald-100'>
                      ✓ 已掌握
                    </span>
                  )}
                  <span
                    className={'absolute top-5 left-5 px-2.5 py-1 text-xs font-medium rounded-full border border-amber-100 bg-white ' + (DIFF_TEXT[currentWord.difficulty] || 'text-slate-500')}
                  >
                    {DIFF_LABEL[currentWord.difficulty] || 'L' + currentWord.difficulty}
                  </span>
                  <span className='text-xs font-mono text-amber-400 mb-4'>WORD</span>
                  <h2 className='text-6xl font-bold text-amber-900 academic-title'>{currentWord.word}</h2>
                  <p className='mt-8 text-slate-400 text-sm'>点击翻页查看释义</p>
                </div>
                <div className='absolute inset-0 backface-hidden rotate-y-180 glass-card rounded-3xl flex flex-col items-center justify-center p-12 border-amber-100 bg-amber-50'>
                  <span className='text-xs font-mono text-amber-600 mb-4'>TRANSLATION</span>
                  <h2 className='text-4xl font-bold text-amber-900 mb-4'>{currentWord.translation}</h2>
                  {wordExample(currentWord) && (
                    <p className='text-slate-600 italic text-center leading-relaxed'>&ldquo;{wordExample(currentWord)}&rdquo;</p>
                  )}
                </div>
              </div>
            </div>

            {/* 认识 / 再看看（翻开后出现） */}
            {isFlipped && (
              <div className='flex justify-center gap-4 mb-8 animate-in fade-in slide-in-from-top-2'>
                <button
                  onClick={(e) => { e.stopPropagation(); markWord(currentWord.word, false); go(1); }}
                  className='px-6 py-2.5 rounded-full border border-amber-200 text-amber-700 hover:bg-amber-50 transition-all font-medium'
                >
                  ↻ 再看看
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); markWord(currentWord.word, true); go(1); }}
                  className='px-6 py-2.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-all font-medium shadow-lg shadow-emerald-200'
                >
                  ✓ 认识
                </button>
              </div>
            )}

            {/* 导航 */}
            <div className='flex justify-between items-center px-4'>
              <button
                onClick={() => go(-1)}
                className='px-6 py-2 rounded-full border border-amber-200 text-amber-700 hover:bg-amber-50 transition-all'
              >上一个</button>
              <span className='text-sm font-mono text-slate-400'>{safeIndex + 1} / {filtered.length}</span>
              <button
                onClick={() => go(1)}
                className='px-6 py-2 rounded-full bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-lg shadow-amber-200'
              >下一个</button>
            </div>
          </>
        ) : (
          <div className='glass-card rounded-3xl p-12 text-center mb-8'>
            <span className='text-4xl' aria-hidden>🃏</span>
            <p className='mt-4 text-slate-500 text-sm'>词库暂时为空 — 等词书数据就绪后再来复习。</p>
            <button onClick={onBack} className='mt-6 px-6 py-2.5 rounded-full bg-amber-600 text-white text-sm hover:bg-amber-700 transition-all'>返回词汇室</button>
          </div>
        )}
      </main>
    </div>
  );
}
