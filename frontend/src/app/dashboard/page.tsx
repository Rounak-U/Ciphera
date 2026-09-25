"use client";

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import ChatWindow from '@/components/ChatWindow';
import RuixenMoonChat from '@/components/ui/ruixen-moon-chat';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Lock, MessageSquare } from 'lucide-react';
import { theme } from '@/lib/theme';
import PixelBlast from '@/components/ui/PixelBlast';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatTheme, setChatTheme] = useState<'default' | 'ruixen' | 'sunset'>('default');
  const router = useRouter();

  useEffect(() => {
    const savedTheme = localStorage.getItem('ciphera_chatTheme') as 'default' | 'ruixen' | 'sunset' | null;
    if (savedTheme) {
      setChatTheme(savedTheme);
    }
  }, []);

  const handleThemeChange = (newTheme: 'default' | 'ruixen' | 'sunset') => {
    setChatTheme(newTheme);
    localStorage.setItem('ciphera_chatTheme', newTheme);
  };

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
      <div className={`h-full w-full md:w-80 shrink-0 ${activeConversationId ? 'hidden md:block' : 'block'}`}>
        <Sidebar
          onSelectConversation={setActiveConversationId}
          activeConversationId={activeConversationId}
          onThemeChange={handleThemeChange}
        />
      </div>

      <div className={`flex flex-1 flex-col min-w-0 ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        {activeConversationId ? (
          <ChatWindow conversationId={activeConversationId} onBack={() => setActiveConversationId(null)} chatTheme={chatTheme} />
        ) : (
        <div
          className="relative flex flex-1 flex-col items-center justify-center overflow-hidden border-l px-6"
          style={{
            background: theme.bg,
            borderColor: theme.borderMuted,
          }}
        >
          {/* PixelBlast Background */}
          <div className="absolute inset-0 z-0 overflow-hidden blur-[1px] opacity-90">
            <PixelBlast
              variant="square"
              pixelSize={4}
              color="#4ade80"
              patternScale={2}
              patternDensity={1}
              pixelSizeJitter={0}
              enableRipples={true}
              rippleSpeed={0.4}
              rippleThickness={0.12}
              rippleIntensityScale={1.5}
              liquid={false}
              liquidStrength={0.12}
              liquidRadius={1.2}
              liquidWobbleSpeed={5}
              speed={0.5}
              edgeFade={0.25}
              transparent={true}
            />
          </div>

          <div className="z-10 flex flex-col items-center">
            <div
              className="mb-6 flex size-20 items-center justify-center rounded-2xl border shadow-[0_0_30px_-5px_rgba(74,222,128,0.2)] backdrop-blur-md"
              style={{
                background: 'rgba(74, 222, 128, 0.05)',
                borderColor: theme.border,
              }}
            >
              <MessageSquare className="size-9" style={{ color: theme.accent }} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: theme.text, textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
              Secure End-to-End Encrypted Chat
            </h2>
            <p
              className="mt-2 max-w-md text-center text-sm leading-relaxed"
              style={{ color: theme.textDim, textShadow: '0 1px 5px rgba(0,0,0,0.8)' }}
            >
              Select a conversation from the sidebar or search for a user to start a secure chat
              session. Messages are protected using hybrid cryptography (RSA-OAEP + AES-256-GCM) with
              automatic key rotation.
            </p>
            <div
              className="mt-8 flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-[0_0_20px_-5px_rgba(74,222,128,0.15)] backdrop-blur-md"
              style={{
                background: 'rgba(74, 222, 128, 0.05)',
                borderColor: theme.border,
                color: theme.accentMuted,
              }}
            >
              <Lock className="size-3.5" />
              E2E Encrypted · Zero plaintext on server
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
