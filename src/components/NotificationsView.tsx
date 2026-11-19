import { useEffect, useState } from 'react';
import { Bell, Heart, Lock, MessageCircle, Sparkles, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import { formatRelativeTime } from '../lib/format';
import type { AppNotification, AuthUser } from '../types';
import { Avatar } from './MediaFrame';

interface NotificationsViewProps {
  currentUser: AuthUser | null;
  onRequireAuth: (reason: string) => void;
  onOpenProfile: (username: string) => void;
  onMarkedRead: () => void;
}

export function NotificationsView({
  currentUser,
  onRequireAuth,
  onOpenProfile,
  onMarkedRead,
}: NotificationsViewProps) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    api
      .getNotifications()
      .then((res) => {
        setItems(res.notifications);
        if (res.notifications.some((n) => !n.read)) {
          api.markNotificationsRead().then(onMarkedRead).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="max-w-lg mx-auto my-12 px-6 py-10 bg-[#121216] border border-white/[0.08] rounded-3xl text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-amber-400">
          <Lock className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-white">Activity &amp; Notifications</h2>
        <p className="text-sm text-zinc-400">
          Sign in to track likes, comments, story replies, and new followers.
        </p>
        <button
          type="button"
          onClick={() => onRequireAuth('Sign in to view your activity notifications.')}
          className="h-11 px-6 rounded-xl bg-white text-zinc-950 font-semibold text-sm hover:bg-zinc-200"
        >
          Sign in
        </button>
      </div>
    );
  }

  function renderIcon(type: AppNotification['type']) {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-sky-400" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-amber-400" />;
      case 'story_reply':
        return <Sparkles className="w-4 h-4 text-amber-300" />;
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-white">Notifications</h1>
        <span className="text-xs text-zinc-400 tabular-nums">{items.length} recent</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-14 text-center bg-[#121216] border border-white/[0.07] rounded-2xl space-y-2">
          <Bell className="w-7 h-7 text-zinc-600 mx-auto" />
          <p className="text-sm font-medium text-zinc-300">All caught up</p>
          <p className="text-xs text-zinc-500">
            Likes, comments, and new followers will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
          {items.map((n) => (
            <div
              key={n.id}
              className={`flex items-center justify-between gap-3 px-4 py-3.5 ${
                !n.read ? 'bg-amber-500/[0.04]' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => onOpenProfile(n.actor.username)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                <div className="relative shrink-0">
                  <Avatar src={n.actor.avatarUrl} name={n.actor.displayName} size="md" />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#121216] border border-white/10 flex items-center justify-center">
                    {renderIcon(n.type)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-200 leading-snug">
                    <span className="font-semibold text-white mr-1.5">{n.actor.username}</span>
                    {n.text}
                  </p>
                  <span className="text-xs text-zinc-500 tabular-nums mt-0.5 block">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </div>
              </button>

              {n.postPreviewUrl && (
                <img
                  src={n.postPreviewUrl}
                  alt="Related post"
                  className="w-11 h-11 rounded-lg object-cover border border-white/10 shrink-0"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
