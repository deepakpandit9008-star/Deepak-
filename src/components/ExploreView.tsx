import { useEffect, useState } from 'react';
import { Film, Heart, MessageCircle, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatCompactCount } from '../lib/format';
import type { PostItem, UserSummary } from '../types';
import { Avatar, MediaFrame } from './MediaFrame';

interface ExploreViewProps {
  onOpenProfile: (username: string) => void;
  onOpenComments: (post: PostItem) => void;
  onOpenReel: (postId: string) => void;
  onFollowToggle: (userId: string) => void;
}

const CATEGORIES = ['All', 'Photography', 'Video & Reels', 'Architecture', 'Nightlife', 'Music'];

export function ExploreView({
  onOpenProfile,
  onOpenComments,
  onOpenReel,
  onFollowToggle,
}: ExploreViewProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      api
        .explore(query, category)
        .then((res) => {
          if (!active) return;
          setPosts(res.posts);
          setUsers(res.users);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, category]);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-5">
      {/* Search bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search creators, locations, or #tags..."
          className="w-full h-12 pl-11 pr-11 bg-[#121216] border border-white/[0.08] rounded-2xl text-base text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`min-h-[38px] px-4 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              category === cat
                ? 'bg-white text-zinc-950'
                : 'bg-[#121216] border border-white/[0.08] text-zinc-300 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Matching creators */}
      {users.length > 0 && (
        <section aria-label="Creators" className="space-y-2.5">
          <h2 className="text-sm font-semibold text-zinc-300">Creators</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {users.slice(0, 6).map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-3 p-3 bg-[#121216] border border-white/[0.07] rounded-2xl"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile(user.username)}
                  className="flex items-center gap-3 min-w-0 text-left"
                >
                  <Avatar src={user.avatarUrl} name={user.displayName} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {user.displayName}
                    </div>
                    <div className="text-xs text-zinc-400 truncate">
                      @{user.username} · <span className="tabular-nums">{user.followersCount} followers</span>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onFollowToggle(user.id);
                    setUsers((prev) =>
                      prev.map((u) =>
                        u.id === user.id
                          ? {
                              ...u,
                              isFollowing: !u.isFollowing,
                              followersCount: u.isFollowing
                                ? Math.max(0, u.followersCount - 1)
                                : u.followersCount + 1,
                            }
                          : u,
                      ),
                    );
                  }}
                  className={`h-9 px-3 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                    user.isFollowing
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                  }`}
                >
                  {user.isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Discovery Media Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-2xl bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center bg-[#121216] border border-white/[0.07] rounded-2xl">
          <p className="text-sm font-medium text-zinc-300">No posts match your filter</p>
          <p className="text-xs text-zinc-500 mt-1">Try another search term or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {posts.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => (post.kind === 'reel' ? onOpenReel(post.id) : onOpenComments(post))}
              className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-zinc-950 border border-white/[0.06] text-left"
            >
              <MediaFrame
                src={post.mediaUrl}
                alt={post.caption}
                isVideo={post.kind === 'video' || post.kind === 'reel'}
                isAnimatedPhoto={post.isAnimatedPhoto}
                filterId={post.filterId}
              />
              {post.kind === 'reel' && (
                <span className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/65 backdrop-blur-md text-white flex items-center justify-center">
                  <Film className="w-3.5 h-3.5 text-amber-400" />
                </span>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <div className="text-xs font-semibold text-white truncate">@{post.author.username}</div>
                <div className="flex items-center gap-3 text-xs text-zinc-200 mt-1 tabular-nums">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 fill-white" />
                    {formatCompactCount(post.likesCount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {formatCompactCount(post.commentsCount)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
