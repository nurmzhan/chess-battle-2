export const dynamic = 'force-dynamic';
'use client';
// src/app/login/page.tsx
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', {
      login,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError('Invalid username/email or password');
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card-elevated p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">♔</div>
          <h1 className="display-title text-2xl">Sign In</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Return to the battlefield
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
              USERNAME OR EMAIL
            </label>
            <input
              className="input"
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              placeholder="Enter username or email"
              required
            />
          </div>

          <div>
            <label className="block mb-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
              PASSWORD
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded" style={{ background: 'rgba(233,69,96,0.1)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? 'Signing in...' : '⚔️ Enter Arena'}
          </button>
        </form>

        <div className="text-center mt-6" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No account?{' '}
          <Link href="/register" style={{ color: 'var(--accent)' }}>
            Register here
          </Link>
        </div>

        <div className="text-center mt-3">
          <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
