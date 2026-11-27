'use client';

// 单词学习（en2zh / zh2en / spell）—— proposal §5.2-5.4：
// 三模式统一队列（qid = mode:wordId，§7.1 共享一个队列槽），抽题权重 10/25/65；
// en2zh / zh2en 四选一（seeded 干扰项，选项顺序按 qid 稳定），spell 逐字母拼写、第 2 次拼错才记 wrong；
// 队列与答题记录经 localStorage 持久化，刷新后可续答。
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import QuizCard from '@/components/vocab/QuizCard';
import QuizSettingsDrawer from '@/components/vocab/QuizSettings';
import { useVocabPool } from '@/lib/vocab/seed';
import {
  buildQueue,
  buildPools,
  wordQids,
  parseWordQid,
  distractorTranslations,
  distractorWords,
  buildChoices,
  highlightExample,
} from '@/lib/vocab/engine';
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
import type {
  VocabWord,
  Sense,
  LearnMode,
  QuizQueue,
  QuizRecord,
  QuizSettings,
  QuizStore,
} from '@/lib/vocab/types';

const QUEUE_SIZE = 10;
const CIRCLED = ['①', '②', '③', '④', '⑤'];
const MODE_LIST: LearnMode[] = ['en2zh', 'zh2en', 'spell'];
const MODE_META: Record<LearnMode, { icon: string; title: string; desc: string }> = {
  en2zh: { icon: '📖', title: '看词识义', desc: '看英文单词，选出正确的中文释义' },
  zh2en: { icon: '🔍', title: '看义选词', desc: '看中文释义，选出正确的英文单词' },
  spell: { icon: '⌨️', title: '拼写挑战', desc: '看释义提示，逐字母拼出英文单词' },
};

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch {
    // 忽略语音合成失败
  }
}

function SenseLine({ sense, word, index }: { sense: Sense; word: VocabWord; index: number }) {
  const highlight = highlightExample(sense.exampleEn, word.word);
  return (
    <p className='text-sm text-slate-600'>
      <span className='text-amber-600 mr-1'>{CIRCLED[index] ?? '·'}</span>
      {sense.pos ? <span className='text-slate-400 mr-1'>{sense.pos}.</span> : null}
      {sense.zh}
      {highlight ? (
        <span className='block text-xs text-slate-400 mt-0.5'>
          {highlight.before}
          <mark className='bg-amber-100 text-amber-800 rounded px-0.5'>{highlight.hit}</mark>
          {highlight.after}
        </span>
      ) : null}
    </p>
  );
}

function SpellArea({
  word,
  answered,
  record,
  spellWrong,
  lastWrong,
  streakHint,
  onSubmit,
}: {
  word: VocabWord;
  answered: boolean;
  record: QuizRecord | null;
  spellWrong: number;
  lastWrong: string;
  streakHint: boolean;
  onSubmit: (guess: string) => void;
}) {
  const [value, setValue] = useState('');
  const answer = word.word;
  const showHint = spellWrong >= 1 || streakHint;

  if (answered) {
    const guess = record?.chosen ?? '';
    const correct = guess.toLowerCase() === answer.toLowerCase();
    const delta = guess.length - answer.length;
    return (
      <div className='space-y-3'>
        <p className='text-3xl font-semibold text-slate-800 tracking-wide'>{answer}</p>
        <p className={correct ? 'text-sm text-emerald-600' : 'text-sm text-rose-500'}>
          {correct ? '拼写正确 🎉' : '再看看正确拼写'}
        </p>
        {!correct && guess ? (
          <p className='text-sm text-slate-500 break-all'>
            你的拼写：
            {answer.split('').map((ch, i) => (
              <span
                key={i}
                className={guess[i] && guess[i].toLowerCase() === ch.toLowerCase() ? 'text-emerald-600' : 'text-rose-500'}
              >
                {guess[i] ?? '_'}
              </span>
            ))}
            {delta > 0 ? <span className='ml-2 text-rose-500'>（多了 {delta} 个字母）</span> : null}
            {delta < 0 ? <span className='ml-2 text-amber-600'>（还差 {-delta} 个字母）</span> : null}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className='space-y-4'
      onSubmit={(e) => {
        e.preventDefault();
        const guess = value.trim();
        if (!guess) return;
        onSubmit(guess);
        setValue('');
      }}
    >
      {spellWrong >= 1 && lastWrong ? (
        <p className='text-xs text-slate-400'>上一次拼写：{lastWrong}（未计入记录）</p>
      ) : null}
      {showHint ? (
        <p className='text-sm text-amber-600'>
          首字母提示：{answer.charAt(0).toUpperCase()}
          {'·'.repeat(Math.max(answer.length - 1, 0))}
        </p>
      ) : null}
      <input
        type='text'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='输入英文拼写…'
        autoFocus
        className='w-full max-w-xs mx-auto block px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-center text-lg text-slate-800 tracking-wide focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100'
      />
      <button
        type='submit'
        className='px-6 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors'
      >
        提交拼写
      </button>
    </form>
  );
}

export default function LearnPage() {
  const { words, ready } = useVocabPool();
  const restoredRef = useRef(false);
  const WORD_BY_ID = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const [store, setStore] = useState<QuizStore>(emptyStore);
  const [queue, setQueue] = useState<QuizQueue | null>(null);
  const [view, setView] = useState<'select' | 'practice' | 'done'>('select');
  const [spellWrong, setSpellWrong] = useState(0);
  const [lastWrong, setLastWrong] = useState('');
  const [consecWrong, setConsecWrong] = useState(0);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [emptyMsg, setEmptyMsg] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [result, setResult] = useState<{ correct: number; wrong: number; skipped: number; total: number; mode: LearnMode } | null>(null);

  // 挂载：恢复题库
  useEffect(() => {
    setStore(loadQuizStore());
  }, []);

  // 词库就绪后恢复非 grammar 队列（grammar 队列留给 /vocab/grammar，§7.1 单队列槽）；
  // 用就绪后的 WORD_BY_ID 校验，分片 id 的 qid 也能续答；只执行一次。
  useEffect(() => {
    if (!ready || restoredRef.current) return;
    restoredRef.current = true;
    const saved = loadQueue();
    if (saved && saved.mode !== 'grammar') {
      const kept = saved.items.filter((qid) => {
        const parsed = parseWordQid(qid);
        return parsed ? WORD_BY_ID.has(parsed.wordId) : false;
      });
      if (kept.length > 0) {
        const resumed: QuizQueue = { ...saved, items: kept, pos: Math.min(saved.pos, kept.length - 1) };
        saveQueue(resumed);
        setQueue(resumed);
        setView('practice');
      } else {
        clearQueue();
      }
    }
  }, [ready, WORD_BY_ID]);

  const currentWord: VocabWord | null = useMemo(() => {
    if (!queue) return null;
    const parsed = parseWordQid(queue.items[queue.pos]);
    return parsed ? WORD_BY_ID.get(parsed.wordId) ?? null : null;
  }, [queue, WORD_BY_ID]);

  const record: QuizRecord | null = useMemo(() => {
    if (!queue) return null;
    return store.records[queue.items[queue.pos]] ?? null;
  }, [queue, store]);

  const chosen = record?.chosen ?? null;

  const choices = useMemo(() => {
    if (!queue || !currentWord || queue.mode === 'spell') return [];
    const qid = queue.items[queue.pos];
    if (queue.mode === 'en2zh') {
      return buildChoices(currentWord.translation, distractorTranslations(currentWord, words, qid), qid);
    }
    return buildChoices(currentWord.word, distractorWords(currentWord, words, qid), qid);
  }, [queue, currentWord, words]);

  const statuses: ('correct' | 'wrong' | '')[] = useMemo(() => {
    if (!queue) return [];
    return queue.items.map((qid) => store.records[qid]?.status ?? '');
  }, [queue, store]);

  const activeMode: LearnMode = useMemo(() => {
    if (queue) return queue.mode as LearnMode;
    return (MODE_LIST as string[]).includes(store.settings.lastMode) ? (store.settings.lastMode as LearnMode) : 'en2zh';
  }, [queue, store.settings.lastMode]);

  const poolCounts = useMemo(() => {
    const pools = buildPools(wordQids(activeMode, words), store.records);
    return { correct: pools.correct.length, wrong: pools.wrong.length, unseen: pools.unseen.length };
  }, [activeMode, store.records, words]);

  const isLast = queue ? queue.pos >= queue.items.length - 1 : false;

  function resetSpell() {
    setSpellWrong(0);
    setLastWrong('');
  }

  function startPractice(mode: LearnMode) {
    const built = buildQueue({
      mode,
      candidateIds: wordQids(mode, words),
      records: store.records,
      ratio: store.settings.ratio,
      size: QUEUE_SIZE,
    });
    if (built.items.length === 0) {
      setEmptyMsg('当前设置下没有可练习的题目，请先在词典页添加词汇或调整抽题权重。');
      return;
    }
    saveQueue(built);
    setStore((prev) => {
      const next = { ...prev, settings: { ...prev.settings, lastMode: mode } };
      saveQuizStore(next);
      return next;
    });
    setQueue(built);
    setSkipped([]);
    setConsecWrong(0);
    resetSpell();
    setView('practice');
  }

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
    setView('select');
    setSettingsOpen(false);
  }

  function handleChoose(text: string) {
    if (!queue || !currentWord || record) return;
    const qid = queue.items[queue.pos];
    const correctText = queue.mode === 'en2zh' ? currentWord.translation : currentWord.word;
    const isCorrect = text === correctText;
    setStore((prev) => {
      const next = applyAnswer(prev, qid, isCorrect ? 'correct' : 'wrong', text, queue.mode);
      saveQuizStore(next);
      return next;
    });
    setConsecWrong((prev) => (isCorrect ? 0 : prev + 1));
  }

  function handleSpellSubmit(guess: string) {
    if (!queue || !currentWord) return;
    const answer = currentWord.word;
    if (guess.toLowerCase() === answer.toLowerCase()) {
      resetSpell();
      handleChoose(answer);
    } else if (spellWrong === 0) {
      // 第 1 次拼错：只反馈不记录
      setSpellWrong(1);
      setLastWrong(guess);
      setConsecWrong((prev) => prev + 1);
    } else {
      // 第 2 次拼错：以输入作答记 wrong 并揭晓
      resetSpell();
      handleChoose(guess);
    }
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
      setResult({ correct, wrong, skipped: skippedNow.length, total: queue.items.length, mode: queue.mode as LearnMode });
      clearQueue();
      setQueue(null);
      resetSpell();
      setView('done');
    } else {
      const next: QuizQueue = { ...queue, pos: queue.pos + 1 };
      saveQueue(next);
      setQueue(next);
      resetSpell();
    }
  }

  function goPrev() {
    if (!queue || queue.pos === 0) return;
    const prev: QuizQueue = { ...queue, pos: queue.pos - 1 };
    saveQueue(prev);
    setQueue(prev);
    resetSpell();
  }

  function jumpTo(index: number) {
    if (!queue || index < 0 || index >= queue.items.length) return;
    const next: QuizQueue = { ...queue, pos: index };
    saveQueue(next);
    setQueue(next);
    resetSpell();
  }

  function renderPrompt() {
    if (!currentWord || !queue) return null;
    if (queue.mode === 'spell') {
      return (
        <SpellArea
          key={queue.items[queue.pos]}
          word={currentWord}
          answered={record !== null}
          record={record}
          spellWrong={spellWrong}
          lastWrong={lastWrong}
          streakHint={consecWrong >= 2}
          onSubmit={handleSpellSubmit}
        />
      );
    }
    if (queue.mode === 'zh2en') {
      return (
        <div>
          <p className='text-xs text-slate-400 mb-3'>选择对应的英文单词</p>
          <p className='text-2xl text-slate-800 leading-relaxed'>{currentWord.senses[0]?.zh || currentWord.translation}</p>
        </div>
      );
    }
    return (
      <div>
        <p className='text-xs text-slate-400 mb-3'>选出正确的中文释义</p>
        <div className='flex items-center justify-center gap-3'>
          <p className='text-3xl font-semibold text-slate-800'>{currentWord.word}</p>
          <button
            onClick={() => speak(currentWord.word)}
            className='text-lg text-amber-600 hover:text-amber-700 transition-colors'
            aria-label='朗读单词'
          >
            🔊
          </button>
        </div>
        {currentWord.phoneticUk || currentWord.phoneticUs ? (
          <p className='text-sm text-slate-400 mt-2'>
            {currentWord.phoneticUk ? <span className='mr-3'>英 {currentWord.phoneticUk}</span> : null}
            {currentWord.phoneticUs ? <span>美 {currentWord.phoneticUs}</span> : null}
          </p>
        ) : null}
      </div>
    );
  }

  function renderAnalysis() {
    if (!currentWord) return null;
    return (
      <div className='space-y-1.5 text-left'>
        {currentWord.senses.map((s, i) => (
          <SenseLine key={i} sense={s} word={currentWord} index={i} />
        ))}
        {currentWord.grammar ? <p className='text-xs text-slate-400 mt-1'>搭配 / 语法：{currentWord.grammar}</p> : null}
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <main className='min-h-screen bg-gradient-to-b from-amber-50 via-white to-white'>
        <div className='max-w-2xl mx-auto px-4 py-16 text-center'>
          <p className='text-4xl mb-4'>📚</p>
          <h1 className='academic-title text-xl font-semibold text-slate-800 mb-2'>词库为空</h1>
          <p className='text-sm text-slate-500 mb-6'>暂无可学习的词汇，请先在词典页查看词库导入情况。</p>
          <Link
            href='/vocab/dict'
            className='inline-block px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors'
          >
            前往词典
          </Link>
        </div>
      </main>
    );
  }

  if (view === 'select') {
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
          <h1 className='academic-title text-2xl font-semibold text-slate-800 mb-1'>单词学习</h1>
          <p className='text-sm text-slate-500 mb-8'>
            今日已练 {countToday(store.records)} 题 · 选择一个模式开始本轮（每轮 {QUEUE_SIZE} 题）
          </p>
          {emptyMsg ? (
            <p className='mb-6 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700'>{emptyMsg}</p>
          ) : null}
          <div className='grid gap-4'>
            {MODE_LIST.map((mode) => (
              <button
                key={mode}
                onClick={() => startPractice(mode)}
                className='glass-card text-left px-5 py-4 hover:border-amber-300 transition-colors'
              >
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-base font-medium text-slate-800'>
                      <span className='mr-2'>{MODE_META[mode].icon}</span>
                      {MODE_META[mode].title}
                    </p>
                    <p className='text-sm text-slate-500 mt-1'>{MODE_META[mode].desc}</p>
                  </div>
                  <span className='text-xs text-slate-400 shrink-0 ml-3'>{words.length} 词</span>
                </div>
              </button>
            ))}
          </div>
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

  if (view === 'done' && result) {
    return (
      <main className='min-h-screen bg-gradient-to-b from-amber-50 via-white to-white'>
        <div className='max-w-2xl mx-auto px-4 py-16 text-center'>
          <p className='text-4xl mb-4'>{result.wrong === 0 ? '🎉' : '💪'}</p>
          <h1 className='academic-title text-2xl font-semibold text-slate-800 mb-2'>本轮完成</h1>
          <p className='text-sm text-slate-500 mb-8'>
            {MODE_META[result.mode].title} · 共 {result.total} 题 · 今日已练 {countToday(store.records)} 题
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
              onClick={() => startPractice(result.mode)}
              className='px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors'
            >
              再来一轮
            </button>
            <button
              onClick={() => {
                setResult(null);
                setView('select');
              }}
              className='px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm hover:border-amber-300 hover:text-amber-700 transition-colors'
            >
              换个模式
            </button>
          </div>
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

  return (
    <main className='min-h-screen bg-gradient-to-b from-amber-50 via-white to-white'>
      <div className='max-w-2xl mx-auto px-4 py-10'>
        <div className='flex items-center justify-between mb-6'>
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
        {queue && currentWord ? (
          <QuizCard
            title={MODE_META[queue.mode as LearnMode].title}
            index={queue.pos}
            total={queue.items.length}
            prompt={renderPrompt()}
            choices={choices}
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
            keyboard={queue.mode !== 'spell'}
          />
        ) : (
          <div className='glass-card px-6 py-12 text-center'>
            <p className='text-3xl mb-3'>🧭</p>
            <p className='text-sm text-slate-500 mb-6'>本轮队列已失效，请返回重新开始。</p>
            <button
              onClick={() => setView('select')}
              className='px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors'
            >
              返回选择模式
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
