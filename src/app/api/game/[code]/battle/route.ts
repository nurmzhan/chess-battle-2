export const dynamic = 'force-dynamic';
// src/app/api/game/[code]/battle/route.ts
// Lightweight battle state store: keeps latest snapshot per role.
// Uses a simple in-memory Map per room (resets on server restart,
// which is fine for local dev — for prod you'd store in Redis/DB).

import { NextRequest, NextResponse } from 'next/server';



import { BattleSnapshot } from '@/types';
// In-memory store: roomCode → merged snapshot
const battleStore = new Map<string, BattleSnapshot>();


// POST /api/game/[code]/battle — push my role's data
export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;
  const { role, snapshot } = await req.json();

  const current = battleStore.get(code) ?? null;
const merged: BattleSnapshot = {
  attacker: snapshot.attacker ?? current?.attacker ?? { x: 0, y: 0, hp: 0, angle: 0 },
  defender: snapshot.defender ?? current?.defender ?? { x: 0, y: 0, hp: 0, angle: 0 },
  bullets: snapshot.bullets ?? current?.bullets ?? [],
  winner: snapshot.winner ?? current?.winner ?? null,
  tick: Math.max(snapshot.tick ?? 0, current?.tick ?? 0),
};
  battleStore.set(code, merged);

  return NextResponse.json({ ok: true });
}

// GET /api/game/[code]/battle — get full merged snapshot
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const snap = battleStore.get(params.code) ?? null;
  return NextResponse.json({ snapshot: snap });
}

// DELETE /api/game/[code]/battle — clear battle state for new battle
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  battleStore.delete(params.code);
  return NextResponse.json({ ok: true });
}