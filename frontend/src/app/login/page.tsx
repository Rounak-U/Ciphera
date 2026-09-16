"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Lock } from 'lucide-react';
import {
  ModernAuthLayout,
  authErrorStyle,
  authInputStyle,
  authSubmitStyle,
} from '@/components/ui/modern-login-signup';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'error' in err.response.data &&
        typeof err.response.data.error === 'string'
          ? err.response.data.error
          : 'Failed to login';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModernAuthLayout mode="login">
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}
      >
        {error && (
          <div role="alert" style={authErrorStyle}>
            {error}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <Mail style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#888' }} />
          <input
            style={{ ...authInputStyle, paddingLeft: '2.5rem' }}
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
          />
        </div>

        <div style={{ position: 'relative' }}>
          <Lock style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#888' }} />
          <input
            style={{ ...authInputStyle, paddingLeft: '2.5rem' }}
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        </div>

        <button
          type="submit"
          style={authSubmitStyle}
          disabled={submitting}
        >
          {submitting ? 'Signing in…' : 'Continue with Email'}
        </button>
      </form>
    </ModernAuthLayout>
  );
}
