
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt, context } = await req.json();
    const API_KEY = process.env.AI_API_KEY; // 从环境变量读取，绝不暴露给前端

    if (!API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    // 模拟启发式引导逻辑：AI 不直接给答案，而是给 Hint
    const systemPrompt = "你是一个高考助教。用户请求答案时，请先给出引导性的提示（Hint），鼓励其思考，不要直接给出最终结果。";

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Context: ${context}\n\nQuestion: ${prompt}` }
        ],
        stream: true,
      }),
    });

    return new NextResponse(response.body);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
