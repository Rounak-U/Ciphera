"use client";

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import ChatWindow from '@/components/ChatWindow';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Lock, MessageSquare } from 'lucide-react';
import { theme } from '@/lib/theme';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const router = useRouter();

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: theme.bg, color: theme.textDim }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="size-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: theme.accent, borderTopColor: 'transparent' }}
          />
          <p className="text-sm">Authenticating…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: theme.bg, color: theme.text }}
    >
      <Sidebar
        onSelectConversation={setActiveConversationId}
        activeConversationId={activeConversationId}
      />

      {activeConversationId ? (
        <ChatWindow conversationId={activeConversationId} />
      ) : (
        <div
          className="flex flex-1 flex-col items-center justify-center border-l px-6"
          style={{
            background: theme.bg,
            borderColor: theme.borderMuted,
          }}
        >
          <div
            className="mb-6 flex size-20 items-center justify-center rounded-2xl border"
            style={{
              background: theme.accentSoft,
              borderColor: theme.border,
            }}
          >
            <MessageSquare className="size-9" style={{ color: theme.accent }} strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: theme.text }}>
            Secure End-to-End Encrypted Chat
          </h2>
          <p
            className="mt-2 max-w-md text-center text-sm leading-relaxed"
            style={{ color: theme.textDim }}
          >
            Select a conversation from the sidebar or search for a user to start a secure chat
            session. Messages are protected using hybrid cryptography (RSA-OAEP + AES-256-GCM) with
            automatic key rotation.
          </p>
          <div
            className="mt-6 flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium"
            style={{
              background: theme.accentSoft,
              borderColor: theme.border,
              color: theme.accentMuted,
            }}
          >
            <Lock className="size-3.5" />
            E2E Encrypted · Zero plaintext on server
          </div>
        </div>
      )}
    </div>
  );
}
