'use client';
// src/components/ui/LobbyPage.tsx
import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

interface LeaderboardEntry {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

export function LobbyPage({ user }: { user: User }) {
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(d => setLeaderboard(d.leaderboard || []));
  }, []);

  const createGame = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/game', { method: 'POST' });
      const data = await res.json();
      if (data.game?.roomCode) {
        router.push(`/game/${data.game.roomCode}`);
      }
    } catch {
      setError('Failed to create game');
    }
    setLoading(false);
  };

  const joinGame = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/game/${joinCode.toUpperCase()}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/game/${joinCode.toUpperCase()}`);
      } else {
        setError(data.error || 'Failed to join');
      }
    } catch {
      setError('Failed to join game');
    }
    setLoading(false);
  };

  const totalGames = user.wins + user.losses + user.draws;
  const winRate = totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0;

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">♛</span>
          <h1 className="display-title text-xl">Chess Roguelite</h1>
        </div>
        <div className="flex items-center gap-4">
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>{user.name}</span>
            <span className="ml-2" style={{ color: 'var(--text-muted)' }}>#{user.rating}</span>
          </div>
          <button className="btn-secondary text-sm" onClick={() => signOut({ callbackUrl: '/' })}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left - Player stats */}
        <div className="space-y-4">
          <div className="card-elevated p-5">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">♔</div>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: '1.2rem' }}>
                {user.name}
              </h2>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Rating: {user.rating}</div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Wins', value: user.wins, color: 'var(--green)' },
                { label: 'Losses', value: user.losses, color: 'var(--red)' },
                { label: 'Draws', value: user.draws, color: 'var(--accent)' },
              ].map(stat => (
                <div key={stat.label} className="card p-2">
                  <div style={{ color: stat.color, fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: '700' }}>
                    {stat.value}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="flex justify-between mb-1" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Win Rate</span>
                <span style={{ color: 'var(--green)' }}>{winRate}%</span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: '6px', background: 'var(--bg-deep)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${winRate}%`, background: 'linear-gradient(90deg, var(--red), var(--green))' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Center - Play */}
        <div className="space-y-4">
          <div className="card-elevated p-6">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: '1rem' }}>
              CREATE GAME
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Create a new game room and share the code with your opponent.
            </p>
            <button
              className="btn-primary w-full py-3 text-base"
              onClick={createGame}
              disabled={loading}
            >
              ⚔️ Create New Game
            </button>
          </div>

          <div className="card-elevated p-6">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: '1rem' }}>
              JOIN GAME
            </h2>
            <input
              className="input mb-3"
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter room code..."
              maxLength={6}
            />
            <button
              className="btn-secondary w-full py-3"
              onClick={joinGame}
              disabled={loading || !joinCode.trim()}
            >
              🛡️ Join Game
            </button>
          </div>

          {error && (
            <div className="p-3 rounded text-center" style={{ background: 'rgba(233,69,96,0.1)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}
        </div>

        {/* Right - Leaderboard */}
        <div className="card-elevated p-5">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: '1rem' }}>
            🏆 LEADERBOARD
          </h2>
          <div className="space-y-2">
            {leaderboard.slice(0, 10).map((player, i) => (
              <div
                key={player.id}
                className="flex items-center gap-3 p-2 rounded"
                style={{
                  background: player.username === user.name ? 'rgba(200,155,60,0.1)' : 'transparent',
                  border: player.username === user.name ? '1px solid rgba(200,155,60,0.3)' : '1px solid transparent',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-display)',
                  color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--text-muted)',
                  width: '1.5rem',
                  textAlign: 'center',
                  fontSize: '0.85rem',
                }}>
                  {i === 0 ? '♛' : i === 1 ? '♜' : i === 2 ? '♞' : `${i + 1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player.username}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {player.wins}W {player.losses}L
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: '0.85rem' }}>
                  {player.rating}
                </span>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                No games played yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* How to play */}
      <div className="mt-8 card p-6">
        <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', marginBottom: '1rem' }}>
          ⚡ HOW BATTLES WORK
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>1. Normal Chess Rules</strong>
            <p className="mt-1">Play chess as usual. Move pieces, develop your position, control the center.</p>
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>2. Capture = Battle</strong>
            <p className="mt-1">When you try to capture an enemy piece, they don't just disappear — they fight back in a roguelite arena!</p>
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>3. Battle Outcome</strong>
            <p className="mt-1">If your piece wins the battle, the capture succeeds. If your piece loses, it retreats and the enemy stays. Game continues either way.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
