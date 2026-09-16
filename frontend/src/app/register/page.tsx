"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { User, Mail, Lock } from 'lucide-react';
import {
  ModernAuthLayout,
  authErrorStyle,
  authInputStyle,
  authSubmitStyle,
} from '@/components/ui/modern-login-signup';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const getPasswordStrength = (pass: string) => {
    let strength = 0;
    if (pass.length > 7) strength += 1;
    if (/[A-Z]/.test(pass)) strength += 1;
    if (/[0-9]/.test(pass)) strength += 1;
    if (/[^A-Za-z0-9]/.test(pass)) strength += 1;
    return strength;
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (strength < 2) {
      return setError(
        'Password is too weak. Please include letters, numbers, and symbols.',
      );
    }

    try {
      setIsGeneratingKeys(true);
      await register(username, email, password);
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
          : 'Failed to register';
      setError(message);
      setIsGeneratingKeys(false);
    }
  };

  return (
    <ModernAuthLayout mode="register">
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
          <User style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#888' }} />
          <input
            style={{ ...authInputStyle, paddingLeft: '2.5rem' }}
            type="text"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
          />
        </div>

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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        </div>

        {password && (
          <div style={{ display: 'flex', height: 4, gap: 4 }}>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderRadius: 9999,
                  background:
                    i < strength
                      ? strength > 2
                        ? '#ededed'
                        : strength === 2
                          ? '#eab308'
                          : '#ef4444'
                      : '#333',
                }}
              />
            ))}
          </div>
        )}

        <button
          type="submit"
          style={{
            ...authSubmitStyle,
            opacity: isGeneratingKeys ? 0.7 : 1,
          }}
          disabled={isGeneratingKeys}
        >
          {isGeneratingKeys
            ? 'Generating 3072-bit RSA Keys...'
            : 'Sign Up with Email'}
        </button>

        <div
          style={{
            borderRadius: 6,
            border: '1px solid #333',
            background: 'rgba(255,255,255,0.03)',
            padding: '0.75rem',
            fontSize: '0.75rem',
            color: '#888',
            lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          <strong style={{ color: '#ccc', display: 'block', marginBottom: 4 }}>
            Security Information
          </strong>
          During registration, a 3072-bit RSA key pair is generated locally. The
          private key never leaves your device.
        </div>
      </form>
    </ModernAuthLayout>
  );
}
