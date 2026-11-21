'use client';

import React, { useState, useEffect, useCallback } from 'react';
import mockData from '@data/mock_data.json';
import Link from 'next/link';

const PROGRESS_KEY = 'xiaomo-vocab-progress-v1';
const INDEX_KEY = 'xiaomo-vocab-index';

interface WordProgress {
  known: boolean;
  reviewedAt: number;
}

type ProgressMap = Record<string, WordProgress>;

function loadProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function VocabPage() {
  const words = mockData.vocab;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [hydrated, setHydrated] = useState(false);

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

  const markWord = useCallback((word: string, known: boolean) => {
    setProgress(prev => {
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

  const go = useCallback((delta: number) => {
    setIsFlipped(false);
    setCurrentIndex(prev => Math.min(words.length - 1, Math.max(0, prev + delta)));
  }, [words.length]);

  const currentWord = words[currentIndex];
  const knownCount = words.filter(w => progress[w.word]?.known).length;
  const percent = words.length ? Math.round((knownCount / words.length) * 100) : 0;
  const isKnown = progress[currentWord.word]?.known;

  return (
    <div className='min-h-screen bg-[#fffdfa] text-[#1a1a1a]'>
      <header className='pt-12 pb-8 px-6 max-w-4xl mx-auto text-center'>
        <Link href='/' className='text-xs text-slate-400 hover:text-amber-600 transition-colors'>← 返回首页</Link>
        <h1 className='academic-title text-5xl font-bold text-amber-700 mt-4 mb-4'>Vocabulary Studio</h1>
        <p className='text-slate-500 text-lg leading-relaxed'>把词汇记忆变成一场探索之旅。</p>
      </header>

      {/* 进度条 */}
      <main className='max-w-xl mx-auto px-6 pb-24'>
        <div className='glass-card rounded-2xl p-4 mb-8'>
          <div className='flex justify-between items-center mb-2 text-xs'>
            <span className='font-mono text-slate-400'>已掌握 {knownCount} / {words.length}</span>
            <div className='flex items-center gap-3'>
              <span className='font-mono text-amber-600 font-bold'>{percent}%</span>
              {hydrated && knownCount > 0 && (
                <button onClick={resetProgress} className='text-slate-400 hover:text-red-500 transition-colors underline underline-offset-2'>
                  重置
                </button>
              )}
            </div>
          </div>
          <div className='h-2 bg-amber-50 rounded-full overflow-hidden'>
            <div
              className='h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-500'
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* 3D 翻卡 */}
        <div
          className='relative h-96 w-full perspective-1000 cursor-pointer mb-10'
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className={'relative w-full h-full transition-all duration-500 preserve-3d ' + (isFlipped ? 'rotate-y-180' : '')}>
            <div className='absolute inset-0 backface-hidden glass-card rounded-3xl flex flex-col items-center justify-center p-12 border-amber-100 bg-white'>
              {hydrated && isKnown && (
                <span className='absolute top-5 right-5 flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full border border-emerald-100'>
                  ✓ 已掌握
                </span>
              )}
              <span className='text-xs font-mono text-amber-400 mb-4'>WORD</span>
              <h2 className='text-6xl font-bold text-amber-900 academic-title'>{currentWord.word}</h2>
              <p className='mt-8 text-slate-400 text-sm'>点击翻页查看释义</p>
            </div>
            <div className='absolute inset-0 backface-hidden rotate-y-180 glass-card rounded-3xl flex flex-col items-center justify-center p-12 border-amber-100 bg-amber-50'>
              <span className='text-xs font-mono text-amber-600 mb-4'>TRANSLATION</span>
              <h2 className='text-4xl font-bold text-amber-900 mb-4'>{currentWord.translation}</h2>
              <p className='text-slate-600 italic text-center leading-relaxed'>&ldquo;{currentWord.example}&rdquo;</p>
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
          <span className='text-sm font-mono text-slate-400'>{currentIndex + 1} / {words.length}</span>
          <button
            onClick={() => go(1)}
            className='px-6 py-2 rounded-full bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-lg shadow-amber-200'
          >下一个</button>
        </div>
      </main>
      <style jsx>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}
