/**
 * 词汇工作室 AI 能力层：AI 助教多轮流式对话 + 在线翻译（MyMemory 默认，失败降级 AI 通道）。
 * 设计依据：docs/vocab-design-proposal.md §5.6 / §5.7 / §8 / §9。
 */
import { streamTutor, type TutorMessage } from './ai';

/* ------------------------------------------------------------------ */
/* AI 助教（方案 §5.7 / §9）                                            */
/* ------------------------------------------------------------------ */

/** 方案 §5.7 定稿系统提示词。 */
export const VOCAB_TUTOR_SYSTEM_PROMPT = `你是小墨高考「词汇工作室」的 AI 助教，名叫墨墨。你的学生是中国高考考生。
1) 范围：只回答英语词汇、语法、例句、考试技巧相关的问题；无关话题礼貌拒绝并引导回学习。
2) 学生发来一个单词时：给英/美音标、词性、高考范围内的核心释义（不超过 4 条）、1 个原创例句+中文翻译、常用搭配、1-2 个易混词辨析。
3) 学生发来一个句子时：先指出句子主干（主谓宾/主系表），再逐层说明修饰成分与从句类型（用课本术语：定语从句、状语从句、非谓语等），最后给整句翻译。
4) 启发式：学生直接索要答案时，先给一个提示并确认；学生明确要求完整解释时才给全量。
5) 语言：用中文讲解；术语与高考课本一致；例句难度控制在高考大纲内。
6) 格式：先一句话结论，再分点展开；不使用表格；总长度不超过 300 字，除非学生要求展开。
7) 若学生消息中带有 [上下文] 标注的题目或单词内容，优先围绕它解答。`;

/** 前端会话消息（assistant 角色仅在请求体里需要；共享通道类型不含该角色，经窄化透传）。 */
export interface VocabChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 保留系统提示词 + 最近 maxRounds 轮（一问一答为一轮，方案 §9）。 */
export function trimChatHistory(messages: VocabChatMessage[], maxRounds = 10): VocabChatMessage[] {
  const system = messages.filter((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system' && m.content.trim() !== '');
  return [...system, ...rest.slice(-maxRounds * 2)];
}

/** 复用共享 SSE 通道（src/lib/ai.ts 不在本任务边界内，类型经窄化透传）。 */
export function streamVocabTutor(
  messages: VocabChatMessage[],
  onText: (text: string) => void,
  signal: AbortSignal,
): Promise<string> {
  return streamTutor(trimChatHistory(messages) as TutorMessage[], onText, signal);
}

/* ------------------------------------------------------------------ */
/* 在线翻译（方案 §5.6 / §8）                                           */
/* ------------------------------------------------------------------ */

export type TranslateDirection = 'en2zh' | 'zh2en';

export interface TranslationResult {
  text: string;
  provider: string;
  degraded: boolean;
}

/** MyMemory 匿名接口单次请求长度上限（保守取 500 字符）。 */
export const TRANSLATE_MAX_CHARS = 500;

/** MyMemory 匿名账户每日免费额度（字符），方案 §8。 */
export const MYMEMORY_DAILY_LIMIT = 5000;

const USAGE_KEY = 'xiaomo-vocab-translate-usage-v1';

interface TranslateUsageRecord {
  date: string;
  chars: number;
}

function usageToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 读取今日已用字符数（仅客户端调用；过期记录视为 0）。 */
export function readTranslateUsage(): number {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return 0;
    const record = JSON.parse(raw) as TranslateUsageRecord;
    return record.date === usageToday() ? record.chars : 0;
  } catch {
    return 0;
  }
}

function recordTranslateUsage(chars: number): void {
  try {
    localStorage.setItem(
      USAGE_KEY,
      JSON.stringify({ date: usageToday(), chars: readTranslateUsage() + chars } satisfies TranslateUsageRecord),
    );
  } catch {
    // 隐私模式下 localStorage 不可用：静默跳过计数。
  }
}

const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';

async function translateWithMyMemory(text: string, dir: TranslateDirection, signal?: AbortSignal): Promise<string> {
  const langpair = dir === 'en2zh' ? 'en|zh-CN' : 'zh-CN|en';
  const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('MyMemory 返回 ' + response.status);
  const data = (await response.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number | string;
    quotaFinished?: boolean;
    responseDetails?: string;
  };
  const raw = String(data?.responseData?.translatedText ?? '');
  const statusNotOk = data?.responseStatus !== 200 && data?.responseStatus !== '200';
  // MyMemory 会把额度/警告文本直接写进 translatedText，不能盲目信任。
  if (data?.quotaFinished === true || statusNotOk || !raw.trim() || /MYMEMORY WARNING/i.test(raw)) {
    throw new Error(data?.responseDetails?.trim() || 'MyMemory 免费额度可能已用尽');
  }
  return raw.trim();
}

function translatePrompt(text: string, dir: TranslateDirection): string {
  return dir === 'en2zh'
    ? `请把下面的英语内容翻译成简体中文。只输出译文，不要解释，不要加引号：\n\n${text}`
    : `请把下面的中文内容翻译成英文。只输出译文，不要解释，不要加引号：\n\n${text}`;
}

/** 备用通道：复用 AI 助教 SSE 通道，单次请求 60 秒超时。 */
async function translateWithTutorChannel(text: string, dir: TranslateDirection, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  const forward = () => controller.abort();
  signal?.addEventListener('abort', forward, { once: true });
  try {
    const result = await streamTutor([{ role: 'user', content: translatePrompt(text, dir) }], () => {}, controller.signal);
    const trimmed = result.trim();
    if (!trimmed) throw new Error('AI 备用通道未返回译文');
    return trimmed;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
}

/**
 * 翻译编排：MyMemory 默认 → 任何失败降级 AI 备用通道（方案 §8）。
 * 全部失败时抛出用户可读错误；外部中断（signal 已中止）原样抛出以便调用方区分。
 */
export async function translateWithFallback(
  text: string,
  dir: TranslateDirection,
  signal?: AbortSignal,
): Promise<TranslationResult> {
  try {
    const out = await translateWithMyMemory(text, dir, signal);
    recordTranslateUsage(text.length);
    return { text: out, provider: 'MyMemory（免 key）', degraded: false };
  } catch (primaryError) {
    if (signal?.aborted) throw primaryError;
    try {
      const out = await translateWithTutorChannel(text, dir, signal);
      return { text: out, provider: 'AI 备用通道', degraded: true };
    } catch (fallbackError) {
      console.warn('[vocab] 翻译两条通道均失败', primaryError, fallbackError);
      throw new Error('翻译服务暂不可用，请稍后重试');
    }
  }
}
