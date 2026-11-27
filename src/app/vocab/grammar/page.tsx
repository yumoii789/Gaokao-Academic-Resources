'use client';

// 语法专项（grammar）—— proposal §5.6：
// 无模式选择页：进入即恢复或自动组卷（每轮 10 题）；
// 单句四选一完形填空，干扰项使用题库自带顺序（answerIndex），不做运行时洗牌；
// 答错优先回炉（wrong 池按时间升序），队列与记录 localStorage 持久化。
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import QuizCard from '@/components/vocab/QuizCard';
import QuizSettingsDrawer from '@/components/vocab/QuizSettings';
import { GRAMMAR_ITEMS } from '@/lib/vocab/seed';
import { buildQueue, buildPools } from '@/lib/vocab/engine';
import {
  emptyStore,
  loadQuizStore,
  saveQuizStore,
  loadQueue,
  saveQueue,
  clearQueue,
  applyAnswer,
  countToday,
} from '@/lib/vocab/store';
import type { GrammarItem, QuizQueue, QuizRecord, QuizSettings, QuizStore } from '@/lib/vocab/types';

const QUEUE_SIZE = 10;
const ITEM_BY_ID = new Map(GRAMMAR_ITEMS.map((g) => [g.id, g]));
const DIFF_LABEL: Record<number, string> = { 1: '基础', 2: '进阶', 3: '冲刺' };
const DIFF_CLASS: Record<number, string> = {
  1: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  2: 'bg-amber-50 text-amber-600 border-amber-200',
  3: 'bg-rose-50 text-rose-500 border-rose-200',
};

function SentenceBlank({ sentence }: { sentence: string }) {
  const at = sentence.indexOf('____');
  if (at < 0) return <span>{sentence}</span>;
  return (
    <span>
      {sentence.slice(0, at)}
      <span
        className='inline-block w-16 border-b-2 border-amber-500 mx-1 align-baseline'
        aria-label='待填空格'
      />
      {sentence.slice(at + 4)}
    </span>
  );
}

export default function GrammarPage() {
  const [store, setStore] = useState<QuizStore>(emptyStore);
  const [queue, setQueue] = useState<QuizQueue | null>(null);
  const [view, setView] = useState<'practice' | 'done'>('practice');
  const [skipped, setSkipped] = useState<number[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [result, setResult] = useState<{ correct: number; wrong: number; skipped: number; total: number } | null>(null);

  function startPractice(source: QuizStore) {
    const built = buildQueue({
      mode: 'grammar',
      candidateIds: GRAMMAR_ITEMS.map((g) => g.id),
      records: source.records,
      ratio: source.settings.ratio,
      size: QUEUE_SIZE,
    });
    if (built.items.length === 0) {
      setQueue(null);
      setView('practice');
      return;
    }
    saveQueue(built);
    setStore((prev) => {
      const next = { ...prev, settings: { ...prev.settings, lastMode: 'grammar' as const } };
      saveQuizStore(next);
      return next;
    });
    setQueue(built);
    setSkipped([]);
    setResult(null);
    setView('practice');
  }

  // 挂载：恢复题库；仅续答 grammar 队列（其余模式队列留给 /vocab/learn），否则自动组卷
  useEffect(() => {
    const loaded = loadQuizStore();
    setStore(loaded);
    const saved = loadQueue();
    if (saved && saved.mode === 'grammar') {
      const kept = saved.items.filter((qid) => ITEM_BY_ID.has(qid));
      if (kept.length > 0) {
        const resumed: QuizQueue = { ...saved, items: kept, pos: Math.min(saved.pos, kept.length - 1) };
        saveQueue(resumed);
        setQueue(resumed);
        setView('practice');
      } else {
        clearQueue();
        startPractice(loaded);
      }
    } else {
      startPractice(loaded);
    }
  }, []);

  const item: GrammarItem | null = useMemo(() => {
    if (!queue) return null;
    return ITEM_BY_ID.get(queue.items[queue.pos]) ?? null;
  }, [queue]);

  const record: QuizRecord | null = useMemo(() => {
    if (!queue) return null;
    return store.records[queue.items[queue.pos]] ?? null;
  }, [queue, store]);

  const chosen = record?.chosen ?? null;

  const statuses: ('correct' | 'wrong' | '')[] = useMemo(() => {
    if (!queue) return [];
    return queue.items.map((qid) => store.records[qid]?.status ?? '');
  }, [queue, store]);

  const poolCounts = useMemo(() => {
    const pools = buildPools(
      GRAMMAR_ITEMS.map((g) => g.id),
      store.records,
    );
    return { correct: pools.correct.length, wrong: pools.wrong.length, unseen: pools.unseen.length };
  }, [store.records]);

  const isLast = queue ? queue.pos >= queue.items.length - 1 : false;

  function changeSettings(settings: QuizSettings) {
    setStore((prev) => {
      const next = { ...prev, settings };
      saveQuizStore(next);
      return next;
    });
  }

  function resetRecords() {
    setStore((prev) => {
      const next = { ...prev, records: {} };
      saveQuizStore(next);
      return next;
    });
    clearQueue();
    setQueue(null);
    setResult(null);
    setSkipped([]);
    setSettingsOpen(false);
  }

  function handleChoose(text: string) {
    if (!queue || !item || record) return;
    const qid = queue.items[queue.pos];
    const isCorrect = text === item.options[item.answerIndex];
    setStore((prev) => {
      const next = applyAnswer(prev, qid, isCorrect ? 'correct' : 'wrong', text, 'grammar');
      saveQuizStore(next);
      return next;
    });
  }

  function goNext() {
    if (!queue) return;
    const qid = queue.items[queue.pos];
    let skippedNow = skipped;
    if (!store.records[qid] && !skipped.includes(queue.pos)) {
      // 未作答直接前进 = 跳过，不写记录
      skippedNow = [...skipped, queue.pos];
      setSkipped(skippedNow);
    }
    if (queue.pos >= queue.items.length - 1) {
      let correct = 0;
      let wrong = 0;
      for (const q of queue.items) {
        const r = store.records[q];
        if (r?.status === 'correct') correct += 1;
        else if (r?.status === 'wrong') wrong += 1;
      }
      setResult({ correct, wrong, skipped: skippedNow.length, total: queue.items.length });
      clearQueue();
      setQueue(null);
      setView('done');
    } else {
      const next: QuizQueue = { ...queue, pos: queue.pos + 1 };
      saveQueue(next);
      setQueue(next);
    }
  }

  function goPrev() {
    if (!queue || queue.pos === 0) return;
    const prev: QuizQueue = { ...queue, pos: queue.pos - 1 };
    saveQueue(prev);
    setQueue(prev);
  }

  function jumpTo(index: number) {
    if (!queue || index < 0 || index >= queue.items.length) return;
    const next: QuizQueue = { ...queue, pos: index };
    saveQueue(next);
    setQueue(next);
  }

  function renderPrompt() {
    if (!item) return null;
    return (
      <div>
        <div className='flex items-center justify-center gap-2 mb-4'>
          <span
            className={
              'px-2 py-0.5 rounded-full border text-xs ' +
              (DIFF_CLASS[item.difficulty] ?? 'border-slate-200 text-slate-400')
            }
          >
            {DIFF_LABEL[item.difficulty] ?? 'Lv.' + item.difficulty}
          </span>
          {item.tags.map((tag) => (
            <span key={tag} className='px-2 py-0.5 rounded-full border border-slate-200 text-xs text-slate-400'>
              {tag}
            </span>
          ))}
        </div>
        <p className='text-xl text-slate-800 leading-relaxed text-center'>
          <SentenceBlank sentence={item.sentence} />
        </p>
      </div>
    );
  }

  function renderAnalysis() {
    if (!item) return null;
    return (
      <div className='space-y-2 text-left'>
        <p className='text-sm text-slate-700'>
          <span className='font-medium text-amber-700'>语法：</span>
          {item.analysis.grammar}
        </p>
        <p className='text-sm text-slate-600'>
          <span className='font-medium text-amber-700'>整句：</span>
          {item.analysis.sentenceZh}
        </p>
        <p className='text-sm text-slate-500'>
          <span className='font-medium text-amber-700'>词汇：</span>
          {item.analysis.wordGloss.map((g) => g.en + ' ' + g.zh).join('；')}
        </p>
      </div>
    );
  }

  if (GRAMMAR_ITEMS.length === 0) {
    return (
      <main className='min-h-screen bg-gradient-to-b from-amber-50 via-white to-white'>
        <div className='max-w-2xl mx-auto px-4 py-16 text-center'>
          <p className='text-4xl mb-4'>🧩</p>
          <h1 className='academic-title text-xl font-semibold text-slate-800 mb-2'>语法题库为空</h1>
          <p className='text-sm text-slate-500 mb-6'>暂无可练习的语法题，请先在词库中导入语法条目。</p>
          <Link
            href='/vocab'
            className='inline-block px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors'
          >
            返回词汇室
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className='min-h-screen bg-gradient-to-b from-amber-50 via-white to-white'>
      <div className='max-w-2xl mx-auto px-4 py-10'>
        <div className='flex items-center justify-between mb-2'>
          <Link href='/vocab' className='text-sm text-slate-400 hover:text-amber-600 transition-colors'>
            ← 返回词汇室
          </Link>
          <button
            onClick={() => setSettingsOpen(true)}
            className='w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-amber-600 hover:border-amber-200 transition-colors'
            aria-label='抽题设置'
          >
            ⚙️
          </button>
        </div>

        {view === 'done' && result ? (
          <div className='text-center py-10'>
            <p className='text-4xl mb-4'>{result.wrong === 0 ? '🎉' : '💪'}</p>
            <h1 className='academic-title text-2xl font-semibold text-slate-800 mb-2'>本轮完成</h1>
            <p className='text-sm text-slate-500 mb-8'>
              语法专项 · 共 {result.total} 题 · 今日已练 {countToday(store.records)} 题
            </p>
            <div className='grid grid-cols-3 gap-3 max-w-md mx-auto mb-10'>
              <div className='glass-card px-4 py-5'>
                <p className='text-2xl font-semibold text-emerald-600'>{result.correct}</p>
                <p className='text-xs text-slate-400 mt-1'>答对</p>
              </div>
              <div className='glass-card px-4 py-5'>
                <p className='text-2xl font-semibold text-rose-500'>{result.wrong}</p>
                <p className='text-xs text-slate-400 mt-1'>答错</p>
              </div>
              <div className='glass-card px-4 py-5'>
                <p className='text-2xl font-semibold text-slate-500'>{result.skipped}</p>
                <p className='text-xs text-slate-400 mt-1'>跳过</p>
              </div>
            </div>
            <div className='flex items-center justify-center gap-3'>
              <button
                onClick={() => startPractice(store)}
                className='px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors'
              >
                再来一轮
              </button>
              <Link
                href='/vocab'
                className='px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm hover:border-amber-300 hover:text-amber-700 transition-colors'
              >
                返回词汇室
              </Link>
            </div>
          </div>
        ) : queue && item ? (
          <QuizCard
            title='语法专项 · 完形填空'
            index={queue.pos}
            total={queue.items.length}
            prompt={renderPrompt()}
            choices={item.options.map((text, i) => ({ text, isCorrect: i === item.answerIndex }))}
            chosen={chosen}
            onChoose={handleChoose}
            analysis={renderAnalysis()}
            onPrev={goPrev}
            onNext={goNext}
            canPrev={queue.pos > 0}
            canNext
            nextLabel={isLast ? '查看结果' : undefined}
            statuses={statuses}
            onJump={jumpTo}
            keyboard
          />
        ) : (
          <div className='glass-card px-6 py-12 text-center'>
            <p className='text-3xl mb-3'>🧩</p>
            <h2 className='text-lg font-medium text-slate-800 mb-2'>语法专项</h2>
            <p className='text-sm text-slate-500 mb-6'>
              单句四选一完形填空，每轮 {QUEUE_SIZE} 题，答错的题会优先回炉。
            </p>
            <button
              onClick={() => startPractice(store)}
              className='px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors'
            >
              重新开始
            </button>
          </div>
        )}
      </div>
      <QuizSettingsDrawer
        open={settingsOpen}
        store={store}
        poolCounts={poolCounts}
        onChangeSettings={changeSettings}
        onResetRecords={resetRecords}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
