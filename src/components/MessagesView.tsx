import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Eye, Flame, ImagePlus, Lock, Send } from 'lucide-react';
import { api } from '../lib/api';
import { formatRelativeTime } from '../lib/format';
import type { AuthUser, ConversationThread, DirectMessage, UserSummary } from '../types';
import { Avatar, MediaFrame } from './MediaFrame';

interface MessagesViewProps {
  currentUser: AuthUser | null;
  initialPartnerId?: string | null;
  onRequireAuth: (reason: string) => void;
  onOpenProfile: (username: string) => void;
  onUnreadChange: () => void;
}

export function MessagesView({
  currentUser,
  initialPartnerId,
  onRequireAuth,
  onOpenProfile,
  onUnreadChange,
}: MessagesViewProps) {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<UserSummary | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [isSnapMode, setIsSnapMode] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<string | null>(null);
  const [activeSnapPreview, setActiveSnapPreview] = useState<DirectMessage | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    loadThreads();
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser && initialPartnerId) {
      openThread(initialPartnerId);
    }
  }, [currentUser?.id, initialPartnerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function loadThreads() {
    try {
      const res = await api.getThreads();
      setThreads(res.threads);
      if (!selectedPartner && window.innerWidth >= 1024 && res.threads[0]) {
        openThread(res.threads[0].partner.id);
      }
    } catch {
      // Handled when unauthenticated
    }
  }

  async function openThread(partnerId: string) {
    try {
      const res = await api.getMessages(partnerId);
      setSelectedPartner(res.partner);
      setMessages(res.messages);
      setThreads((prev) =>
        prev.map((t) => (t.partner.id === partnerId ? { ...t, unreadCount: 0 } : t)),
      );
      onUnreadChange();
    } catch {
      // Ignore
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPartner) return;
    if (!text.trim() && !pendingMedia) return;
    setSending(true);
    try {
      const res = await api.sendMessage(selectedPartner.id, {
        text: text.trim(),
        mediaDataUrl: pendingMedia || undefined,
        isEphemeralSnap: isSnapMode && Boolean(pendingMedia),
      });
      setMessages((prev) => [...prev, res.message]);
      setText('');
      setPendingMedia(null);
      setIsSnapMode(false);
      loadThreads();
    } finally {
      setSending(false);
    }
  }

  async function handleOpenEphemeralSnap(msg: DirectMessage) {
    if (msg.recipientId === currentUser?.id) {
      if (msg.snapOpenedByRecipient) return;
      try {
        const res = await api.openSnap(msg.id);
        setActiveSnapPreview(res.message);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...res.message, mediaUrl: undefined } : m,
          ),
        );
      } catch {
        // Already opened or unauthorized
      }
      return;
    }
    if (msg.mediaUrl) {
      setActiveSnapPreview(msg);
    }
  }

  function handleAttachImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setPendingMedia(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  if (!currentUser) {
    return (
      <div className="max-w-lg mx-auto my-12 px-6 py-10 bg-[#121216] border border-white/[0.08] rounded-3xl text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-amber-400">
          <Lock className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-white">Private Messages &amp; Snaps</h2>
        <p className="text-sm text-zinc-400">
          Sign in to chat privately with creators and open ephemeral view-once photo snaps.
        </p>
        <button
          type="button"
          onClick={() => onRequireAuth('Sign in to access private messages and snaps.')}
          className="h-11 px-6 rounded-xl bg-white text-zinc-950 font-semibold text-sm hover:bg-zinc-200"
        >
          Sign in to Messages
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-6 sm:py-4">
      <div className="h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-3.5rem)] bg-[#121216] border-y sm:border border-white/[0.08] sm:rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Thread list */}
        <aside
          className={`lg:col-span-4 border-r border-white/[0.07] flex flex-col overflow-hidden ${
            selectedPartner ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="px-4 py-3.5 border-b border-white/[0.07] flex items-center justify-between">
            <h1 className="text-base font-bold text-white">Direct Messages</h1>
            <span className="text-xs text-zinc-400">@{currentUser.username}</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.05]">
            {threads.map((t) => {
              const active = selectedPartner?.id === t.partner.id;
              return (
                <button
                  key={t.partner.id}
                  type="button"
                  onClick={() => openThread(t.partner.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                    active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <Avatar src={t.partner.avatarUrl} name={t.partner.displayName} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {t.partner.displayName}
                      </span>
                      {t.lastMessage && (
                        <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
                          {formatRelativeTime(t.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-zinc-400 truncate">
                        {t.lastMessage
                          ? t.lastMessage.isEphemeralSnap
                            ? 'Ephemeral Snap'
                            : t.lastMessage.text
                          : 'Start a conversation'}
                      </span>
                      {t.unreadCount > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-zinc-950 text-[11px] font-bold flex items-center justify-center tabular-nums">
                          {t.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Active Conversation */}
        <div
          className={`lg:col-span-8 flex flex-col overflow-hidden ${
            selectedPartner ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {selectedPartner ? (
            <>
              <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedPartner(null)}
                    aria-label="Back to threads"
                    className="lg:hidden min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center rounded-full text-zinc-300 hover:bg-white/[0.06]"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProfile(selectedPartner.username)}
                    className="flex items-center gap-3 min-w-0 text-left"
                  >
                    <Avatar
                      src={selectedPartner.avatarUrl}
                      name={selectedPartner.displayName}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {selectedPartner.displayName}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        @{selectedPartner.username}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => {
                  const mine = m.senderId === currentUser.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 space-y-2 ${
                          mine
                            ? 'bg-amber-500 text-zinc-950'
                            : 'bg-zinc-900 border border-white/[0.08] text-zinc-100'
                        }`}
                      >
                        {m.isEphemeralSnap ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEphemeralSnap(m)}
                            disabled={(!mine && Boolean(m.snapOpenedByRecipient)) || (mine && !m.mediaUrl)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-colors ${
                              mine
                                ? 'bg-black/15 border-black/15 text-zinc-950'
                                : m.snapOpenedByRecipient
                                  ? 'bg-zinc-950/60 border-white/10 text-zinc-500'
                                  : 'bg-rose-500/15 border-rose-500/35 text-rose-200 hover:bg-rose-500/25'
                            }`}
                          >
                            {m.snapOpenedByRecipient && !mine ? (
                              <Eye className="w-4 h-4 shrink-0" />
                            ) : (
                              <Flame className="w-4 h-4 shrink-0" />
                            )}
                            <span className="text-xs font-semibold">
                              {mine
                                ? 'Sent Snap'
                                : m.snapOpenedByRecipient
                                  ? 'Snap opened'
                                  : 'Tap to view Snap'}
                            </span>
                          </button>
                        ) : (
                          m.mediaUrl && (
                            <div className="w-52 aspect-[4/5] rounded-xl overflow-hidden bg-black">
                              <MediaFrame
                                src={m.mediaUrl}
                                alt="Shared attachment"
                                isVideo={m.mediaType === 'video'}
                              />
                            </div>
                          )
                        )}
                        {m.text && <p className="text-sm leading-relaxed">{m.text}</p>}
                        <div
                          className={`text-[10px] tabular-nums ${
                            mine ? 'text-zinc-900/75' : 'text-zinc-500'
                          }`}
                        >
                          {formatRelativeTime(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {pendingMedia && (
                <div className="px-4 py-2 border-t border-white/[0.07] bg-zinc-950/70 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={pendingMedia}
                      alt="Attachment preview"
                      className="w-11 h-11 rounded-lg object-cover border border-white/15"
                    />
                    <button
                      type="button"
                      onClick={() => setIsSnapMode((s) => !s)}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
                        isSnapMode
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : 'bg-zinc-900 border-white/10 text-zinc-300'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      {isSnapMode ? 'View-once Snap ON' : 'Make View-once Snap'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingMedia(null)}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              )}

              <form
                onSubmit={handleSend}
                className="p-3 border-t border-white/[0.07] bg-zinc-950/60 flex items-center gap-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAttachImage}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach photo or snap"
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-zinc-900 border border-white/[0.08] text-zinc-300 hover:text-white flex items-center justify-center"
                >
                  <ImagePlus className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Message ${selectedPartner.displayName}...`}
                  className="flex-1 h-11 px-4 rounded-xl bg-zinc-900 border border-white/[0.08] text-base text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={sending}
                  aria-label="Send message"
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center hover:bg-amber-400 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-400">
              <Camera className="w-8 h-8 text-zinc-600 mb-3" />
              <p className="text-sm font-medium text-zinc-300">Select a conversation</p>
              <p className="text-xs text-zinc-500 mt-1">
                Send private messages or view-once photo snaps.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Ephemeral Snap Viewer Modal */}
      {activeSnapPreview && activeSnapPreview.mediaUrl && (
        <div
          onClick={() => setActiveSnapPreview(null)}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Ephemeral snap viewer"
        >
          <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-zinc-950 border border-white/15">
            <MediaFrame
              src={activeSnapPreview.mediaUrl}
              alt="Ephemeral snap"
              isVideo={activeSnapPreview.mediaType === 'video'}
            />
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/85 to-transparent text-center">
              <p className="text-sm text-white font-medium">{activeSnapPreview.text}</p>
              <p className="text-xs text-zinc-400 mt-1">Tap anywhere to close</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
