'use client';

// 词汇工作室 Hub —— proposal §5.1：统计行 + 六入口 glass-card + 抽题设置抽屉。
// 闪卡入口留在本页（视图开关），其余入口为路由链接。
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GRAMMAR_ITEMS, useVocabPool } from '@/lib/vocab/seed';
import { buildPools, wordQids } from '@/lib/vocab/engine';
import { clearQueue, countToday, emptyStore, loadQuizStore, saveQuizStore } from '@/lib/vocab/store';
import type { QuizSettings, QuizStore } from '@/lib/vocab/types';
import QuizSettingsDrawer from './QuizSettings';

interface HubProps {
  onOpenFlashcards: () => void;
}

const ENTRIES: { href: string; emoji: string; title: string; desc: string }[] = [
  { href: '/vocab/dict', emoji: '📖', title: '电子词典', desc: '音标 · 释义 · 例句' },
  { href: '/vocab/learn', emoji: '✍️', title: '记单词', desc: '英译中 / 中译英 / 拼写' },
  { href: '/vocab/grammar', emoji: '🧩', title: '记语法', desc: '完形挖空 · 四选一' },
  { href: '/vocab/translate', emoji: '🌐', title: '在线翻译', desc: '免费 · 无需登录' },
  { href: '/vocab/tutor', emoji: '🤖', title: 'AI 助教', desc: '多轮对话讲词汇语法' },
];

export default function Hub({ onOpenFlashcards }: HubProps) {
  const { words } = useVocabPool();
  const [store, setStore] = useState<QuizStore>(emptyStore);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 挂载后恢复对错记录与设置（避免 SSR/CSR 不匹配）
  useEffect(() => {
    setStore(loadQuizStore());
  }, []);

  const stats = useMemo(() => {
    const candidates = [
      ...wordQids('en2zh', words),
      ...wordQids('zh2en', words),
      ...wordQids('spell', words),
      ...GRAMMAR_ITEMS.map((g) => g.id),
    ];
    const pools = buildPools(candidates, store.records);
    return {
      words: words.length,
      grammar: GRAMMAR_ITEMS.length,
      correct: pools.correct.length,
      wrong: pools.wrong.length,
      unseen: pools.unseen.length,
      today: countToday(store.records),
    };
  }, [store, words]);

  const onChangeSettings = useCallback((settings: QuizSettings) => {
    setStore((prev) => {
      const next = { ...prev, settings };
      saveQuizStore(next);
      return next;
    });
  }, []);

  const onResetRecords = useCallback(() => {
    setStore((prev) => {
      const next = { ...prev, records: {} };
      saveQuizStore(next);
      return next;
    });
    clearQueue();
  }, []);

  return (
    <main className="min-h-screen">
      <header className="pt-12 pb-8 px-6 max-w-4xl mx-auto text-center">
        <div className="mb-6">
          <Link href="/" className="text-xs text-slate-400 hover:text-amber-600 transition-colors">← 返回首页</Link>
        </div>
        <h1 className="academic-title text-4xl sm:text-5xl text-slate-800 mb-3">词汇工作室</h1>
        <p className="text-sm text-slate-500 mb-6">Vocabulary Studio · 把词汇记忆变成一场探索之旅。</p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-500">
          <span>已收录 <b className="font-mono text-amber-700">{stats.words}</b> 词 · 语法 <b className="font-mono text-amber-700">{stats.grammar}</b> 题</span>
          <span>答对 <b className="font-mono text-emerald-600">{stats.correct}</b></span>
          <span>错题 <b className="font-mono text-rose-500">{stats.wrong}</b></span>
          <span>未答 <b className="font-mono text-slate-600">{stats.unseen}</b></span>
          <span>今日已练 <b className="font-mono text-amber-700">{stats.today}</b></span>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="px-3 py-1 rounded-full border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
            aria-label="抽题设置"
          >
            ⚙ 抽题设置
          </button>
        </div>
      </header>

      <section className="px-6 pb-16 max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={onOpenFlashcards}
          className="glass-card rounded-2xl p-5 text-left hover:ring-2 ring-amber-300 transition-all"
        >
          <span className="text-3xl" aria-hidden>🃏</span>
          <h2 className="mt-3 font-medium text-slate-800">闪卡复习</h2>
          <p className="text-xs text-slate-500 mt-1">原有翻卡记忆，进度完整保留</p>
        </button>
        {ENTRIES.map((e) => (
          <Link key={e.href} href={e.href} className="glass-card rounded-2xl p-5 hover:ring-2 ring-amber-300 transition-all">
            <span className="text-3xl" aria-hidden>{e.emoji}</span>
            <h2 className="mt-3 font-medium text-slate-800">{e.title}</h2>
            <p className="text-xs text-slate-500 mt-1">{e.desc}</p>
          </Link>
        ))}
      </section>

      <QuizSettingsDrawer
        open={settingsOpen}
        store={store}
        poolCounts={{ correct: stats.correct, wrong: stats.wrong, unseen: stats.unseen }}
        onChangeSettings={onChangeSettings}
        onResetRecords={onResetRecords}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
