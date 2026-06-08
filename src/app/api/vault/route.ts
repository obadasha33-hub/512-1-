import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const vaultId = req.nextUrl.searchParams.get('vaultId') || auth.vault.id;
  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });
  }

  const db = getAdminDb();
  const doc = await db.collection('vaults').doc(vaultId).get();
  if (!doc.exists) return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
  return NextResponse.json({ vault: { id: doc.id, ...doc.data() }, currentMemberId: auth.member.id });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, name, theme, font, startDate, members } = body;
  const db = getAdminDb();
  const vaultId = id || 'vault-' + Date.now().toString(36);
  const existing = await db.collection('vaults').doc(vaultId).get();
  if (existing.exists) {
    return NextResponse.json({ vault: { id: existing.id, ...existing.data() } });
  }
  const vaultData: any = {
    id: vaultId,
    name: name || '512',
    theme: theme || 'Pinky',
    font: font || 'Default',
    startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
    createdAt: new Date().toISOString(),
    members: {
      partner1: { id: 'm-' + Date.now(), name: 'You', role: 'partner1' },
      partner2: { id: 'm-' + (Date.now() + 1), name: 'Partner', role: 'partner2' },
    },
  };
  await db.collection('vaults').doc(vaultId).set(vaultData);
  return NextResponse.json({ vault: { id: vaultId, ...vaultData } }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const vaultId = req.nextUrl.searchParams.get('vaultId') || auth.vault.id;
  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });
  }

  const body = await req.json();
  const { theme, font, name, startDate, batmanName, princessName, batmanPhoto, princessPhoto, chatWallpaper } = body;
  const db = getAdminDb();
  const updateData: any = {};
  if (theme) updateData.theme = theme;
  if (font) updateData.font = font;
  if (name) updateData.name = name;
  if (startDate) updateData.startDate = new Date(startDate).toISOString();
  if (chatWallpaper !== undefined) updateData.chatWallpaper = chatWallpaper;

  if (batmanName !== undefined) updateData.batmanName = batmanName;
  if (princessName !== undefined) updateData.princessName = princessName;

  if (batmanName !== undefined || batmanPhoto !== undefined) {
    const memberUpdate: any = {};
    if (batmanName !== undefined) memberUpdate.name = batmanName;
    if (batmanPhoto !== undefined) memberUpdate.photoUrl = batmanPhoto;
    await db.collection('vaults').doc(vaultId).update({ 'members.partner1': { ...memberUpdate } }).catch(() => {});
  }
  if (princessName !== undefined || princessPhoto !== undefined) {
    const memberUpdate: any = {};
    if (princessName !== undefined) memberUpdate.name = princessName;
    if (princessPhoto !== undefined) memberUpdate.photoUrl = princessPhoto;
    await db.collection('vaults').doc(vaultId).update({ 'members.partner2': { ...memberUpdate } }).catch(() => {});
  }

  await db.collection('vaults').doc(vaultId).update(updateData);
  const updated = await db.collection('vaults').doc(vaultId).get();
  return NextResponse.json({ vault: { id: updated.id, ...updated.data() } });
}
