import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase/admin';

const ROUTE_VERSION = 'ai-route-v6-firebase';

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

    const db = getAdminDb();
    const userMsgRef = await db.collection('aiChats').add({
      vaultId: vault.id, memberId: member.id, identity: member.role,
      role: 'user', content: message, createdAt: new Date().toISOString(),
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || ''}` },
        body: JSON.stringify({ model: 'openai/gpt-4o-mini', messages: conversationHistory }),
      });
      const data = await completion.json();
      reply = data.choices?.[0]?.message?.content || "I'm here for you, try again in a bit! 💕";
    } catch {
      reply = "I'm taking a moment to recharge — please try again in a bit! 💕";
    }

    const asstMsgRef = await db.collection('aiChats').add({
      vaultId: vault.id, memberId: null, identity: 'AI',
      role: 'assistant', content: reply, createdAt: new Date().toISOString(),
    });

    console.log(`[AI Route] ${ROUTE_VERSION} completed`);
    return NextResponse.json({ reply, userMessageId: userMsgRef.id, assistantMessageId: asstMsgRef.id });
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

    const db = getAdminDb();
    const snap = await db.collection('aiChats').where('vaultId', '==', vault.id).orderBy('createdAt', 'asc').get();
    const messages = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ messages });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Failed to load AI history' }, { status: 500 });
  }
}
