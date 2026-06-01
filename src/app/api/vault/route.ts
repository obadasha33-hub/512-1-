import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/vault?vaultId=xxx
export async function GET(req: NextRequest) {
  try {
    const vaultId = req.nextUrl.searchParams.get('vaultId');
    if (!vaultId) {
      return NextResponse.json({ error: 'vaultId is required' }, { status: 400 });
    }

    const vault = await db.vault.findUnique({
      where: { id: vaultId },
      include: { members: true },
    });

    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }

    return NextResponse.json({ vault });
  } catch (error) {
    console.error('[Vault GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch vault' }, { status: 500 });
  }
}

// POST /api/vault - Create a new vault
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, theme, font, startDate, members } = body;

    // If id is provided, check if vault already exists and upsert
    if (id) {
      const existing = await db.vault.findUnique({ where: { id } });
      if (existing) {
        // Vault already exists, just return it
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

// PUT /api/vault?vaultId=xxx - Update vault settings
export async function PUT(req: NextRequest) {
  try {
    const vaultId = req.nextUrl.searchParams.get('vaultId');
    if (!vaultId) {
      return NextResponse.json({ error: 'vaultId is required' }, { status: 400 });
    }

    const body = await req.json();
    const { theme, font, name, startDate, batmanName, princessName, batmanPhoto, princessPhoto } = body;

    const updateData: Record<string, any> = {};
    if (theme) updateData.theme = theme;
    if (font) updateData.font = font;
    if (name) updateData.name = name;
    if (startDate) updateData.startDate = new Date(startDate);

    // Update member names/photos if provided
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
  } catch (error) {
    console.error('[Vault PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update vault' }, { status: 500 });
  }
}
