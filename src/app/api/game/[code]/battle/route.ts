export const dynamic = 'force-dynamic';
// src/app/api/game/[code]/battle/route.ts
// Fast battle state store. This route intentionally avoids Prisma because
// battle sync is high-frequency and would exhaust DB connections on Vercel.

import { NextRequest, NextResponse } from 'next/server';
import { BattleSnapshot } from '@/types';

type BattleRole = 'attacker' | 'defender';

interface StoredBattle {
  snapshot: BattleSnapshot;
  consumedBullets: Set<string>;
  updatedAt: number;
}

const EMPTY_PLAYER = { x: 0, y: 0, hp: 0, angle: 0 };
const ARENA_W = 700;
const ARENA_H = 480;
const WALL = 16;
const HIT_RADIUS = 24;
const MAX_BATTLE_AGE_MS = 5 * 60 * 1000;

const OBSTACLES = [
  { x: 180, y: 150, w: 60, h: 60 },
  { x: 460, y: 150, w: 60, h: 60 },
  { x: 310, y: 200, w: 80, h: 40 },
  { x: 180, y: 280, w: 60, h: 60 },
  { x: 460, y: 280, w: 60, h: 60 },
];

const battleStore = new Map<string, StoredBattle>();

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

function emptyBattle(): StoredBattle {
  return {
    snapshot: {
      attacker: { ...EMPTY_PLAYER },
      defender: { ...EMPTY_PLAYER },
      bullets: [],
      winner: null,
      tick: 0,
    },
    consumedBullets: new Set<string>(),
    updatedAt: Date.now(),
  };
}

function pruneOldBattles() {
  const now = Date.now();
  for (const [code, battle] of Array.from(battleStore.entries())) {
    if (now - battle.updatedAt > MAX_BATTLE_AGE_MS) {
      battleStore.delete(code);
    }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  pruneOldBattles();

  const { code } = params;
  const { role, snapshot } = await req.json() as { role: BattleRole; snapshot: Partial<BattleSnapshot> };
  const current = battleStore.get(code) ?? emptyBattle();
  const currentSnap = current.snapshot;
  const currentBullets = currentSnap.bullets ?? [];
  const incomingBullets = (snapshot.bullets ?? [])
    .filter(b => b.owner === role && !current.consumedBullets.has(bulletKey(b.owner, b.id)));

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
        current.consumedBullets.add(bulletKey(b.owner, b.id));
        return false;
      }

      const target = b.owner === 'attacker' ? merged.defender : merged.attacker;
      if (dist(b, target) < HIT_RADIUS) {
        target.hp = Math.max(0, target.hp - b.damage);
        current.consumedBullets.add(bulletKey(b.owner, b.id));
        if (target.hp <= 0) {
          merged.winner = b.owner;
        }
        return false;
      }

      return true;
    });
  }

  current.snapshot = merged;
  current.updatedAt = Date.now();
  battleStore.set(code, current);

  return NextResponse.json({ ok: true, snapshot: merged });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  pruneOldBattles();
  return NextResponse.json({ snapshot: battleStore.get(params.code)?.snapshot ?? null });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  battleStore.delete(params.code);
  return NextResponse.json({ ok: true });
}
