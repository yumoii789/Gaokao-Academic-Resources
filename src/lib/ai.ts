export type TutorMessage = { role: 'system' | 'user'; content: string };

export async function streamTutor(
  messages: TutorMessage[],
  onText: (text: string) => void,
  signal: AbortSignal,
) {
  const response = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai', messages, stream: true }),
    signal,
  });
  if (!response.ok || !response.body) throw new Error('AI 服务返回 ' + response.status);
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
        if (delta) {
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
