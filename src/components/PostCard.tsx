import { useState } from 'react';
import {
  BadgeCheck,
  Bookmark,
  Film,
  Heart,
  MessageCircle,
  Send,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatCompactCount, formatRelativeTime } from '../lib/format';
import type { AuthUser, PostItem } from '../types';
import { Avatar, MediaFrame } from './MediaFrame';

interface PostCardProps {
  post: PostItem;
  currentUser: AuthUser | null;
  onLike: (postId: string) => void;
  onSave: (postId: string) => void;
  onOpenComments: (post: PostItem) => void;
  onOpenProfile: (username: string) => void;
  onFollowToggle: (userId: string) => void;
  onShareToDM: (post: PostItem) => void;
  onDeletePost?: (postId: string) => void;
  onOpenReel?: (postId: string) => void;
}

export function PostCard({
  post,
  currentUser,
  onLike,
  onSave,
  onOpenComments,
  onOpenProfile,
  onFollowToggle,
  onShareToDM,
  onDeletePost,
  onOpenReel,
}: PostCardProps) {
  const [heartBurst, setHeartBurst] = useState(false);
  const [muted, setMuted] = useState(true);

  const isOwner = currentUser?.id === post.authorId;

  function handleDoubleTap() {
    if (!post.likedByMe) {
      onLike(post.id);
    }
    setHeartBurst(true);
    window.setTimeout(() => setHeartBurst(false), 700);
  }

  return (
    <article className="bg-[#121216] border border-white/[0.07] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => onOpenProfile(post.author.username)}
          className="flex items-center gap-3 min-w-0 text-left group"
        >
          <Avatar src={post.author.avatarUrl} name={post.author.displayName} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-white truncate group-hover:underline">
                {post.author.username}
              </span>
              {post.author.verified && (
                <BadgeCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-label="Verified" />
              )}
            </div>
            <div className="text-xs text-zinc-400 truncate tabular-nums">
              {formatRelativeTime(post.createdAt)}
              {post.location ? ` · ${post.location}` : ''}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {!isOwner && (
            <button
              type="button"
              onClick={() => onFollowToggle(post.authorId)}
              className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                post.author.isFollowing
                  ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                  : 'bg-white text-zinc-950 hover:bg-zinc-200'
              }`}
            >
              {post.author.isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
          {isOwner && onDeletePost && (
            <button
              type="button"
              onClick={() => onDeletePost(post.id)}
              aria-label="Delete post"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-white/[0.05] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Media container */}
      <div className="relative aspect-[4/5] sm:aspect-square bg-zinc-950 select-none">
        <MediaFrame
          src={post.mediaUrl}
          alt={post.caption}
          isVideo={post.kind === 'video' || post.kind === 'reel'}
          isAnimatedPhoto={post.isAnimatedPhoto}
          filterId={post.filterId}
          muted={muted}
          onDoubleClick={handleDoubleTap}
        />

        {heartBurst && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Heart className="w-20 h-20 text-rose-500 fill-rose-500 drop-shadow-2xl scale-110 transition-transform duration-200" />
          </div>
        )}

        {(post.kind === 'video' || post.kind === 'reel') && (
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            {post.kind === 'reel' && onOpenReel && (
              <button
                type="button"
                onClick={() => onOpenReel(post.id)}
                className="h-9 px-3 rounded-lg bg-black/70 backdrop-blur-md text-xs font-medium text-white flex items-center gap-1.5 border border-white/15 hover:bg-black/85"
              >
                <Film className="w-3.5 h-3.5 text-amber-400" />
                Watch Reel
              </button>
            )}
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute video' : 'Mute video'}
              className="w-9 h-9 rounded-full bg-black/70 backdrop-blur-md text-white flex items-center justify-center border border-white/15 hover:bg-black/85"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pt-3 pb-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 -ml-2">
            <button
              type="button"
              onClick={() => onLike(post.id)}
              aria-label={post.likedByMe ? 'Unlike post' : 'Like post'}
              className="min-w-[44px] min-h-[44px] px-2 flex items-center gap-1.5 rounded-xl hover:bg-white/[0.05] active:scale-95 transition-all"
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  post.likedByMe ? 'text-rose-500 fill-rose-500' : 'text-zinc-200'
                }`}
              />
              <span className="text-sm font-medium text-zinc-200 tabular-nums">
                {formatCompactCount(post.likesCount)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenComments(post)}
              aria-label="Open comments"
              className="min-w-[44px] min-h-[44px] px-2 flex items-center gap-1.5 rounded-xl hover:bg-white/[0.05] active:scale-95 transition-all"
            >
              <MessageCircle className="w-5 h-5 text-zinc-200" />
              <span className="text-sm font-medium text-zinc-200 tabular-nums">
                {formatCompactCount(post.commentsCount)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onShareToDM(post)}
              aria-label="Send post in message"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-zinc-200 hover:bg-white/[0.05] active:scale-95 transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onSave(post.id)}
            aria-label={post.savedByMe ? 'Remove from saved' : 'Save post'}
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl hover:bg-white/[0.05] active:scale-95 transition-all"
          >
            <Bookmark
              className={`w-5 h-5 transition-colors ${
                post.savedByMe ? 'text-amber-400 fill-amber-400' : 'text-zinc-200'
              }`}
            />
          </button>
        </div>

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

        {post.tags.length > 0 && (
          <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{post.category}</span>
            <span aria-hidden="true">·</span>
            <span>{post.tags.map((t) => `#${t}`).join(' ')}</span>
          </div>
        )}

        {post.comments.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenComments(post)}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors block pt-0.5"
          >
            View all {post.comments.length} comments
          </button>
        )}
      </div>
    </article>
  );
}
