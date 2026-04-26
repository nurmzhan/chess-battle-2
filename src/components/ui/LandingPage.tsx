'use client';
// src/components/ui/LandingPage.tsx
import Link from 'next/link';

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Animated background pieces */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {['♟','♜','♞','♝','♛','♚','♙','♖','♘','♗','♕','♔'].map((piece, i) => (
          <div
            key={i}
            className="absolute text-4xl opacity-5 select-none"
            style={{
              left: `${(i * 8.5) % 100}%`,
              top: `${(i * 13 + 10) % 90}%`,
              animation: `float ${3 + (i % 3)}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`,
            }}
          >
            {piece}
          </div>
        ))}
      </div>

      <div className="relative z-10 text-center max-w-2xl">
        {/* Logo */}
        <div className="mb-2 text-6xl">♛</div>
        
        <h1 className="display-title text-5xl mb-3" style={{ fontSize: 'clamp(2rem, 6vw, 4rem)' }}>
          Chess Roguelite
        </h1>
        
        <p className="text-xl mb-2" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          When pieces clash, they fight for their lives.
        </p>
        
        <p className="mb-8" style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Multiplayer chess where captures trigger 2D roguelite battles. 
          The attacker only wins the square if they survive combat.
        </p>

        {/* Feature icons */}
        <div className="grid grid-cols-3 gap-4 mb-10 max-w-md mx-auto">
          {[
            { icon: '⚔️', label: 'Capture Battles' },
            { icon: '🏆', label: 'Ranked Matches' },
            { icon: '📊', label: 'Track Your Stats' },
          ].map(f => (
            <div key={f.label} className="card p-3 text-center">
              <div className="text-2xl mb-1">{f.icon}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'var(--font-display)' }}>
                {f.label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/register">
            <button className="btn-primary text-lg px-8 py-3">
              ⚔️ Enter the Arena
            </button>
          </Link>
          <Link href="/login">
            <button className="btn-secondary text-lg px-8 py-3">
              Sign In
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
