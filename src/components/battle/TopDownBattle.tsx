'use client';
// TopDownBattle.tsx — clean rewrite
//
// SYNC MODEL:
//   • API route is authoritative for HP, bullet hits, and winner.
//   • Clients send position + their own bullets and render the shared snapshot.
//
// ОПТИМИЗАЦИЯ:
//   • Снапшот отправляется каждые 2 тика (не каждый кадр).
//   • theirBullets обновляются из remote снапшота, двигаются локально между обновлениями.
//   • LERP интерполяция для плавного движения противника.

import { useEffect, useRef, useState } from 'react';
import { BattleSnapshot, Piece, PieceType } from '@/types';

const PIECE_STATS: Record<PieceType, {
  hp: number; speed: number; bulletSpeed: number;
  fireRate: number; damage: number; radius: number; emoji: string;
}> = {
  queen:  { hp: 200, speed: 3.2, bulletSpeed: 9,  fireRate: 180, damage: 22, radius: 18, emoji: '♛' },
  rook:   { hp: 180, speed: 2.4, bulletSpeed: 7,  fireRate: 350, damage: 35, radius: 20, emoji: '♜' },
  bishop: { hp: 120, speed: 3.6, bulletSpeed: 10, fireRate: 220, damage: 18, radius: 16, emoji: '♝' },
  knight: { hp: 140, speed: 4.0, bulletSpeed: 8,  fireRate: 260, damage: 20, radius: 17, emoji: '♞' },
  king:   { hp: 250, speed: 2.0, bulletSpeed: 6,  fireRate: 400, damage: 28, radius: 22, emoji: '♚' },
  pawn:   { hp: 80,  speed: 2.8, bulletSpeed: 7,  fireRate: 500, damage: 12, radius: 14, emoji: '♟' },
};

const ARENA_W = 700;
const ARENA_H = 480;
const WALL = 16;

const OBSTACLES = [
  { x: 180, y: 150, w: 60, h: 60 },
  { x: 460, y: 150, w: 60, h: 60 },
  { x: 310, y: 200, w: 80, h: 40 },
  { x: 180, y: 280, w: 60, h: 60 },
  { x: 460, y: 280, w: 60, h: 60 },
];

interface Vec2 { x: number; y: number; }
interface Bullet {
  id: number; x: number; y: number; vx: number; vy: number;
  owner: 'attacker' | 'defender'; damage: number; life: number;
}
interface DmgNum { x: number; y: number; value: number; life: number; color: string; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }

interface PlayerSnap {
  x: number; y: number; hp: number; angle: number;
  bullets: Bullet[];
  winner: 'attacker' | 'defender' | null;
  tick: number;
}

interface Props {
  attackerPiece: Piece;
  defenderPiece: Piece;
  myRole: 'attacker' | 'defender';
  battleSnap: BattleSnapshot | null;
  onSnapshot: (snap: PlayerSnap) => void;
  onBattleEnd: (attackerWon: boolean) => void;
}

let _bid = 0;
const uid = () => (++_bid) & 0xfffff; // wrap to avoid huge numbers
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

function hitsObstacle(x: number, y: number, r: number) {
  for (const o of OBSTACLES) {
    const cx = clamp(x, o.x, o.x + o.w);
    const cy = clamp(y, o.y, o.y + o.h);
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
  }
  return false;
}

export function TopDownBattle({
  attackerPiece, defenderPiece, myRole, battleSnap, onSnapshot, onBattleEnd,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [winner, setWinner] = useState<'attacker' | 'defender' | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [started, setStarted] = useState(false);
  const endCalledRef = useRef(false);

  const myStats = PIECE_STATS[myRole === 'attacker' ? attackerPiece.type : defenderPiece.type];
  const theirStats = PIECE_STATS[myRole === 'attacker' ? defenderPiece.type : attackerPiece.type];

  // ── All mutable state in one ref so the game loop always has fresh values ──
  const g = useRef({
    // MY state (I am authoritative)
    mx: myRole === 'attacker' ? 80 : ARENA_W - 80,
    my: ARENA_H / 2,
    mhp: myStats.hp,
    mangle: myRole === 'attacker' ? 0 : Math.PI,
    mlastShot: 0,
    myBullets: [] as Bullet[],

    // THEIR state (visual only, from remote)
    tx: myRole === 'attacker' ? ARENA_W - 80 : 80,
    ty: ARENA_H / 2,
    thp: theirStats.hp,   // their HP as reported by them — display only
    tangle: myRole === 'attacker' ? Math.PI : 0,
    targetTx: myRole === 'attacker' ? ARENA_W - 80 : 80,
    targetTy: ARENA_H / 2,
    theirBullets: [] as Bullet[],  // their bullets, rendered locally

    // Input
    keys: new Set<string>(),
    mouseAngle: myRole === 'attacker' ? 0 : Math.PI,
    mouseDown: false,

    // Game state
    winner: null as 'attacker' | 'defender' | null,
    tick: 0,
    lastSnapTick: 0,
    rafId: 0,

    // Visuals
    particles: [] as Particle[],
    dmgNums: [] as DmgNum[],
  });

  // ── Countdown ──
  useEffect(() => {
    let c = 3;
    const iv = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) { clearInterval(iv); setStarted(true); }
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Apply shared authoritative battle snapshot ──
  useEffect(() => {
    if (!battleSnap) return;
    const s = g.current;

    if (battleSnap.winner && !endCalledRef.current) {
      triggerEnd(s, battleSnap.winner);
      return;
    }

    if (s.winner) return; // battle already decided locally, skip position updates

    const myData = myRole === 'attacker' ? battleSnap.attacker : battleSnap.defender;
    const theirData = myRole === 'attacker' ? battleSnap.defender : battleSnap.attacker;
    const bullets = battleSnap.bullets ?? [];

    if (theirData && !(theirData.hp === 0 && theirData.x === 0 && theirData.y === 0)) {
      s.targetTx = theirData.x;
      s.targetTy = theirData.y;
      s.tangle = theirData.angle;

      if (theirData.hp < s.thp) {
        const dmg = Math.round(s.thp - theirData.hp);
        s.dmgNums.push({
          x: s.tx + (Math.random() - 0.5) * 24,
          y: s.ty - 20,
          value: dmg,
          life: 50,
          color: myRole === 'attacker' ? '#fb923c' : '#a78bfa',
        });
      }
      s.thp = theirData.hp;
    }

    if (myData && !(myData.hp === 0 && myData.x === 0 && myData.y === 0)) {
      if (myData.hp < s.mhp) {
        const dmg = Math.round(s.mhp - myData.hp);
        spawnParticles(s, s.mx, s.my, '#f87171');
        s.dmgNums.push({
          x: s.mx + (Math.random() - 0.5) * 24,
          y: s.my - 20,
          value: dmg,
          life: 50,
          color: '#f87171',
        });
      }
      s.mhp = myData.hp;
    }

    s.theirBullets = bullets.filter(b => b.owner !== myRole).map(b => ({ ...b }));

    if (battleSnap.attacker.hp <= 0 && battleSnap.defender.hp > 0) {
      triggerEnd(s, 'defender');
    } else if (battleSnap.defender.hp <= 0 && battleSnap.attacker.hp > 0) {
      triggerEnd(s, 'attacker');
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleSnap]);

  function triggerEnd(s: typeof g.current, w: 'attacker' | 'defender') {
    if (endCalledRef.current) return;
    endCalledRef.current = true;
    s.winner = w;
    setWinner(w);
    setTimeout(() => onBattleEnd(w === 'attacker'), 2000);
  }

  // ── Keyboard input ──
  useEffect(() => {
    const kd = (e: KeyboardEvent) => g.current.keys.add(e.key.toLowerCase());
    const ku = (e: KeyboardEvent) => g.current.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);

  // ── Game loop ──
  useEffect(() => {
    if (!started || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const s = g.current;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      s.mouseAngle = Math.atan2(e.clientY - rect.top - s.my, e.clientX - rect.left - s.mx);
    };
    const onDown = () => { s.mouseDown = true; };
    const onUp = () => { s.mouseDown = false; };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mouseup', onUp);

    const loop = (now: number) => {
      s.rafId = requestAnimationFrame(loop);
      if (s.winner) {
        // Still render the final frame with winner overlay handled by React
        drawFrame(ctx, s, myStats, theirStats, myRole);
        return;
      }
      s.tick++;

      // ── Move ──
      let dx = 0, dy = 0;
      if (s.keys.has('w') || s.keys.has('arrowup'))    dy -= 1;
      if (s.keys.has('s') || s.keys.has('arrowdown'))  dy += 1;
      if (s.keys.has('a') || s.keys.has('arrowleft'))  dx -= 1;
      if (s.keys.has('d') || s.keys.has('arrowright')) dx += 1;
      const mag = Math.hypot(dx, dy);
      if (mag > 0) { dx /= mag; dy /= mag; }
      const r = myStats.radius;
      const nx = clamp(s.mx + dx * myStats.speed, WALL + r, ARENA_W - WALL - r);
      const ny = clamp(s.my + dy * myStats.speed, WALL + r, ARENA_H - WALL - r);
      if (!hitsObstacle(nx, s.my, r)) s.mx = nx;
      if (!hitsObstacle(s.mx, ny, r)) s.my = ny;
      s.mangle = s.mouseAngle;

      // ── Shoot ──
      if (s.mouseDown && now - s.mlastShot > myStats.fireRate) {
        s.mlastShot = now;
        s.myBullets.push({
          id: uid(),
          x: s.mx + Math.cos(s.mangle) * (r + 12),
          y: s.my + Math.sin(s.mangle) * (r + 12),
          vx: Math.cos(s.mangle) * myStats.bulletSpeed,
          vy: Math.sin(s.mangle) * myStats.bulletSpeed,
          owner: myRole,
          damage: myStats.damage,
          life: 90,
        });
      }

      // ── My bullets: visual movement only. The API route decides hits and HP. ──
      for (let i = s.myBullets.length - 1; i >= 0; i--) {
        const b = s.myBullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.x < WALL || b.x > ARENA_W - WALL || b.y < WALL || b.y > ARENA_H - WALL || b.life <= 0) {
          s.myBullets.splice(i, 1); continue;
        }
        if (hitsObstacle(b.x, b.y, 5)) {
          spawnParticles(s, b.x, b.y, '#94a3b8');
          s.myBullets.splice(i, 1); continue;
        }
        if (dist(b, { x: s.tx, y: s.ty }) < theirStats.radius + 6) {
          spawnParticles(s, b.x, b.y, myRole === 'attacker' ? '#818cf8' : '#fb923c');
        }
      }

      // ── Their bullets: visual movement only. The API route decides hits and HP. ──
      for (let i = s.theirBullets.length - 1; i >= 0; i--) {
        const b = s.theirBullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.x < WALL || b.x > ARENA_W - WALL || b.y < WALL || b.y > ARENA_H - WALL || b.life <= 0) {
          s.theirBullets.splice(i, 1); continue;
        }
        if (hitsObstacle(b.x, b.y, 5)) {
          spawnParticles(s, b.x, b.y, '#94a3b8');
          s.theirBullets.splice(i, 1); continue;
        }
        if (dist(b, { x: s.mx, y: s.my }) < myStats.radius + 6) {
          spawnParticles(s, b.x, b.y, myRole === 'attacker' ? '#a78bfa' : '#fb923c');
        }
      }

      // ── Send my snapshot every 2 ticks ──
      if (s.tick - s.lastSnapTick >= 2) {
        s.lastSnapTick = s.tick;
        onSnapshot({
          x: s.mx, y: s.my, hp: s.mhp, angle: s.mangle,
          bullets: s.myBullets,
          winner: s.winner,
          tick: s.tick,
        });
      }

      // ── Interpolate their position ──
      const LERP = 0.18;
      s.tx += (s.targetTx - s.tx) * LERP;
      s.ty += (s.targetTy - s.ty) * LERP;

      drawFrame(ctx, s, myStats, theirStats, myRole);
    };

    s.rafId = requestAnimationFrame(loop);

    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mouseup', onUp);
      cancelAnimationFrame(s.rafId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const myPiece = myRole === 'attacker' ? attackerPiece : defenderPiece;
  const enemyPiece = myRole === 'attacker' ? defenderPiece : attackerPiece;
  const iWon = winner === myRole;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: '#020617', minHeight: '100vh', padding: '20px', fontFamily: 'monospace',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 12, width: ARENA_W }}>
        <div style={{ flex: 1 }}>
          <span style={{ color: '#f97316', fontSize: 20 }}>{PIECE_STATS[myPiece.type].emoji} </span>
          <span style={{ color: '#f97316', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {myPiece.color} {myPiece.type}
          </span>
          <span style={{ color: '#475569', fontSize: 12 }}> (YOU)</span>
        </div>
        <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 18 }}>⚔ BATTLE ⚔</div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <span style={{ color: '#818cf8', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {enemyPiece.color} {enemyPiece.type}
          </span>
          <span style={{ color: '#475569', fontSize: 12 }}> (ENEMY) </span>
          <span style={{ color: '#818cf8', fontSize: 20 }}>{PIECE_STATS[enemyPiece.type].emoji}</span>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef} width={ARENA_W} height={ARENA_H}
          style={{
            border: '2px solid #1e293b', borderRadius: 8,
            cursor: 'crosshair', display: 'block',
            boxShadow: '0 0 40px #0f172a',
          }}
        />

        {/* Countdown overlay */}
        {!started && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.85)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8,
          }}>
            <div style={{ color: '#f97316', fontSize: 96, fontWeight: 'bold', lineHeight: 1 }}>
              {countdown <= 0 ? 'GO!' : countdown}
            </div>
            <div style={{ color: '#64748b', marginTop: 16 }}>Get ready to fight!</div>
          </div>
        )}

        {/* Winner overlay */}
        {winner && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.92)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>{iWon ? '🏆' : '💀'}</div>
            <div style={{
              fontSize: 36, fontWeight: 'bold',
              color: iWon ? '#4ade80' : '#f87171',
              textShadow: iWon ? '0 0 20px #4ade80' : '0 0 20px #f87171',
            }}>
              {iWon ? 'VICTORY!' : 'DEFEATED!'}
            </div>
            <div style={{ color: '#64748b', marginTop: 12, fontSize: 14 }}>
              {iWon
                ? `${myPiece.color} ${myPiece.type} captures the square!`
                : `${enemyPiece.color} ${enemyPiece.type} defends!`}
            </div>
            <div style={{ color: '#334155', marginTop: 8, fontSize: 12 }}>Returning to chess board...</div>
          </div>
        )}
      </div>

      <div style={{ color: '#1e293b', fontSize: 11, marginTop: 8 }}>
        WASD / Arrow keys to move • Mouse to aim • Click to shoot
      </div>
    </div>
  );
}

// ── Draw frame (pure, no React) ───────────────────────────────────────────────

function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: any,
  myStats: any,
  theirStats: any,
  myRole: 'attacker' | 'defender',
) {
  ctx.clearRect(0, 0, ARENA_W, ARENA_H);
  drawArena(ctx);
  drawObstacles(ctx);
  drawParticleList(ctx, s.particles);
  drawDamageNumbers(ctx, s.dmgNums);
  [...s.theirBullets, ...s.myBullets].forEach((b: Bullet) => drawBullet(ctx, b));

  // Draw them first (behind me)
  drawFighter(ctx, s.tx, s.ty, s.thp, theirStats.hp, s.tangle, theirStats.radius,
    theirStats.emoji, myRole === 'attacker' ? '#818cf8' : '#f97316', false);
  drawFighter(ctx, s.mx, s.my, s.mhp, myStats.hp, s.mangle, myStats.radius,
    myStats.emoji, myRole === 'attacker' ? '#f97316' : '#818cf8', true);

  // HUD
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';  ctx.fillText('YOU',   20,          22);
  ctx.textAlign = 'right'; ctx.fillText('ENEMY', ARENA_W - 20, 22);
  ctx.textAlign = 'center'; ctx.fillStyle = '#334155'; ctx.font = '11px monospace';
  ctx.fillText('WASD move  •  Mouse aim  •  Click shoot', ARENA_W / 2, ARENA_H - 8);
}

// ── Pure draw helpers ─────────────────────────────────────────────────────────

function spawnParticles(s: any, x: number, y: number, color: string) {
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2, spd = 1 + Math.random() * 3;
    s.particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 18 + Math.random() * 10, color });
  }
}

function drawDamageNumbers(ctx: CanvasRenderingContext2D, nums: DmgNum[]) {
  for (let i = nums.length - 1; i >= 0; i--) {
    const d = nums[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, d.life / 30);
    ctx.font = 'bold 17px monospace';
    ctx.fillStyle = d.color;
    ctx.textAlign = 'center';
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 10;
    ctx.fillText(`-${d.value}`, d.x, d.y);
    ctx.restore();
    d.y -= 1.3;
    d.life--;
    if (d.life <= 0) nums.splice(i, 1);
  }
}

function drawArena(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
  for (let x = 0; x < ARENA_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke();
  }
  for (let y = 0; y < ARENA_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke();
  }
  ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 3;
  ([[0, 0, ARENA_W, WALL], [0, ARENA_H - WALL, ARENA_W, WALL],
    [0, 0, WALL, ARENA_H], [ARENA_W - WALL, 0, WALL, ARENA_H]] as number[][])
    .forEach(([x, y, w, h]) => { ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); });
}

function drawObstacles(ctx: CanvasRenderingContext2D) {
  for (const o of OBSTACLES) {
    ctx.fillStyle = '#334155'; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#475569';
    ctx.fillRect(o.x, o.y, o.w, 4);
    ctx.fillRect(o.x, o.y, 4, o.h);
  }
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
  const color = b.owner === 'attacker' ? '#fb923c' : '#a78bfa';
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawParticleList(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    ctx.globalAlpha = p.life / 28;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
  ctx.globalAlpha = 1;
}

function drawFighter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, hp: number, maxHp: number, angle: number,
  r: number, emoji: string, color: string, isMe: boolean,
) {
  // Shadow
  ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x, y + r - 4, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.restore();

  // Glow
  const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
  grd.addColorStop(0, color + '44'); grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();

  // Body
  ctx.fillStyle = color;
  ctx.strokeStyle = isMe ? '#fff' : '#aaa';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Emoji
  ctx.font = `${r}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
  ctx.fillText(emoji, x, y); ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';

  // Barrel
  ctx.strokeStyle = isMe ? '#fff' : '#ccc';
  ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  ctx.lineTo(x + Math.cos(angle) * (r + 10), y + Math.sin(angle) * (r + 10));
  ctx.stroke();

  // HP bar
  const bw = r * 2.5, bh = 5, bx = x - bw / 2, by = y - r - 12;
  const pct = Math.max(0, hp / maxHp);
  ctx.fillStyle = '#1e1e2e'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = pct > 0.6 ? '#4ade80' : pct > 0.3 ? '#facc15' : '#f87171';
  ctx.fillRect(bx, by, bw * pct, bh);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
}
