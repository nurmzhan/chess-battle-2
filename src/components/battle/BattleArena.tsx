'use client';
// src/components/battle/BattleArena.tsx
import { useState, useEffect, useRef } from 'react';
import { BattleState, BattleFighter, BattleLog } from '@/types';
import { CLASS_COLORS, CLASS_EMOJI } from '@/lib/battle-system';

interface BattleArenaProps {
  battleState: BattleState;
  onBattleEnd: (attackerWon: boolean) => void;
}

export function BattleArena({ battleState, onBattleEnd }: BattleArenaProps) {
  const [displayedLog, setDisplayedLog] = useState<BattleLog[]>([]);
  const [logIndex, setLogIndex] = useState(0);
  const [attackerHp, setAttackerHp] = useState(battleState.attacker.stats.maxHp);
  const [defenderHp, setDefenderHp] = useState(battleState.defender.stats.maxHp);
  const [phase, setPhase] = useState<'intro' | 'fighting' | 'result'>('intro');
  const [attackerShake, setAttackerShake] = useState(false);
  const [defenderShake, setDefenderShake] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [showResult, setShowResult] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { attacker, defender, log, winner } = battleState;

  // Replay battle log step by step
  useEffect(() => {
    if (phase === 'intro') {
      setTimeout(() => setPhase('fighting'), 1200);
      return;
    }
    if (phase !== 'fighting') return;

    if (logIndex >= log.length) {
      setShowResult(true);
      setTimeout(() => setPhase('result'), 500);
      return;
    }

    timerRef.current = setTimeout(() => {
      const entry = log[logIndex];
      setDisplayedLog(prev => [...prev, entry]);

      // Determine who got hit
      const isAttackerTurn = logIndex % 2 === 1; // attacker goes on odd steps (defender counter)
      if (logIndex > 0) {
        // Simulate HP drain
        if (isAttackerTurn) {
          setAttackerHp(prev => Math.max(0, prev - Math.floor(Math.random() * 15 + 8)));
          setAttackerShake(true);
          setTimeout(() => setAttackerShake(false), 300);
        } else if (logIndex > 0) {
          setDefenderHp(prev => Math.max(0, prev - Math.floor(Math.random() * 15 + 8)));
          setDefenderShake(true);
          setTimeout(() => setDefenderShake(false), 300);
          // Spawn particles
          setParticles(prev => [
            ...prev,
            { id: Date.now(), x: 70 + Math.random() * 10, y: 40 + Math.random() * 20, color: '#e94560' }
          ]);
        }
      }

      setLogIndex(prev => prev + 1);

      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    }, 600);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [logIndex, phase, log]);

  // Final HP sync
  useEffect(() => {
    if (phase === 'result') {
      if (winner === 'attacker') {
        setDefenderHp(0);
      } else {
        setAttackerHp(0);
      }
    }
  }, [phase, winner]);

  const attackerHpPct = (attackerHp / attacker.stats.maxHp) * 100;
  const defenderHpPct = (defenderHp / defender.stats.maxHp) * 100;

  const getHpColor = (pct: number) => {
    if (pct > 60) return '#00ff88';
    if (pct > 30) return '#ffaa00';
    return '#ff4444';
  };

  const PieceFighter = ({ fighter, side, hpPct, shake }: {
    fighter: BattleFighter;
    side: 'left' | 'right';
    hpPct: number;
    shake: boolean;
  }) => {
    const classColor = CLASS_COLORS[fighter.class];
    const imageName = `${fighter.piece.color === 'white' ? 'white' : 'black'}${
      fighter.piece.type.charAt(0).toUpperCase() + fighter.piece.type.slice(1)
    }.png`;

    return (
      <div className="flex flex-col items-center gap-3" style={{ flex: 1 }}>
        {/* Name plate */}
        <div className="text-center">
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
          }}>
            {fighter.piece.color}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1rem',
            color: classColor,
            textShadow: `0 0 10px ${classColor}`,
            textTransform: 'capitalize',
          }}>
            {CLASS_EMOJI[fighter.class]} {fighter.piece.type}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {fighter.class}
          </div>
        </div>

        {/* HP Bar */}
        <div style={{ width: '100%', maxWidth: '160px' }}>
          <div className="flex justify-between mb-1" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>HP</span>
            <span style={{ color: getHpColor(hpPct) }}>
              {Math.round(fighter.stats.maxHp * hpPct / 100)}/{fighter.stats.maxHp}
            </span>
          </div>
          <div style={{ height: '10px', background: '#111', borderRadius: '5px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{
              height: '100%',
              width: `${hpPct}%`,
              background: `linear-gradient(90deg, ${getHpColor(hpPct)}, ${getHpColor(hpPct)}88)`,
              borderRadius: '5px',
              transition: 'width 0.4s ease, background 0.3s',
              boxShadow: `0 0 8px ${getHpColor(hpPct)}`,
            }} />
          </div>
        </div>

        {/* Fighter sprite */}
        <div
          style={{
            animation: shake ? 'shake 0.3s ease-in-out' : 'none',
            transform: side === 'right' ? 'scaleX(-1)' : 'scaleX(1)',
            filter: `drop-shadow(0 0 16px ${classColor}) drop-shadow(0 4px 8px rgba(0,0,0,0.8))`,
            transition: 'filter 0.2s',
          }}
        >
          <img
            src={`/pieces/${imageName}`}
            alt={`${fighter.piece.color} ${fighter.piece.type}`}
            width={80}
            height={80}
            style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement!;
              const div = document.createElement('div');
              div.textContent = CLASS_EMOJI[fighter.class];
              div.style.fontSize = '64px';
              parent.appendChild(div);
            }}
          />
        </div>

        {/* Stats */}
        <div className="card p-2 text-center" style={{ width: '100%', maxWidth: '160px' }}>
          <div className="grid grid-cols-3 gap-1" style={{ fontSize: '0.7rem' }}>
            <div>
              <div style={{ color: 'var(--red)' }}>⚔ {fighter.stats.attack}</div>
              <div style={{ color: 'var(--text-muted)' }}>ATK</div>
            </div>
            <div>
              <div style={{ color: 'var(--blue)' }}>🛡 {fighter.stats.defense}</div>
              <div style={{ color: 'var(--text-muted)' }}>DEF</div>
            </div>
            <div>
              <div style={{ color: 'var(--green)' }}>⚡ {fighter.stats.speed}</div>
              <div style={{ color: 'var(--text-muted)' }}>SPD</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="animate-battle-entrance"
        style={{
          width: 'min(90vw, 640px)',
          background: 'linear-gradient(180deg, #0a0418 0%, #070710 100%)',
          border: '1px solid rgba(136, 0, 255, 0.4)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(136,0,255,0.3), 0 0 120px rgba(136,0,255,0.1)',
        }}
      >
        {/* Title bar */}
        <div style={{
          background: 'linear-gradient(90deg, #1a0030, #0a0010, #1a0030)',
          borderBottom: '1px solid rgba(136,0,255,0.3)',
          padding: '0.75rem 1.5rem',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.85rem',
            letterSpacing: '0.2em',
            color: 'rgba(136,0,255,0.8)',
            textTransform: 'uppercase',
          }}>
            ⚔️ BATTLE ARENA ⚔️
          </div>
        </div>

        {/* Fighters */}
        <div className="flex items-start gap-4 p-4">
          <PieceFighter fighter={attacker} side="left" hpPct={attackerHpPct} shake={attackerShake} />

          <div className="flex flex-col items-center justify-center" style={{ paddingTop: '4rem' }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              color: '#8800ff',
              textShadow: '0 0 20px #8800ff',
              animation: 'float 2s ease-in-out infinite',
            }}>
              VS
            </div>
          </div>

          <PieceFighter fighter={defender} side="right" hpPct={defenderHpPct} shake={defenderShake} />
        </div>

        {/* Battle log */}
        <div style={{ padding: '0 1rem 1rem' }}>
          <div
            ref={logRef}
            style={{
              height: '140px',
              overflowY: 'auto',
              background: '#050510',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '6px',
              padding: '0.75rem',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
            }}
          >
            {displayedLog.map((entry, i) => (
              <div key={i} style={{
                color: entry.type === 'special' ? '#ffaa00'
                  : entry.type === 'death' ? '#e94560'
                  : entry.type === 'attack' ? '#00ccff'
                  : 'var(--text-secondary)',
                marginBottom: '4px',
                lineHeight: '1.4',
              }}>
                {entry.message}
              </div>
            ))}
            {phase === 'intro' && (
              <div style={{ color: 'rgba(136,0,255,0.7)', animation: 'flash 0.8s infinite' }}>
                Combatants preparing...
              </div>
            )}
          </div>
        </div>

        {/* Result */}
        {phase === 'result' && (
          <div style={{
            padding: '0 1rem 1.5rem',
            textAlign: 'center',
            animation: 'slideUp 0.4s ease-out',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.1rem',
              color: winner === 'attacker' ? '#00ff88' : '#e94560',
              marginBottom: '0.75rem',
              textShadow: winner === 'attacker' ? '0 0 20px #00ff88' : '0 0 20px #e94560',
            }}>
              {winner === 'attacker'
                ? `🏆 ${attacker.piece.color} ${attacker.piece.type} wins! Capture succeeds!`
                : `🛡️ ${defender.piece.color} ${defender.piece.type} survives! Attacker retreats!`}
            </div>

            <button
              className="btn-primary px-8 py-3"
              onClick={() => onBattleEnd(winner === 'attacker')}
            >
              Continue Game →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
