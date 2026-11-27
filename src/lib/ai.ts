import {
  BUILTIN_PROVIDER,
  checkRateLimit,
  loadAiConfig,
  recordUsage,
  type AiProviderConfig,
} from './ai-config';

export type TutorContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type TutorContent = string | TutorContentPart[];

export type TutorMessage = { role: 'system' | 'user' | 'assistant'; content: TutorContent };

function resolveProvider(): AiProviderConfig {
  const config = loadAiConfig();
  return config.customProvider ?? BUILTIN_PROVIDER;
}

async function chatStream(
  provider: AiProviderConfig,
  messages: TutorMessage[],
  onText: (text: string) => void,
  signal: AbortSignal,
): Promise<string> {
  let url: string;
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: Record<string, unknown>;
  if (provider.builtIn) {
    url = provider.baseUrl + '/openai';
    body = { model: provider.selectedModel || 'openai', messages, stream: true };
  } else {
    url = provider.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    if (provider.apiKey) headers.Authorization = 'Bearer ' + provider.apiKey;
    body = { model: provider.selectedModel, messages, stream: true };
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 200);
    } catch { /* 忽略。 */ }
    throw new Error('AI 服务返回 ' + response.status + (detail ? '：' + detail : ''));
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    buffer += decoder.decode(step.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          text += delta;
          onText(text);
        }
      } catch {
        // 忽略不完整的 SSE JSON 片段。
      }
    }
  }
  if (!text) throw new Error('AI 未返回内容');
  return text;
}

/** 限速 + 计数 + 直连（BYOK 自定义 provider 或内置免费保底）。 */
export async function streamTutor(
  messages: TutorMessage[],
  onText: (text: string) => void,
  signal: AbortSignal,
): Promise<string> {
  checkRateLimit();
  const provider = resolveProvider();
  try {
    const text = await chatStream(provider, messages, onText, signal);
    recordUsage();
    return text;
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    // 无自定义 provider 时给一条可操作的指引。
    if (provider.builtIn) {
      throw new Error('免费通道暂时不可用：' + (error as Error).message + '（可在管理后台配置自己的 AI 服务）');
    }
    throw error;
  }
}
