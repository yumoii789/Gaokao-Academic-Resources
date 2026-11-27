'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { VOCAB_TUTOR_SYSTEM_PROMPT, streamVocabTutor, type VocabChatMessage } from '@/lib/vocab-ai';

const EXAMPLES = [
  'explain 这个词：abandon',
  '分析句子：Not only did he pass the exam, but he also got the highest score.',
  '完形填空总是错一半，有什么提分技巧？',
];

/** 首字超时：45 秒内没有任何增量就中止本轮（方案 §9）。 */
const FIRST_TOKEN_TIMEOUT_MS = 45000;

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600';

export default function VocabTutorPage() {
  const [chat, setChat] = useState<VocabChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const lastMsg = chat.length > 0 ? chat[chat.length - 1] : undefined;

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'end' });
  }, [chat]);

  const runTurn = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setError(null);
      setBusy(true);
      setChat((prev) => [...prev, { role: 'user', content: trimmed }, { role: 'assistant', content: '' }]);
      const controller = new AbortController();
      abortRef.current = controller;
      let gotFirst = false;
      let timedOut = false;
      const timer = window.setTimeout(() => {
        if (!gotFirst) {
          timedOut = true;
          controller.abort();
        }
      }, FIRST_TOKEN_TIMEOUT_MS);
      try {
        await streamVocabTutor(
          [{ role: 'system', content: VOCAB_TUTOR_SYSTEM_PROMPT }, ...chat, { role: 'user', content: trimmed }],
          (t) => {
            gotFirst = true;
            setChat((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: t };
              return next;
            });
          },
          controller.signal,
        );
      } catch (err) {
        if (controller.signal.aborted && !timedOut) {
          // 用户主动停止：保留已生成的部分内容，去掉空占位。
          setChat((prev) => {
            const last = prev[prev.length - 1];
            return last?.role === 'assistant' && last.content === '' ? prev.slice(0, -1) : prev;
          });
        } else {
          // 失败：回滚本轮（用户消息 + 空回复），保留原话供重试。
          setChat((prev) => prev.slice(0, -2));
          setError({
            message: timedOut
              ? 'AI 通道响应超时，请重试'
              : err instanceof TypeError
                ? '网络连接失败，请稍后重试'
                : err instanceof Error && err.message
                  ? err.message
                  : '回答中断了，请重试',
            retry: trimmed,
          });
        }
      } finally {
        window.clearTimeout(timer);
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, chat],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setChat([]);
    setError(null);
    inputRef.current?.focus();
  }, []);

  const retry = useCallback(() => {
    if (!error) return;
    const text = error.retry;
    setError(null);
    void runTurn(text);
  }, [error, runTurn]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    void runTurn(text);
  }, [busy, input, runTurn]);

  return (
    <div className="flex h-screen flex-col bg-[#fffdfa] text-[#1a1a1a] supports-[height:100dvh]:h-dvh">
      <header className="shrink-0 border-b border-amber-100/70 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/vocab"
              className={`inline-flex rounded-full px-1 text-xs text-amber-700 hover:text-amber-800 ${focusRing}`}
            >
              ← 返回词汇工作室
            </Link>
            <h1 className="academic-title mt-0.5 truncate text-lg font-bold text-amber-700">AI 助教 · 墨墨</h1>
          </div>
          {chat.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className={`min-h-[44px] rounded-full border border-amber-200 bg-white px-4 text-xs font-medium text-amber-700 hover:bg-amber-50 ${focusRing}`}
            >
              清空对话
            </button>
          )}
        </div>
      </header>

      <div
        role="log"
        aria-live="polite"
        aria-label="与 AI 助教墨墨的对话"
        className="flex-1 overflow-y-auto px-4 py-5"
      >
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {chat.length === 0 ? (
            <div className="glass-card p-5 sm:p-6">
              <p className="text-sm leading-relaxed text-slate-600">
                你好，我是墨墨 🌱 单词、句子、语法、考试技巧都可以问我。对话只保存在本页内存里，刷新或离开即清空。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => void runTurn(ex)}
                    className={`rounded-full border border-amber-200 bg-white px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 ${focusRing}`}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chat.map((m, i) => {
              if (m.role === 'user') {
                return (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-amber-600 px-4 py-2.5 text-sm leading-relaxed text-white">
                      {m.content}
                    </p>
                  </div>
                );
              }
              const streaming = busy && i === chat.length - 1;
              return (
                <div key={i} className="flex justify-start">
                  <div className="glass-card max-w-[92%] px-4 py-3">
                    {m.content ? (
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                        {m.content}
                        {streaming && <span className="ml-0.5 animate-pulse text-amber-600">▍</span>}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400">
                        <span className="animate-pulse">墨墨思考中…</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} aria-hidden="true" />
        </div>
      </div>

      <div className="shrink-0 border-t border-amber-100/70 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl">
          {error && (
            <div
              role="alert"
              className="mb-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-600"
            >
              <p>{error.message}</p>
              <button
                type="button"
                onClick={retry}
                className={`mt-2 min-h-[44px] rounded-full border border-rose-300 bg-white px-4 text-xs font-medium text-rose-600 hover:bg-rose-100 ${focusRing}`}
              >
                重试这一句
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="输入单词、句子或问题…"
              aria-label="向墨墨提问"
              className="min-h-[44px] w-full resize-none rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm leading-relaxed placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className={`min-h-[44px] shrink-0 rounded-full border border-rose-300 bg-white px-4 text-sm font-medium text-rose-600 hover:bg-rose-100 ${focusRing}`}
              >
                停止
              </button>
            ) : (
              <button
                type="button"
                onClick={send}
                disabled={!input.trim()}
                className={`min-h-[44px] shrink-0 rounded-full bg-amber-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
              >
                发送
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center font-mono text-[11px] text-slate-400">
            Enter 发送 · Shift+Enter 换行 · 历史仅保存在本页内存
          </p>
        </div>
      </div>
    </div>
  );
}
