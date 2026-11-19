import { useState } from 'react';
import { Send, X } from 'lucide-react';
import { formatRelativeTime } from '../lib/format';
import type { PostComment, PostItem } from '../types';
import { Avatar } from './MediaFrame';

interface CommentsDrawerProps {
  post: PostItem | null;
  isAuthenticated: boolean;
  onClose: () => void;
  onRequireAuth: (reason: string) => void;
  onAddComment: (postId: string, text: string) => Promise<PostComment | null>;
  onOpenProfile: (username: string) => void;
}

export function CommentsDrawer({
  post,
  isAuthenticated,
  onClose,
  onRequireAuth,
  onAddComment,
  onOpenProfile,
}: CommentsDrawerProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!post) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireAuth('Sign in to join the conversation and post comments.');
      return;
    }
    if (!text.trim() || !post) return;
    setSubmitting(true);
    try {
      const added = await onAddComment(post.id, text.trim());
      if (added) setText('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Comments"
    >
      <div className="w-full sm:max-w-lg max-h-[82dvh] bg-[#121216] border border-white/[0.09] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden">
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mt-3 sm:hidden" />

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
          <h3 className="text-base font-semibold text-white">
            Comments <span className="text-zinc-500 font-normal tabular-nums">({post.comments.length})</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.06]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Original caption */}
          <div className="flex items-start gap-3 pb-3 border-b border-white/[0.06]">
            <button type="button" onClick={() => onOpenProfile(post.author.username)}>
              <Avatar src={post.author.avatarUrl} name={post.author.displayName} size="sm" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-200 leading-relaxed">
                <button
                  type="button"
                  onClick={() => onOpenProfile(post.author.username)}
                  className="font-semibold text-white mr-2 hover:underline"
                >
                  {post.author.username}
                </button>
                {post.caption}
              </p>
              <span className="text-xs text-zinc-500 mt-1 block tabular-nums">
                {formatRelativeTime(post.createdAt)}
              </span>
            </div>
          </div>

          {post.comments.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              No comments yet. Start the thread below.
            </div>
          ) : (
            post.comments.map((c) => (
              <div key={c.id} className="flex items-start gap-3">
                <button type="button" onClick={() => onOpenProfile(c.author.username)}>
                  <Avatar src={c.author.avatarUrl} name={c.author.displayName} size="sm" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(c.author.username)}
                      className="text-sm font-semibold text-white hover:underline"
                    >
                      {c.author.username}
                    </button>
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {formatRelativeTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-200 mt-0.5 leading-relaxed">{c.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-3 px-4 pb-safe border-t border-white/[0.07] bg-zinc-950/60 flex items-center gap-2"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isAuthenticated ? 'Add a comment...' : 'Sign in to comment...'}
            className="flex-1 h-11 px-4 rounded-xl bg-zinc-900 border border-white/[0.08] text-base text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={submitting}
            aria-label="Post comment"
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white text-zinc-950 flex items-center justify-center hover:bg-zinc-200 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
