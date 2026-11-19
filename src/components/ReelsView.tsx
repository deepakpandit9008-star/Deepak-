import { useState } from 'react';
import {
  Bookmark,
  Heart,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Send,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatCompactCount } from '../lib/format';
import type { PostItem } from '../types';
import { Avatar, MediaFrame } from './MediaFrame';

interface ReelsViewProps {
  reels: PostItem[];
  focusedReelId?: string | null;
  onLike: (postId: string) => void;
  onSave: (postId: string) => void;
  onOpenComments: (post: PostItem) => void;
  onOpenProfile: (username: string) => void;
  onFollowToggle: (userId: string) => void;
  onShareToDM: (post: PostItem) => void;
}

export function ReelsView({
  reels,
  focusedReelId,
  onLike,
  onSave,
  onOpenComments,
  onOpenProfile,
  onFollowToggle,
  onShareToDM,
}: ReelsViewProps) {
  const [muted, setMuted] = useState(true);
  const [pausedIds, setPausedIds] = useState<Record<string, boolean>>({});

  const orderedReels = focusedReelId
    ? [
        ...reels.filter((r) => r.id === focusedReelId),
        ...reels.filter((r) => r.id !== focusedReelId),
      ]
    : reels;

  if (orderedReels.length === 0) {
    return (
      <div className="h-[72dvh] flex flex-col items-center justify-center text-center px-6">
        <p className="text-base font-medium text-zinc-300">No reels published yet</p>
        <p className="text-sm text-zinc-500 mt-1">
          Open Camera to record or upload a vertical short video.
        </p>
      </div>
    );
  }

  function togglePause(id: string) {
    setPausedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-3rem)] w-full max-w-[440px] mx-auto overflow-y-scroll snap-y snap-mandatory no-scrollbar rounded-none sm:rounded-3xl bg-black border-0 sm:border sm:border-white/[0.08]">
      {orderedReels.map((reel) => {
        const isPaused = Boolean(pausedIds[reel.id]);
        return (
          <section
            key={reel.id}
            aria-label={`Reel by ${reel.author.username}`}
            className="relative w-full h-full snap-start snap-always shrink-0 overflow-hidden bg-zinc-950"
          >
            <div className="absolute inset-0" onClick={() => togglePause(reel.id)}>
              <MediaFrame
                src={reel.mediaUrl}
                alt={reel.caption}
                isVideo={true}
                isAnimatedPhoto={reel.isAnimatedPhoto && !isPaused}
                filterId={reel.filterId}
                autoPlay={!isPaused}
                muted={muted}
                className="w-full h-full"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
            </div>

            {isPaused && (
              <button
                type="button"
                onClick={() => togglePause(reel.id)}
                aria-label="Resume reel"
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center border border-white/20"
              >
                <Play className="w-7 h-7 fill-white ml-0.5" />
              </button>
            )}

            {/* Top mute / playback pill */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => togglePause(reel.id)}
                aria-label={isPaused ? 'Play reel' : 'Pause reel'}
                className="min-w-[44px] min-h-[44px] rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center border border-white/15"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute reel' : 'Mute reel'}
                className="min-w-[44px] min-h-[44px] rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center border border-white/15"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Bottom overlay */}
            <div className="absolute inset-x-0 bottom-0 z-10 p-4 pb-5 flex items-end justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(reel.author.username)}
                    className="flex items-center gap-2.5 min-w-0"
                  >
                    <Avatar src={reel.author.avatarUrl} name={reel.author.displayName} size="sm" />
                    <span className="text-sm font-semibold text-white truncate">
                      {reel.author.username}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onFollowToggle(reel.authorId)}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      reel.author.isFollowing
                        ? 'bg-white/15 text-white'
                        : 'bg-white text-zinc-950'
                    }`}
                  >
                    {reel.author.isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>

                <p className="text-sm text-zinc-100 leading-snug line-clamp-2">{reel.caption}</p>

                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Music2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{reel.audioTrack || 'Original Audio'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums shrink-0">
                    {formatCompactCount(reel.viewsCount)} views
                  </span>
                </div>
              </div>

              {/* Right thumb action rail */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => onLike(reel.id)}
                  aria-label="Like reel"
                  className="flex flex-col items-center gap-1 min-w-[44px]"
                >
                  <span className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/10">
                    <Heart
                      className={`w-5 h-5 ${
                        reel.likedByMe ? 'text-rose-500 fill-rose-500' : 'text-white'
                      }`}
                    />
                  </span>
                  <span className="text-xs font-medium text-white tabular-nums">
                    {formatCompactCount(reel.likesCount)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenComments(reel)}
                  aria-label="Comment on reel"
                  className="flex flex-col items-center gap-1 min-w-[44px]"
                >
                  <span className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/10">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </span>
                  <span className="text-xs font-medium text-white tabular-nums">
                    {formatCompactCount(reel.commentsCount)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onSave(reel.id)}
                  aria-label="Save reel"
                  className="flex flex-col items-center gap-1 min-w-[44px]"
                >
                  <span className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/10">
                    <Bookmark
                      className={`w-5 h-5 ${
                        reel.savedByMe ? 'text-amber-400 fill-amber-400' : 'text-white'
                      }`}
                    />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onShareToDM(reel)}
                  aria-label="Share reel"
                  className="flex flex-col items-center gap-1 min-w-[44px]"
                >
                  <span className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/10">
                    <Send className="w-5 h-5 text-white" />
                  </span>
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
