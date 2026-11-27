// 种子词库适配器：把 data/mock_data.json 的 vocab 种子词适配为完整词条 schema。
// 词汇数据管线（/data/vocab/*.json 分片）经 loadVocabLibrary / useVocabPool 挂载：SEED_WORDS 永远兜底，加载失败或离线时页面照常可用。
// 词条 schema 见 docs/vocab-design-proposal.md §6.2；种子词缺音标/逐释义/语法/词形，相关 UI 段落自动隐藏。
import { useEffect, useState } from 'react';
import mockData from '@data/mock_data.json';
import type { GrammarItem, Sense, VocabWord, WordForms } from './types';

interface RawWord {
  word?: string;
  translation?: string;
  example?: string;
  difficulty?: number;
  book?: string;
}

const rawVocab: RawWord[] = ((mockData as { vocab?: RawWord[] }).vocab ?? []).filter(
  (w): w is RawWord => !!w && typeof w === 'object'
);

function adaptWord(raw: RawWord): VocabWord | null {
  const word = (raw.word ?? '').trim();
  if (!word) return null;
  const translation = (raw.translation ?? '').trim();
  const example = (raw.example ?? '').trim();
  const difficulty =
    raw.difficulty === 1 || raw.difficulty === 2 || raw.difficulty === 3 ? raw.difficulty : 2;
  return {
    id: 'mock-' + word.toLowerCase(),
    word,
    translation,
    phoneticUk: '',
    phoneticUs: '',
    difficulty,
    book: (raw.book ?? '').trim() || '高考核心词',
    senses: translation
      ? [{ pos: '', zh: translation, exampleEn: example, exampleZh: '' }]
      : [],
    grammar: '',
    forms: {},
  };
}

export const SEED_WORDS: VocabWord[] = rawVocab
  .map(adaptWord)
  .filter((w): w is VocabWord => w !== null);

export const SEED_BOOK = SEED_WORDS[0]?.book ?? '高考核心词';

// 语法完形种子题库（proposal §6.4 schema；选项预生成，运行时不造选项）
export const GRAMMAR_ITEMS: GrammarItem[] = [
  {
    id: 'gram-gk-0001',
    sentence: 'This is the museum ____ we visited last year.',
    options: ['which', 'where', 'when', 'what'],
    answerIndex: 0,
    analysis: {
      grammar: '先行词 museum 指物，且在从句中作 visited 的宾语，应用关系代词 which/that。',
      sentenceZh: '这就是我们去年参观的那家博物馆。',
      wordGloss: [
        { en: 'museum', zh: 'n. 博物馆' },
        { en: 'visit', zh: 'v. 参观' },
        { en: 'last year', zh: '去年' },
      ],
    },
    difficulty: 2,
    tags: ['定语从句'],
  },
  {
    id: 'gram-gk-0002',
    sentence: 'This is the village ____ my grandfather was born.',
    options: ['which', 'where', 'when', 'what'],
    answerIndex: 1,
    analysis: {
      grammar: '先行词 village 表示地点，且从句中不缺宾语（be born in a place），应用关系副词 where。',
      sentenceZh: '这就是我爷爷出生的那个村庄。',
      wordGloss: [
        { en: 'village', zh: 'n. 村庄' },
        { en: 'grandfather', zh: 'n. 祖父' },
        { en: 'be born', zh: '出生' },
      ],
    },
    difficulty: 2,
    tags: ['定语从句'],
  },
  {
    id: 'gram-gk-0003',
    sentence: 'I still remember the day ____ we first met.',
    options: ['which', 'where', 'when', 'what'],
    answerIndex: 2,
    analysis: {
      grammar: '先行词 day 表示时间，从句主谓宾完整（不缺成分），应用关系副词 when。',
      sentenceZh: '我仍然记得我们初次见面的那一天。',
      wordGloss: [
        { en: 'remember', zh: 'v. 记得' },
        { en: 'meet', zh: 'v. 遇见' },
      ],
    },
    difficulty: 2,
    tags: ['定语从句'],
  },
  {
    id: 'gram-gk-0004',
    sentence: '____ from the top of the mountain, the city looks like a garden.',
    options: ['Seeing', 'Seen', 'To see', 'Having seen'],
    answerIndex: 1,
    analysis: {
      grammar: '主语 the city 与 see 之间是被动关系（城市"被看"），应用过去分词 Seen 作状语。',
      sentenceZh: '从山顶看去，这座城市就像一座花园。',
      wordGloss: [
        { en: 'top', zh: 'n. 顶部' },
        { en: 'mountain', zh: 'n. 山' },
        { en: 'look like', zh: '看起来像' },
      ],
    },
    difficulty: 3,
    tags: ['非谓语动词'],
  },
  {
    id: 'gram-gk-0005',
    sentence: 'The teacher advised us ____ more English after class.',
    options: ['practice', 'practicing', 'to practice', 'practiced'],
    answerIndex: 2,
    analysis: {
      grammar: 'advise sb to do sth 为固定搭配，意为"建议某人做某事"，应用不定式 to practice。',
      sentenceZh: '老师建议我们课后多练习英语。',
      wordGloss: [
        { en: 'advise', zh: 'v. 建议' },
        { en: 'practice', zh: 'v. 练习' },
      ],
    },
    difficulty: 1,
    tags: ['非谓语动词', '固定搭配'],
  },
  {
    id: 'gram-gk-0006',
    sentence: 'By the time we got to the station, the train ____.',
    options: ['left', 'has left', 'had left', 'was leaving'],
    answerIndex: 2,
    analysis: {
      grammar: 'by the time + 一般过去时从句，主句动作发生在"过去之前"，应用过去完成时 had left。',
      sentenceZh: '等我们到车站时，火车已经开走了。',
      wordGloss: [
        { en: 'station', zh: 'n. 车站' },
        { en: 'by the time', zh: '到……的时候' },
      ],
    },
    difficulty: 2,
    tags: ['动词时态'],
  },
  {
    id: 'gram-gk-0007',
    sentence: 'If I ____ you, I would take the chance.',
    options: ['am', 'was', 'were', 'be'],
    answerIndex: 2,
    analysis: {
      grammar: '对现在情况的虚拟语气，be 动词一律用 were（If I were you…）。',
      sentenceZh: '如果我是你，我会抓住这个机会。',
      wordGloss: [
        { en: 'chance', zh: 'n. 机会' },
        { en: 'take the chance', zh: '抓住机会' },
      ],
    },
    difficulty: 2,
    tags: ['虚拟语气'],
  },
  {
    id: 'gram-gk-0008',
    sentence: 'Not until midnight ____ his homework.',
    options: ['he finished', 'did he finish', 'he had finished', 'does he finish'],
    answerIndex: 1,
    analysis: {
      grammar: 'Not until 位于句首时句子需部分倒装（did he finish），且描述过去的一次性动作用一般过去时。',
      sentenceZh: '直到午夜他才完成作业。',
      wordGloss: [
        { en: 'midnight', zh: 'n. 午夜' },
        { en: 'not until', zh: '直到……才' },
      ],
    },
    difficulty: 3,
    tags: ['倒装句'],
  },
  {
    id: 'gram-gk-0009',
    sentence: 'He is ____ honest boy, and everyone believes him.',
    options: ['a', 'an', 'the', '/'],
    answerIndex: 1,
    analysis: {
      grammar: 'honest 的 h 不发音，以元音音素开头；单数可数名词首次泛指用不定冠词 an。',
      sentenceZh: '他是个诚实的孩子，大家都很信任他。',
      wordGloss: [
        { en: 'honest', zh: 'adj. 诚实的' },
        { en: 'believe', zh: 'v. 相信' },
      ],
    },
    difficulty: 1,
    tags: ['冠词'],
  },
  {
    id: 'gram-gk-0010',
    sentence: '____ surprised me most was that he passed the exam.',
    options: ['What', 'That', 'Which', 'It'],
    answerIndex: 0,
    analysis: {
      grammar: '主语从句中缺主语（surprised 的执行者），应用连接代词 What；That 引导从句时不充当句子成分。',
      sentenceZh: '最让我惊讶的是他通过了考试。',
      wordGloss: [
        { en: 'surprise', zh: 'v. 使惊讶' },
        { en: 'pass the exam', zh: '通过考试' },
      ],
    },
    difficulty: 3,
    tags: ['名词性从句'],
  },
  {
    id: 'gram-gk-0011',
    sentence: 'The more you practice, ____ it becomes.',
    options: ['easier', 'the easier', 'more easy', 'the easiest'],
    answerIndex: 1,
    analysis: {
      grammar: '"the + 比较级…, the + 比较级…" 表示"越……越……"；easy 的比较级为 easier。',
      sentenceZh: '你练习得越多，它就变得越容易。',
      wordGloss: [
        { en: 'practice', zh: 'v. 练习' },
        { en: 'become', zh: 'v. 变得' },
      ],
    },
    difficulty: 2,
    tags: ['比较结构'],
  },
  {
    id: 'gram-gk-0012',
    sentence: 'Neither of the answers ____ correct.',
    options: ['are', 'is', 'were', 'be'],
    answerIndex: 1,
    analysis: {
      grammar: 'neither/either/each + of + 复数名词作主语时谓语动词用单数；一般事实用一般现在时 is。',
      sentenceZh: '这两个答案都不正确。',
      wordGloss: [
        { en: 'neither', zh: 'pron. 两者都不' },
        { en: 'correct', zh: 'adj. 正确的' },
      ],
    },
    difficulty: 2,
    tags: ['主谓一致'],
  },
];

// ===== 分片词库挂载（静态导出 /data/vocab/*.json，数据管线产物）=====
// fetch 路径取 STATIC_EXPORT 的 next.config.mjs basePath（Next 不会给 fetch 自动加前缀，同 QuestionBrowser 取数模式）。
const VOCAB_DATA_BASE = '/Gaokao-Academic-Resources/data/vocab';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// 分片词 → 完整词条 schema 的防御性适配：gk688 缺 senses.example/grammar/forms，缺省补空（对应 UI 段落自动隐藏）。
function normalizeShardWord(raw: unknown, fallbackBook: string): VocabWord | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const word = typeof raw.word === 'string' ? raw.word.trim() : '';
  if (!id || !word) return null;
  const senses: Sense[] = Array.isArray(raw.senses)
    ? raw.senses.flatMap((s): Sense[] => {
        if (!isRecord(s)) return [];
        return [
          {
            pos: typeof s.pos === 'string' ? s.pos : '',
            zh: typeof s.zh === 'string' ? s.zh : '',
            exampleEn: typeof s.exampleEn === 'string' ? s.exampleEn : '',
            exampleZh: typeof s.exampleZh === 'string' ? s.exampleZh : '',
          },
        ];
      })
    : [];
  return {
    id,
    word,
    translation: typeof raw.translation === 'string' ? raw.translation : '',
    phoneticUk: typeof raw.phoneticUk === 'string' ? raw.phoneticUk : '',
    phoneticUs: typeof raw.phoneticUs === 'string' ? raw.phoneticUs : '',
    difficulty:
      raw.difficulty === 1 || raw.difficulty === 2 || raw.difficulty === 3 ? raw.difficulty : 2,
    book: typeof raw.book === 'string' && raw.book.trim() ? raw.book.trim() : fallbackBook,
    senses,
    grammar: typeof raw.grammar === 'string' ? raw.grammar : '',
    forms: isRecord(raw.forms) ? (raw.forms as WordForms) : {},
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

let libraryPromise: Promise<VocabWord[]> | null = null;

// 拉取 books.json 清单 → 并行抓各书分片 → 按 headword 合并进 SEED_WORDS 兜底池：
// fillLevel === 'full' 的书替换同 headword 词条（数据更全，id 用分片 id 保证学习进度连续），
// 其余书追加（跳过已有 headword）。任何网络/解析失败都回退 SEED_WORDS，页面不空转。
export function loadVocabLibrary(): Promise<VocabWord[]> {
  if (!libraryPromise) {
    libraryPromise = (async () => {
      try {
        const manifest = (await fetchJson(`${VOCAB_DATA_BASE}/books.json`)) as { books?: unknown };
        const books = Array.isArray(manifest.books) ? manifest.books.filter(isRecord) : [];
        const fetched = await Promise.all(
          books.map(async (book) => {
            const files = Array.isArray(book.chunkFiles)
              ? book.chunkFiles.filter((f): f is string => typeof f === 'string')
              : [];
            const chunks = await Promise.all(files.map((f) => fetchJson(`${VOCAB_DATA_BASE}/${f}`)));
            return {
              replace: book.fillLevel === 'full',
              name: typeof book.name === 'string' && book.name.trim() ? book.name.trim() : String(book.id ?? ''),
              rawWords: chunks.flatMap((c) => {
                const chunkWords = (c as { words?: unknown }).words;
                return Array.isArray(chunkWords) ? chunkWords : [];
              }),
            };
          })
        );
        const pool = SEED_WORDS.slice();
        const byHeadword = new Map<string, number>();
        pool.forEach((w, i) => {
          if (!byHeadword.has(w.word)) byHeadword.set(w.word, i);
        });
        for (const { replace, name, rawWords } of fetched) {
          for (const raw of rawWords) {
            const word = normalizeShardWord(raw, name);
            if (!word) continue;
            const at = byHeadword.get(word.word);
            if (at === undefined) {
              byHeadword.set(word.word, pool.length);
              pool.push(word);
            } else if (replace) {
              pool[at] = word;
            }
          }
        }
        return pool;
      } catch {
        return SEED_WORDS.slice();
      }
    })();
  }
  return libraryPromise;
}

// 客户端 Hook：首帧用 SEED_WORDS 兜底渲染，词库就绪后整体替换（ready 供调用方做时序门禁）。
export interface VocabPool {
  words: VocabWord[];
  ready: boolean;
}

export function useVocabPool(): VocabPool {
  const [pool, setPool] = useState<VocabPool>({ words: SEED_WORDS, ready: false });
  useEffect(() => {
    let alive = true;
    loadVocabLibrary().then((loaded) => {
      if (alive) setPool({ words: loaded, ready: true });
    });
    return () => {
      alive = false;
    };
  }, []);
  return pool;
}
