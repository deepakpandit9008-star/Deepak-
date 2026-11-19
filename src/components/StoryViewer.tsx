import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatRelativeTime, formatStoryCountdown } from '../lib/format';
import type { StoryGroup } from '../types';
import { Avatar, MediaFrame } from './MediaFrame';

interface StoryViewerProps {
  groups: StoryGroup[];
  initialGroupIndex: number;
  isAuthenticated: boolean;
  onRequireAuth: (reason: string) => void;
  onClose: () => void;
  onOpenProfile: (username: string) => void;
  onStoryViewed: (storyId: string) => void;
}

const STORY_DURATION_MS = 5500;

export function StoryViewer({
  groups,
  initialGroupIndex,
  isAuthenticated,
  onRequireAuth,
  onClose,
  onOpenProfile,
  onStoryViewed,
}: StoryViewerProps) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [replyNotice, setReplyNotice] = useState<string | null>(null);

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  useEffect(() => {
    if (!currentStory) return;
    if (isAuthenticated && !currentStory.viewedByMe) {
      api.viewStory(currentStory.id).catch(() => {});
      onStoryViewed(currentStory.id);
    }
  }, [currentStory?.id, isAuthenticated]);

  useEffect(() => {
    if (!currentStory || paused) return;
    setProgress(0);
    const start = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(timer);
        goNext();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [groupIndex, storyIndex, paused]);

  if (!currentGroup || !currentStory) return null;

  function goNext() {
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((i) => i + 1);
      setProgress(0);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }

  function goPrev() {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((g) => g - 1);
      setStoryIndex(Math.max(0, prevGroup.stories.length - 1));
      setProgress(0);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireAuth('Sign in to reply directly to 24-hour stories.');
      return;
    }
    if (!replyText.trim()) return;
    try {
      await api.replyToStory(currentStory.id, replyText.trim());
      setReplyText('');
      setReplyNotice('Reply sent to DM');
      window.setTimeout(() => setReplyNotice(null), 2200);
    } catch {
      setReplyNotice('Could not send reply');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${currentGroup.author.displayName} story`}
    >
      <div className="relative w-full h-dvh sm:h-[88dvh] sm:max-w-[430px] sm:rounded-3xl overflow-hidden bg-zinc-950 border-0 sm:border sm:border-white/10 shadow-2xl flex flex-col">
        {/* Media layer */}
        <div
          className="absolute inset-0"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        >
          <MediaFrame
            src={currentStory.mediaUrl}
            alt={currentStory.captionOverlay || `${currentGroup.author.username} story`}
            isVideo={currentStory.mediaType === 'video'}
            filterId={currentStory.filterId}
            className="w-full h-full"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 via-black/30 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        </div>

        {/* Tap navigation zones */}
        <div className="relative z-10 flex-1 flex">
          <button
            type="button"
            aria-label="Previous story"
            onClick={goPrev}
            className="w-1/3 h-full focus:outline-none"
          />
          <div className="w-1/3 h-full" onClick={() => setPaused((p) => !p)} />
          <button
            type="button"
            aria-label="Next story"
            onClick={goNext}
            className="w-1/3 h-full focus:outline-none"
          />
        </div>

        {/* Top bar + progress */}
        <div className="absolute top-0 inset-x-0 z-20 p-3 pt-safe">
          <div className="flex gap-1.5 mb-3">
            {currentGroup.stories.map((st, idx) => (
              <div key={st.id} className="h-0.5 flex-1 bg-white/25 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-[width] duration-75"
                  style={{
                    width:
                      idx < storyIndex ? '100%' : idx === storyIndex ? `${progress}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProfile(currentGroup.author.username);
              }}
              className="flex items-center gap-2.5 min-w-0 text-left"
            >
              <Avatar src={currentGroup.author.avatarUrl} name={currentGroup.author.displayName} size="sm" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {currentGroup.author.username}
                </div>
                <div className="text-xs text-zinc-300 tabular-nums">
                  {formatRelativeTime(currentStory.createdAt)} · {formatStoryCountdown(currentStory.expiresAt)}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? 'Resume story' : 'Pause story'}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/90 hover:bg-white/10"
              >
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close story viewer"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/90 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop side arrows */}
        {groupIndex > 0 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous creator story"
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 text-white items-center justify-center hover:bg-black/75"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {groupIndex < groups.length - 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next creator story"
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 text-white items-center justify-center hover:bg-black/75"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Caption overlay & reply composer */}
        <div className="relative z-20 p-4 pb-safe space-y-3">
          {currentStory.captionOverlay && (
            <p className="text-sm sm:text-base font-medium text-white drop-shadow-md leading-snug max-w-[90%]">
              {currentStory.captionOverlay}
            </p>
          )}
          {replyNotice && (
            <div className="text-xs font-medium text-amber-300 bg-black/70 px-3 py-1.5 rounded-lg inline-block">
              {replyNotice}
            </div>
          )}
          <form onSubmit={handleSendReply} className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${currentGroup.author.username}...`}
              className="flex-1 h-11 px-4 rounded-full bg-black/55 backdrop-blur-md border border-white/25 text-base text-white placeholder:text-zinc-300 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              aria-label="Send story reply"
              className="min-w-[44px] min-h-[44px] rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center hover:bg-amber-400 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
