'use client';
import { useEffect, useRef, useState } from 'react';
import { Piece, PieceType } from '@/types';
import { Bullet, BattleSnapshot } from '@/types';
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


interface Props {
  attackerPiece: Piece;
  defenderPiece: Piece;
  myRole: 'attacker' | 'defender';
  onSnapshot: (snap: BattleSnapshot) => void;
  remoteSnapshot: BattleSnapshot | null;
  onBattleEnd: (attackerWon: boolean) => void;
}

let _bid = 0;
const uid = () => ++_bid;
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

export function TopDownBattle({ attackerPiece, defenderPiece, myRole, onSnapshot, remoteSnapshot, onBattleEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [winner, setWinner] = useState<'attacker' | 'defender' | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [started, setStarted] = useState(false);

  const myStats = PIECE_STATS[myRole === 'attacker' ? attackerPiece.type : defenderPiece.type];
  const theirStats = PIECE_STATS[myRole === 'attacker' ? defenderPiece.type : attackerPiece.type];

  // All mutable game state lives here so the loop always has fresh values
  const g = useRef({
    mx: myRole === 'attacker' ? 80 : ARENA_W - 80,
    my: ARENA_H / 2,
    mhp: 0 as number,      // set after myStats known
    mangle: myRole === 'attacker' ? 0 : Math.PI,
    mlastShot: 0,
    tx: myRole === 'attacker' ? ARENA_W - 80 : 80,
    ty: ARENA_H / 2,
    targetTx: myRole === 'attacker' ? ARENA_W - 80 : 80,  // ✅
    targetTy: ARENA_H / 2,                                  // ✅
    thp: 0 as number,
    tangle: myRole === 'attacker' ? Math.PI : 0,
    myBullets: [] as Bullet[],
    theirBullets: [] as Bullet[],
    keys: new Set<string>(),
    mouseAngle: myRole === 'attacker' ? 0 : Math.PI,
    mouseDown: false,
    winner: null as 'attacker' | 'defender' | null,
    tick: 0,
    lastSnapTick: 0,
    rafId: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
  });

  // Init HP after stats are known
  useEffect(() => {
    g.current.mhp = myStats.hp;
    g.current.thp = theirStats.hp;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── Apply remote snapshot ──
  // SYNC MODEL:
  // - Each player is authoritative for their OWN hp (they take hits from remote bullets)
  // - Each player sends their bullets in the snapshot
  // - The remote player renders those bullets and applies damage locally
  // - Winner is determined when either hp hits 0 — both sides agree because:
  //   attacker's bullets reduce defender's hp on DEFENDER's machine,
  //   defender reports their hp back in snapshot — attacker reads it.
  useEffect(() => {
    if (!remoteSnapshot) return;
    const s = g.current;
    const theirKey = myRole === 'attacker' ? 'defender' : 'attacker';
    const theirSnap = remoteSnapshot[theirKey];
    if (!theirSnap) return;

    // Update their visual position and angle
    s.targetTx = theirSnap.x;
    s.targetTy = theirSnap.y;
    s.tangle = theirSnap.angle;


    // Their bullets — we'll apply damage to ourselves locally
    s.theirBullets = (remoteSnapshot.bullets ?? []).filter(b => b.owner !== myRole);

    // Winner signal from remote
    // Принимаем winner только если мы сами ещё не определили победителя
  if (remoteSnapshot.winner && !s.winner) {
    s.winner = remoteSnapshot.winner;
    setWinner(remoteSnapshot.winner);
    setTimeout(() => onBattleEnd(remoteSnapshot.winner === 'attacker'), 2000);
  }

  // Если их HP по нашим данным <= 0 — форсируем победу
  if (s.thp <= 0 && !s.winner) {
    const w: 'attacker' | 'defender' = myRole;
    s.winner = w;
    setWinner(w);
    setTimeout(() => onBattleEnd(w === 'attacker'), 2000);
  }
  }, [remoteSnapshot, myRole, onBattleEnd]);

  // ── Input ──
  useEffect(() => {
    const kd = (e: KeyboardEvent) => g.current.keys.add(e.key.toLowerCase());
    const ku = (e: KeyboardEvent) => g.current.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
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
      if (s.winner) return;
      s.rafId = requestAnimationFrame(loop);
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

      // ── My bullets move & hit obstacles ──
for (let i = s.myBullets.length - 1; i >= 0; i--) {
  const b = s.myBullets[i];
  b.x += b.vx; b.y += b.vy; b.life--;
  if (b.x < WALL || b.x > ARENA_W - WALL || b.y < WALL || b.y > ARENA_H - WALL || b.life <= 0) {
    s.myBullets.splice(i, 1); continue;
  }
  if (hitsObstacle(b.x, b.y, 5)) {
    spawnP(s, b.x, b.y, '#94a3b8'); s.myBullets.splice(i, 1); continue;
  }
  // ✅ Проверяем попадание по противнику локально
  if (dist(b, { x: s.tx, y: s.ty }) < theirStats.radius + 5) {
    s.thp = Math.max(0, s.thp - b.damage);
    spawnP(s, b.x, b.y, myRole === 'attacker' ? '#818cf8' : '#fb923c');
    s.myBullets.splice(i, 1);
    if (s.thp <= 0 && !s.winner) {
      const w: 'attacker' | 'defender' = myRole;
      s.winner = w;
      setWinner(w);
      setTimeout(() => onBattleEnd(w === 'attacker'), 2000);
    }
  }
}

      
//уысу
      // ── Snapshot (send MY position + MY hp + MY bullets) ──
      if (s.tick - s.lastSnapTick >= 3) {
        s.lastSnapTick = s.tick;
        const mySnap = { x: s.mx, y: s.my, hp: s.mhp, angle: s.mangle };
        const theirSnap = { x: s.tx, y: s.ty, hp: s.thp, angle: s.tangle };
        onSnapshot({
          attacker: myRole === 'attacker' ? mySnap : theirSnap,
          defender: myRole === 'defender' ? mySnap : theirSnap,
          bullets: s.myBullets,
          winner: s.winner,
          tick: s.tick,
        });
      }
      // ── Интерполяция позиции противника ──
      const LERP = 0.2;
      s.tx += (s.targetTx - s.tx) * LERP;
      s.ty += (s.targetTy - s.ty) * LERP;

      // ── Draw ──
      ctx.clearRect(0, 0, ARENA_W, ARENA_H);
      drawArena(ctx);
      drawObstacles(ctx);
      drawParticles(ctx, s);
      [...s.theirBullets, ...s.myBullets].forEach(b => drawBullet(ctx, b));
      drawFighter(ctx, s.tx, s.ty, s.thp, theirStats.hp, s.tangle, theirStats.radius,
        theirStats.emoji, myRole === 'attacker' ? '#818cf8' : '#f97316', false);
      drawFighter(ctx, s.mx, s.my, s.mhp, myStats.hp, s.mangle, myStats.radius,
        myStats.emoji, myRole === 'attacker' ? '#f97316' : '#818cf8', true);

      // HUD labels
      ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left'; ctx.fillText('YOU', 20, 22);
      ctx.textAlign = 'right'; ctx.fillText('ENEMY', ARENA_W - 20, 22);
      ctx.textAlign = 'center'; ctx.fillStyle = '#334155'; ctx.font = '11px monospace';
      ctx.fillText('WASD move  •  Mouse aim  •  Click shoot', ARENA_W / 2, ARENA_H - 8);
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#020617', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 12, width: ARENA_W }}>
        <div style={{ flex: 1 }}>
          <span style={{ color: '#f97316', fontSize: 20 }}>{PIECE_STATS[myPiece.type].emoji} </span>
          <span style={{ color: '#f97316', fontWeight: 'bold', textTransform: 'uppercase' }}>{myPiece.color} {myPiece.type}</span>
          <span style={{ color: '#475569', fontSize: 12 }}> (YOU)</span>
        </div>
        <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 18 }}>⚔ BATTLE ⚔</div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <span style={{ color: '#818cf8', fontWeight: 'bold', textTransform: 'uppercase' }}>{enemyPiece.color} {enemyPiece.type}</span>
          <span style={{ color: '#475569', fontSize: 12 }}> (ENEMY) </span>
          <span style={{ color: '#818cf8', fontSize: 20 }}>{PIECE_STATS[enemyPiece.type].emoji}</span>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} width={ARENA_W} height={ARENA_H}
          style={{ border: '2px solid #1e293b', borderRadius: 8, cursor: 'crosshair', display: 'block', boxShadow: '0 0 40px #0f172a' }} />

        {!started && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
            <div style={{ color: '#f97316', fontSize: 96, fontWeight: 'bold', lineHeight: 1 }}>{countdown <= 0 ? 'GO!' : countdown}</div>
            <div style={{ color: '#64748b', marginTop: 16 }}>Get ready to fight!</div>
          </div>
        )}

        {winner && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>{iWon ? '🏆' : '💀'}</div>
            <div style={{ fontSize: 36, fontWeight: 'bold', color: iWon ? '#4ade80' : '#f87171', textShadow: iWon ? '0 0 20px #4ade80' : '0 0 20px #f87171' }}>
              {iWon ? 'VICTORY!' : 'DEFEATED!'}
            </div>
            <div style={{ color: '#64748b', marginTop: 12, fontSize: 14 }}>
              {iWon ? `${myPiece.color} ${myPiece.type} captures the square!` : `${enemyPiece.color} ${enemyPiece.type} defends!`}
            </div>
            <div style={{ color: '#334155', marginTop: 8, fontSize: 12 }}>Returning to chess board...</div>
          </div>
        )}
      </div>
      <div style={{ color: '#1e293b', fontSize: 11, marginTop: 8 }}>WASD / Arrow keys to move • Mouse to aim • Click to shoot</div>
    </div>
  );
}

// ── Pure draw helpers (no React) ──────────────────────────────────────────────

function spawnP(s: any, x: number, y: number, color: string) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, spd = 1 + Math.random() * 3;
    s.particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 20 + Math.random() * 10, color });
  }
}

function drawArena(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
  for (let x = 0; x < ARENA_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke(); }
  for (let y = 0; y < ARENA_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke(); }
  ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 3;
  ([[0,0,ARENA_W,WALL],[0,ARENA_H-WALL,ARENA_W,WALL],[0,0,WALL,ARENA_H],[ARENA_W-WALL,0,WALL,ARENA_H]] as number[][]).forEach(([x,y,w,h]) => { ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); });
}

function drawObstacles(ctx: CanvasRenderingContext2D) {
  for (const o of OBSTACLES) {
    ctx.fillStyle = '#334155'; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#475569'; ctx.fillRect(o.x, o.y, o.w, 4); ctx.fillRect(o.x, o.y, 4, o.h);
  }
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
  const color = b.owner === 'attacker' ? '#fb923c' : '#a78bfa';
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, s: any) {
  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i];
    ctx.globalAlpha = p.life / 30; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    if (p.life <= 0) s.particles.splice(i, 1);
  }
  ctx.globalAlpha = 1;
}

function drawFighter(ctx: CanvasRenderingContext2D,
  x: number, y: number, hp: number, maxHp: number, angle: number,
  r: number, emoji: string, color: string, isMe: boolean) {

  ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x, y + r - 4, r * 0.8, r * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
  grd.addColorStop(0, color + '44'); grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = color; ctx.strokeStyle = isMe ? '#fff' : '#aaa'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  ctx.font = `${r}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
  ctx.fillText(emoji, x, y); ctx.shadowBlur = 0;

  ctx.strokeStyle = isMe ? '#fff' : '#ccc'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  ctx.lineTo(x + Math.cos(angle) * (r + 10), y + Math.sin(angle) * (r + 10));
  ctx.stroke();

  const bw = r * 2.5, bh = 5, bx = x - bw / 2, by = y - r - 12;
  const pct = hp / maxHp;
  ctx.fillStyle = '#1e1e2e'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = pct > 0.6 ? '#4ade80' : pct > 0.3 ? '#facc15' : '#f87171';
  ctx.fillRect(bx, by, bw * Math.max(0, pct), bh);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
}