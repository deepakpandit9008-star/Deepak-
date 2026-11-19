import type {
  AdCampaign,
  AdminOverviewPayload,
  AppNotification,
  AuthUser,
  ConversationThread,
  CreatorMonetizationDashboard,
  DirectMessage,
  FeedPayload,
  MonetizationPolicyConfig,
  PayoutRequest,
  PostComment,
  PostItem,
  ProfilePayload,
  StoryGroup,
  UserAccountStatus,
  UserSummary,
} from '../types';

const TOKEN_STORAGE_KEY = 'snapgram_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted private browsing modes
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  me: () => apiFetch<{ user: AuthUser | null }>('/api/auth/me'),
  login: async (identifier: string, password: string) => {
    const res = await apiFetch<{ user: AuthUser; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setStoredToken(res.token);
    return res.user;
  },
  signup: async (payload: {
    username: string;
    displayName: string;
    email: string;
    password: string;
    referralCode?: string;
    birthYear?: number;
  }) => {
    const res = await apiFetch<{ user: AuthUser; token: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(res.token);
    return res.user;
  },
  demoLogin: async () => {
    const res = await apiFetch<{ user: AuthUser; token: string }>('/api/auth/demo', {
      method: 'POST',
    });
    setStoredToken(res.token);
    return res.user;
  },
  logout: async () => {
    try {
      await apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  getFeed: () => apiFetch<FeedPayload>('/api/feed'),
  explore: (q: string, category: string) =>
    apiFetch<{ posts: PostItem[]; users: UserSummary[] }>(
      `/api/explore?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`,
    ),

  createPost: (payload: {
    mediaDataUrl: string;
    kind: 'photo' | 'video' | 'reel';
    filterId: string;
    caption: string;
    location?: string;
    audioTrack?: string;
    category?: string;
  }) =>
    apiFetch<{ post: PostItem }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deletePost: (postId: string) =>
    apiFetch<{ ok: boolean }>(`/api/posts/${postId}`, { method: 'DELETE' }),

  createStory: (payload: { mediaDataUrl: string; filterId: string; captionOverlay?: string }) =>
    apiFetch<{ ok: boolean; storyGroups: StoryGroup[] }>('/api/stories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  viewStory: (storyId: string) =>
    apiFetch<{ ok: boolean }>(`/api/stories/${storyId}/view`, { method: 'POST' }),

  replyToStory: (storyId: string, text: string) =>
    apiFetch<{ ok: boolean }>(`/api/stories/${storyId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  toggleLike: (postId: string) =>
    apiFetch<{ liked: boolean; likesCount: number }>(`/api/posts/${postId}/like`, { method: 'POST' }),

  toggleSave: (postId: string) =>
    apiFetch<{ saved: boolean }>(`/api/posts/${postId}/save`, { method: 'POST' }),

  addComment: (postId: string, text: string) =>
    apiFetch<{ comment: PostComment }>(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  toggleFollow: (userId: string) =>
    apiFetch<{ isFollowing: boolean; followersCount: number }>(`/api/users/${userId}/follow`, {
      method: 'POST',
    }),

  getProfile: (username: string) => apiFetch<ProfilePayload>(`/api/users/${encodeURIComponent(username)}`),

  getFollowers: (userId: string) =>
    apiFetch<{ users: UserSummary[] }>(`/api/users/${encodeURIComponent(userId)}/followers`),

  getFollowing: (userId: string) =>
    apiFetch<{ users: UserSummary[] }>(`/api/users/${encodeURIComponent(userId)}/following`),

  updateProfile: (payload: {
    username?: string;
    displayName: string;
    bio: string;
    website?: string;
    avatarDataUrl?: string;
  }) =>
    apiFetch<{ user: AuthUser }>('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getThreads: () => apiFetch<{ threads: ConversationThread[] }>('/api/messages'),
  getMessages: (partnerId: string) =>
    apiFetch<{ partner: UserSummary; messages: DirectMessage[] }>(`/api/messages/${partnerId}`),
  sendMessage: (
    partnerId: string,
    payload: { text?: string; mediaDataUrl?: string; isEphemeralSnap?: boolean },
  ) =>
    apiFetch<{ message: DirectMessage }>(`/api/messages/${partnerId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  openSnap: (messageId: string) =>
    apiFetch<{ message: DirectMessage }>(`/api/messages/${messageId}/open-snap`, { method: 'POST' }),

  getNotifications: () => apiFetch<{ notifications: AppNotification[] }>('/api/notifications'),
  markNotificationsRead: () =>
    apiFetch<{ ok: boolean }>('/api/notifications/read', { method: 'POST' }),

  // Advertising
  recordAdEvent: (adId: string, eventType: 'impression' | 'click') =>
    apiFetch<{ ok: boolean; impressions: number; clicks: number; spentCents: number }>(
      `/api/ads/${encodeURIComponent(adId)}/${eventType}`,
      { method: 'POST' },
    ),
  reportAd: (adId: string, payload: { reason?: string; hideOnly?: boolean }) =>
    apiFetch<{ ok: boolean }>(`/api/ads/${encodeURIComponent(adId)}/report`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createAdCampaign: (payload: {
    advertiserName: string;
    title: string;
    body: string;
    mediaDataUrl?: string;
    destinationUrl: string;
    ctaLabel?: string;
    placement: 'feed' | 'reels' | 'explore';
    billingModel: 'cpm' | 'cpc';
    rateCents: number;
    budgetCents: number;
    ageRestricted18Plus: boolean;
    policyCategory: string;
  }) =>
    apiFetch<{ campaign: AdCampaign }>('/api/ads', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  fundAdCheckout: (adId: string) =>
    apiFetch<{ checkoutUrl: string; sessionId: string }>(
      `/api/ads/${encodeURIComponent(adId)}/fund-checkout`,
      { method: 'POST' },
    ),

  // Creator Monetization, Points, Referrals & Stripe Payouts
  getMonetizationDashboard: () =>
    apiFetch<CreatorMonetizationDashboard>('/api/monetization/dashboard'),
  updateCompliance: (payload: {
    birthYear?: number;
    acceptMonetizationTerms?: boolean;
    acceptTaxCompliance?: boolean;
  }) =>
    apiFetch<{ user: AuthUser }>('/api/monetization/compliance', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  redeemPoints: (points: number) =>
    apiFetch<{ pointsBalance: number; estimatedEarningsCents: number }>('/api/monetization/redeem', {
      method: 'POST',
      body: JSON.stringify({ points }),
    }),
  connectPayoutAccount: () =>
    apiFetch<{ onboardingUrl: string }>('/api/monetization/payout-account/connect', {
      method: 'POST',
    }),
  requestPayout: (amountCents: number) =>
    apiFetch<{ payout: PayoutRequest }>('/api/monetization/payouts/request', {
      method: 'POST',
      body: JSON.stringify({ amountCents }),
    }),

  // Admin Console (RBAC: role === 'admin')
  getAdminOverview: () => apiFetch<AdminOverviewPayload>('/api/admin/overview'),
  updateAdminConfig: (payload: Partial<MonetizationPolicyConfig>) =>
    apiFetch<{ config: MonetizationPolicyConfig }>('/api/admin/config', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  moderateAd: (
    adId: string,
    payload: { status?: AdCampaign['status']; ageRestricted18Plus?: boolean; policyCompliant?: boolean },
  ) =>
    apiFetch<{ ad: AdCampaign }>(`/api/admin/ads/${encodeURIComponent(adId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  resolveAdReport: (reportId: string, pauseAd: boolean) =>
    apiFetch<{ report: unknown }>(`/api/admin/reports/${encodeURIComponent(reportId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ pauseAd }),
    }),
  moderatePayout: (payoutId: string, payload: { action: 'approve' | 'reject'; note?: string }) =>
    apiFetch<{ payout: PayoutRequest; paymentProviderConfigured: boolean; message?: string }>(
      `/api/admin/payouts/${encodeURIComponent(payoutId)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    ),
  moderateReferral: (referralId: string, payload: { status: 'qualified' | 'rejected'; reason?: string }) =>
    apiFetch<{ referral: unknown }>(`/api/admin/referrals/${encodeURIComponent(referralId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  manageAdminUser: (
    userId: string,
    payload: {
      accountStatus?: UserAccountStatus;
      policyStrikesDelta?: number;
      pointsDelta?: number;
      approveEstimatedCents?: number;
      reason?: string;
    },
  ) =>
    apiFetch<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

