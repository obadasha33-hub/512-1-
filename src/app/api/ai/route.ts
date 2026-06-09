import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { db } from '@/lib/db';

const ROUTE_VERSION = 'ai-route-v7-prisma';

export async function POST(req: NextRequest) {
  try {
    const result = await authenticateRequest(req);
    if (!result.ok) return result.response;
    const { member, vault } = result;

    const body = await req.json();
    const { message, systemPrompt, history } = body;
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Save user message to Prisma
    await db.aiChatMessage.create({
      data: {
        vaultId: vault.id,
        role: 'user',
        text: message,
      }
    });

    const defaultSystem = `You are "Obli" — a caring, supportive AI companion for couples.
Your purpose is to provide thoughtful relationship advice, romantic suggestions, and gentle encouragement.
Keep responses warm, positive, and helpful. Address users by their names when known.`;

    const conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt || defaultSystem },
    ];
    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          conversationHistory.push({ role: msg.role, content: msg.content });
        }
      }
    }
    conversationHistory.push({ role: 'user', content: message });

    let reply: string;
    try {
      const completion = await fetch('https://api.openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || ''}`,
          'HTTP-Referer': 'https://our-sanctuary.app',
          'X-Title': 'Our Sanctuary'
        },
        body: JSON.stringify({ model: 'openai/gpt-4o-mini', messages: conversationHistory }),
      });
      const data = await completion.json();
      reply = data.choices?.[0]?.message?.content || "I'm here for you, try again in a bit! 💕";
    } catch {
      reply = "I'm taking a moment to recharge — please try again in a bit! 💕";
    }

    // Save AI response to Prisma
    await db.aiChatMessage.create({
      data: {
        vaultId: vault.id,
        role: 'assistant',
        text: reply,
      }
    });

    console.log(`[AI Route] ${ROUTE_VERSION} completed`);
    return NextResponse.json({ reply });
  } catch (error: unknown) {
    console.error('[AI Route] Error:', error);
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const result = await authenticateRequest(req);
    if (!result.ok) return result.response;
    const { vault } = result;

    const messages = await db.aiChatMessage.findMany({
      where: { vaultId: vault.id },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ messages });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Failed to load AI history' }, { status: 500 });
  }
}
