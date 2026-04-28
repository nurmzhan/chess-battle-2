export const dynamic = 'force-dynamic';
// src/app/api/game/[code]/battle/route.ts
// Authoritative battle state. It is stored inside game.boardState so both
// players, and deployed server instances, read the same battle.

import { NextRequest, NextResponse } from 'next/server';
import { BattleSnapshot } from '@/types';
import { prisma } from '@/lib/prisma';

type BattleRole = 'attacker' | 'defender';

interface StoredBattle {
  snapshot: BattleSnapshot;
  consumedBullets: string[];
}

const EMPTY_PLAYER = { x: 0, y: 0, hp: 0, angle: 0 };
const ARENA_W = 700;
const ARENA_H = 480;
const WALL = 16;
const HIT_RADIUS = 24;

const OBSTACLES = [
  { x: 180, y: 150, w: 60, h: 60 },
  { x: 460, y: 150, w: 60, h: 60 },
  { x: 310, y: 200, w: 80, h: 40 },
  { x: 180, y: 280, w: 60, h: 60 },
  { x: 460, y: 280, w: 60, h: 60 },
];

const bulletKey = (owner: BattleRole, id: number) => `${owner}:${id}`;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function hitsObstacle(x: number, y: number, r: number) {
  for (const o of OBSTACLES) {
    const cx = clamp(x, o.x, o.x + o.w);
    const cy = clamp(y, o.y, o.y + o.h);
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
  }
  return false;
}

const emptyBattle = (): StoredBattle => ({
  snapshot: {
    attacker: { ...EMPTY_PLAYER },
    defender: { ...EMPTY_PLAYER },
    bullets: [],
    winner: null,
    tick: 0,
  },
  consumedBullets: [],
});

async function readBattle(code: string) {
  const game = await prisma.game.findUnique({
    where: { roomCode: code },
    select: { boardState: true },
  });
  if (!game) return null;

  const board = JSON.parse(game.boardState || '{}');
  const battle = (board.battleRuntime ?? emptyBattle()) as StoredBattle;
  return { board, battle };
}

async function writeBattle(code: string, board: any, battle: StoredBattle | null) {
  if (battle) {
    board.battleRuntime = battle;
  } else {
    delete board.battleRuntime;
  }

  await prisma.game.update({
    where: { roomCode: code },
    data: { boardState: JSON.stringify(board), updatedAt: new Date() },
  });
}

// POST /api/game/[code]/battle — push my role's data
export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;
  const { role, snapshot } = await req.json() as { role: BattleRole; snapshot: Partial<BattleSnapshot> };

  const loaded = await readBattle(code);
  if (!loaded) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  const { board, battle: current } = loaded;
  const consumed = new Set(current.consumedBullets);
  const currentSnap = current.snapshot;
  const currentBullets = currentSnap.bullets ?? [];
  const incomingBullets = (snapshot.bullets ?? [])
    .filter(b => b.owner === role && !consumed.has(bulletKey(b.owner, b.id)));
  const mergedBullets = [
    ...currentBullets.filter(b => b.owner !== role),
    ...incomingBullets,
  ];

  const merged: BattleSnapshot = {
    attacker: snapshot.attacker
      ? {
          ...currentSnap.attacker,
          x: snapshot.attacker.x,
          y: snapshot.attacker.y,
          angle: snapshot.attacker.angle,
          hp: currentSnap.attacker.hp > 0 ? currentSnap.attacker.hp : snapshot.attacker.hp,
        }
      : currentSnap.attacker,
    defender: snapshot.defender
      ? {
          ...currentSnap.defender,
          x: snapshot.defender.x,
          y: snapshot.defender.y,
          angle: snapshot.defender.angle,
          hp: currentSnap.defender.hp > 0 ? currentSnap.defender.hp : snapshot.defender.hp,
        }
      : currentSnap.defender,
    bullets: mergedBullets,
    winner: currentSnap.winner,
    tick: currentSnap.tick + 1,
  };

  if (!merged.winner && merged.attacker.hp > 0 && merged.defender.hp > 0) {
    merged.bullets = merged.bullets.filter(b => {
      if (
        b.x < WALL ||
        b.x > ARENA_W - WALL ||
        b.y < WALL ||
        b.y > ARENA_H - WALL ||
        b.life <= 0 ||
        hitsObstacle(b.x, b.y, 5)
      ) {
        consumed.add(bulletKey(b.owner, b.id));
        return false;
      }

      const target = b.owner === 'attacker' ? merged.defender : merged.attacker;
      if (dist(b, target) < HIT_RADIUS) {
        target.hp = Math.max(0, target.hp - b.damage);
        consumed.add(bulletKey(b.owner, b.id));
        if (target.hp <= 0) {
          merged.winner = b.owner;
        }
        return false;
      }

      return true;
    });
  }

  await writeBattle(code, board, {
    snapshot: merged,
    consumedBullets: Array.from(consumed).slice(-500),
  });

  return NextResponse.json({ ok: true });
}

// GET /api/game/[code]/battle — get full merged snapshot
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const loaded = await readBattle(params.code);
  if (!loaded) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  return NextResponse.json({ snapshot: loaded.battle.snapshot ?? null });
}

// DELETE /api/game/[code]/battle — clear battle state for new battle
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const loaded = await readBattle(params.code);
  if (!loaded) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  await writeBattle(params.code, loaded.board, null);
  return NextResponse.json({ ok: true });
}
