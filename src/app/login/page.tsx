'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Failed to login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 10% 20%, hsl(220, 25%, 10%) 0%, hsl(220, 25%, 5%) 90%)',
      padding: '1.5rem'
    }}>
      <div className="card glass" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2rem',
            background: 'linear-gradient(135deg, white, hsl(var(--accent)))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.5rem'
          }}>
            Office Claim
          </h1>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
            Monthly Expense Claim Portal
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'hsl(var(--danger) / 0.12)',
            border: '1px solid hsl(var(--danger) / 0.25)',
            color: 'hsl(var(--danger))',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '1.5rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'hsl(var(--text-muted))'
              }} />
              <input
                id="username"
                type="text"
                placeholder="Enter username"
                className="form-input"
                style={{ width: '100%', paddingLeft: '2.75rem' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'hsl(var(--text-muted))'
              }} />
              <input
                id="password"
                type="password"
                placeholder="Enter password"
                className="form-input"
                style={{ width: '100%', paddingLeft: '2.75rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.875rem' }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1.5rem' }}>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', fontWeight: '600' }}>
            Demo Access Accounts
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
            <div className="glass" style={{ padding: '0.5rem', borderRadius: '8px', fontSize: '0.75rem' }}>
              <div style={{ color: 'hsl(var(--accent))', fontWeight: '600' }}>Admin</div>
              <div style={{ color: 'hsl(var(--text-muted))' }}>admin</div>
              <div style={{ color: 'hsl(var(--text-muted))' }}>adminpassword</div>
            </div>
            <div className="glass" style={{ padding: '0.5rem', borderRadius: '8px', fontSize: '0.75rem' }}>
              <div style={{ color: 'hsl(var(--accent))', fontWeight: '600' }}>Staff</div>
              <div style={{ color: 'hsl(var(--text-muted))' }}>staff</div>
              <div style={{ color: 'hsl(var(--text-muted))' }}>staffpassword</div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
