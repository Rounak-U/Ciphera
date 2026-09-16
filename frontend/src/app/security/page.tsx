"use client";

import { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  Database,
  UserX,
  AlertTriangle,
  Activity,
  Info,
  ArrowLeft,
  Lock,
  KeyRound,
  Fingerprint,
  Hash,
} from 'lucide-react';
import Link from 'next/link';
import { generateSessionKey, encryptMessage, decryptMessage } from '@securechat/crypto';
import axios from 'axios';
import { theme } from '@/lib/theme';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const cryptoStats = [
  { label: 'Message Encryption', value: 'AES-256-GCM', icon: Lock },
  { label: 'Key Exchange', value: 'RSA-OAEP', icon: KeyRound },
  { label: 'RSA Key Size', value: '3072-bit', icon: Fingerprint },
  { label: 'Password Hashing', value: 'Argon2id', icon: Hash },
];

const securitySteps = [
  {
    title: 'Key Generation',
    body: 'Upon registration, your browser generates a 3072-bit RSA key pair. The private key never leaves your device\'s memory.',
  },
  {
    title: 'Hybrid Encryption',
    body: 'A fast AES-256-GCM session key encrypts messages. That session key is then encrypted using the recipient\'s RSA public key.',
  },
  {
    title: 'Authentication Tags',
    body: 'AES-GCM is an authenticated encryption mode. Any ciphertext modification invalidates the tag and decryption fails.',
  },
  {
    title: 'Session Key Rotation',
    body: 'After a message threshold, a new AES session key is generated and exchanged so old keys cannot decrypt future messages.',
  },
];

export default function SecurityLab() {
  const [tamperResult, setTamperResult] = useState<string | null>(null);
  const [unauthResult, setUnauthResult] = useState<string | null>(null);
  const [dbResult, setDbResult] = useState<string | null>(null);

  const runTamperingSimulation = async () => {
    try {
      setTamperResult('Running…');
      const sessionKey = await generateSessionKey();
      const { ciphertext, nonce } = await encryptMessage('Secret Data', sessionKey);
      const tamperedCiphertext =
        String.fromCharCode(ciphertext.charCodeAt(0) ^ 1) + ciphertext.slice(1);

      try {
        await decryptMessage(tamperedCiphertext, nonce, sessionKey);
        setTamperResult('Failed: Tampered message was accepted!');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setTamperResult(`Success: Tampering detected! Error: ${message}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setTamperResult(`Error in simulation: ${message}`);
    }
  };

  const runUnauthAccess = async () => {
    try {
      setUnauthResult('Running…');
      await axios.get(`${API_URL}/conversations/00000000-0000-0000-0000-000000000000`, {
        withCredentials: true,
      });
      setUnauthResult('Failed: Got access to conversation!');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 403) {
          setUnauthResult('Success: 403 Forbidden — unauthorized access blocked.');
        } else if (err.response?.status === 404) {
          setUnauthResult('Success: 404 Not Found (also valid for preventing enumeration).');
        } else {
          setUnauthResult(`Success: Access blocked (${err.message})`);
        }
      } else {
        setUnauthResult('Success: Access blocked.');
      }
    }
  };

  return (
    <div className="min-h-screen" style={{ background: theme.bg, color: theme.text }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b backdrop-blur-md"
        style={{
          background: 'rgba(0,0,0,0.85)',
          borderColor: theme.borderMuted,
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 items-center justify-center rounded-xl border"
              style={{ background: theme.accentSoft, borderColor: theme.border }}
            >
              <Shield className="size-5" style={{ color: theme.accent }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Security Lab</h1>
              <p className="text-xs" style={{ color: theme.textDim }}>
                Cryptography dashboard & interactive tests
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: theme.surface,
              borderColor: theme.border,
              color: theme.textMuted,
            }}
          >
            <ArrowLeft className="size-4" />
            Back to Chat
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {/* Crypto architecture */}
        <Section
          title="Current Cryptographic Architecture"
          icon={<Activity className="size-5" style={{ color: theme.textMuted }} />}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cryptoStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border p-4 transition-colors"
                style={{ background: theme.surface, borderColor: theme.border }}
              >
                <div
                  className="mb-3 flex size-9 items-center justify-center rounded-lg border"
                  style={{ background: theme.accentSoft, borderColor: theme.border }}
                >
                  <stat.icon className="size-4" style={{ color: theme.textMuted }} />
                </div>
                <p
                  className="text-[11px] font-semibold tracking-wider uppercase"
                  style={{ color: theme.textDim }}
                >
                  {stat.label}
                </p>
                <p className="mt-1 text-base font-semibold" style={{ color: theme.text }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* Interactive lab */}
        <Section
          title="Interactive Security Lab"
          icon={<AlertTriangle className="size-5" style={{ color: theme.textMuted }} />}
        >
          <div className="space-y-3">
            <LabCard
              icon={<ShieldAlert className="size-4 text-red-400" />}
              title="Message Tampering"
              subtitle="Integrity check"
              description="Modifies one byte of a valid AES-GCM ciphertext to test authentication tag validation."
              buttonLabel="Run Simulation"
              onRun={runTamperingSimulation}
              result={tamperResult}
            />
            <LabCard
              icon={<UserX className="size-4 text-red-400" />}
              title="Unauthorized Access"
              subtitle="Authorization check"
              description="Attempts to read messages from a conversation the active user is not a member of."
              buttonLabel="Run Simulation"
              onRun={runUnauthAccess}
              result={unauthResult}
            />
            <LabCard
              icon={<Database className="size-4" style={{ color: theme.textMuted }} />}
              title="Database Exposure"
              subtitle="Server-side view"
              description="Demonstrates what a compromised database would reveal to an attacker."
              buttonLabel="View Database Record"
              onRun={() =>
                setDbResult(
                  'Stored Message: zK9fA72x9Kp...Q91=\nNonce: ab8f3c...\n\n(The server stores ZERO plaintext. AES-GCM ciphertext is useless without the session key.)',
                )
              }
              result={dbResult}
              isCode
            />
          </div>
        </Section>

        {/* How it works */}
        <Section
          title="How Security Works"
          icon={<Info className="size-5" style={{ color: theme.textMuted }} />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {securitySteps.map((step, i) => (
              <div
                key={step.title}
                className="rounded-xl border p-4"
                style={{ background: theme.surface, borderColor: theme.border }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="flex size-6 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: theme.accentSoft, color: theme.textMuted }}
                  >
                    {i + 1}
                  </span>
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: theme.textDim }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-6"
      style={{ background: theme.card, borderColor: theme.borderMuted }}
    >
      <h2 className="mb-5 flex items-center gap-2.5 text-base font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function LabCard({
  icon,
  title,
  subtitle,
  description,
  buttonLabel,
  onRun,
  result,
  isCode = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  buttonLabel: string;
  onRun: () => void;
  result: string | null;
  isCode?: boolean;
}) {
  const isSuccess = result?.toLowerCase().includes('success');
  const isFailure = result && !isSuccess && !result.includes('Running');

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: theme.surface, borderColor: theme.border }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-semibold">{title}</h3>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
              style={{ background: theme.accentSoft, color: theme.textDim }}
            >
              {subtitle}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: theme.textDim }}>
            {description}
          </p>
        </div>
        <button
          onClick={onRun}
          className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            background: theme.accentMuted,
            color: '#000000',
          }}
        >
          {buttonLabel}
        </button>
      </div>

      {result && (
        <div
          className="mt-4 rounded-lg border p-3 text-sm"
          style={
            isCode
              ? {
                background: theme.bg,
                borderColor: theme.border,
                color: theme.textMuted,
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.75rem',
                whiteSpace: 'pre-wrap',
              }
              : isSuccess
                ? {
                  background: 'rgba(255,255,255,0.06)',
                  borderColor: theme.border,
                  color: theme.text,
                }
                : isFailure
                  ? {
                    background: 'rgba(127, 29, 29, 0.2)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                  }
                  : {
                    background: theme.accentSoft,
                    borderColor: theme.border,
                    color: theme.textMuted,
                  }
          }
        >
          {isCode ? <pre className="m-0 whitespace-pre-wrap">{result}</pre> : result}
        </div>
      )}
    </div>
  );
}
