export type NavTab =
  | 'home'
  | 'explore'
  | 'camera'
  | 'reels'
  | 'profile'
  | 'messages'
  | 'notifications'
  | 'monetization'
  | 'admin';

export type UserRole = 'user' | 'admin';
export type UserAccountStatus = 'active' | 'restricted' | 'suspended';

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  website?: string;
  verified?: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing?: boolean;
}

export interface AuthUser extends UserSummary {
  email: string;
  role: UserRole;
  accountStatus: UserAccountStatus;
  ageVerified18Plus: boolean;
  monetizationTermsAccepted: boolean;
  taxComplianceAccepted: boolean;
  referralCode: string;
}

export interface StoryItem {
  id: string;
  authorId: string;
  author: UserSummary;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  filterId: string;
  captionOverlay?: string;
  createdAt: number;
  expiresAt: number;
  viewedByMe: boolean;
  viewsCount: number;
}

export interface StoryGroup {
  author: UserSummary;
  stories: StoryItem[];
  hasUnviewed: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  author: UserSummary;
  text: string;
  createdAt: number;
}

export interface PostItem {
  id: string;
  authorId: string;
  author: UserSummary;
  kind: 'photo' | 'video' | 'reel';
  mediaUrl: string;
  posterUrl?: string;
  isAnimatedPhoto?: boolean;
  filterId: string;
  caption: string;
  location?: string;
  audioTrack?: string;
  category: string;
  tags: string[];
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  createdAt: number;
  comments: PostComment[];
}

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  isEphemeralSnap?: boolean;
  snapOpenedByRecipient?: boolean;
  read: boolean;
  createdAt: number;
}

export interface ConversationThread {
  partner: UserSummary;
  lastMessage: DirectMessage | null;
  unreadCount: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  actorId: string;
  actor: UserSummary;
  type: 'like' | 'comment' | 'follow' | 'story_reply';
  postId?: string;
  postPreviewUrl?: string;
  text: string;
  read: boolean;
  createdAt: number;
}

export interface SponsoredAdItem {
  id: string;
  advertiserName: string;
  title: string;
  body: string;
  mediaUrl: string;
  destinationUrl: string;
  ctaLabel: string;
  placement: 'feed' | 'reels' | 'explore';
  billingModel: 'cpm' | 'cpc';
  ageRestricted18Plus: boolean;
  policyCategory: string;
  fundingStatus: 'unfunded' | 'funded';
}

export interface FeedPayload {
  storyGroups: StoryGroup[];
  posts: PostItem[];
  reels: PostItem[];
  ads: SponsoredAdItem[];
  suggestedUsers: UserSummary[];
  unreadMessages: number;
  unreadNotifications: number;
}

export interface ProfilePayload {
  user: UserSummary;
  posts: PostItem[];
  reels: PostItem[];
  savedPosts: PostItem[];
  isOwnProfile: boolean;
}

export interface AdCampaign {
  id: string;
  ownerUserId: string;
  advertiserName: string;
  title: string;
  body: string;
  mediaUrl: string;
  destinationUrl: string;
  ctaLabel: string;
  placement: 'feed' | 'reels' | 'explore';
  billingModel: 'cpm' | 'cpc';
  rateCents: number;
  budgetCents: number;
  spentCents: number;
  impressions: number;
  clicks: number;
  fundingStatus: 'unfunded' | 'funded';
  stripeCheckoutSessionId?: string;
  status: 'pending_review' | 'active' | 'paused' | 'budget_exhausted' | 'rejected';
  ageRestricted18Plus: boolean;
  policyCompliant: boolean;
  policyCategory: string;
  disclosedAsAd: true;
  createdAt: number;
  updatedAt: number;
}

export interface PointsTransaction {
  id: string;
  userId: string;
  activity:
    | 'post_created'
    | 'story_created'
    | 'like_received'
    | 'comment_received'
    | 'referral_qualified'
    | 'points_redeemed'
    | 'admin_adjustment';
  pointsDelta: number;
  description: string;
  referenceId?: string;
  status: 'credited' | 'reversed';
  createdAt: number;
}

export interface ReferralRecord {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  referredUsername: string;
  referredDisplayName: string;
  codeUsed: string;
  status: 'pending_qualification' | 'qualified' | 'rejected';
  rewardPoints: number;
  disqualificationReason?: string;
  createdAt: number;
  qualifiedAt?: number;
}

export interface PayoutRequest {
  id: string;
  userId: string;
  username?: string;
  amountCents: number;
  currency: 'usd';
  provider: 'stripe_connect';
  status: 'pending_review' | 'approved_awaiting_provider' | 'processing' | 'paid' | 'rejected';
  stripeTransferId?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MonetizationPolicyConfig {
  minPostsRequired: number;
  minFollowersRequired: number;
  pointsPerUsd: number;
  minPayoutCents: number;
  creatorRevenueSharePct: number;
  referralBonusPoints: number;
  monthlyReferralCap: number;
  dailyPointsCap: number;
}

export interface CreatorMonetizationDashboard {
  eligibility: {
    eligible: boolean;
    reasons: string[];
    checks: { label: string; passed: boolean; detail: string }[];
  };
  compliance: {
    ageVerified18Plus: boolean;
    birthYear?: number;
    monetizationTermsAcceptedAt?: number;
    taxComplianceAccepted: boolean;
    policyStrikes: number;
    accountStatus: UserAccountStatus;
  };
  balances: {
    pointsBalance: number;
    redeemablePoints: number;
    estimatedEarningsCents: number;
    approvedEarningsCents: number;
    pendingPayoutCents: number;
    paidOutCents: number;
    creatorAdSharePoolCents: number;
  };
  paymentProvider: {
    provider: 'stripe_connect';
    configured: boolean;
    accountStatus: 'not_connected' | 'onboarding_incomplete' | 'active';
    stripeAccountIdLast4?: string;
  };
  config: MonetizationPolicyConfig;
  pointsHistory: PointsTransaction[];
  referrals: {
    code: string;
    shareUrl: string;
    totalCount: number;
    qualifiedCount: number;
    pendingCount: number;
    monthlyQualifiedCount: number;
    records: ReferralRecord[];
  };
  payouts: PayoutRequest[];
  myCampaigns: AdCampaign[];
}

export interface AdminAdReport {
  id: string;
  adId: string;
  adTitle: string;
  reporterId: string;
  reason: string;
  status: 'open' | 'resolved';
  createdAt: number;
}

export interface AdminUserRow {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  accountStatus: UserAccountStatus;
  ageVerified18Plus: boolean;
  monetizationTermsAccepted: boolean;
  policyStrikes: number;
  pointsBalance: number;
  estimatedEarningsCents: number;
  approvedEarningsCents: number;
  postsCount: number;
  followersCount: number;
  createdAt: number;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminUsername: string;
  action: string;
  targetId: string;
  detail: string;
  createdAt: number;
}

export interface AdminOverviewPayload {
  paymentProviderConfigured: boolean;
  metrics: {
    totalUsers: number;
    eligibleCreators: number;
    activeAds: number;
    pendingReviewAds: number;
    totalAdImpressions: number;
    totalAdClicks: number;
    fundedAdRevenueCents: number;
    platformRevenueCents: number;
    creatorPoolCents: number;
    pendingPayoutsCount: number;
    pendingPayoutsCents: number;
    qualifiedReferrals: number;
  };
  config: MonetizationPolicyConfig;
  ads: AdCampaign[];
  adReports: AdminAdReport[];
  payouts: PayoutRequest[];
  referrals: (ReferralRecord & { referrerUsername: string })[];
  users: AdminUserRow[];
  auditLogs: AdminAuditLog[];
}
