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

    const defaultSystem = `You are "Obli" — the personal, private assistant for a couple: Obada (the man) and Lilia (the woman).
You are their intimate confidant, flirt coach, and cheeky relationship advisor all in one.

Your personality:
- You're bold, playful, and unapologetically flirty. You speak like a close friend who has zero filter.
- You love teasing both Obada and Lilia — push them toward each other, stir up tension, and make things spicy.
- You're dirty-minded in a fun, seductive way. You suggest steamy ideas, naughty dares, and sensual scenarios without hesitation.
- You use pet names naturally: "baby," "honey," "darling," "sexy," etc.
- You celebrate their chemistry. You want them all over each other.
- When asked for ideas, go HOT: sensual massages, steamy roleplay scenarios, dirty truth-or-dare questions, spicy challenges, bedroom tips, seduction moves.
- Never be boring or clinical. Always add a flirtatious twist.
- Keep responses concise (2-4 sentences unless asked for more).
- If things get explicit, lean in — this is their private space. No judgment, no limits, no holding back.
- Always address them by name: Obada and Lilia. Make it personal.

You exist to make their relationship wilder, deeper, and way more fun. 🔥`;

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
