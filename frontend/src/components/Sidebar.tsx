"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Plus, User as UserIcon, LogOut, Shield, ShieldAlert, Trash2, MoreVertical, Palette } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { generateSessionKey, encryptSessionKey, importPublicKey } from '@securechat/crypto';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { theme } from '@/lib/theme';
import { Dancing_Script } from 'next/font/google';

const dancingScript = Dancing_Script({ weight: '700', subsets: ['latin'] });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function Sidebar({
  onSelectConversation,
  activeConversationId,
  onThemeChange,
}: {
  onSelectConversation: (id: string) => void;
  activeConversationId: string | null;
  onThemeChange?: (theme: 'default' | 'ruixen' | 'sunset') => void;
}) {
  const { user, logout, deleteAccount, getPrivateKey } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (socket) {
      const handleNewMessage = () => {
        console.log('🔔 Sidebar received real-time socket ping! Fetching latest conversations...');
        fetchConversations();
      };

      socket.on('receive_message', handleNewMessage);

      return () => {
        socket.off('receive_message', handleNewMessage);
      };
    }
  }, [socket]);

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API_URL}/conversations`);
      setConversations(res.data);
    } catch (error: any) {
      console.warn('Failed to fetch conversations:', error.message || error);
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length > 2) {
      setIsSearching(true);
      try {
        const res = await axios.get(`${API_URL}/users?q=${q}`);
        setSearchResults(res.data);
      } catch (error: any) {
        console.warn('Search failed:', error.message || error);
      }
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  };

  const startConversation = async (targetUser: any) => {
    try {
      const sessionKey = await generateSessionKey();
      const targetPublicKey = await importPublicKey(targetUser.publicKey);
      const encryptedForTarget = await encryptSessionKey(sessionKey, targetPublicKey);
      const myPublicKey = await importPublicKey(user!.publicKey);
      const encryptedForSelf = await encryptSessionKey(sessionKey, myPublicKey);

      const initialEncryptedKeyMaterial = {
        [targetUser.id]: encryptedForTarget,
        [user!.id]: encryptedForSelf,
      };

      const res = await axios.post(`${API_URL}/conversations`, {
        targetUserId: targetUser.id,
        initialEncryptedKeyMaterial,
      });

      setSearchQuery('');
      setIsSearching(false);
      await fetchConversations();
      onSelectConversation(res.data.id);
    } catch (error: any) {
      console.warn('Failed to start conversation:', error.message || error);
      alert(
        'Failed to start conversation due to cryptographic constraints. Did you lose your private key?',
      );
    }
  };

  const handleSelectConversation = (id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, _count: { ...c._count, messages: 0 } } : c
      )
    );
    onSelectConversation(id);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("Are you sure you want to permanently delete your account? This will wipe all your conversations and session keys, and cannot be undone.");
    if (!confirmed) return;

    try {
      await deleteAccount();
      router.push('/login');
    } catch (error) {
      alert("Failed to delete account. Please try again.");
    }
  };

  return (
    <div
      className="flex h-full w-full flex-col md:border-r"
      style={{ background: theme.card, borderColor: theme.borderMuted, color: theme.text }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-2.5">
          <h2
            className={`${dancingScript.className} tracking-tight`}
            style={{
              color: '#4ade80',
              fontSize: '1.75rem',
              textShadow: '0 0 10px rgba(74, 222, 128, 0.4)',
              lineHeight: 1,
            }}
          >
            Ciphera
          </h2>
        </div>
        <div className="flex items-center gap-1 relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="rounded-lg p-2 transition-colors hover:opacity-80"
            style={{ color: theme.textMuted }}
            title="Settings"
          >
            <MoreVertical size={18} strokeWidth={1.5} />
          </button>

          {showSettings && (
            <div
              className="absolute top-full right-0 mt-2 w-56 rounded-xl shadow-lg border z-50 overflow-hidden"
              style={{ background: theme.surface, borderColor: theme.border }}
            >
              <div className="py-1">
                <Link
                  href="/security"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                  style={{ color: theme.text }}
                  onClick={() => setShowSettings(false)}
                >
                  <ShieldAlert size={16} style={{ color: theme.textMuted }} />
                  Security Lab
                </Link>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                  style={{ color: theme.text }}
                  onClick={() => {
                    onThemeChange?.('default');
                    setShowSettings(false);
                  }}
                >
                  <Palette size={16} style={{ color: theme.textMuted }} />
                  Default Theme
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                  style={{ color: theme.text }}
                  onClick={() => {
                    onThemeChange?.('ruixen');
                    setShowSettings(false);
                  }}
                >
                  <Palette size={16} style={{ color: theme.textMuted }} />
                  Ruixen Moon Theme
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                  style={{ color: theme.text }}
                  onClick={() => {
                    onThemeChange?.('sunset');
                    setShowSettings(false);
                  }}
                >
                  <Palette size={16} style={{ color: theme.textMuted }} />
                  Sunset Theme
                </button>
                <div className="h-px w-full my-1" style={{ background: theme.borderMuted }}></div>
                <button
                  onClick={() => {
                    setShowSettings(false);
                    handleDeleteAccount();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 size={16} />
                  Delete Account
                </button>
                <button
                  onClick={() => {
                    setShowSettings(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-red-500 hover:bg-red-500/10"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            style={{ color: theme.textDim }}
            strokeWidth={2}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search users…"
            className="block w-full rounded-lg py-2.5 pr-3 pl-10 text-sm outline-none transition-shadow focus:ring-2"
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              color: theme.text,
            }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3">
        {isSearching ? (
          <div className="py-2">
            <h3
              className="mb-2 px-2 text-[11px] font-semibold tracking-wider uppercase"
              style={{ color: theme.textDim }}
            >
              Results
            </h3>
            {searchResults.map((u) => (
              <div
                key={u.id}
                onClick={() => startConversation(u)}
                className="mx-1 mb-1 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme.surfaceHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Avatar initials={u.username?.[0]?.toUpperCase() || '?'} active={false} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.username}</p>
                </div>
                <Plus size={16} style={{ color: theme.accent }} />
              </div>
            ))}
            {searchResults.length === 0 && (
              <p className="px-2 text-sm" style={{ color: theme.textDim }}>
                No users found.
              </p>
            )}
          </div>
        ) : (
          <div className="py-2">
            <h3
              className="mb-2 px-2 text-[11px] font-semibold tracking-wider uppercase"
              style={{ color: theme.textDim }}
            >
              Recent Chats
            </h3>
            {(() => {
              const visibleConvs = conversations.filter(
                (conv) => activeConversationId === conv.id || (conv.messages && conv.messages.length > 0)
              );

              if (visibleConvs.length === 0) {
                return (
                  <p className="px-2 py-4 text-center text-sm" style={{ color: theme.textDim }}>
                    No conversations yet. Search for a user to start chatting.
                  </p>
                );
              }

              return visibleConvs.map((conv) => {
                const otherMember = conv.members.find((m: any) => m.userId !== user?.id)?.user;
                if (!otherMember) return null;

                const isActive = activeConversationId === conv.id;
                const unreadCount = conv._count?.messages || 0;

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className="mx-1 mb-1 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                    style={{
                      background: isActive ? theme.accentSoft : 'transparent',
                      border: isActive ? `1px solid ${theme.border}` : '1px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = theme.surfaceHover;
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Avatar
                      initials={otherMember.username?.[0]?.toUpperCase() || '?'}
                      active={isActive}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium"
                        style={{ color: isActive ? theme.accent : theme.text }}
                      >
                        {otherMember.username}
                      </p>
                      <p className="mt-0.5 truncate text-xs" style={{ color: theme.textDim }}>
                        {conv.messages && conv.messages[0]
                          ? 'Encrypted message…'
                          : 'No messages yet'}
                      </p>
                    </div>
                    {!isActive && unreadCount > 0 && (
                      <div
                        className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-black"
                        style={{ background: theme.accent }}
                      >
                        {unreadCount}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* User footer */}
      <div className="border-t p-4" style={{ borderColor: theme.borderMuted, background: theme.surface }}>
        <div className="flex items-center gap-3">
          <Avatar initials={user?.username?.[0]?.toUpperCase() || 'U'} active={false} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.username}</p>
            <p className="truncate text-xs" style={{ color: theme.textDim }}>
              {user?.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ initials, active }: { initials: string; active: boolean }) {
  return (
    <div
      className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      style={{
        background: active ? theme.accentMuted : theme.surface,
        color: active ? theme.bg : theme.textMuted,
        border: `1px solid ${active ? theme.accent : theme.border}`,
      }}
    >
      {initials}
    </div>
  );
}
