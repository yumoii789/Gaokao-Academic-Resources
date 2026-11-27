// 抽题引擎：三池划分 + 权重抽题（空池权重再分配）+ 确定性干扰项 + 例句工具
// 对应 proposal §7.2 / §7.3 / §7.4
import type {
  ChoiceOption,
  LearnMode,
  QuizMode,
  QuizQueue,
  QuizRecord,
  RatioSettings,
  VocabWord,
} from './types';

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleSeeded<T>(list: readonly T[], rng: () => number): T[] {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// 权重归一化：三者之和不强制 100，按实际权重占比生效 —— §7.2
export function normalizeWeights(ratio: RatioSettings): RatioSettings {
  const sum = ratio.correct + ratio.wrong + ratio.unseen;
  if (sum <= 0) return { correct: 0.1, wrong: 0.25, unseen: 0.65 };
  return {
    correct: ratio.correct / sum,
    wrong: ratio.wrong / sum,
    unseen: ratio.unseen / sum,
  };
}

export interface PoolSnapshot {
  correct: string[];
  wrong: string[]; // 已按 at 升序（最久未复习优先）
  unseen: string[];
}

// 三池口径：答对 = records[correct]；错题 = records[wrong]；未答 = 总池 − 已答 —— §7.1
export function buildPools(candidateIds: string[], records: Record<string, QuizRecord>): PoolSnapshot {
  const correct: string[] = [];
  const wrong: string[] = [];
  const unseen: string[] = [];
  for (const qid of candidateIds) {
    const rec = records[qid];
    if (!rec) unseen.push(qid);
    else if (rec.status === 'correct') correct.push(qid);
    else wrong.push(qid);
  }
  wrong.sort((a, b) => (records[a]?.at ?? 0) - (records[b]?.at ?? 0));
  return { correct, wrong, unseen };
}

// 按权重预生成一轮队列：逐名额按可用池权重落池，空池权重自动失效（等价于 §7.3 的再分配）；
// 错题池取最久未复习者，其余均匀随机。
export function buildQueue(opts: {
  mode: QuizMode;
  candidateIds: string[];
  records: Record<string, QuizRecord>;
  ratio: RatioSettings;
  size?: number;
}): QuizQueue {
  const size = Math.max(0, opts.size ?? 10);
  const pools = buildPools(opts.candidateIds, opts.records);
  const rng = mulberry32((Date.now() ^ hashSeed(opts.mode + ':' + opts.candidateIds.length)) >>> 0);
  const weights = normalizeWeights(opts.ratio);
  const available: Record<'correct' | 'wrong' | 'unseen', string[]> = {
    correct: pools.correct.slice(),
    wrong: pools.wrong.slice(),
    unseen: shuffleSeeded(pools.unseen, rng),
  };
  const items: string[] = [];
  while (items.length < size) {
    const open = (['correct', 'wrong', 'unseen'] as const).filter((k) => available[k].length > 0);
    if (open.length === 0) break;
    const wSum = open.reduce((acc, k) => acc + weights[k], 0);
    let roll = rng() * (wSum > 0 ? wSum : open.length);
    let picked: 'correct' | 'wrong' | 'unseen' = open[open.length - 1];
    for (const k of open) {
      roll -= wSum > 0 ? weights[k] : 1 / open.length;
      if (roll <= 0) {
        picked = k;
        break;
      }
    }
    items.push(available[picked].shift() as string);
  }
  return { mode: opts.mode, size: items.length, items, pos: 0 };
}

export function wordQids(mode: LearnMode, words: VocabWord[]): string[] {
  return words.map((w) => mode + ':' + w.id);
}

export function parseWordQid(qid: string): { mode: LearnMode; wordId: string } | null {
  const i = qid.indexOf(':');
  if (i <= 0) return null;
  const mode = qid.slice(0, i);
  if (mode !== 'en2zh' && mode !== 'zh2en' && mode !== 'spell') return null;
  return { mode: mode as LearnMode, wordId: qid.slice(i + 1) };
}

export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

// 模式一（英→中）中文干扰项：同书 difficulty ±1 优先、排除重复释义 —— §7.4
export function distractorTranslations(
  answer: VocabWord,
  pool: VocabWord[],
  qid: string,
  count = 3
): string[] {
  const rng = mulberry32(hashSeed(qid));
  const seen = new Set<string>([answer.translation]);
  const candidates = pool.filter(
    (w) => w.id !== answer.id && w.translation && !seen.has(w.translation)
  );
  const near = shuffleSeeded(
    candidates.filter((w) => Math.abs(w.difficulty - answer.difficulty) <= 1),
    rng
  );
  const far = shuffleSeeded(
    candidates.filter((w) => Math.abs(w.difficulty - answer.difficulty) > 1),
    rng
  );
  const out: string[] = [];
  for (const w of [...near, ...far]) {
    if (out.length >= count) break;
    if (seen.has(w.translation)) continue;
    seen.add(w.translation);
    out.push(w.translation);
  }
  return out;
}

// 模式二（中→英）英文干扰项：编辑距离 ≤2 优先，其次同书随机词 —— §7.4
export function distractorWords(
  answer: VocabWord,
  pool: VocabWord[],
  qid: string,
  count = 3
): string[] {
  const rng = mulberry32(hashSeed(qid + ':w'));
  const target = answer.word.toLowerCase();
  const others = pool.filter((w) => w.id !== answer.id && w.word.toLowerCase() !== target);
  const close = shuffleSeeded(
    others.filter((w) => editDistance(w.word.toLowerCase(), target) <= 2),
    rng
  );
  const rest = shuffleSeeded(
    others.filter((w) => editDistance(w.word.toLowerCase(), target) > 2),
    rng
  );
  const out: string[] = [];
  for (const w of [...close, ...rest]) {
    if (out.length >= count) break;
    if (out.some((x) => x.toLowerCase() === w.word.toLowerCase())) continue;
    out.push(w.word);
  }
  return out;
}

// 组装选项：seed 由 qid 决定，刷新后顺序不变；干扰项不足时缩容 —— §7.4
export function buildChoices(correctText: string, distractors: string[], qid: string): ChoiceOption[] {
  const rng = mulberry32(hashSeed(qid + ':c'));
  const options = [correctText, ...distractors.filter((d) => d && d !== correctText)];
  return shuffleSeeded(options, rng).map((text) => ({ text, isCorrect: text === correctText }));
}

// 例句高亮：目标词（不分大小写、词边界）的第一次出现
export function highlightExample(
  example: string,
  word: string
): { before: string; hit: string; after: string } | null {
  if (!example || !word) return null;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('\\b' + escaped + '\\b', 'i').exec(example);
  if (!m) return null;
  return {
    before: example.slice(0, m.index),
    hit: m[0],
    after: example.slice(m.index + m[0].length),
  };
}

// 例句挖空：目标词替换为 ____
export function blankExample(
  example: string,
  word: string
): { before: string; after: string } | null {
  const h = highlightExample(example, word);
  if (!h) return null;
  return { before: h.before, after: h.after };
}

// 词典无结果时的近形词建议
export function nearWords(query: string, pool: VocabWord[], limit = 6): VocabWord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return pool
    .map((w) => ({ w, d: editDistance(w.word.toLowerCase(), q) }))
    .filter((x) => x.d <= 2 || x.w.word.toLowerCase().startsWith(q.slice(0, 3)))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.w);
}
