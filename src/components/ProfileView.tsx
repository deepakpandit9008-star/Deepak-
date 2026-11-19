import { useEffect, useRef, useState } from 'react';
import {
  Award,
  BadgeCheck,
  Bookmark,
  Camera,
  Film,
  Grid3X3,
  Link as LinkIcon,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCompactCount } from '../lib/format';
import type { AuthUser, PostItem, ProfilePayload, UserSummary } from '../types';
import { Avatar, MediaFrame } from './MediaFrame';

interface ProfileViewProps {
  username: string | null;
  currentUser: AuthUser | null;
  onRequireAuth: (reason: string) => void;
  onUserUpdated: (user: AuthUser) => void;
  onLogout: () => void;
  onFollowToggle: (userId: string) => Promise<void>;
  onOpenComments: (post: PostItem) => void;
  onOpenReel: (postId: string) => void;
  onMessageUser: (userId: string) => void;
  onOpenProfile: (username: string) => void;
  onOpenMonetization?: () => void;
  onOpenAdmin?: () => void;
}

function resizeImageToDataUrl(file: File, maxDim = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected image.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Invalid image file.'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(result);
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileView({
  username,
  currentUser,
  onRequireAuth,
  onUserUpdated,
  onLogout,
  onFollowToggle,
  onOpenComments,
  onOpenReel,
  onMessageUser,
  onOpenProfile,
  onOpenMonetization,
  onOpenAdmin,
}: ProfileViewProps) {
  const targetUsername = username || currentUser?.username || null;
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('posts');

  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | undefined>(undefined);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [connectionsModal, setConnectionsModal] = useState<'followers' | 'following' | null>(null);
  const [connectionsList, setConnectionsList] = useState<UserSummary[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!targetUsername) {
      setProfile(null);
      return;
    }
    loadProfile(targetUsername);
  }, [
    targetUsername,
    currentUser?.id,
    currentUser?.username,
    currentUser?.displayName,
    currentUser?.bio,
    currentUser?.avatarUrl,
  ]);

  async function loadProfile(uname: string) {
    setLoading(true);
    try {
      const data = await api.getProfile(uname);
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  function openEditModal() {
    if (!profile) return;
    setEditUsername(profile.user.username);
    setEditName(profile.user.displayName);
    setEditBio(profile.user.bio);
    setEditWebsite(profile.user.website || '');
    setEditAvatar(undefined);
    setEditError(null);
    setEditing(true);
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 640);
      setEditAvatar(dataUrl);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to process photo.');
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setEditError(null);
    setSaving(true);
    try {
      const res = await api.updateProfile({
        username: editUsername,
        displayName: editName,
        bio: editBio,
        website: editWebsite,
        avatarDataUrl: editAvatar,
      });
      onUserUpdated(res.user);
      setEditing(false);
      await loadProfile(res.user.username);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save profile changes.');
    } finally {
      setSaving(false);
    }
  }

  async function openConnections(type: 'followers' | 'following') {
    if (!profile) return;
    setConnectionsModal(type);
    setConnectionsLoading(true);
    try {
      const res =
        type === 'followers'
          ? await api.getFollowers(profile.user.id)
          : await api.getFollowing(profile.user.id);
      setConnectionsList(res.users);
    } catch {
      setConnectionsList([]);
    } finally {
      setConnectionsLoading(false);
    }
  }

  async function handleConnectionFollowToggle(userId: string) {
    await onFollowToggle(userId);
    if (profile) {
      loadProfile(profile.user.username);
      if (connectionsModal) {
        const res =
          connectionsModal === 'followers'
            ? await api.getFollowers(profile.user.id)
            : await api.getFollowing(profile.user.id);
        setConnectionsList(res.users);
      }
    }
  }

  if (!targetUsername) {
    return (
      <div className="max-w-lg mx-auto my-12 px-6 py-10 bg-[#121216] border border-white/[0.08] rounded-3xl text-center space-y-4">
        <h2 className="text-lg font-semibold text-white">Your SnapGram Profile</h2>
        <p className="text-sm text-zinc-400">
          Sign in or create a free account to customize your profile, save posts, and build your gallery.
        </p>
        <button
          type="button"
          onClick={() => onRequireAuth('Sign in to view and customize your profile.')}
          className="h-11 px-6 rounded-xl bg-white text-zinc-950 font-semibold text-sm hover:bg-zinc-200"
        >
          Sign in or Sign up
        </button>
      </div>
    );
  }

  if (loading && !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="h-32 rounded-3xl bg-zinc-900 animate-pulse" />
        <div className="grid grid-cols-3 gap-2">
          <div className="aspect-square rounded-xl bg-zinc-900 animate-pulse" />
          <div className="aspect-square rounded-xl bg-zinc-900 animate-pulse" />
          <div className="aspect-square rounded-xl bg-zinc-900 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto my-12 p-8 text-center text-zinc-400">
        Profile not found.
      </div>
    );
  }

  const displayedItems =
    activeTab === 'posts'
      ? profile.posts
      : activeTab === 'reels'
        ? profile.reels
        : profile.savedPosts;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 space-y-6">
      {/* Profile Header Card */}
      <section className="bg-[#121216] border border-white/[0.08] rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar
            src={profile.user.avatarUrl}
            name={profile.user.displayName}
            size="xl"
            className="self-start"
          />

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                    {profile.user.displayName}
                  </h1>
                  {profile.user.verified && (
                    <BadgeCheck className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                </div>
                <p className="text-sm text-zinc-400">@{profile.user.username}</p>
              </div>

              {profile.isOwnProfile ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="min-h-[40px] px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Edit profile
                  </button>
                  {onOpenMonetization && (
                    <button
                      type="button"
                      onClick={onOpenMonetization}
                      className="min-h-[40px] px-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Award className="w-3.5 h-3.5" />
                      Rewards
                    </button>
                  )}
                  {onOpenAdmin && currentUser?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={onOpenAdmin}
                      className="min-h-[40px] px-3.5 rounded-xl bg-zinc-900 border border-white/[0.1] hover:border-amber-500/40 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      Admin
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onLogout}
                    aria-label="Log out"
                    className="min-h-[40px] px-3.5 rounded-xl bg-zinc-900 border border-white/[0.08] hover:text-rose-400 hover:border-rose-500/30 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await onFollowToggle(profile.user.id);
                      loadProfile(profile.user.username);
                    }}
                    className={`min-h-[40px] px-5 rounded-xl text-xs font-semibold transition-colors ${
                      profile.user.isFollowing
                        ? 'bg-zinc-800 text-white hover:bg-zinc-700'
                        : 'bg-white text-zinc-950 hover:bg-zinc-200'
                    }`}
                  >
                    {profile.user.isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMessageUser(profile.user.id)}
                    className="min-h-[40px] px-4 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-500/25"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Message
                  </button>
                </div>
              )}
            </div>

            {profile.user.bio && (
              <p className="text-sm text-zinc-200 leading-relaxed max-w-xl">{profile.user.bio}</p>
            )}

            {profile.user.website && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <LinkIcon className="w-3.5 h-3.5" />
                <span>{profile.user.website}</span>
              </div>
            )}

            <div className="flex items-center gap-6 pt-1 text-sm tabular-nums">
              <div className="min-h-[36px] flex items-center gap-1">
                <span className="font-bold text-white">{profile.user.postsCount}</span>
                <span className="text-zinc-400">posts</span>
              </div>
              <button
                type="button"
                onClick={() => openConnections('followers')}
                className="min-h-[36px] flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <span className="font-bold text-white">
                  {formatCompactCount(profile.user.followersCount)}
                </span>
                <span className="text-zinc-400">followers</span>
              </button>
              <button
                type="button"
                onClick={() => openConnections('following')}
                className="min-h-[36px] flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <span className="font-bold text-white">
                  {formatCompactCount(profile.user.followingCount)}
                </span>
                <span className="text-zinc-400">following</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#121216] border border-white/[0.08] rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('posts')}
          className={`min-h-[38px] px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'posts' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          Posts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reels')}
          className={`min-h-[38px] px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'reels' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          Reels
        </button>
        {profile.isOwnProfile && (
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`min-h-[38px] px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'saved' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            Saved
          </button>
        )}
      </div>

      {/* Media Grid */}
      {displayedItems.length === 0 ? (
        <div className="py-16 text-center bg-[#121216] border border-white/[0.07] rounded-2xl text-sm text-zinc-500">
          Nothing in {activeTab} yet.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          {displayedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => (item.kind === 'reel' ? onOpenReel(item.id) : onOpenComments(item))}
              className="relative aspect-[4/5] rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-950 border border-white/[0.06] group"
            >
              <MediaFrame
                src={item.mediaUrl}
                alt={item.caption}
                isVideo={item.kind === 'video' || item.kind === 'reel'}
                isAnimatedPhoto={item.isAnimatedPhoto}
                filterId={item.filterId}
              />
              {item.kind === 'reel' && (
                <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/65 text-white flex items-center justify-center">
                  <Film className="w-3 h-3 text-amber-400" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Followers / Following Modal */}
      {connectionsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={connectionsModal === 'followers' ? 'Followers' : 'Following'}
        >
          <div className="w-full sm:max-w-md max-h-[78dvh] bg-[#121216] border border-white/[0.09] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden">
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mt-3 sm:hidden" />

            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
              <h2 className="text-base font-bold text-white capitalize">{connectionsModal}</h2>
              <button
                type="button"
                onClick={() => setConnectionsModal(null)}
                aria-label="Close list"
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {connectionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-xl bg-zinc-900 animate-pulse" />
                  ))}
                </div>
              ) : connectionsList.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-500">
                  {connectionsModal === 'followers'
                    ? 'No followers yet.'
                    : 'Not following anyone yet.'}
                </div>
              ) : (
                connectionsList.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-900/60"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setConnectionsModal(null);
                        onOpenProfile(u.username);
                      }}
                      className="flex items-center gap-3 min-w-0 text-left flex-1"
                    >
                      <Avatar src={u.avatarUrl} name={u.displayName} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {u.displayName}
                        </div>
                        <div className="text-xs text-zinc-400 truncate">@{u.username}</div>
                      </div>
                    </button>

                    {currentUser?.id !== u.id && (
                      <button
                        type="button"
                        onClick={() => handleConnectionFollowToggle(u.id)}
                        className={`h-9 px-3.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                          u.isFollowing
                            ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                            : 'bg-white text-zinc-950 hover:bg-zinc-200'
                        }`}
                      >
                        {u.isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit profile"
        >
          <form
            onSubmit={handleSaveProfile}
            className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto bg-[#121216] border border-white/[0.09] rounded-t-3xl sm:rounded-3xl p-6 pb-safe space-y-4"
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto sm:hidden" />

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Edit profile</h2>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close edit profile"
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-sm text-rose-300">
                {editError}
              </div>
            )}

            <div className="flex items-center gap-4">
              <Avatar
                src={editAvatar || profile.user.avatarUrl}
                name={editName || profile.user.displayName}
                size="lg"
              />
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="h-10 px-4 rounded-xl bg-zinc-800 text-xs font-semibold text-white flex items-center gap-2 hover:bg-zinc-700"
              >
                <Camera className="w-3.5 h-3.5" />
                Change photo
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Username</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={24}
                pattern="[a-zA-Z0-9_]+"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full h-11 px-3.5 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Display name</label>
              <input
                type="text"
                required
                maxLength={40}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-11 px-3.5 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Bio</label>
              <textarea
                rows={3}
                maxLength={180}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Website</label>
              <input
                type="text"
                maxLength={80}
                value={editWebsite}
                onChange={(e) => setEditWebsite(e.target.value)}
                placeholder="yourstudio.com"
                className="w-full h-11 px-3.5 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full h-12 rounded-xl bg-white text-zinc-950 font-semibold text-sm hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
