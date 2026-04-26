// src/app/api/game/[code]/battle/route.ts
// Lightweight battle state store: keeps latest snapshot per role.
// Uses a simple in-memory Map per room (resets on server restart,
// which is fine for local dev — for prod you'd store in Redis/DB).

import { NextRequest, NextResponse } from 'next/server';

interface BattleSnapshot {
  attacker?: unknown;
  defender?: unknown;
  bullets?: unknown[];
  winner?: string | null;
  tick?: number;
}

// In-memory store: roomCode → merged snapshot
const battleStore = new Map<string, BattleSnapshot>();

// POST /api/game/[code]/battle — push my role's data
export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;
  const { role, snapshot } = await req.json();

  const current = battleStore.get(code) ?? {};
  const merged = {
    ...current,
    [role]: snapshot[role], // attacker or defender position
    bullets: snapshot.bullets ?? current.bullets,
    winner: snapshot.winner ?? current.winner,
    tick: Math.max(snapshot.tick ?? 0, current.tick ?? 0),
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