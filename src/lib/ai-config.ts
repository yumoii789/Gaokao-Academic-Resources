// 纯静态 BYOK：AI 配置仅存本浏览器 localStorage，不经过任何服务器。
export type AiProviderConfig = {
  id: string;
  name: string;
  /** 填到版本段前的根地址，如 https://api.deepseek.com 或 https://api.openai.com/v1 */
  baseUrl: string;
  apiKey: string;
  models: string[];
  selectedModel: string;
  builtIn?: boolean;
};

export type AiConfig = {
  customProvider: AiProviderConfig | null;
  includeImages: boolean;
  maxPerDay: number;
};

const CONFIG_KEY = 'xiaomo-ai-config-v1';
const USAGE_KEY = 'xiaomo-ai-usage-v1';
const VISIT_KEY = 'xiaomo-visit-stats-v1';

/** 内置免费保底：pollinations（无 key，OpenAI 兼容端点）。 */
export const BUILTIN_PROVIDER: AiProviderConfig = {
  id: 'builtin-pollinations',
  name: 'Pollinations（免费·无需配置）',
  baseUrl: 'https://text.pollinations.ai',
  apiKey: '',
  models: ['openai'],
  selectedModel: 'openai',
  builtIn: true,
};

export const DEFAULT_CONFIG: AiConfig = {
  customProvider: null,
  includeImages: false,
  maxPerDay: 50,
};

export function loadAiConfig(): AiConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    return {
      customProvider: parsed.customProvider ?? null,
      includeImages: parsed.includeImages ?? false,
      maxPerDay: typeof parsed.maxPerDay === 'number' && parsed.maxPerDay > 0 ? parsed.maxPerDay : 50,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAiConfig(config: AiConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch { /* 存储不可用时静默。 */ }
}

/** OpenAI 兼容 GET {baseUrl}/models，返回模型 id 列表。 */
export async function fetchModelList(baseUrl: string, apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const root = baseUrl.replace(/\/+$/, '');
  const response = await fetch(root + '/models', {
    headers: apiKey ? { Authorization: 'Bearer ' + apiKey } : undefined,
    signal,
  });
  if (!response.ok) throw new Error('模型列表获取失败（HTTP ' + response.status + '）');
  const data = await response.json() as { data?: { id?: string }[] };
  const ids = (data.data ?? []).map(m => m.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) throw new Error('服务商未返回任何模型');
  return ids;
}

type Usage = { date: string; count: number };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadUsage(): Usage {
  try {
    const raw = window.localStorage.getItem(USAGE_KEY);
    if (raw) {
      const u = JSON.parse(raw) as Usage;
      if (u.date === today()) return u;
    }
  } catch { /* 忽略。 */ }
  return { date: today(), count: 0 };
}

function bumpUsage(): void {
  try {
    window.localStorage.setItem(USAGE_KEY, JSON.stringify(loadUsage()));
  } catch { /* 忽略。 */ }
}

export function getUsage(): { count: number; maxPerDay: number } {
  const config = loadAiConfig();
  return { count: loadUsage().count, maxPerDay: config.maxPerDay };
}

/** 本机近似限速（纯静态无法按真实 IP，仅约束当前浏览器）。 */
export function checkRateLimit(): void {
  const { count, maxPerDay } = getUsage();
  if (count >= maxPerDay) {
    throw new Error('今日 AI 使用次数已达上限（' + count + '/' + maxPerDay + '），可在管理后台调整。');
  }
}

export function recordUsage(): void {
  const u = loadUsage();
  u.count += 1;
  try {
    window.localStorage.setItem(USAGE_KEY, JSON.stringify(u));
  } catch { /* 忽略。 */ }
  bumpUsage();
}

/** 本机访客统计：PV + 首次访问 + 访问天数（sessionStorage 去重，刷新不计 PV）。 */
export function trackVisit(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage.getItem(VISIT_KEY + ':counted') === '1') return;
    window.sessionStorage.setItem(VISIT_KEY + ':counted', '1');
    const raw = window.localStorage.getItem(VISIT_KEY);
    const stats = raw
      ? (JSON.parse(raw) as { pv: number; firstVisit: string; days: string[] })
      : { pv: 0, firstVisit: new Date().toISOString(), days: [] as string[] };
    const d = today();
    stats.pv += 1;
    if (!stats.days.includes(d)) stats.days.push(d);
    window.localStorage.setItem(VISIT_KEY, JSON.stringify(stats));
  } catch { /* 忽略。 */ }
}

export function getVisitStats(): { pv: number; firstVisit: string; days: number } {
  try {
    const raw = window.localStorage.getItem(VISIT_KEY);
    if (!raw) return { pv: 0, firstVisit: '', days: 0 };
    const s = JSON.parse(raw) as { pv: number; firstVisit: string; days: string[] };
    return { pv: s.pv, firstVisit: s.firstVisit, days: s.days.length };
  } catch {
    return { pv: 0, firstVisit: '', days: 0 };
  }
}

export function resetVisitStats(): void {
  try {
    window.localStorage.removeItem(VISIT_KEY);
  } catch { /* 忽略。 */ }
}
