import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Bell,
  Camera,
  Compass,
  Film,
  Home,
  LogIn,
  MessageCircle,
  PlusSquare,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AuthModal } from './components/AuthModal';
import { CameraStudio } from './components/CameraStudio';
import { CommentsDrawer } from './components/CommentsDrawer';
import { ExploreView } from './components/ExploreView';
import { Avatar } from './components/MediaFrame';
import { MessagesView } from './components/MessagesView';
import { MonetizationView } from './components/MonetizationView';
import { NotificationsView } from './components/NotificationsView';
import { PostCard } from './components/PostCard';
import { ProfileView } from './components/ProfileView';
import { ReelsView } from './components/ReelsView';
import { ShareToDMModal } from './components/ShareToDMModal';
import { SponsoredAdCard } from './components/SponsoredAdCard';
import { StoryBar } from './components/StoryBar';
import { StoryViewer } from './components/StoryViewer';
import { api } from './lib/api';
import { formatCompactCount } from './lib/format';
import type { AuthUser, FeedPayload, NavTab, PostItem } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [feed, setFeed] = useState<FeedPayload>({
    storyGroups: [],
    posts: [],
    reels: [],
    ads: [],
    suggestedUsers: [],
    unreadMessages: 0,
    unreadNotifications: 0,
  });
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [hiddenAdIds, setHiddenAdIds] = useState<string[]>([]);
  const [initialReferralCode] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('ref') || '';
    } catch {
      return '';
    }
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>(undefined);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');

  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<PostItem | null>(null);

  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [focusedReelId, setFocusedReelId] = useState<string | null>(null);
  const [messagePartnerId, setMessagePartnerId] = useState<string | null>(null);
  const [cameraInitialMode, setCameraInitialMode] = useState<'post' | 'story' | 'reel' | 'snap'>(
    'post',
  );
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshFeed = useCallback(async () => {
    try {
      const data = await api.getFeed();
      setFeed(data);
    } catch {
      // Handled gracefully
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    api
      .me()
      .then((res) => setCurrentUser(res.user))
      .catch(() => {})
      .finally(() => {
        refreshFeed();
      });
  }, [refreshFeed]);

  function openAuth(reason?: string, mode: 'login' | 'signup' = 'login') {
    setAuthReason(reason);
    setAuthInitialMode(mode);
    setAuthModalOpen(true);
  }

  function handleOpenProfile(username: string) {
    setProfileUsername(username);
    setActiveTab('profile');
  }

  function handleOpenReel(postId: string) {
    setFocusedReelId(postId);
    setActiveTab('reels');
  }

  function handleMessageUser(userId: string) {
    if (!currentUser) {
      openAuth('Sign in to send private messages.');
      return;
    }
    setMessagePartnerId(userId);
    setActiveTab('messages');
  }

  async function handleLike(postId: string) {
    if (!currentUser) {
      openAuth('Sign in to like posts and reels.');
      return;
    }
    try {
      const res = await api.toggleLike(postId);
      const applyLike = (list: PostItem[]) =>
        list.map((p) =>
          p.id === postId ? { ...p, likedByMe: res.liked, likesCount: res.likesCount } : p,
        );
      setFeed((prev) => ({
        ...prev,
        posts: applyLike(prev.posts),
        reels: applyLike(prev.reels),
      }));
    } catch {
      showToast('Could not update like.');
    }
  }

  async function handleSave(postId: string) {
    if (!currentUser) {
      openAuth('Sign in to save posts to your collection.');
      return;
    }
    try {
      const res = await api.toggleSave(postId);
      const applySave = (list: PostItem[]) =>
        list.map((p) => (p.id === postId ? { ...p, savedByMe: res.saved } : p));
      setFeed((prev) => ({
        ...prev,
        posts: applySave(prev.posts),
        reels: applySave(prev.reels),
      }));
      showToast(res.saved ? 'Saved to your collection' : 'Removed from saved');
    } catch {
      showToast('Could not save post.');
    }
  }

  async function handleAddComment(postId: string, text: string) {
    try {
      const res = await api.addComment(postId, text);
      const appendComment = (list: PostItem[]) =>
        list.map((p) =>
          p.id === postId
            ? {
                ...p,
                commentsCount: p.commentsCount + 1,
                comments: [...p.comments, res.comment],
              }
            : p,
        );
      setFeed((prev) => ({
        ...prev,
        posts: appendComment(prev.posts),
        reels: appendComment(prev.reels),
      }));
      return res.comment;
    } catch {
      showToast('Could not post comment.');
      return null;
    }
  }

  async function handleFollowToggle(userId: string) {
    if (!currentUser) {
      openAuth('Sign in to follow creators.');
      return;
    }
    try {
      const res = await api.toggleFollow(userId);
      const updateAuthor = (list: PostItem[]) =>
        list.map((p) =>
          p.authorId === userId
            ? {
                ...p,
                author: {
                  ...p.author,
                  isFollowing: res.isFollowing,
                  followersCount: res.followersCount,
                },
              }
            : p,
        );
      setFeed((prev) => ({
        ...prev,
        posts: updateAuthor(prev.posts),
        reels: updateAuthor(prev.reels),
        suggestedUsers: prev.suggestedUsers.map((u) =>
          u.id === userId
            ? { ...u, isFollowing: res.isFollowing, followersCount: res.followersCount }
            : u,
        ),
      }));
    } catch {
      showToast('Could not update follow status.');
    }
  }

  async function handleDeletePost(postId: string) {
    try {
      await api.deletePost(postId);
      setFeed((prev) => ({
        ...prev,
        posts: prev.posts.filter((p) => p.id !== postId),
        reels: prev.reels.filter((p) => p.id !== postId),
      }));
      showToast('Post deleted');
    } catch {
      showToast('Could not delete post.');
    }
  }

  async function handleLogout() {
    await api.logout();
    setCurrentUser(null);
    setProfileUsername(null);
    setActiveTab('home');
    refreshFeed();
    showToast('Signed out');
  }

  const activeCommentsPost =
    [...feed.posts, ...feed.reels].find((p) => p.id === commentsPostId) || null;

  const desktopNavItems: {
    id: NavTab;
    label: string;
    icon: typeof Home;
    badge?: number;
  }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'reels', label: 'Reels', icon: Film },
    { id: 'messages', label: 'Messages', icon: MessageCircle, badge: feed.unreadMessages },
    { id: 'notifications', label: 'Activity', icon: Bell, badge: feed.unreadNotifications },
    { id: 'camera', label: 'Camera', icon: PlusSquare },
    { id: 'monetization', label: 'Rewards', icon: Award },
    ...(currentUser?.role === 'admin'
      ? [{ id: 'admin' as NavTab, label: 'Admin', icon: ShieldCheck }]
      : []),
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  return (
    <div className="min-h-dvh bg-[#09090B] text-[#FAFAFA] flex flex-col lg:flex-row">
      {/* Mobile Top App Bar (compact sticky header within 15% cap) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 pt-safe bg-[#09090B]/90 backdrop-blur-md border-b border-white/[0.07] px-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            setActiveTab('home');
            setProfileUsername(null);
          }}
          className="font-display text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          SnapGram
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            aria-label="Notifications"
            className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-zinc-200 hover:bg-white/[0.06]"
          >
            <Bell className="w-5 h-5" />
            {feed.unreadNotifications > 0 && (
              <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {feed.unreadNotifications}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            aria-label="Private messages"
            className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-zinc-200 hover:bg-white/[0.06]"
          >
            <MessageCircle className="w-5 h-5" />
            {feed.unreadMessages > 0 && (
              <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold flex items-center justify-center tabular-nums">
                {feed.unreadMessages}
              </span>
            )}
          </button>

          {!currentUser && (
            <button
              type="button"
              onClick={() => openAuth(undefined, 'login')}
              className="ml-1 h-9 px-3 rounded-xl bg-white text-zinc-950 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Desktop Left Navigation Rail */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-dvh border-r border-white/[0.07] bg-[#09090B] px-4 py-6 justify-between">
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('home');
              setProfileUsername(null);
            }}
            className="px-3 text-left font-display text-2xl font-extrabold tracking-tight text-white whitespace-nowrap"
          >
            SnapGram
          </button>

          <nav aria-label="Main navigation" className="space-y-1">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'profile') setProfileUsername(null);
                    if (item.id === 'camera') setCameraInitialMode('post');
                    setActiveTab(item.id);
                  }}
                  className={`w-full min-h-[46px] px-3.5 rounded-xl flex items-center justify-between text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#121216] text-white border border-white/[0.08]'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="flex items-center gap-3.5">
                    <Icon className={`w-5 h-5 ${active ? 'text-amber-400' : ''}`} />
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-zinc-950 text-[11px] font-bold flex items-center justify-center tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Account footer */}
        <div className="pt-4 border-t border-white/[0.07]">
          {currentUser ? (
            <button
              type="button"
              onClick={() => {
                setProfileUsername(null);
                setActiveTab('profile');
              }}
              className="w-full p-2.5 rounded-2xl bg-[#121216] border border-white/[0.07] flex items-center gap-3 text-left hover:border-white/15 transition-colors"
            >
              <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white truncate">
                  {currentUser.displayName}
                </div>
                <div className="text-xs text-zinc-400 truncate">@{currentUser.username}</div>
              </div>
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => openAuth(undefined, 'login')}
                className="w-full h-11 rounded-xl bg-white text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign in / Sign up
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Stage */}
      <main className="flex-1 min-w-0 pb-20 lg:pb-8">
        {activeTab === 'home' && (
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            {/* Center Feed Column */}
            <div className="xl:col-span-8 w-full max-w-[560px] mx-auto space-y-5">
              <StoryBar
                storyGroups={feed.storyGroups}
                currentUser={currentUser}
                onSelectGroup={(idx) => setStoryViewerIndex(idx)}
                onCreateStory={() => {
                  setCameraInitialMode('story');
                  setActiveTab('camera');
                }}
              />

              {loadingFeed ? (
                <div className="space-y-5">
                  <div className="h-[460px] rounded-2xl bg-zinc-900 animate-pulse" />
                  <div className="h-[460px] rounded-2xl bg-zinc-900 animate-pulse" />
                </div>
              ) : feed.posts.length === 0 ? (
                <div className="py-16 text-center bg-[#121216] border border-white/[0.07] rounded-2xl space-y-3">
                  <p className="text-base font-medium text-zinc-300">Your feed is quiet</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('camera')}
                    className="h-10 px-5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-semibold"
                  >
                    Capture first frame
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {(() => {
                    const visibleFeedAd = feed.ads.find(
                      (a) => a.placement === 'feed' && !hiddenAdIds.includes(a.id),
                    );
                    const adInsertIndex = Math.min(1, feed.posts.length - 1);
                    return feed.posts.map((post, idx) => (
                      <div key={post.id} className="space-y-5">
                        <PostCard
                          post={post}
                          currentUser={currentUser}
                          onLike={handleLike}
                          onSave={handleSave}
                          onOpenComments={(p) => setCommentsPostId(p.id)}
                          onOpenProfile={handleOpenProfile}
                          onFollowToggle={handleFollowToggle}
                          onShareToDM={(p) => {
                            if (!currentUser) {
                              openAuth('Sign in to send posts directly to friends.');
                              return;
                            }
                            setSharePost(p);
                          }}
                          onDeletePost={handleDeletePost}
                          onOpenReel={handleOpenReel}
                        />
                        {visibleFeedAd && idx === adInsertIndex && (
                          <SponsoredAdCard
                            ad={visibleFeedAd}
                            isAuthenticated={Boolean(currentUser)}
                            onRequireAuth={(reason) => openAuth(reason)}
                            onHidden={(adId) => setHiddenAdIds((prev) => [...prev, adId])}
                          />
                        )}
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Desktop Right Contextual Rail */}
            <aside className="hidden xl:block xl:col-span-4 sticky top-6 space-y-5">
              {currentUser ? (
                <div className="p-4 bg-[#121216] border border-white/[0.07] rounded-2xl flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileUsername(null);
                      setActiveTab('profile');
                    }}
                    className="flex items-center gap-3 min-w-0 text-left"
                  >
                    <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size="md" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {currentUser.displayName}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">@{currentUser.username}</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCameraInitialMode('story');
                      setActiveTab('camera');
                    }}
                    className="h-9 px-3 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-semibold whitespace-nowrap"
                  >
                    New Story
                  </button>
                </div>
              ) : (
                <div className="p-5 bg-[#121216] border border-white/[0.08] rounded-2xl space-y-3">
                  <h2 className="text-base font-bold text-white">Join SnapGram</h2>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Sign in or try the demo creator account to post photos, record 24-hour stories, and message friends.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAuth(undefined, 'signup')}
                      className="flex-1 h-10 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200"
                    >
                      Sign up
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuth(undefined, 'login')}
                      className="flex-1 h-10 rounded-xl bg-zinc-800 text-white text-xs font-semibold hover:bg-zinc-700"
                    >
                      Log in
                    </button>
                  </div>
                </div>
              )}

              <div className="p-4 bg-[#121216] border border-white/[0.07] rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-200">Suggested Creators</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('explore')}
                    className="text-xs font-medium text-amber-400 hover:underline"
                  >
                    See all
                  </button>
                </div>

                <div className="space-y-3">
                  {feed.suggestedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => handleOpenProfile(user.username)}
                        className="flex items-center gap-3 min-w-0 text-left"
                      >
                        <Avatar src={user.avatarUrl} name={user.displayName} size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {user.displayName}
                          </div>
                          <div className="text-xs text-zinc-400 truncate tabular-nums">
                            @{user.username} · {formatCompactCount(user.followersCount)}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFollowToggle(user.id)}
                        className={`h-8 px-3 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                          user.isFollowing
                            ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                            : 'bg-white text-zinc-950 hover:bg-zinc-200'
                        }`}
                      >
                        {user.isFollowing ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'explore' && (
          <ExploreView
            onOpenProfile={handleOpenProfile}
            onOpenComments={(p) => setCommentsPostId(p.id)}
            onOpenReel={handleOpenReel}
            onFollowToggle={handleFollowToggle}
          />
        )}

        {activeTab === 'reels' && (
          <div className="sm:py-3">
            <ReelsView
              reels={feed.reels}
              focusedReelId={focusedReelId}
              onLike={handleLike}
              onSave={handleSave}
              onOpenComments={(p) => setCommentsPostId(p.id)}
              onOpenProfile={handleOpenProfile}
              onFollowToggle={handleFollowToggle}
              onShareToDM={(p) => {
                if (!currentUser) {
                  openAuth('Sign in to send reels directly to friends.');
                  return;
                }
                setSharePost(p);
              }}
            />
          </div>
        )}

        {activeTab === 'camera' && (
          <CameraStudio
            currentUser={currentUser}
            suggestedUsers={feed.suggestedUsers}
            initialMode={cameraInitialMode}
            onRequireAuth={(reason) => openAuth(reason)}
            onPublished={(mode) => {
              refreshFeed();
              if (mode === 'reel') {
                setFocusedReelId(null);
                setActiveTab('reels');
                showToast('Reel published');
              } else if (mode === 'snap') {
                setActiveTab('messages');
                showToast('Ephemeral Snap sent');
              } else if (mode === 'story') {
                setActiveTab('home');
                showToast('Added to 24-hour story');
              } else {
                setActiveTab('home');
                showToast('Post published to feed');
              }
            }}
          />
        )}

        {activeTab === 'messages' && (
          <MessagesView
            currentUser={currentUser}
            initialPartnerId={messagePartnerId}
            onRequireAuth={(reason) => openAuth(reason)}
            onOpenProfile={handleOpenProfile}
            onUnreadChange={refreshFeed}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsView
            currentUser={currentUser}
            onRequireAuth={(reason) => openAuth(reason)}
            onOpenProfile={handleOpenProfile}
            onMarkedRead={refreshFeed}
          />
        )}

        {activeTab === 'monetization' && (
          <MonetizationView
            currentUser={currentUser}
            onRequireAuth={(reason) => openAuth(reason)}
            onUserUpdated={(u) => setCurrentUser(u)}
            onToast={showToast}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboardView currentUser={currentUser} onToast={showToast} />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            username={profileUsername}
            currentUser={currentUser}
            onRequireAuth={(reason) => openAuth(reason)}
            onUserUpdated={(u) => {
              if (profileUsername && currentUser && profileUsername === currentUser.username) {
                setProfileUsername(u.username);
              }
              setCurrentUser(u);
              refreshFeed();
              showToast('Profile updated');
            }}
            onLogout={handleLogout}
            onFollowToggle={handleFollowToggle}
            onOpenComments={(p) => setCommentsPostId(p.id)}
            onOpenReel={handleOpenReel}
            onMessageUser={handleMessageUser}
            onOpenProfile={handleOpenProfile}
            onOpenMonetization={() => setActiveTab('monetization')}
            onOpenAdmin={() => setActiveTab('admin')}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Thumb Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 pb-safe bg-[#09090B]/95 backdrop-blur-md border-t border-white/[0.08] grid grid-cols-5 items-center"
      >
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
            activeTab === 'home' ? 'text-white' : 'text-zinc-500'
          }`}
        >
          <Home className={`w-5 h-5 ${activeTab === 'home' ? 'text-amber-400' : ''}`} />
          <span className="text-[10px] font-medium">Home</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('explore')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
            activeTab === 'explore' ? 'text-white' : 'text-zinc-500'
          }`}
        >
          <Compass className={`w-5 h-5 ${activeTab === 'explore' ? 'text-amber-400' : ''}`} />
          <span className="text-[10px] font-medium">Explore</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCameraInitialMode('post');
            setActiveTab('camera');
          }}
          aria-label="Open camera studio"
          className="min-h-[44px] flex items-center justify-center"
        >
          <span className="w-11 h-9 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center shadow-lg shadow-amber-500/20 active:scale-95 transition-transform">
            <Camera className="w-5 h-5" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFocusedReelId(null);
            setActiveTab('reels');
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
            activeTab === 'reels' ? 'text-white' : 'text-zinc-500'
          }`}
        >
          <Film className={`w-5 h-5 ${activeTab === 'reels' ? 'text-amber-400' : ''}`} />
          <span className="text-[10px] font-medium">Reels</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setProfileUsername(null);
            setActiveTab('profile');
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
            activeTab === 'profile' ? 'text-white' : 'text-zinc-500'
          }`}
        >
          {currentUser ? (
            <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size="xs" />
          ) : (
            <UserIcon className={`w-5 h-5 ${activeTab === 'profile' ? 'text-amber-400' : ''}`} />
          )}
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>

      {/* Modals & Drawers */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authInitialMode}
        initialReferralCode={initialReferralCode}
        reasonMessage={authReason}
        onAuthenticated={(user) => {
          setCurrentUser(user);
          refreshFeed();
          showToast(`Welcome, @${user.username}`);
        }}
      />

      {storyViewerIndex !== null && (
        <StoryViewer
          groups={feed.storyGroups}
          initialGroupIndex={storyViewerIndex}
          isAuthenticated={Boolean(currentUser)}
          onRequireAuth={(reason) => {
            setStoryViewerIndex(null);
            openAuth(reason);
          }}
          onClose={() => setStoryViewerIndex(null)}
          onOpenProfile={handleOpenProfile}
          onStoryViewed={(storyId) => {
            setFeed((prev) => ({
              ...prev,
              storyGroups: prev.storyGroups.map((g) => {
                const updatedStories = g.stories.map((s) =>
                  s.id === storyId ? { ...s, viewedByMe: true } : s,
                );
                return {
                  ...g,
                  stories: updatedStories,
                  hasUnviewed: updatedStories.some((s) => !s.viewedByMe),
                };
              }),
            }));
          }}
        />
      )}

      <CommentsDrawer
        post={activeCommentsPost}
        isAuthenticated={Boolean(currentUser)}
        onClose={() => setCommentsPostId(null)}
        onRequireAuth={(reason) => {
          setCommentsPostId(null);
          openAuth(reason);
        }}
        onAddComment={handleAddComment}
        onOpenProfile={(uname) => {
          setCommentsPostId(null);
          handleOpenProfile(uname);
        }}
      />

      <ShareToDMModal
        post={sharePost}
        users={feed.suggestedUsers}
        onClose={() => setSharePost(null)}
      />

      {/* Non-blocking status toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-xs font-semibold text-white shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
