// localStorage 状态：xiaomo-vocab-quiz-v1（设置 + 对/错记录）与 xiaomo-vocab-queue-v1（本轮队列）。
// 与现有闪卡键 xiaomo-vocab-progress-v1 并存、互不迁移 —— proposal §7.1
import type {
  QuizMode,
  QuizQueue,
  QuizRecord,
  QuizSettings,
  QuizStore,
  RatioSettings,
} from './types';

export const QUIZ_KEY = 'xiaomo-vocab-quiz-v1';
export const QUEUE_KEY = 'xiaomo-vocab-queue-v1';

// 抽题默认比例 10 / 25 / 65（权重，可调，按归一化生效）—— proposal §7.2
export const DEFAULT_RATIO: RatioSettings = { correct: 10, wrong: 25, unseen: 65 };

export function defaultSettings(): QuizSettings {
  return { ratio: { ...DEFAULT_RATIO }, book: '', lastMode: 'en2zh' };
}

export function emptyStore(): QuizStore {
  return { settings: defaultSettings(), records: {} };
}

function clampWeight(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  const v = Math.round(n);
  return v < 0 ? 0 : Math.min(v, 100);
}

export function loadQuizStore(): QuizStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = JSON.parse(window.localStorage.getItem(QUIZ_KEY) || 'null') as
      | (Partial<QuizStore> & { settings?: { ratio?: Partial<RatioSettings> } })
      | null;
    if (!raw || typeof raw !== 'object') return emptyStore();
    const settings = defaultSettings();
    const rawSettings = raw.settings;
    if (rawSettings && typeof rawSettings === 'object') {
      const rawRatio = rawSettings.ratio;
      if (rawRatio && typeof rawRatio === 'object') {
        settings.ratio = {
          correct: clampWeight(rawRatio.correct),
          wrong: clampWeight(rawRatio.wrong),
          unseen: clampWeight(rawRatio.unseen),
        };
      }
      if (typeof (rawSettings as { lastMode?: unknown }).lastMode === 'string') {
        settings.lastMode = (rawSettings as { lastMode: string }).lastMode as QuizMode;
      }
      if (typeof rawSettings.book === 'string') settings.book = rawSettings.book;
    }
    const records: Record<string, QuizRecord> = {};
    const rawRecords = raw.records;
    if (rawRecords && typeof rawRecords === 'object') {
      for (const [qid, value] of Object.entries(rawRecords as Record<string, unknown>)) {
        if (!qid) continue;
        const rec = value as Partial<QuizRecord> | null;
        if (!rec || typeof rec !== 'object') continue;
        if (rec.status !== 'correct' && rec.status !== 'wrong') continue;
        records[qid] = {
          status: rec.status,
          chosen: typeof rec.chosen === 'string' ? rec.chosen : '',
          at: typeof rec.at === 'number' ? rec.at : 0,
          mode: (typeof rec.mode === 'string' ? rec.mode : 'en2zh') as QuizMode,
        };
      }
    }
    return { settings, records };
  } catch {
    return emptyStore();
  }
}

export function saveQuizStore(store: QuizStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUIZ_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用（隐私模式等）时静默降级为仅内存
  }
}

export function loadQueue(): QuizQueue | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = JSON.parse(window.localStorage.getItem(QUEUE_KEY) || 'null') as
      | Partial<QuizQueue>
      | null;
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.mode !== 'string' || !Array.isArray(raw.items)) return null;
    const items = raw.items.filter((q): q is string => typeof q === 'string');
    const pos = typeof raw.pos === 'number' && raw.pos >= 0 ? Math.floor(raw.pos) : 0;
    const size = typeof raw.size === 'number' && raw.size > 0 ? Math.floor(raw.size) : items.length;
    return { mode: raw.mode as QuizMode, size, items, pos };
  } catch {
    return null;
  }
}

export function saveQueue(queue: QuizQueue): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function clearQueue(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(QUEUE_KEY);
  } catch {
    // ignore
  }
}

export function applyAnswer(
  store: QuizStore,
  qid: string,
  status: 'correct' | 'wrong',
  chosen: string,
  mode: QuizMode
): QuizStore {
  const records: Record<string, QuizRecord> = {
    ...store.records,
    [qid]: { status, chosen, at: Date.now(), mode },
  };
  return { ...store, records };
}

export function countToday(records: Record<string, QuizRecord>, now = Date.now()): number {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  const start = day.getTime();
  return Object.values(records).filter((r) => r.at >= start).length;
}
