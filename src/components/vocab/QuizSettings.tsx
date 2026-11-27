'use client';

// 抽题设置抽屉 —— proposal §5.1 / §7.2：
// 三池权重滑杆（不必加和为 100，展示归一化占比）+ 恢复默认 + 清空对错记录。
import React, { useEffect } from 'react';
import { DEFAULT_RATIO } from '@/lib/vocab/store';
import type { QuizSettings, QuizStore } from '@/lib/vocab/types';

interface QuizSettingsDrawerProps {
  open: boolean;
  store: QuizStore;
  poolCounts: { correct: number; wrong: number; unseen: number };
  onChangeSettings: (settings: QuizSettings) => void;
  onResetRecords: () => void;
  onClose: () => void;
}

const ROWS: { key: 'correct' | 'wrong' | 'unseen'; label: string; hint: string; color: string }[] = [
  { key: 'correct', label: '已答对', hint: '巩固已掌握的词', color: 'text-emerald-600' },
  { key: 'wrong', label: '答错题', hint: '优先最久未复习的错题', color: 'text-rose-500' },
  { key: 'unseen', label: '未答新题', hint: '开拓新词', color: 'text-amber-600' },
];

export default function QuizSettingsDrawer({ open, store, poolCounts, onChangeSettings, onResetRecords, onClose }: QuizSettingsDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const ratio = store.settings.ratio;
  const sum = ratio.correct + ratio.wrong + ratio.unseen;
  const pct = (n: number) => (sum > 0 ? Math.round((n / sum) * 100) + '%' : '—');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="抽题设置">
      <button type="button" aria-label="关闭设置" onClick={onClose} className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm cursor-default" />
      <div className="relative glass-card rounded-3xl w-full sm:max-w-md m-4 p-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="academic-title text-xl text-slate-800">抽题设置</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-amber-50 text-slate-400 hover:text-amber-600 text-lg" aria-label="关闭">✕</button>
        </div>

        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          三池权重不必加和为 100，实际按归一化占比生效；某池抽尽后，其权重自动分配给其余池。
        </p>

        <div className="space-y-5 mb-6">
          {ROWS.map((row) => (
            <div key={row.key}>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor={'ratio-' + row.key} className="text-sm font-medium text-slate-700">
                  {row.label} <span className="text-xs font-normal text-slate-400">· {row.hint}</span>
                </label>
                <span className={'text-sm font-mono font-bold ' + row.color}>
                  {ratio[row.key]} <span className="text-xs text-slate-400">({pct(ratio[row.key])})</span>
                </span>
              </div>
              <input
                id={'ratio-' + row.key}
                type="range"
                min={0}
                max={100}
                step={5}
                value={ratio[row.key]}
                onChange={(e) => onChangeSettings({ ...store.settings, ratio: { ...ratio, [row.key]: Number(e.target.value) } })}
                className="w-full accent-amber-600"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">现有 {poolCounts[row.key]} 题</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onChangeSettings({ ...store.settings, ratio: { ...DEFAULT_RATIO } })}
            className="px-4 py-2 rounded-full border border-amber-200 text-sm text-amber-800 hover:bg-amber-50 transition-colors"
          >
            恢复默认 10/25/65
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('确定清空全部答对/答错记录吗？此操作不可恢复。')) onResetRecords();
            }}
            className="px-4 py-2 rounded-full border border-rose-200 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
          >
            清空对错记录
          </button>
        </div>
      </div>
    </div>
  );
}
