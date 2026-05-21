import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message, systemPrompt } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const defaultSystem = `You are a wise, warm, and insightful relationship guide named "Sanctuary Oracle." 
You help couples deepen their connection, navigate challenges, and celebrate their love.
Your tone is compassionate, playful when appropriate, and always supportive.
Keep responses concise (2-4 sentences unless asked for more). Use gentle humor and warmth.
Never judge. Always encourage open communication and mutual respect.
If asked about sensitive topics, be thoughtful and supportive.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt || defaultSystem },
        { role: 'user', content: message },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "I'm here for you, but I seem to be at a loss for words right now. Please try again. 💕";

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    console.error('[AI Route] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to get AI response';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
