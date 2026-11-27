'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MYMEMORY_DAILY_LIMIT,
  TRANSLATE_MAX_CHARS,
  readTranslateUsage,
  translateWithFallback,
  type TranslateDirection,
  type TranslationResult,
} from '@/lib/vocab-ai';

const DIRECTIONS: { id: TranslateDirection; label: string; ariaLabel: string }[] = [
  { id: 'en2zh', label: '英 → 汉', ariaLabel: '切换为英语译中文' },
  { id: 'zh2en', label: '汉 → 英', ariaLabel: '切换为中文译英语' },
];

const REQUEST_TIMEOUT_MS = 20000;

type CopyTarget = 'result' | 'source';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600';

export default function VocabTranslatePage() {
  const [dir, setDir] = useState<TranslateDirection>('en2zh');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<{ target: CopyTarget; ok: boolean } | null>(null);
  const [usage, setUsage] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setUsage(readTranslateUsage());
    setHydrated(true);
    return () => abortRef.current?.abort();
  }, []);

  const busy = status === 'loading';

  const switchDir = (next: TranslateDirection) => {
    if (next === dir) return;
    setDir(next);
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  const doTranslate = useCallback(async () => {
    const text = source.trim();
    if (!text || busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    setStatus('loading');
    setError(null);
    setResult(null);
    setCopyState(null);
    try {
      const out = await translateWithFallback(text, dir, controller.signal);
      setResult(out);
      setStatus('done');
      setUsage(readTranslateUsage());
    } catch (err) {
      if (controller.signal.aborted && !timedOut) return; // 被新一轮请求取代，静默退出
      setStatus('error');
      setError(
        timedOut
          ? '翻译服务响应超时，请稍后重试'
          : err instanceof Error && err.message
            ? err.message
            : '翻译失败，请稍后重试',
      );
    } finally {
      window.clearTimeout(timer);
    }
  }, [busy, dir, source]);

  const copy = useCallback(async (text: string, target: CopyTarget) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState({ target, ok: true });
    } catch {
      setCopyState({ target, ok: false });
    }
    window.setTimeout(() => {
      setCopyState((prev) => (prev && prev.target === target ? null : prev));
    }, 2000);
  }, []);

  return (
    <div className="min-h-screen bg-[#fffdfa] px-4 py-6 text-[#1a1a1a] sm:py-10">
      <div className="mx-auto w-full max-w-xl">
        <header>
          <Link
            href="/vocab"
            className={`inline-flex items-center rounded-full px-2 py-1 -ml-2 text-sm text-amber-700 hover:text-amber-800 ${focusRing}`}
          >
            ← 返回词汇工作室
          </Link>
          <h1 className="academic-title mt-3 text-2xl font-bold text-amber-700 sm:text-3xl">在线翻译</h1>
          <p className="mt-1 text-sm text-slate-500">
            英汉互译 · 默认 MyMemory 免费通道，失败自动切换 AI 备用通道，无需配置密钥。
          </p>
        </header>

        <section className="glass-card mt-6 p-5 sm:p-6" aria-label="翻译设置">
          <div role="group" aria-label="翻译方向">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">翻译方向</span>
            <div className="mt-2 flex rounded-full border border-amber-200 bg-white p-1">
              {DIRECTIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={dir === d.id}
                  aria-label={d.ariaLabel}
                  onClick={() => switchDir(d.id)}
                  className={`min-h-[44px] flex-1 rounded-full px-4 text-sm font-medium transition-colors ${focusRing} ${
                    dir === d.id ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <label
            htmlFor="translate-source"
            className="mt-5 block text-xs font-medium uppercase tracking-wide text-slate-400"
          >
            原文
          </label>
          <textarea
            id="translate-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            maxLength={TRANSLATE_MAX_CHARS}
            rows={5}
            dir="auto"
            placeholder={dir === 'en2zh' ? '输入要翻译的英语…' : '输入要翻译的中文…'}
            className="mt-2 w-full resize-y rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm leading-relaxed placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="font-mono text-xs text-slate-400" aria-live="polite">
              {source.length} / {TRANSLATE_MAX_CHARS}
            </span>
            {hydrated && (
              <span className="font-mono text-xs text-slate-400" title="MyMemory 匿名账户每日免费额度">
                今日已用 {usage} / {MYMEMORY_DAILY_LIMIT.toLocaleString('zh-CN')} 字符
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => void doTranslate()}
            disabled={!source.trim() || busy}
            className={`mt-4 min-h-[44px] w-full rounded-full bg-amber-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          >
            {busy ? '翻译中…' : '翻 译'}
          </button>
        </section>

        <section aria-live="polite" className="mt-5">
          {busy && (
            <div className="glass-card p-5 text-sm text-slate-500">
              <span className="animate-pulse">正在翻译…</span>
            </div>
          )}

          {status === 'error' && error && (
            <div className="glass-card border border-rose-200 p-5">
              <p className="text-sm font-medium text-rose-600">{error}</p>
              <p className="mt-1 text-xs text-slate-500">可稍后重试，或先复制原文留存。</p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void copy(source, 'source')}
                  className={`min-h-[44px] rounded-full border border-amber-200 bg-white px-4 text-xs font-medium text-amber-700 hover:bg-amber-50 ${focusRing}`}
                >
                  {copyState?.target === 'source' ? (copyState.ok ? '已复制 ✓' : '复制失败，请手动选择') : '复制原文'}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="glass-card p-5">
              <div className="flex items-start justify-between gap-3">
                <p
                  lang={dir === 'en2zh' ? 'zh-CN' : 'en'}
                  className="whitespace-pre-wrap break-words text-base leading-relaxed text-slate-700"
                >
                  {result.text}
                </p>
                <button
                  type="button"
                  onClick={() => void copy(result.text, 'result')}
                  className={`shrink-0 rounded-full border border-amber-200 bg-white px-4 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 ${focusRing}`}
                >
                  {copyState?.target === 'result' ? (copyState.ok ? '已复制 ✓' : '复制失败') : '复制'}
                </button>
              </div>
              <p className="mt-3 font-mono text-xs text-slate-400">
                {result.provider}
                {result.degraded ? '（已自动降级）' : ''}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
