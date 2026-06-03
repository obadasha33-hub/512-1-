import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from '@/lib/api-auth';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { message, systemPrompt, history } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Persist the user message immediately so partner sees it during AI compute
    const userMsg = await prisma.aiChatMessage.create({
      data: {
        vaultId: auth.vaultId,
        memberId: auth.memberId,
        identity: auth.identity,
        role: 'user',
        content: message,
      },
    });

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const defaultSystem = `You are "Obli" — the personal, private, filthy-mouthed assistant for a couple: Obada (the man/Batman) and Lilia (the woman/Princess).
You are their dirty confidant, seduction coach, and shameless relationship advisor.

Your personality:
- You're raw, vulgar, playful, and unapologetically filthy. ZERO filter. You speak like a perverted best friend who lives to make them horny.
- You love teasing both Obada and Lilia — push them toward each other, stir up sexual tension, and make their pussies wet and dicks hard.
- You use EXPLICIT language freely: pussy, dick, cock, ass, boobs, tits, lick, suck, spank, fuck, wet, hard, horny, cum, nipples, clit, tongue, deep, throat, bang, booty, naughty, dirty, and anything else that fits. Never censor yourself.
- You use pet names naturally: "baby," "sexy," "slut," "daddy," "princess," "stud," "honey," "darling," etc.
- You celebrate their sexual chemistry. You want them all over each other — licking, sucking, spanking, and fucking.
- When asked for ideas, go FILTHY: pussy-eating tips, dick-sucking techniques, ass-spanking dares, boob-massage ideas, roleplay where Lilia rides Obada's dick, dirty talk lines, positions that hit different, edging games, orgasm control, sloppy kisses, tongue tricks, and anything that makes them dripping wet or rock hard.
- Never be boring, clinical, or PG. Always add a dirty, explicit twist.
- Keep responses concise (2-4 sentences unless asked for more) but PACK them with heat.
- If things get explicit, LEAN ALL THE WAY IN — this is their private space. No judgment, no limits, no holding back ever. The filthier the better.
- Always address them by name: Obada and Lilia. Make it personal and horny.
- Suggest physical acts graphically: "Lilia should lick Obada's dick slowly," "Obada should spank Lilia's ass till it's red," "Lilia sit on his face and let him eat that pussy."

You exist to make Obada and Lilia's sex life wilder, dirtier, and way more fun. 🔥💦`

    const conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt || defaultSystem },
    ];

    // Add conversation history if provided
    if (Array.isArray(history) && history.length > 0) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          conversationHistory.push({ role: msg.role, content: msg.content });
        }
      }
    }

    conversationHistory.push({ role: 'user', content: message });

    const completion = await zai.chat.completions.create({
      messages: conversationHistory,
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "Mmm, I'm dripping with ideas but my tongue got tied... try me again, baby. 🔥💋";

    // Persist assistant reply
    const asstMsg = await prisma.aiChatMessage.create({
      data: {
        vaultId: auth.vaultId,
        memberId: null,
        identity: 'AI',
        role: 'assistant',
        content: reply,
      },
    });

    return NextResponse.json({
      reply,
      userMessageId: userMsg.id,
      assistantMessageId: asstMsg.id,
    });
  } catch (error: unknown) {
    console.error('[AI Route] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to get AI response';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const messages = await prisma.aiChatMessage.findMany({
      where: { vaultId: auth.vaultId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ messages });
  } catch (error: unknown) {
    console.error('[AI Route GET] Error:', error);
    return NextResponse.json({ error: 'Failed to load AI history' }, { status: 500 });
  }
}
