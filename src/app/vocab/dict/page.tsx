'use client';

// 电子词典（§5.2）：按词/释义搜索、难度筛选、随机例词、近形词建议、完整词条卡。
// 数据源为 useVocabPool：SEED_WORDS 即时兜底，静态分片 /data/vocab 加载成功后展示全量词库。
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useVocabPool } from '@/lib/vocab/seed';
import { highlightExample, nearWords } from '@/lib/vocab/engine';
import type { VocabWord, WordForms } from '@/lib/vocab/types';

const DIFF_CLASS: Record<number, string> = {
  1: 'bg-emerald-50 text-emerald-600',
  2: 'bg-amber-50 text-amber-600',
  3: 'bg-rose-50 text-rose-500',
};
const DIFF_LABEL: Record<number, string> = { 1: '基础', 2: '进阶', 3: '冲刺' };
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'];
const FORM_LABELS: { key: keyof WordForms; label: string }[] = [
  { key: 'plural', label: '复数' },
  { key: 'past', label: '过去式' },
  { key: 'pastParticiple', label: '过去分词' },
  { key: 'presentParticiple', label: '现在分词' },
  { key: 'thirdPerson', label: '三单' },
  { key: 'comparative', label: '比较级' },
  { key: 'superlative', label: '最高级' },
];
const FILTER_CHIPS: { value: 'all' | 1 | 2 | 3; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 1, label: '基础' },
  { value: 2, label: '进阶' },
  { value: 3, label: '冲刺' },
];

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function ExampleLine({ example, word }: { example: string; word: string }) {
  const hit = highlightExample(example, word);
  if (!hit) {
    return <p className="text-sm italic text-slate-500">{example}</p>;
  }
  return (
    <p className="text-sm italic text-slate-500">
      {hit.before}
      <mark className="rounded bg-amber-100 px-0.5 text-amber-700 not-italic">{hit.hit}</mark>
      {hit.after}
    </p>
  );
}

function WordCard({ w }: { w: VocabWord }) {
  const forms = FORM_LABELS.map((f) => ({ label: f.label, value: w.forms[f.key] })).filter((f) => !!f.value);
  return (
    <article className="glass-card rounded-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{w.word}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {w.phoneticUs ? <span>美 /{w.phoneticUs}/</span> : null}
            {w.phoneticUk ? <span>英 /{w.phoneticUk}/</span> : null}
            <span className={`rounded-full px-2 py-0.5 text-xs ${DIFF_CLASS[w.difficulty] ?? DIFF_CLASS[2]}`}>
              {DIFF_LABEL[w.difficulty] ?? '进阶'}
            </span>
            <span>{w.book}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => speak(w.word)}
          aria-label={`朗读 ${w.word}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-2 focus-visible:ring-amber-600"
        >
          🔊
        </button>
      </div>

      <p className="mt-3 text-lg text-slate-700">{w.translation}</p>

      {w.senses.length > 0 && (
        <ol className="mt-4 space-y-2">
          {w.senses.map((s, i) => (
            <li key={i} className="text-slate-600">
              <span className="mr-1 text-amber-600">{CIRCLED[i] ?? '·'}</span>
              {s.pos ? <span className="mr-1 text-slate-400">{s.pos}</span> : null}
              {s.zh}
              {s.exampleEn ? <ExampleLine example={s.exampleEn} word={w.word} /> : null}
              {s.exampleZh ? <p className="text-sm text-slate-400">{s.exampleZh}</p> : null}
            </li>
          ))}
        </ol>
      )}

      {w.grammar ? <p className="mt-3 text-sm text-slate-500">语法：{w.grammar}</p> : null}

      {forms.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {forms.map((f) => (
            <span key={f.label} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {f.label} {f.value}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5">
        <Link
          href="/vocab/learn"
          className="inline-flex min-h-[44px] items-center rounded-full bg-amber-600 px-5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
        >
          去练习这个词 →
        </Link>
      </div>
    </article>
  );
}

export default function DictPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 1 | 2 | 3>('all');
  const [featured, setFeatured] = useState<VocabWord | null>(null);
  const { words, ready } = useVocabPool();

  // 词库就绪后随机抽一个例词（避免 SSR/CSR 不匹配；兜底 SEED_WORDS 同样可用）
  useEffect(() => {
    if (!ready || words.length === 0) return;
    setFeatured(words[Math.floor(Math.random() * words.length)] ?? null);
  }, [ready, words]);

  const trimmed = query.trim();
  const q = trimmed.toLowerCase();
  const results = useMemo(() => {
    return words.filter((w) => {
      if (filter !== 'all' && w.difficulty !== filter) return false;
      if (!q) return true;
      return w.word.toLowerCase().includes(q) || w.translation.includes(trimmed);
    });
  }, [q, trimmed, filter, words]);

  const suggestions = useMemo(() => {
    if (results.length > 0 || !q) return [];
    return nearWords(trimmed, words);
  }, [results.length, q, trimmed, words]);

  return (
    <main className="min-h-screen">
      <header className="pt-12 pb-6 px-6 max-w-4xl mx-auto text-center">
        <div className="mb-4">
          <Link href="/vocab" className="text-xs text-slate-400 hover:text-amber-600 transition-colors">← 返回词汇室</Link>
        </div>
        <h1 className="academic-title text-4xl sm:text-5xl text-slate-800 mb-3">电子词典</h1>
        <p className="text-sm text-slate-500">📖 音标 · 释义 · 例句 · 词形变化</p>
      </header>

      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索单词或中文释义…"
          aria-label="搜索单词"
          className="w-full rounded-2xl border border-amber-200 bg-white/80 px-5 py-3 text-slate-700 outline-none transition-colors focus:border-amber-600"
        />

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="难度筛选">
          {FILTER_CHIPS.map((c) => (
            <button
              key={String(c.value)}
              type="button"
              onClick={() => setFilter(c.value)}
              aria-pressed={filter === c.value}
              className={`min-h-[36px] rounded-full px-4 text-sm transition-colors ${
                filter === c.value ? 'bg-amber-600 text-white' : 'bg-white/70 text-slate-500 hover:bg-amber-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {featured !== null && !q && filter === 'all' && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm text-slate-400">今日例词 · 随机</h2>
            <WordCard w={featured} />
          </section>
        )}

        <section className="mt-8">
          {results.length > 0 ? (
            <>
              <h2 className="mb-3 text-sm text-slate-400">
                {q || filter !== 'all' ? `找到 ${results.length} 条` : `全部词条 · ${results.length}`}
              </h2>
              <div className="space-y-5">
                {results.map((w) => (
                  <WordCard key={w.id} w={w} />
                ))}
              </div>
            </>
          ) : (
            <div className="glass-card rounded-3xl p-10 text-center">
              <p className="text-4xl" aria-hidden>🔍</p>
              <p className="mt-3 text-slate-500">
                {words.length === 0 ? '词库暂无词条，等待数据管线接入。' : `没有找到「${trimmed}」相关的词条`}
              </p>
              {suggestions.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm text-slate-400">你是不是想找：</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {suggestions.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setQuery(w.word)}
                        className="rounded-full bg-amber-50 px-4 py-2 text-sm text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        {w.word}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
