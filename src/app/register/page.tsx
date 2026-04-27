export const dynamic = 'force-dynamic';
'use client';
// src/app/register/page.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username, email: form.email, password: form.password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Registration failed');
      setLoading(false);
      return;
    }

    // Auto sign in
    await signIn('credentials', {
      login: form.username,
      password: form.password,
      redirect: false,
    });

    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card-elevated p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⚔️</div>
          <h1 className="display-title text-2xl">Join the Battle</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Create your warrior account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'username', label: 'USERNAME', type: 'text', placeholder: 'Choose a username' },
            { key: 'email', label: 'EMAIL', type: 'email', placeholder: 'Enter your email' },
            { key: 'password', label: 'PASSWORD', type: 'password', placeholder: 'Min 6 characters' },
            { key: 'confirm', label: 'CONFIRM PASSWORD', type: 'password', placeholder: 'Repeat password' },
          ].map(field => (
            <div key={field.key}>
              <label className="block mb-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
                {field.label}
              </label>
              <input
                className="input"
                type={field.type}
                value={(form as any)[field.key]}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                required
              />
            </div>
          ))}

          {error && (
            <div className="p-3 rounded" style={{ background: 'rgba(233,69,96,0.1)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? 'Creating account...' : '🛡️ Create Account'}
          </button>
        </form>

        <div className="text-center mt-6" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent)' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
