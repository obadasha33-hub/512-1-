import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

// GET /api/vault?vaultId=xxx — requires Authorization header.
// Returns full vault data including members.
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;

  const vaultId = req.nextUrl.searchParams.get('vaultId') || auth.vault.id;
  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch with session' }, { status: 403 });
  }

  const vault = await db.vault.findUnique({
    where: { id: vaultId },
    include: { members: true },
  });

  if (!vault) {
    return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
  }

  return NextResponse.json({ vault, currentMemberId: auth.member.id });
}

// POST /api/vault — LEGACY: creates a vault without security.
// Use /api/auth/create instead for a secure 2-user vault.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, theme, font, startDate, members } = body;

    if (id) {
      const existing = await db.vault.findUnique({ where: { id } });
      if (existing) {
        const vault = await db.vault.findUnique({ where: { id }, include: { members: true } });
        return NextResponse.json({ vault });
      }
    }

    const vault = await db.vault.create({
      data: {
        ...(id ? { id } : {}),
        name: name || '521',
        theme: theme || 'Pinky',
        font: font || 'Default',
        startDate: startDate ? new Date(startDate) : new Date(),
        members: {
          create: members || [
            { role: 'partner1', name: 'You' },
            { role: 'partner2', name: 'Partner' },
          ],
        },
      },
      include: { members: true },
    });

    return NextResponse.json({ vault }, { status: 201 });
  } catch (error) {
    console.error('[Vault POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create vault' }, { status: 500 });
  }
}

// PUT /api/vault?vaultId=xxx — Update vault settings. Requires auth.
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;

  const vaultId = req.nextUrl.searchParams.get('vaultId') || auth.vault.id;
  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch with session' }, { status: 403 });
  }

  const body = await req.json();
  const { theme, font, name, startDate, batmanName, princessName, batmanPhoto, princessPhoto } = body;

  const updateData: Record<string, any> = {};
  if (theme) updateData.theme = theme;
  if (font) updateData.font = font;
  if (name) updateData.name = name;
  if (startDate) updateData.startDate = new Date(startDate);

  if (batmanName !== undefined || batmanPhoto !== undefined) {
    const partner1 = await db.vaultMember.findFirst({ where: { vaultId, role: 'partner1' } });
    if (partner1) {
      await db.vaultMember.update({
        where: { id: partner1.id },
        data: {
          ...(batmanName !== undefined ? { name: batmanName } : {}),
          ...(batmanPhoto !== undefined ? { photoUrl: batmanPhoto } : {}),
        },
      });
    }
  }

  if (princessName !== undefined || princessPhoto !== undefined) {
    const partner2 = await db.vaultMember.findFirst({ where: { vaultId, role: 'partner2' } });
    if (partner2) {
      await db.vaultMember.update({
        where: { id: partner2.id },
        data: {
          ...(princessName !== undefined ? { name: princessName } : {}),
          ...(princessPhoto !== undefined ? { photoUrl: princessPhoto } : {}),
        },
      });
    }
  }

  const vault = await db.vault.update({
    where: { id: vaultId },
    data: updateData,
    include: { members: true },
  });

  return NextResponse.json({ vault });
}
