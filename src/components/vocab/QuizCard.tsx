'use client';

// 通用答题机（四选一）—— proposal §5.5：
// 答对 → 绿色反馈并记 correct；答错 → "你选了 X / 正确答案 Y"；
// 解析答后自动展开（未答可手动展开）；上一个/下一个常驻；
// 键盘 1-4 / A-D 选择、Enter 下一个、← 上一个（输入框聚焦时不拦截）—— §10。
import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChoiceOption } from '@/lib/vocab/types';

const LETTERS = ['A', 'B', 'C', 'D'];

interface QuizCardProps {
  title: string;
  index: number;
  total: number;
  prompt: ReactNode;
  choices: ChoiceOption[];
  chosen: string | null;
  onChoose: (text: string) => void;
  analysis: ReactNode;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  nextLabel?: string;
  statuses: ('correct' | 'wrong' | '')[];
  onJump?: (index: number) => void;
  keyboard?: boolean;
}

export default function QuizCard(props: QuizCardProps) {
  const { title, index, total, prompt, choices, chosen, onChoose, analysis, onPrev, onNext, canPrev, canNext, nextLabel, statuses, onJump, keyboard } = props;
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    if (chosen !== null) setShowAnalysis(true);
  }, [chosen]);

  // 键盘作答；输入控件聚焦时跳过，避免拼写模式的回车提交被拦截
  useEffect(() => {
    if (!keyboard) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const numIdx = ['1', '2', '3', '4'].indexOf(e.key);
      const alphaIdx = ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
      const idx = numIdx >= 0 ? numIdx : alphaIdx;
      if (idx >= 0 && idx < choices.length) {
        if (chosen === null) {
          e.preventDefault();
          onChoose(choices[idx].text);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onNext();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const answered = chosen !== null;
  const chosenIdx = answered ? choices.findIndex((c) => c.text === chosen) : -1;
  const correctIdx = choices.findIndex((c) => c.isCorrect);

  return (
    <section className="max-w-2xl mx-auto" aria-label={title}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-amber-800">{title}</h2>
        <p className="text-xs text-slate-500 font-mono">
          第 {index} / {total} 题
        </p>
      </div>

      <div className="flex gap-1 mb-6" role="group" aria-label="答题进度">
        {statuses.map((s, i) => (
          <button
            key={i}
            type="button"
            aria-label={'第' + (i + 1) + '题' + (s === 'correct' ? '，已答对' : s === 'wrong' ? '，已答错' : '，未作答')}
            onClick={() => onJump?.(i)}
            className={
              'h-2 flex-1 rounded-full transition-all ' +
              (s === 'correct'
                ? 'bg-emerald-500 '
                : s === 'wrong'
                  ? 'bg-rose-400 '
                  : i === index - 1
                    ? 'bg-amber-500 '
                    : 'bg-amber-100 ') +
              (onJump ? 'cursor-pointer hover:opacity-75' : 'cursor-default')
            }
          />
        ))}
      </div>

      <div className="glass-card rounded-3xl p-6 sm:p-8 mb-4">{prompt}</div>

      <div className="space-y-3 mb-4" role="group" aria-label="选项">
        {choices.map((c, i) => {
          const isChosen = i === chosenIdx;
          const isCorrect = i === correctIdx;
          let cls = 'border-amber-100 bg-white/70 text-slate-700 hover:border-amber-300 hover:bg-amber-50/70 cursor-pointer';
          if (answered) {
            if (isCorrect) cls = 'border-emerald-500 bg-emerald-50 text-emerald-800';
            else if (isChosen) cls = 'border-rose-400 bg-rose-50 text-rose-700';
            else cls = 'border-amber-100 bg-white/60 text-slate-400 opacity-70 cursor-not-allowed';
          }
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              aria-pressed={isChosen}
              onClick={() => onChoose(c.text)}
              className={'w-full text-left px-4 py-3 rounded-2xl border transition-all flex items-center gap-3 min-h-[44px] ' + cls}
            >
              <span
                className={
                  'font-mono text-xs font-bold ' +
                  (answered && isCorrect ? 'text-emerald-600' : answered && isChosen ? 'text-rose-500' : 'text-amber-600')
                }
              >
                {LETTERS[i]}.
              </span>
              <span className="flex-1">{c.text}</span>
              {answered && isCorrect && <span aria-hidden>✓</span>}
              {answered && isChosen && !isCorrect && <span aria-hidden>✗</span>}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="mb-4 min-h-[24px]">
        {answered ? (
          chosenIdx >= 0 && choices[chosenIdx]?.isCorrect ? (
            <p className="text-sm font-medium text-emerald-700">✓ 回答正确</p>
          ) : (
            <div className="text-sm space-y-1">
              <p className="text-rose-600 font-medium">✗ 你选了 {chosenIdx >= 0 ? LETTERS[chosenIdx] + '. ' : ''}{chosen}</p>
              {correctIdx >= 0 && (
                <p className="text-emerald-700">✓ 正确答案：{LETTERS[correctIdx]}. {choices[correctIdx].text}</p>
              )}
            </div>
          )
        ) : (
          <p className="text-xs text-slate-400">未作答 — 点击下一个将跳过本题（不计入记录）</p>
        )}
      </div>

      {showAnalysis || answered ? (
        <div className="rounded-2xl border border-amber-100 bg-white/70 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-amber-700 tracking-widest">解析</h3>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-amber-600"
              onClick={() => setShowAnalysis((v) => !v)}
            >
              {showAnalysis ? '收起' : '展开'}
            </button>
          </div>
          <div className="text-sm text-slate-700 space-y-2 leading-relaxed">{analysis}</div>
        </div>
      ) : (
        <div className="mb-6">
          <button
            type="button"
            className="text-sm text-amber-700 hover:text-amber-800 underline underline-offset-4"
            onClick={() => setShowAnalysis(true)}
          >
            查看解析
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className={'px-5 py-2.5 rounded-full border border-amber-200 text-sm text-amber-800 bg-white/70 transition-all ' + (canPrev ? 'hover:bg-amber-50' : 'opacity-40 cursor-not-allowed')}
        >
          ← 上一个
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className={'px-6 py-2.5 rounded-full bg-amber-600 text-white text-sm font-medium shadow-sm transition-all ' + (canNext ? 'hover:bg-amber-700' : 'opacity-40 cursor-not-allowed')}
        >
          {nextLabel ?? '下一个 →'}
        </button>
      </div>
    </section>
  );
}
