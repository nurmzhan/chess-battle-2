export const dynamic = 'force-dynamic';
// src/app/api/game/[code]/battle/route.ts
// Authoritative battle state. Stored in game.boardState during the active
// battle so Vercel serverless instances cannot disagree about HP.

import { NextRequest, NextResponse } from 'next/server';
import { BattleSnapshot } from '@/types';
import { prisma } from '@/lib/prisma';

type BattleRole = 'attacker' | 'defender';
type HitEvent = { id: number; owner: BattleRole; damage: number };

interface StoredBattle {
  snapshot: BattleSnapshot;
  consumedHits: string[];
}

const EMPTY_PLAYER = { x: 0, y: 0, hp: 0, angle: 0 };
const MAX_BULLETS_PER_OWNER = 24;

const hitKey = (owner: BattleRole, id: number) => `${owner}:${id}`;
const isEmptyPlayer = (p: { x: number; y: number; hp: number }) =>
  p.hp === 0 && p.x === 0 && p.y === 0;

function emptyBattle(): StoredBattle {
  return {
    snapshot: {
      attacker: { ...EMPTY_PLAYER },
      defender: { ...EMPTY_PLAYER },
      bullets: [],
      winner: null,
      tick: 0,
    },
    consumedHits: [],
  };
}

async function readBattle(code: string) {
  const game = await prisma.game.findUnique({
    where: { roomCode: code },
    select: { boardState: true },
  });
  if (!game) return null;

  const board = JSON.parse(game.boardState || '{}');
  const battle = (board.battleRuntime ?? emptyBattle()) as StoredBattle;
  battle.consumedHits ??= [];
  return { board, battle };
}

async function writeBattle(code: string, board: any, battle: StoredBattle | null) {
  if (battle) board.battleRuntime = battle;
  else delete board.battleRuntime;

  await prisma.game.update({
    where: { roomCode: code },
    data: { boardState: JSON.stringify(board), updatedAt: new Date() },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;
  const { role, snapshot } = await req.json() as {
    role: BattleRole;
    snapshot: Partial<BattleSnapshot> & { hits?: HitEvent[] };
  };

  const loaded = await readBattle(code);
  if (!loaded) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  const { board, battle: current } = loaded;
  const currentSnap = current.snapshot;
  const consumed = new Set(current.consumedHits);
  const incomingBullets = (snapshot.bullets ?? [])
    .filter(b => b.owner === role)
    .slice(-MAX_BULLETS_PER_OWNER);

  const merged: BattleSnapshot = {
    attacker: snapshot.attacker
      ? {
          ...currentSnap.attacker,
          x: snapshot.attacker.x,
          y: snapshot.attacker.y,
          angle: snapshot.attacker.angle,
          hp: isEmptyPlayer(currentSnap.attacker) ? snapshot.attacker.hp : currentSnap.attacker.hp,
        }
      : currentSnap.attacker,
    defender: snapshot.defender
      ? {
          ...currentSnap.defender,
          x: snapshot.defender.x,
          y: snapshot.defender.y,
          angle: snapshot.defender.angle,
          hp: isEmptyPlayer(currentSnap.defender) ? snapshot.defender.hp : currentSnap.defender.hp,
        }
      : currentSnap.defender,
    bullets: [
      ...(currentSnap.bullets ?? []).filter(b => b.owner !== role).slice(-MAX_BULLETS_PER_OWNER),
      ...incomingBullets,
    ],
    winner: currentSnap.winner,
    tick: currentSnap.tick + 1,
  };

  if (!merged.winner && merged.attacker.hp > 0 && merged.defender.hp > 0) {
    for (const hit of snapshot.hits ?? []) {
      if (hit.owner !== role) continue;
      const key = hitKey(hit.owner, hit.id);
      if (consumed.has(key)) continue;

      const target = hit.owner === 'attacker' ? merged.defender : merged.attacker;
      target.hp = Math.max(0, target.hp - hit.damage);
      consumed.add(key);

      if (target.hp <= 0) {
        merged.winner = hit.owner;
        break;
      }
    }
  }

  await writeBattle(code, board, {
    snapshot: merged,
    consumedHits: Array.from(consumed).slice(-500),
  });

  return NextResponse.json({ ok: true, snapshot: merged });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const loaded = await readBattle(params.code);
  if (!loaded) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  return NextResponse.json({ snapshot: loaded.battle.snapshot ?? null });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const loaded = await readBattle(params.code);
  if (!loaded) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  await writeBattle(params.code, loaded.board, null);
  return NextResponse.json({ ok: true });
}
