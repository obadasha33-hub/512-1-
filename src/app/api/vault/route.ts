import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

/**
 * PRODUCTION-GRADE Vault Management API
 */

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;

  const vaultId = req.nextUrl.searchParams.get('vaultId') || auth.vault.id;
  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });
  }

  try {
    const vault = await db.vault.findUnique({
      where: { id: vaultId },
      include: {
        members: true,
      }
    });

    if (!vault) return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    return NextResponse.json({ vault, currentMemberId: auth.member.id });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Vault creation usually happens via /api/auth/create
  // This route acts as a secondary verification/sync
  try {
    const body = await req.json();
    const { id, name, theme, font, startDate } = body;

    const vault = await db.vault.upsert({
      where: { id: id || 'new' },
      update: { name, theme, font },
      create: {
        id: id || undefined,
        name: name || 'Our Sanctuary',
        theme: theme || 'Pinky',
        font: font || 'Default',
        startDate: startDate ? new Date(startDate) : new Date(),
      }
    });

    return NextResponse.json({ vault }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create vault' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;

  const vaultId = req.nextUrl.searchParams.get('vaultId') || auth.vault.id;
  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      theme, font, name, startDate,
      batmanName, princessName,
      batmanPhoto, princessPhoto,
      chatWallpaper
    } = body;

    const updateData: any = {};
    if (theme) updateData.theme = theme;
    if (font) updateData.font = font;
    if (name) updateData.name = name;
    if (startDate) updateData.startDate = new Date(startDate);

    // Update individual member names/photos in relational table
    if (batmanName || batmanPhoto) {
      await db.vaultMember.updateMany({
        where: { vaultId, role: 'partner1' },
        data: {
          name: batmanName || undefined,
          photoUrl: batmanPhoto || undefined
        }
      });
    }
    if (princessName || princessPhoto) {
      await db.vaultMember.updateMany({
        where: { vaultId, role: 'partner2' },
        data: {
          name: princessName || undefined,
          photoUrl: princessPhoto || undefined
        }
      });
    }

    const updatedVault = await db.vault.update({
      where: { id: vaultId },
      data: updateData,
      include: { members: true }
    });

    return NextResponse.json({ vault: updatedVault });
  } catch (error) {
    console.error('[Vault PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update vault' }, { status: 500 });
  }
}
