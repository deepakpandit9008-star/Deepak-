import { useState } from 'react';
import { Check, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import type { PostItem, UserSummary } from '../types';
import { Avatar } from './MediaFrame';

interface ShareToDMModalProps {
  post: PostItem | null;
  users: UserSummary[];
  onClose: () => void;
}

export function ShareToDMModal({ post, users, onClose }: ShareToDMModalProps) {
  const [sentIds, setSentIds] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');

  if (!post) return null;

  async function handleSend(userId: string) {
    if (!post) return;
    await api.sendMessage(userId, {
      text: note.trim() || `Shared a post by @${post.author.username}: "${post.caption.slice(0, 60)}"`,
      mediaDataUrl: post.posterUrl || post.mediaUrl,
      isEphemeralSnap: false,
    });
    setSentIds((prev) => ({ ...prev, [userId]: true }));
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share post via private message"
    >
      <div className="w-full sm:max-w-md bg-[#121216] border border-white/[0.09] rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto sm:hidden" />

        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Send to a friend</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add an optional note..."
          className="w-full h-11 px-3.5 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
        />

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {users.map((u) => {
            const sent = Boolean(sentIds[u.id]);
            return (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-900/70"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={u.avatarUrl} name={u.displayName} size="sm" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{u.displayName}</div>
                    <div className="text-xs text-zinc-400 truncate">@{u.username}</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={sent}
                  onClick={() => handleSend(u.id)}
                  className={`h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    sent
                      ? 'bg-zinc-800 text-amber-400'
                      : 'bg-white text-zinc-950 hover:bg-zinc-200'
                  }`}
                >
                  {sent ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                  {sent ? 'Sent' : 'Send'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
