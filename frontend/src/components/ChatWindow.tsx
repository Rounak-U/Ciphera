"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import {
  encryptMessage,
  decryptMessage,
  decryptSessionKey,
  generateSessionKey,
  encryptSessionKey,
} from '@securechat/crypto';
import { Send, Lock, ShieldAlert, Check, CheckCheck, KeyRound, Smile, ArrowLeft } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { theme } from '@/lib/theme';
import { PromptInput } from "@/components/ui/ai-chat-input";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const ROTATION_LIMIT = 30;

const playSound = (type: 'send' | 'receive') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'send') {
      // Quick ascending bloop
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else {
      // Soft ding
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {
    // Ignore audio errors
  }
};

export default function ChatWindow({ conversationId, onBack, chatTheme = 'default' }: { conversationId: string; onBack?: () => void; chatTheme?: 'default' | 'ruixen' | 'sunset' }) {
  const { user, getPrivateKey } = useAuth();
  const { socket, isConnected } = useSocket();

  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');

  const [activeSessionKey, setActiveSessionKey] = useState<CryptoKey | null>(null);
  const [activeKeyVersion, setActiveKeyVersion] = useState<number>(0);
  const [decryptionErrors, setDecryptionErrors] = useState<Record<string, string>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      loadConversation();
    }
  }, [conversationId]);

  useEffect(() => {
    if (socket && conversationId) {
      socket.emit('join_conversation', conversationId);

      const handleReceive = (msg: any) => {
        if (msg.conversationId === conversationId) {
          processIncomingMessage(msg);
        }
      };

      const handleRotation = (newKeyData: any) => {
        if (newKeyData.conversationId === conversationId) {
          loadSessionKey(newKeyData);
        }
      };

      const handleDelivered = (data: any) => {
        if (data.conversationId === conversationId) {
          setMessages((prev) =>
            prev.map((m) =>
              data.messageIds.includes(m.id)
                ? { ...m, deliveredAt: data.deliveredAt || new Date() }
                : m,
            ),
          );
        }
      };

      const handleRead = (data: any) => {
        if (data.conversationId === conversationId) {
          setMessages((prev) =>
            prev.map((m) =>
              data.messageIds.includes(m.id)
                ? { ...m, readAt: data.readAt || new Date() }
                : m,
            ),
          );
        }
      };

      socket.on('receive_message', handleReceive);
      socket.on('key_rotation', handleRotation);
      socket.on('message_delivered', handleDelivered);
      socket.on('message_read', handleRead);

      return () => {
        socket.off('receive_message', handleReceive);
        socket.off('key_rotation', handleRotation);
        socket.off('message_delivered', handleDelivered);
        socket.off('message_read', handleRead);
      };
    }
  }, [socket, conversationId, activeSessionKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    const markUnreadAsRead = () => {
      if (document.hasFocus() && socket) {
        const unreadIds = messages
          .filter((m) => m.senderId !== user?.id && !m.readAt)
          .map((m) => m.id);

        if (unreadIds.length > 0) {
          socket.emit('message_read', { conversationId, messageIds: unreadIds });
        }
      }
    };

    markUnreadAsRead();
    window.addEventListener('focus', markUnreadAsRead);
    return () => window.removeEventListener('focus', markUnreadAsRead);
  }, [messages, socket, user?.id, conversationId]);

  const loadConversation = async () => {
    try {
      const res = await axios.get(`${API_URL}/conversations/${conversationId}`);
      const conv = res.data;
      setConversation(conv);

      let loadedKey = null;
      let loadedVersion = 0;

      if (conv.sessionKeys && conv.sessionKeys.length > 0) {
        const result = await loadSessionKey(conv.sessionKeys[0]);
        if (result) {
          loadedKey = result.sessionKey;
          loadedVersion = result.keyVersion;
        }
      }

      fetchMessages(loadedKey, loadedVersion);
    } catch (error: any) {
      console.warn('Failed to load conversation:', error.message || error);
    }
  };

  const loadSessionKey = async (keyMetadata: any) => {
    try {
      const privateKey = await getPrivateKey();
      if (!privateKey) {
        throw new Error('Private key not found in memory.');
      }

      const material = JSON.parse(keyMetadata.encryptedKeyMaterial);
      const encryptedForMe = material[user!.id];

      if (!encryptedForMe) {
        throw new Error('No key material found for this user');
      }

      const sessionKey = await decryptSessionKey(encryptedForMe, privateKey);
      setActiveSessionKey(sessionKey);
      setActiveKeyVersion(keyMetadata.keyVersion);
      return { sessionKey, keyVersion: keyMetadata.keyVersion };
    } catch (error: any) {
      console.warn('Failed to load session key:', error.message || error);
      setActiveSessionKey(null);
      return null;
    }
  };

  const fetchMessages = async (keyToUse?: CryptoKey | null, versionToUse?: number) => {
    try {
      const res = await axios.get(`${API_URL}/conversations/${conversationId}/messages`);
      const rawMessages = res.data;

      const processed = await Promise.all(
        rawMessages.map((m: any) => decryptAndFormatMessage(m, keyToUse, versionToUse)),
      );
      setMessages(processed);

      if (socket) {
        const undeliveredIds = rawMessages
          .filter((m: any) => m.senderId !== user?.id && !m.deliveredAt)
          .map((m: any) => m.id);

        if (undeliveredIds.length > 0) {
          socket.emit('message_delivered', { conversationId, messageIds: undeliveredIds });
        }

        if (document.hasFocus()) {
          const unreadIds = rawMessages
            .filter((m: any) => m.senderId !== user?.id && !m.readAt)
            .map((m: any) => m.id);

          if (unreadIds.length > 0) {
            socket.emit('message_read', { conversationId, messageIds: unreadIds });
          }
        }
      }
    } catch (error: any) {
      console.warn('Failed to fetch messages:', error.message || error);
    }
  };

  const decryptAndFormatMessage = async (
    msg: any,
    keyToUse?: CryptoKey | null,
    versionToUse?: number,
  ) => {
    const key = keyToUse !== undefined ? keyToUse : activeSessionKey;
    const version = versionToUse !== undefined ? versionToUse : activeKeyVersion;

    if (!key || msg.keyVersion !== version) {
      return { ...msg, decryptedText: '[Encrypted - Key Unavailable]', isDecrypted: false };
    }

    try {
      const plaintext = await decryptMessage(msg.ciphertext, msg.nonce, key);
      return { ...msg, decryptedText: plaintext, isDecrypted: true };
    } catch (error: any) {
      setDecryptionErrors((prev) => ({ ...prev, [msg.id]: error.message }));
      return {
        ...msg,
        decryptedText: '[Tampering Detected - Authentication Failed]',
        isDecrypted: false,
        isTampered: true,
      };
    }
  };

  const processIncomingMessage = async (msg: any) => {
    const processed = await decryptAndFormatMessage(msg);
    setMessages((prev) => {
      if (prev.some((m) => m.id === processed.id)) return prev;
      return [...prev, processed];
    });

    if (msg.senderId !== user?.id && socket) {
      playSound('receive');
      socket.emit('message_delivered', { conversationId, messageIds: [msg.id] });
      if (document.hasFocus()) {
        socket.emit('message_read', { conversationId, messageIds: [msg.id] });
      }
    }
  };

  const rotateKeyIfNecessary = async () => {
    if (messages.length > 0 && messages.length % ROTATION_LIMIT === 0) {
      console.log(`Threshold reached (${ROTATION_LIMIT} messages). Rotating key...`);
      try {
        const newSessionKey = await generateSessionKey();
        const otherMember = conversation.members.find((m: any) => m.userId !== user?.id)?.user;

        const myPublicKey = await crypto.subtle.importKey(
          'spki',
          Uint8Array.from(
            atob(user!.publicKey.replace(/-----(BEGIN|END) PUBLIC KEY-----|\n/g, '')),
          ).buffer,
          { name: 'RSA-OAEP', hash: 'SHA-256' },
          true,
          ['encrypt'],
        );
        const targetPublicKey = await crypto.subtle.importKey(
          'spki',
          Uint8Array.from(
            atob(otherMember.publicKey.replace(/-----(BEGIN|END) PUBLIC KEY-----|\n/g, '')),
          ).buffer,
          { name: 'RSA-OAEP', hash: 'SHA-256' },
          true,
          ['encrypt'],
        );

        const encryptedForSelf = await encryptSessionKey(newSessionKey, myPublicKey);
        const encryptedForTarget = await encryptSessionKey(newSessionKey, targetPublicKey);

        const newVersion = activeKeyVersion + 1;

        socket?.emit('key_rotation', {
          conversationId,
          keyVersion: newVersion,
          encryptedKeyMaterial: {
            [user!.id]: encryptedForSelf,
            [otherMember.id]: encryptedForTarget,
          },
        });

        setActiveSessionKey(newSessionKey);
        setActiveKeyVersion(newVersion);
      } catch (err: any) {
        console.warn('Rotation failed:', err.message || err);
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeSessionKey || !socket) return;

    await rotateKeyIfNecessary();

    const plaintext = inputText;
    setInputText('');

    try {
      const { ciphertext, nonce } = await encryptMessage(plaintext, activeSessionKey);

      socket.emit('send_message', {
        conversationId,
        ciphertext,
        nonce,
        keyVersion: activeKeyVersion,
      });

      playSound('send');
    } catch (error: any) {
      console.warn('Failed to encrypt/send:', error.message || error);
    }
  };

  const handlePromptSubmit = async (value: string) => {
    if (!value.trim() || !activeSessionKey || !socket) return;

    await rotateKeyIfNecessary();

    try {
      const { ciphertext, nonce } = await encryptMessage(value, activeSessionKey);

      socket.emit('send_message', {
        conversationId,
        ciphertext,
        nonce,
        keyVersion: activeKeyVersion,
      });

      playSound('send');
    } catch (error: any) {
      console.warn('Failed to encrypt/send:', error.message || error);
    }
  };

  if (!conversation) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ background: theme.bg, color: theme.textDim }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="size-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: theme.accent, borderTopColor: 'transparent' }}
          />
          <p className="text-sm">Loading conversation…</p>
        </div>
      </div>
    );
  }

  const otherMember = conversation.members.find((m: any) => m.userId !== user?.id)?.user;

  return (
    <div 
      className={`flex h-full flex-1 flex-col ${chatTheme === 'ruixen' || chatTheme === 'sunset' ? 'bg-cover bg-center' : ''}`}
      style={{ 
        background: chatTheme === 'ruixen' ? undefined : (chatTheme === 'sunset' ? undefined : theme.bg),
        backgroundImage: chatTheme === 'ruixen' 
          ? "url('https://cdn.21st.dev/assets/mirror/c3/c333918af688a4a8a3d004652e6c0ee219457a9d84d380eeb31f513d4b59a09f.png')" 
          : chatTheme === 'sunset'
            ? "radial-gradient(125% 125% at 50% 101%, rgba(245,87,2,1) 10.5%, rgba(245,120,2,1) 16%, rgba(245,140,2,1) 17.5%, rgba(245,170,100,1) 25%, rgba(238,174,202,1) 40%, rgba(202,179,214,1) 65%, rgba(148,201,233,1) 100%)"
            : undefined,
        backgroundPosition: chatTheme === 'ruixen' || chatTheme === 'sunset' ? 'center' : undefined,
      }}
    >
      {/* Header */}
      <div
        className={`z-10 flex h-16 shrink-0 items-center justify-between border-b px-4 md:px-6 ${chatTheme === 'ruixen' || chatTheme === 'sunset' ? 'backdrop-blur-md' : ''}`}
        style={{
          background: (chatTheme === 'ruixen' || chatTheme === 'sunset') ? 'rgba(0, 0, 0, 0.5)' : theme.card,
          borderColor: (chatTheme === 'ruixen' || chatTheme === 'sunset') ? 'rgba(255, 255, 255, 0.1)' : theme.borderMuted,
        }}
      >
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden flex items-center justify-center p-2 -ml-2 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: theme.textDim }}
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={{
              background: theme.accentSoft,
              color: theme.accent,
              border: `1px solid ${theme.border}`,
            }}
          >
            {otherMember?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: theme.text }}>
              {otherMember?.username}
            </h3>
            <p className="text-xs" style={{ color: isConnected ? theme.accentMuted : theme.textDim }}>
              {isConnected ? 'Connected · Encrypted' : 'Reconnecting…'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs font-medium">
          <Badge icon={<Lock size={12} />} label="E2E Encrypted" accent />
          <div className="hidden md:block">
            <Badge icon={<KeyRound size={12} />} label={`Key v${activeKeyVersion}`} />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 space-y-3 overflow-y-auto p-4 md:p-6"
        style={{ background: (chatTheme === 'ruixen' || chatTheme === 'sunset') ? 'transparent' : theme.bg }}
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center py-12">
            <Lock className="mb-3 size-8 opacity-40" style={{ color: theme.accent }} />
            <p className="text-sm" style={{ color: theme.textDim }}>
              No messages yet. Send the first encrypted message.
            </p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === user?.id;
          return (
            <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[72%] px-4 py-2.5 shadow-sm"
                style={
                  msg.isTampered
                    ? {
                      background: 'rgba(127, 29, 29, 0.25)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#fca5a5',
                      borderRadius: 16,
                    }
                    : isMe
                      ? {
                        background: theme.accentMuted,
                        color: '#000000',
                        borderRadius: '16px 16px 4px 16px',
                      }
                      : {
                        background: theme.card,
                        color: theme.text,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '16px 16px 16px 4px',
                      }
                }
              >
                {msg.isTampered ? (
                  <div className="flex flex-col gap-1">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-red-400">
                      <ShieldAlert size={14} />
                      Tampering Detected
                    </div>
                    <p className="text-sm">{msg.decryptedText}</p>
                    <p className="mt-1 font-mono text-xs break-all text-red-400/80">
                      {decryptionErrors[msg.id]}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed">{msg.decryptedText}</p>
                    <div
                      className="mt-1 flex items-center justify-end gap-1 text-[10px]"
                      style={{ color: isMe ? 'rgba(0,0,0,0.5)' : theme.textDim }}
                    >
                      {msg.isDecrypted && isMe && (
                        msg.readAt ? (
                          <CheckCheck size={13} />
                        ) : msg.deliveredAt ? (
                          <CheckCheck size={13} style={{ opacity: 0.7 }} />
                        ) : (
                          <Check size={13} style={{ opacity: 0.5 }} />
                        )
                      )}
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className={`border-t p-4 ${chatTheme === 'ruixen' || chatTheme === 'sunset' ? 'backdrop-blur-md' : ''}`}
        style={{ 
          background: (chatTheme === 'ruixen' || chatTheme === 'sunset') ? 'rgba(0, 0, 0, 0.5)' : theme.card, 
          borderColor: (chatTheme === 'ruixen' || chatTheme === 'sunset') ? 'rgba(255, 255, 255, 0.1)' : theme.borderMuted 
        }}
      >
        <div className="relative mx-auto flex max-w-3xl">
          {showEmojiPicker && (
            <div className="absolute bottom-16 left-0 z-50 shadow-2xl">
              <EmojiPicker
                theme={Theme.DARK}
                onEmojiClick={(emojiData) => {
                  setInputText((prev) => prev + emojiData.emoji);
                }}
              />
            </div>
          )}
          <form onSubmit={handleSend} className="flex flex-1 gap-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              disabled={!activeSessionKey}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-white/5 disabled:opacity-40"
              style={{ color: theme.textDim }}
            >
              <Smile size={20} />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!activeSessionKey}
              placeholder={
                !isConnected
                  ? 'Connecting to secure server…'
                  : !activeSessionKey
                    ? 'Cannot decrypt: Private key missing or corrupted'
                    : 'Type an encrypted message…'
              }
              className="flex-1 rounded-xl px-5 py-3 text-sm outline-none transition-shadow focus:ring-2 disabled:opacity-50"
              style={{
                background: (chatTheme === 'ruixen' || chatTheme === 'sunset') ? 'rgba(255, 255, 255, 0.1)' : theme.surface,
                border: (chatTheme === 'ruixen' || chatTheme === 'sunset') ? '1px solid rgba(255, 255, 255, 0.2)' : `1px solid ${theme.border}`,
                color: !isConnected || !activeSessionKey ? theme.textDim : theme.text,
              }}
            />
            <button
              type="submit"
              disabled={!activeSessionKey || !inputText.trim()}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl transition-opacity disabled:opacity-40"
              style={{
                background: theme.accentMuted,
                color: '#000000',
              }}
            >
              <Send size={18} className="ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Badge({
  icon,
  label,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border px-3 py-1.5"
      style={{
        background: accent ? theme.accentSoft : theme.surface,
        borderColor: theme.border,
        color: accent ? theme.accent : theme.textDim,
      }}
    >
      {icon}
      {label}
    </div>
  );
}
