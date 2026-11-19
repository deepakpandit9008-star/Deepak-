import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { createServer as createViteServer } from 'vite';
import type {
  AdCampaign,
  AdminAdReport,
  AdminAuditLog,
  AdminOverviewPayload,
  AdminUserRow,
  AppNotification,
  AuthUser,
  ConversationThread,
  CreatorMonetizationDashboard,
  DirectMessage,
  FeedPayload,
  MonetizationPolicyConfig,
  PayoutRequest,
  PointsTransaction,
  PostComment,
  PostItem,
  ProfilePayload,
  ReferralRecord,
  SponsoredAdItem,
  StoryGroup,
  StoryItem,
  UserAccountStatus,
  UserRole,
  UserSummary,
} from './src/types.ts';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PRIVATE_UPLOADS_DIR = path.join(DATA_DIR, 'private_uploads');
const DB_FILE = path.join(DATA_DIR, 'snapgram-db.json');
const SESSION_COOKIE = 'snapgram_session';
const SESSION_SECRET =
  process.env.SESSION_SECRET && !process.env.SESSION_SECRET.includes('CHANGE_ME')
    ? process.env.SESSION_SECRET
    : crypto.createHash('sha256').update(`snapgram-local-${process.cwd()}`).digest('hex');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const stripeClient =
  STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.includes('MY_')
    ? new Stripe(STRIPE_SECRET_KEY)
    : null;

interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
  avatarUrl: string;
  bio: string;
  website?: string;
  verified?: boolean;
  role: UserRole;
  accountStatus: UserAccountStatus;
  ageVerified18Plus: boolean;
  birthYear?: number;
  monetizationTermsAcceptedAt?: number;
  taxComplianceAccepted: boolean;
  policyStrikes: number;
  referralCode: string;
  referredByUserId?: string;
  pointsBalance: number;
  estimatedEarningsCents: number;
  approvedEarningsCents: number;
  stripeAccountId?: string;
  payoutAccountStatus: 'not_connected' | 'onboarding_incomplete' | 'active';
  createdAt: number;
}

interface StoredAdEvent {
  id: string;
  adId: string;
  eventType: 'impression' | 'click';
  viewerKey: string;
  createdAt: number;
}

interface StoredStory {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  filterId: string;
  captionOverlay?: string;
  createdAt: number;
  expiresAt: number;
  viewedBy: string[];
}

interface StoredComment {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  createdAt: number;
}

interface StoredPost {
  id: string;
  authorId: string;
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
  likes: string[];
  saves: string[];
  viewsCount: number;
  createdAt: number;
}

interface StoredFollow {
  followerId: string;
  followingId: string;
  createdAt: number;
}

interface StoredMessage {
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

interface StoredNotification {
  id: string;
  userId: string;
  actorId: string;
  type: 'like' | 'comment' | 'follow' | 'story_reply';
  postId?: string;
  postPreviewUrl?: string;
  text: string;
  read: boolean;
  createdAt: number;
}

interface DatabaseSchema {
  users: StoredUser[];
  follows: StoredFollow[];
  stories: StoredStory[];
  posts: StoredPost[];
  comments: StoredComment[];
  messages: StoredMessage[];
  notifications: StoredNotification[];
  ads: AdCampaign[];
  adEvents: StoredAdEvent[];
  adReports: AdminAdReport[];
  adHiddenByUser: Record<string, string[]>;
  pointsLedger: PointsTransaction[];
  rewardActivityClaims: string[];
  referrals: ReferralRecord[];
  payouts: PayoutRequest[];
  auditLogs: AdminAuditLog[];
  monetizationConfig: MonetizationPolicyConfig;
}

const DEFAULT_MONETIZATION_CONFIG: MonetizationPolicyConfig = {
  minPostsRequired: 1,
  minFollowersRequired: 1,
  pointsPerUsd: 100,
  minPayoutCents: 2500,
  creatorRevenueSharePct: 45,
  referralBonusPoints: 100,
  monthlyReferralCap: 20,
  dailyPointsCap: 150,
};

function generateReferralCode(username: string): string {
  const clean = username.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6) || 'SG';
  return `SG-${clean}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(PRIVATE_UPLOADS_DIR)) fs.mkdirSync(PRIVATE_UPLOADS_DIR, { recursive: true });
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuf, derived);
}

function signToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, iat: Date.now(), exp: Date.now() + 1000 * 60 * 60 * 24 * 14 }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: string;
      exp?: number;
    };
    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

function seedDatabase(): DatabaseSchema {
  const now = Date.now();
  const hour = 3600 * 1000;
  const demoPass = hashPassword('snapgram123');

  const users: StoredUser[] = [
    {
      id: 'u_admin',
      username: 'snapgram_admin',
      displayName: 'Platform Operations',
      email: 'admin@snapgram.demo',
      passwordHash: demoPass,
      avatarUrl: '/src/assets/images/avatar_maya_1795026374635.jpg',
      bio: 'SnapGram Trust, Safety & Monetization Operations.',
      verified: true,
      role: 'admin',
      accountStatus: 'active',
      ageVerified18Plus: true,
      birthYear: 1990,
      monetizationTermsAcceptedAt: now - hour * 720,
      taxComplianceAccepted: true,
      policyStrikes: 0,
      referralCode: 'SG-ADMIN-0001',
      pointsBalance: 0,
      estimatedEarningsCents: 0,
      approvedEarningsCents: 0,
      payoutAccountStatus: 'not_connected',
      createdAt: now - hour * 720,
    },
    {
      id: 'u_maya',
      username: 'maya_lin',
      displayName: 'Maya Lin',
      email: 'maya@snapgram.demo',
      passwordHash: demoPass,
      avatarUrl: '/src/assets/images/avatar_maya_1795026374635.jpg',
      bio: '35mm street frames & late-night Tokyo light studies. Shooting Leica M11 + analog.',
      website: 'mayalin.studio',
      verified: true,
      role: 'user',
      accountStatus: 'active',
      ageVerified18Plus: true,
      birthYear: 1996,
      monetizationTermsAcceptedAt: now - hour * 500,
      taxComplianceAccepted: false,
      policyStrikes: 0,
      referralCode: 'SG-MAYA-1001',
      pointsBalance: 0,
      estimatedEarningsCents: 0,
      approvedEarningsCents: 0,
      payoutAccountStatus: 'not_connected',
      createdAt: now - hour * 720,
    },
    {
      id: 'u_kai',
      username: 'kai_motion',
      displayName: 'Kai Sato',
      email: 'kai@snapgram.demo',
      passwordHash: demoPass,
      avatarUrl: '/src/assets/images/avatar_kai_1795026374784.jpg',
      bio: 'Night skate films, soundscapes & handheld city reels.',
      website: 'kaimotion.film',
      verified: true,
      role: 'user',
      accountStatus: 'active',
      ageVerified18Plus: true,
      birthYear: 1998,
      monetizationTermsAcceptedAt: now - hour * 400,
      taxComplianceAccepted: false,
      policyStrikes: 0,
      referralCode: 'SG-KAI-1002',
      pointsBalance: 0,
      estimatedEarningsCents: 0,
      approvedEarningsCents: 0,
      payoutAccountStatus: 'not_connected',
      createdAt: now - hour * 650,
    },
    {
      id: 'u_elena',
      username: 'elena_forma',
      displayName: 'Elena Vance',
      email: 'elena@snapgram.demo',
      passwordHash: demoPass,
      avatarUrl: '/src/assets/images/avatar_elena_1795026376005.jpg',
      bio: 'Spatial designer exploring raw concrete, daylight shadow geometry, and vinyl.',
      website: 'forma-arch.co',
      verified: false,
      role: 'user',
      accountStatus: 'active',
      ageVerified18Plus: true,
      birthYear: 1995,
      monetizationTermsAcceptedAt: now - hour * 300,
      taxComplianceAccepted: false,
      policyStrikes: 0,
      referralCode: 'SG-ELENA-1003',
      pointsBalance: 0,
      estimatedEarningsCents: 0,
      approvedEarningsCents: 0,
      payoutAccountStatus: 'not_connected',
      createdAt: now - hour * 500,
    },
  ];

  const follows: StoredFollow[] = [
    { followerId: 'u_maya', followingId: 'u_kai', createdAt: now - hour * 120 },
    { followerId: 'u_maya', followingId: 'u_elena', createdAt: now - hour * 90 },
    { followerId: 'u_kai', followingId: 'u_maya', createdAt: now - hour * 80 },
    { followerId: 'u_elena', followingId: 'u_maya', createdAt: now - hour * 70 },
  ];

  const stories: StoredStory[] = [
    {
      id: 's_1',
      authorId: 'u_maya',
      mediaUrl: '/src/assets/images/story_rooftop_dusk_1795026377393.jpg',
      mediaType: 'image',
      filterId: 'cobalt',
      captionOverlay: 'Blue hour check-in from Shoreditch rooftop',
      createdAt: now - hour * 2,
      expiresAt: now + hour * 22,
      viewedBy: [],
    },
    {
      id: 's_2',
      authorId: 'u_kai',
      mediaUrl: '/src/assets/images/reel_skate_tunnel_1795026378184.jpg',
      mediaType: 'image',
      filterId: 'kodak',
      captionOverlay: 'Midnight tunnel run — raw cut dropping tonight',
      createdAt: now - hour * 3,
      expiresAt: now + hour * 21,
      viewedBy: [],
    },
    {
      id: 's_3',
      authorId: 'u_elena',
      mediaUrl: '/src/assets/images/post_brutalist_light_1795026377758.jpg',
      mediaType: 'image',
      filterId: 'matte',
      captionOverlay: '4:15 PM sun angle hit the atrium wall',
      createdAt: now - hour * 5,
      expiresAt: now + hour * 19,
      viewedBy: ['u_maya'],
    },
  ];

  const posts: StoredPost[] = [
    {
      id: 'p_tokyo_rain',
      authorId: 'u_maya',
      kind: 'photo',
      mediaUrl: '/src/assets/images/post_tokyo_rain_1795026376614.jpg',
      filterId: 'original',
      caption: 'Wet asphalt turns every lantern into a second exposure. Shinjuku alleyways after midnight.',
      location: 'Shinjuku, Tokyo',
      category: 'Photography',
      tags: ['street', 'tokyo', 'night', '35mm'],
      likes: ['u_kai', 'u_elena'],
      saves: ['u_elena'],
      viewsCount: 1420,
      createdAt: now - hour * 2.5,
    },
    {
      id: 'p_skate_reel',
      authorId: 'u_kai',
      kind: 'reel',
      mediaUrl: '/src/assets/images/reel_skate_tunnel_1795026378184.jpg',
      posterUrl: '/src/assets/images/reel_skate_tunnel_1795026378184.jpg',
      isAnimatedPhoto: true,
      filterId: 'kodak',
      caption: 'Carving the curved pedestrian tube at 1 AM. Echoes of urethane on poured concrete.',
      location: 'Southbank Underpass',
      audioTrack: 'Kai Sato · Sodium Echoes (Original Audio)',
      category: 'Video & Reels',
      tags: ['skate', 'reel', 'nightfilm', 'urban'],
      likes: ['u_maya', 'u_elena'],
      saves: ['u_maya'],
      viewsCount: 8940,
      createdAt: now - hour * 5,
    },
    {
      id: 'p_brutalist',
      authorId: 'u_elena',
      kind: 'photo',
      mediaUrl: '/src/assets/images/post_brutalist_light_1795026377758.jpg',
      filterId: 'matte',
      caption: 'Silence carved in board-formed concrete. Only one diagonal beam enters before dusk.',
      location: 'Kunsthalle Atrium',
      category: 'Architecture',
      tags: ['architecture', 'brutalism', 'light', 'gallery'],
      likes: ['u_maya'],
      saves: ['u_maya', 'u_kai'],
      viewsCount: 980,
      createdAt: now - hour * 9,
    },
    {
      id: 'p_vinyl_video',
      authorId: 'u_kai',
      kind: 'video',
      mediaUrl: '/src/assets/images/post_vinyl_studio_1795026377323.jpg',
      posterUrl: '/src/assets/images/post_vinyl_studio_1795026377323.jpg',
      isAnimatedPhoto: true,
      filterId: 'kodak',
      caption: 'Late-night tape loop session before scoring the next short reel. Warm tungsten and 45 RPM.',
      location: 'Studio B, East London',
      audioTrack: 'Analog Warmth · Loop 04',
      category: 'Music',
      tags: ['vinyl', 'studio', 'analog', 'music'],
      likes: ['u_elena'],
      saves: [],
      viewsCount: 2310,
      createdAt: now - hour * 14,
    },
    {
      id: 'p_rooftop_reel',
      authorId: 'u_maya',
      kind: 'reel',
      mediaUrl: '/src/assets/images/story_rooftop_dusk_1795026377393.jpg',
      posterUrl: '/src/assets/images/story_rooftop_dusk_1795026377393.jpg',
      isAnimatedPhoto: true,
      filterId: 'cobalt',
      caption: 'City lights waking up across the skyline. Held a 15-second timelapse from the parapet.',
      location: 'East Rooftop',
      audioTrack: 'Night Horizon · Ambient Field Recording',
      category: 'Nightlife',
      tags: ['skyline', 'dusk', 'timelapse', 'city'],
      likes: ['u_kai'],
      saves: ['u_kai'],
      viewsCount: 5120,
      createdAt: now - hour * 20,
    },
  ];

  const comments: StoredComment[] = [
    {
      id: 'c_1',
      postId: 'p_tokyo_rain',
      authorId: 'u_kai',
      text: 'The lantern reflections on the wet stone look unreal. What shutter speed did you hold?',
      createdAt: now - hour * 2,
    },
    {
      id: 'c_2',
      postId: 'p_tokyo_rain',
      authorId: 'u_maya',
      text: '1/60s wide open at f/1.4 on 35mm — kept the rain streak sharp.',
      createdAt: now - hour * 1.6,
    },
    {
      id: 'c_3',
      postId: 'p_skate_reel',
      authorId: 'u_elena',
      text: 'That tunnel curve frames the sodium glow so cleanly.',
      createdAt: now - hour * 4,
    },
  ];

  const messages: StoredMessage[] = [
    {
      id: 'm_1',
      senderId: 'u_kai',
      recipientId: 'u_maya',
      text: 'Hey Maya! Are we still shooting the night bridge reel on Thursday?',
      read: true,
      createdAt: now - hour * 6,
    },
    {
      id: 'm_2',
      senderId: 'u_maya',
      recipientId: 'u_kai',
      text: 'Yes, bringing the 35mm and two fast primes. Meet around blue hour?',
      read: true,
      createdAt: now - hour * 5.5,
    },
    {
      id: 'm_3',
      senderId: 'u_kai',
      recipientId: 'u_maya',
      text: 'Sent a quick location snap from the underpass.',
      mediaUrl: '/src/assets/images/reel_skate_tunnel_1795026378184.jpg',
      mediaType: 'image',
      isEphemeralSnap: true,
      snapOpenedByRecipient: false,
      read: false,
      createdAt: now - hour * 1.2,
    },
    {
      id: 'm_4',
      senderId: 'u_elena',
      recipientId: 'u_maya',
      text: 'Loved the Tokyo rain frame — saved it to my moodboard.',
      read: true,
      createdAt: now - hour * 3,
    },
  ];

  const notifications: StoredNotification[] = [
    {
      id: 'n_1',
      userId: 'u_maya',
      actorId: 'u_kai',
      type: 'comment',
      postId: 'p_tokyo_rain',
      postPreviewUrl: '/src/assets/images/post_tokyo_rain_1795026376614.jpg',
      text: 'commented: "The lantern reflections on the wet stone look unreal."',
      read: false,
      createdAt: now - hour * 2,
    },
    {
      id: 'n_2',
      userId: 'u_maya',
      actorId: 'u_elena',
      type: 'like',
      postId: 'p_tokyo_rain',
      postPreviewUrl: '/src/assets/images/post_tokyo_rain_1795026376614.jpg',
      text: 'liked your photo from Shinjuku, Tokyo',
      read: false,
      createdAt: now - hour * 2.2,
    },
    {
      id: 'n_3',
      userId: 'u_maya',
      actorId: 'u_elena',
      type: 'follow',
      text: 'started following you',
      read: true,
      createdAt: now - hour * 18,
    },
  ];

  const ads: AdCampaign[] = [
    {
      id: 'ad_house_studio',
      ownerUserId: 'u_admin',
      advertiserName: 'Forma Analog Lab',
      title: 'Film & Color Presets for Night Photography',
      body: 'Sponsored studio toolkit for creators shooting 35mm and vertical reels. Transparent pricing, no subscriptions required.',
      mediaUrl: '/src/assets/images/post_vinyl_studio_1795026377323.jpg',
      destinationUrl: 'https://example.com/forma-lab',
      ctaLabel: 'Learn more',
      placement: 'feed',
      billingModel: 'cpm',
      rateCents: 600,
      budgetCents: 5000,
      spentCents: 0,
      impressions: 0,
      clicks: 0,
      fundingStatus: 'unfunded',
      status: 'active',
      ageRestricted18Plus: false,
      policyCompliant: true,
      policyCategory: 'Creative Tools',
      disclosedAsAd: true,
      createdAt: now - hour * 12,
      updatedAt: now - hour * 12,
    },
  ];

  return {
    users,
    follows,
    stories,
    posts,
    comments,
    messages,
    notifications,
    ads,
    adEvents: [],
    adReports: [],
    adHiddenByUser: {},
    pointsLedger: [],
    rewardActivityClaims: [],
    referrals: [],
    payouts: [],
    auditLogs: [],
    monetizationConfig: { ...DEFAULT_MONETIZATION_CONFIG },
  };
}

function migrateDatabase(parsed: Partial<DatabaseSchema>): DatabaseSchema {
  const now = Date.now();
  const base = seedDatabase();
  const users: StoredUser[] = (parsed.users || base.users).map((u) => {
    const isEnvAdmin = Boolean(ADMIN_EMAIL && u.email.toLowerCase() === ADMIN_EMAIL);
    return {
      ...u,
      role: isEnvAdmin ? 'admin' : u.role || 'user',
      accountStatus: u.accountStatus || 'active',
      ageVerified18Plus: typeof u.ageVerified18Plus === 'boolean' ? u.ageVerified18Plus : false,
      taxComplianceAccepted: typeof u.taxComplianceAccepted === 'boolean' ? u.taxComplianceAccepted : false,
      policyStrikes: typeof u.policyStrikes === 'number' ? u.policyStrikes : 0,
      referralCode: u.referralCode || generateReferralCode(u.username),
      pointsBalance: typeof u.pointsBalance === 'number' ? u.pointsBalance : 0,
      estimatedEarningsCents:
        typeof u.estimatedEarningsCents === 'number' ? u.estimatedEarningsCents : 0,
      approvedEarningsCents:
        typeof u.approvedEarningsCents === 'number' ? u.approvedEarningsCents : 0,
      payoutAccountStatus: u.payoutAccountStatus || 'not_connected',
    };
  });

  if (!users.some((u) => u.role === 'admin')) {
    const adminTemplate = base.users.find((u) => u.id === 'u_admin');
    if (adminTemplate) users.unshift(adminTemplate);
  }

  return {
    users,
    follows: parsed.follows || base.follows,
    stories: parsed.stories || base.stories,
    posts: parsed.posts || base.posts,
    comments: parsed.comments || base.comments,
    messages: parsed.messages || base.messages,
    notifications: parsed.notifications || base.notifications,
    ads: Array.isArray(parsed.ads) ? parsed.ads : base.ads,
    adEvents: Array.isArray(parsed.adEvents) ? parsed.adEvents : [],
    adReports: Array.isArray(parsed.adReports) ? parsed.adReports : [],
    adHiddenByUser: parsed.adHiddenByUser || {},
    pointsLedger: Array.isArray(parsed.pointsLedger) ? parsed.pointsLedger : [],
    rewardActivityClaims: Array.isArray(parsed.rewardActivityClaims)
      ? parsed.rewardActivityClaims
      : [],
    referrals: Array.isArray(parsed.referrals) ? parsed.referrals : [],
    payouts: Array.isArray(parsed.payouts) ? parsed.payouts : [],
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
    monetizationConfig: {
      ...DEFAULT_MONETIZATION_CONFIG,
      ...(parsed.monetizationConfig || {}),
      minPostsRequired: parsed.monetizationConfig?.minPostsRequired ?? 1,
      minFollowersRequired: parsed.monetizationConfig?.minFollowersRequired ?? 1,
      pointsPerUsd: parsed.monetizationConfig?.pointsPerUsd ?? 100,
      minPayoutCents: parsed.monetizationConfig?.minPayoutCents ?? 2500,
      creatorRevenueSharePct: parsed.monetizationConfig?.creatorRevenueSharePct ?? 45,
      referralBonusPoints: parsed.monetizationConfig?.referralBonusPoints ?? 100,
      monthlyReferralCap: parsed.monetizationConfig?.monthlyReferralCap ?? 20,
      dailyPointsCap: parsed.monetizationConfig?.dailyPointsCap ?? 150,
    },
  };
  void now;
}

function loadDatabase(): DatabaseSchema {
  ensureDirectories();
  if (!fs.existsSync(DB_FILE)) {
    const seeded = seedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf8');
    return seeded;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const migrated = migrateDatabase(JSON.parse(raw) as Partial<DatabaseSchema>);
    return migrated;
  } catch {
    const seeded = seedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf8');
    return seeded;
  }
}

let db: DatabaseSchema = loadDatabase();

function saveDatabase() {
  ensureDirectories();
  const tmpPath = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_FILE);
}

function toUserSummary(user: StoredUser, viewerId: string | null): UserSummary {
  const followersCount = db.follows.filter((f) => f.followingId === user.id).length;
  const followingCount = db.follows.filter((f) => f.followerId === user.id).length;
  const postsCount = db.posts.filter((p) => p.authorId === user.id).length;
  const isFollowing = viewerId
    ? db.follows.some((f) => f.followerId === viewerId && f.followingId === user.id)
    : false;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    website: user.website,
    verified: user.verified,
    followersCount,
    followingCount,
    postsCount,
    isFollowing,
  };
}

function toAuthUser(user: StoredUser): AuthUser {
  return {
    ...toUserSummary(user, user.id),
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    ageVerified18Plus: user.ageVerified18Plus,
    monetizationTermsAccepted: Boolean(user.monetizationTermsAcceptedAt),
    taxComplianceAccepted: user.taxComplianceAccepted,
    referralCode: user.referralCode,
  };
}

function getUserById(id: string): StoredUser | undefined {
  return db.users.find((u) => u.id === id);
}

function evaluateCreatorEligibility(user: StoredUser) {
  const cfg = db.monetizationConfig;
  const postsCount = db.posts.filter((p) => p.authorId === user.id).length;
  const followersCount = db.follows.filter((f) => f.followingId === user.id).length;

  const checks = [
    {
      label: 'Age 18+ Verification',
      passed: user.ageVerified18Plus,
      detail: user.ageVerified18Plus
        ? `Verified${user.birthYear ? ` (${user.birthYear})` : ''}`
        : 'Must verify birth year confirming age 18 or older',
    },
    {
      label: 'Monetization & FTC Policy Terms',
      passed: Boolean(user.monetizationTermsAcceptedAt),
      detail: user.monetizationTermsAcceptedAt
        ? 'Terms and disclosure rules accepted'
        : 'Must accept creator monetization & ad disclosure rules',
    },
    {
      label: 'Account Standing',
      passed: user.accountStatus === 'active' && user.policyStrikes === 0,
      detail:
        user.accountStatus === 'active' && user.policyStrikes === 0
          ? 'Active · 0 policy strikes'
          : `Status: ${user.accountStatus} · ${user.policyStrikes} strikes`,
    },
    {
      label: `Original Posts (${postsCount}/${cfg.minPostsRequired})`,
      passed: postsCount >= cfg.minPostsRequired,
      detail: `Minimum ${cfg.minPostsRequired} original post(s) required`,
    },
    {
      label: `Followers (${followersCount}/${cfg.minFollowersRequired})`,
      passed: followersCount >= cfg.minFollowersRequired,
      detail: `Minimum ${cfg.minFollowersRequired} follower(s) required`,
    },
  ];

  const reasons = checks.filter((c) => !c.passed).map((c) => c.label);
  return {
    eligible: reasons.length === 0,
    reasons,
    checks,
  };
}

function awardActivityPoints(params: {
  userId: string;
  activity: PointsTransaction['activity'];
  points: number;
  description: string;
  referenceId?: string;
  claimKey?: string;
  dailyActivityCap?: number;
}) {
  const user = getUserById(params.userId);
  if (!user) return false;
  if (user.accountStatus !== 'active' || user.policyStrikes > 0) return false;
  if (!user.ageVerified18Plus || !user.monetizationTermsAcceptedAt) return false;

  if (params.claimKey) {
    if (db.rewardActivityClaims.includes(params.claimKey)) return false;
  }

  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const recentCredits = db.pointsLedger.filter(
    (t) =>
      t.userId === user.id &&
      t.status === 'credited' &&
      t.pointsDelta > 0 &&
      t.createdAt >= dayAgo,
  );
  const earnedLast24h = recentCredits.reduce((acc, t) => acc + t.pointsDelta, 0);
  if (earnedLast24h + params.points > db.monetizationConfig.dailyPointsCap) {
    return false;
  }
  if (params.dailyActivityCap !== undefined) {
    const activityCountToday = recentCredits.filter((t) => t.activity === params.activity).length;
    if (activityCountToday >= params.dailyActivityCap) return false;
  }

  if (params.claimKey) {
    db.rewardActivityClaims.push(params.claimKey);
  }
  user.pointsBalance += params.points;
  db.pointsLedger.unshift({
    id: `pt_${crypto.randomBytes(6).toString('hex')}`,
    userId: user.id,
    activity: params.activity,
    pointsDelta: params.points,
    description: params.description,
    referenceId: params.referenceId,
    status: 'credited',
    createdAt: Date.now(),
  });
  return true;
}

function maybeQualifyReferralForUser(referredUserId: string) {
  const ref = db.referrals.find(
    (r) => r.referredUserId === referredUserId && r.status === 'pending_qualification',
  );
  if (!ref) return;
  const referredUser = getUserById(referredUserId);
  const referrer = getUserById(ref.referrerUserId);
  if (!referredUser || !referrer) return;
  if (referredUser.accountStatus !== 'active' || !referredUser.ageVerified18Plus) return;
  const postCount = db.posts.filter((p) => p.authorId === referredUser.id).length;
  if (postCount < 1) return;

  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  const monthlyQualified = db.referrals.filter(
    (r) =>
      r.referrerUserId === referrer.id &&
      r.status === 'qualified' &&
      (r.qualifiedAt || r.createdAt) >= monthAgo,
  ).length;

  if (monthlyQualified >= db.monetizationConfig.monthlyReferralCap) {
    ref.status = 'rejected';
    ref.disqualificationReason = 'Referrer monthly qualified referral cap reached.';
    return;
  }

  if (!referrer.ageVerified18Plus || !referrer.monetizationTermsAcceptedAt || referrer.accountStatus !== 'active') {
    return;
  }

  const bonus = db.monetizationConfig.referralBonusPoints;
  ref.status = 'qualified';
  ref.rewardPoints = bonus;
  ref.qualifiedAt = Date.now();
  referrer.pointsBalance += bonus;
  db.pointsLedger.unshift({
    id: `pt_${crypto.randomBytes(6).toString('hex')}`,
    userId: referrer.id,
    activity: 'referral_qualified',
    pointsDelta: bonus,
    description: `Qualified referral reward for @${referredUser.username}`,
    referenceId: ref.id,
    status: 'credited',
    createdAt: Date.now(),
  });
}

const PROHIBITED_AD_TERMS = [
  'guaranteed income',
  'guaranteed money',
  'get rich quick',
  'miracle cure',
  'counterfeit',
  'illegal drugs',
  'unverified crypto return',
];

function validateAdCompliance(payload: {
  title: string;
  body: string;
  destinationUrl: string;
}): string | null {
  const combined = `${payload.title} ${payload.body}`.toLowerCase();
  for (const term of PROHIBITED_AD_TERMS) {
    if (combined.includes(term)) {
      return `Advertising policy violation: promotional copy cannot include "${term}".`;
    }
  }
  const url = payload.destinationUrl.trim();
  if (!/^https:\/\/[a-z0-9.-]+/i.test(url)) {
    return 'Destination URL must use a valid https:// domain.';
  }
  return null;
}

function getActiveAdsForViewer(
  viewerId: string | null,
  placement?: 'feed' | 'reels' | 'explore',
): SponsoredAdItem[] {
  const viewer = viewerId ? getUserById(viewerId) : undefined;
  const hiddenIds = viewerId ? db.adHiddenByUser[viewerId] || [] : [];

  return db.ads
    .filter((ad) => {
      if (ad.status !== 'active' || !ad.policyCompliant) return false;
      if (ad.spentCents >= ad.budgetCents) return false;
      if (placement && ad.placement !== placement) return false;
      if (hiddenIds.includes(ad.id)) return false;
      if (ad.ageRestricted18Plus && (!viewer || !viewer.ageVerified18Plus)) return false;
      return true;
    })
    .map((ad) => ({
      id: ad.id,
      advertiserName: ad.advertiserName,
      title: ad.title,
      body: ad.body,
      mediaUrl: ad.mediaUrl,
      destinationUrl: ad.destinationUrl,
      ctaLabel: ad.ctaLabel,
      placement: ad.placement,
      billingModel: ad.billingModel,
      ageRestricted18Plus: ad.ageRestricted18Plus,
      policyCategory: ad.policyCategory,
      fundingStatus: ad.fundingStatus,
    }));
}

function recordAuditLog(adminId: string, action: string, targetId: string, detail: string) {
  const admin = getUserById(adminId);
  db.auditLogs.unshift({
    id: `aud_${crypto.randomBytes(5).toString('hex')}`,
    adminId,
    adminUsername: admin?.username || 'admin',
    action,
    targetId,
    detail,
    createdAt: Date.now(),
  });
}

function enrichPost(post: StoredPost, viewerId: string | null): PostItem | null {
  const author = getUserById(post.authorId);
  if (!author) return null;
  const postComments: PostComment[] = db.comments
    .filter((c) => c.postId === post.id)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => {
      const cAuthor = getUserById(c.authorId);
      return {
        id: c.id,
        postId: c.postId,
        authorId: c.authorId,
        author: cAuthor
          ? toUserSummary(cAuthor, viewerId)
          : {
              id: c.authorId,
              username: 'creator',
              displayName: 'Creator',
              avatarUrl: '/src/assets/images/avatar_maya_1795026374635.jpg',
              bio: '',
              followersCount: 0,
              followingCount: 0,
              postsCount: 0,
            },
        text: c.text,
        createdAt: c.createdAt,
      };
    });

  return {
    id: post.id,
    authorId: post.authorId,
    author: toUserSummary(author, viewerId),
    kind: post.kind,
    mediaUrl: post.mediaUrl,
    posterUrl: post.posterUrl,
    isAnimatedPhoto: post.isAnimatedPhoto,
    filterId: post.filterId,
    caption: post.caption,
    location: post.location,
    audioTrack: post.audioTrack,
    category: post.category,
    tags: post.tags,
    likesCount: post.likes.length,
    commentsCount: postComments.length,
    viewsCount: post.viewsCount,
    likedByMe: viewerId ? post.likes.includes(viewerId) : false,
    savedByMe: viewerId ? post.saves.includes(viewerId) : false,
    createdAt: post.createdAt,
    comments: postComments,
  };
}

function getActiveStoryGroups(viewerId: string | null): StoryGroup[] {
  const now = Date.now();
  const activeStories = db.stories
    .filter((s) => s.expiresAt > now)
    .sort((a, b) => a.createdAt - b.createdAt);

  const grouped = new Map<string, StoryItem[]>();
  for (const s of activeStories) {
    const author = getUserById(s.authorId);
    if (!author) continue;
    const item: StoryItem = {
      id: s.id,
      authorId: s.authorId,
      author: toUserSummary(author, viewerId),
      mediaUrl: s.mediaUrl,
      mediaType: s.mediaType,
      filterId: s.filterId,
      captionOverlay: s.captionOverlay,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      viewedByMe: viewerId ? s.viewedBy.includes(viewerId) : false,
      viewsCount: s.viewedBy.length,
    };
    const list = grouped.get(s.authorId) || [];
    list.push(item);
    grouped.set(s.authorId, list);
  }

  const result: StoryGroup[] = [];
  for (const [, stories] of grouped.entries()) {
    result.push({
      author: stories[0].author,
      stories,
      hasUnviewed: stories.some((st) => !st.viewedByMe),
    });
  }

  result.sort((a, b) => {
    if (viewerId && a.author.id === viewerId) return -1;
    if (viewerId && b.author.id === viewerId) return 1;
    if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
    return b.stories[b.stories.length - 1].createdAt - a.stories[a.stories.length - 1].createdAt;
  });

  return result;
}

function saveDataUrlUpload(
  dataUrl: string,
  options: { isPrivate?: boolean } = {},
): { url: string; mediaType: 'image' | 'video' } | null {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif)|video\/(?:mp4|webm|quicktime));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > 15 * 1024 * 1024) {
    throw new Error('Media exceeds 15MB upload limit');
  }
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  const ext = extMap[mime] || 'bin';
  const filename = `sg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  ensureDirectories();
  const targetDir = options.isPrivate ? PRIVATE_UPLOADS_DIR : UPLOADS_DIR;
  fs.writeFileSync(path.join(targetDir, filename), buffer);
  return {
    url: options.isPrivate ? `/api/private-media/${filename}` : `/uploads/${filename}`,
    mediaType: mime.startsWith('video/') ? 'video' : 'image',
  };
}

function isSafeInternalMediaPath(url: string): boolean {
  return (
    (url.startsWith('/src/assets/images/') || url.startsWith('/uploads/')) &&
    !url.includes('..') &&
    !/[<>"'\s]/.test(url)
  );
}

function signPrivateMediaUrl(mediaUrl: string, viewerId: string, ttlMs = 3600 * 1000): string {
  if (!mediaUrl.startsWith('/api/private-media/')) return mediaUrl;
  const filename = path.basename(mediaUrl.split('?')[0]);
  const exp = Date.now() + ttlMs;
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${filename}:${viewerId}:${exp}`)
    .digest('base64url');
  return `/api/private-media/${encodeURIComponent(filename)}?uid=${encodeURIComponent(viewerId)}&exp=${exp}&sig=${sig}`;
}

function verifyPrivateMediaSig(filename: string, uid: string, exp: number, sig: string): boolean {
  if (!uid || !exp || !sig || exp < Date.now()) return false;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${filename}:${uid}:${exp}`)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function formatMessageForViewer(m: StoredMessage, viewerId: string): DirectMessage {
  const isOpenedSnapForRecipient =
    Boolean(m.isEphemeralSnap) && m.recipientId === viewerId && Boolean(m.snapOpenedByRecipient);
  const mediaUrl =
    isOpenedSnapForRecipient || !m.mediaUrl
      ? undefined
      : signPrivateMediaUrl(m.mediaUrl, viewerId, m.isEphemeralSnap ? 5 * 60 * 1000 : 3600 * 1000);
  return {
    ...m,
    mediaUrl,
  };
}

function getViewerId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const uid = verifyToken(token);
    if (uid && getUserById(uid)) return uid;
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE]) {
    const uid = verifyToken(cookies[SESSION_COOKIE]);
    if (uid && getUserById(uid)) return uid;
  }
  return null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const viewerId = getViewerId(req);
  if (!viewerId) {
    res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
    return;
  }
  const user = getUserById(viewerId);
  if (user && user.accountStatus === 'suspended') {
    res.status(403).json({ error: 'This account is suspended due to a policy violation.' });
    return;
  }
  res.locals.userId = viewerId;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const viewerId = getViewerId(req);
  if (!viewerId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const user = getUserById(viewerId);
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }
  res.locals.userId = viewerId;
  next();
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 14,
    path: '/',
  });
}

async function startServer() {
  const app = express();

  // Stripe Webhook must receive unparsed raw body for signature verification
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
    if (!stripeClient || !STRIPE_WEBHOOK_SECRET) {
      res.status(503).json({ error: 'Stripe webhook handling is not configured.' });
      return;
    }
    const sig = req.headers['stripe-signature'];
    if (typeof sig !== 'string') {
      res.status(400).json({ error: 'Missing Stripe signature header.' });
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripeClient.webhooks.constructEvent(req.body as Buffer, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid webhook signature.' });
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const adId = session.metadata?.adId;
      const ad = db.ads.find((a) => a.id === adId || a.stripeCheckoutSessionId === session.id);
      if (ad && session.payment_status === 'paid') {
        ad.fundingStatus = 'funded';
        if (ad.policyCompliant && ad.status === 'pending_review') {
          ad.status = 'active';
        }
        ad.updatedAt = Date.now();
        saveDatabase();
      }
    } else if (event.type === 'account.updated') {
      const acct = event.data.object as Stripe.Account;
      const user = db.users.find((u) => u.stripeAccountId === acct.id);
      if (user) {
        user.payoutAccountStatus =
          acct.payouts_enabled && acct.details_submitted ? 'active' : 'onboarding_incomplete';
        saveDatabase();
      }
    }

    res.json({ received: true });
  });

  app.use(express.json({ limit: '22mb' }));
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );

  // Secure authenticated private DM media route
  app.get('/api/private-media/:filename', (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      res.status(400).json({ error: 'Invalid media filename.' });
      return;
    }

    let viewerId = getViewerId(req);
    if (!viewerId) {
      const uid = String(req.query.uid || '');
      const exp = Number(req.query.exp || 0);
      const sig = String(req.query.sig || '');
      if (verifyPrivateMediaSig(filename, uid, exp, sig) && getUserById(uid)) {
        viewerId = uid;
      }
    }

    if (!viewerId) {
      res.status(401).json({ error: 'Authentication required to view private media.' });
      return;
    }

    const expectedPath = `/api/private-media/${filename}`;
    const msg = db.messages.find(
      (m) =>
        m.mediaUrl === expectedPath && (m.senderId === viewerId || m.recipientId === viewerId),
    );
    if (!msg) {
      res.status(403).json({ error: 'You do not have permission to access this private media.' });
      return;
    }

    const filePath = path.join(PRIVATE_UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Media file not found.' });
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(filePath);
  });

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Auth routes
  app.post('/api/auth/signup', (req, res) => {
    const { username, displayName, email, password, referralCode, birthYear } = req.body as {
      username?: string;
      displayName?: string;
      email?: string;
      password?: string;
      referralCode?: string;
      birthYear?: number;
    };

    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanDisplayName = (displayName || '').trim();

    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      res.status(400).json({ error: 'Username must be 3–24 characters using letters, numbers, or underscores.' });
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (db.users.some((u) => u.username === cleanUsername)) {
      res.status(409).json({ error: 'That username is already taken.' });
      return;
    }
    if (db.users.some((u) => u.email === cleanEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const currentYear = new Date().getFullYear();
    let parsedBirthYear: number | undefined;
    let ageVerified18Plus = false;
    if (birthYear !== undefined && birthYear !== null && String(birthYear).trim() !== '') {
      const y = Number(birthYear);
      if (!Number.isInteger(y) || y < 1900 || y > currentYear - 13) {
        res.status(400).json({ error: 'Users must be at least 13 years old to register on SnapGram.' });
        return;
      }
      parsedBirthYear = y;
      ageVerified18Plus = currentYear - y >= 18;
    }

    const cleanRefCode = (referralCode || '').trim().toUpperCase();
    const referrer = cleanRefCode
      ? db.users.find((u) => u.referralCode.toUpperCase() === cleanRefCode && u.accountStatus === 'active')
      : undefined;

    const avatars = [
      '/src/assets/images/avatar_maya_1795026374635.jpg',
      '/src/assets/images/avatar_kai_1795026374784.jpg',
      '/src/assets/images/avatar_elena_1795026376005.jpg',
    ];
    const newUser: StoredUser = {
      id: `u_${crypto.randomBytes(6).toString('hex')}`,
      username: cleanUsername,
      displayName: cleanDisplayName || cleanUsername,
      email: cleanEmail,
      passwordHash: hashPassword(password),
      avatarUrl: avatars[db.users.length % avatars.length],
      bio: 'New creator on SnapGram.',
      role: ADMIN_EMAIL && cleanEmail === ADMIN_EMAIL ? 'admin' : 'user',
      accountStatus: 'active',
      ageVerified18Plus,
      birthYear: parsedBirthYear,
      taxComplianceAccepted: false,
      policyStrikes: 0,
      referralCode: generateReferralCode(cleanUsername),
      referredByUserId: referrer?.id,
      pointsBalance: 0,
      estimatedEarningsCents: 0,
      approvedEarningsCents: 0,
      payoutAccountStatus: 'not_connected',
      createdAt: Date.now(),
    };

    db.users.push(newUser);
    if (referrer) {
      db.referrals.unshift({
        id: `ref_${crypto.randomBytes(5).toString('hex')}`,
        referrerUserId: referrer.id,
        referredUserId: newUser.id,
        referredUsername: newUser.username,
        referredDisplayName: newUser.displayName,
        codeUsed: cleanRefCode,
        status: 'pending_qualification',
        rewardPoints: 0,
        createdAt: Date.now(),
      });
    }
    // Auto-follow featured creator so new user has an active initial feed
    db.follows.push({ followerId: newUser.id, followingId: 'u_maya', createdAt: Date.now() });
    db.notifications.unshift({
      id: `n_${crypto.randomBytes(5).toString('hex')}`,
      userId: 'u_maya',
      actorId: newUser.id,
      type: 'follow',
      text: 'started following you',
      read: false,
      createdAt: Date.now(),
    });
    saveDatabase();

    const token = signToken(newUser.id);
    setSessionCookie(res, token);
    res.status(201).json({ user: toAuthUser(newUser), token });
  });

  app.post('/api/auth/login', (req, res) => {
    const { identifier, password } = req.body as { identifier?: string; password?: string };
    const clean = (identifier || '').trim().toLowerCase();
    if (!clean || !password) {
      res.status(400).json({ error: 'Username/email and password are required.' });
      return;
    }
    const user = db.users.find((u) => u.email === clean || u.username === clean);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid credentials. Try @maya_lin / snapgram123 or create a new account.' });
      return;
    }
    const token = signToken(user.id);
    setSessionCookie(res, token);
    res.json({ user: toAuthUser(user), token });
  });

  app.post('/api/auth/demo', (_req, res) => {
    const demoUser = db.users.find((u) => u.id === 'u_maya') || db.users[0];
    const token = signToken(demoUser.id);
    setSessionCookie(res, token);
    res.json({ user: toAuthUser(demoUser), token });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const viewerId = getViewerId(req);
    if (!viewerId) {
      res.json({ user: null });
      return;
    }
    const user = getUserById(viewerId);
    res.json({ user: user ? toAuthUser(user) : null });
  });

  // Feed (public read + personalized flags if signed in)
  app.get('/api/feed', (req, res) => {
    const viewerId = getViewerId(req);
    const storyGroups = getActiveStoryGroups(viewerId);
    const allPosts = db.posts
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((p) => enrichPost(p, viewerId))
      .filter((p): p is PostItem => p !== null);

    const posts = allPosts.filter((p) => p.kind === 'photo' || p.kind === 'video');
    const reels = allPosts.filter((p) => p.kind === 'reel' || p.kind === 'video');
    const suggestedUsers = db.users
      .filter((u) => u.id !== viewerId)
      .map((u) => toUserSummary(u, viewerId));

    const unreadMessages = viewerId
      ? db.messages.filter((m) => m.recipientId === viewerId && !m.read).length
      : 0;
    const unreadNotifications = viewerId
      ? db.notifications.filter((n) => n.userId === viewerId && !n.read).length
      : 0;

    const payload: FeedPayload = {
      storyGroups,
      posts,
      reels,
      ads: getActiveAdsForViewer(viewerId),
      suggestedUsers,
      unreadMessages,
      unreadNotifications,
    };
    res.json(payload);
  });

  // Explore & Search
  app.get('/api/explore', (req, res) => {
    const viewerId = getViewerId(req);
    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || 'All');

    let posts = db.posts
      .slice()
      .sort((a, b) => b.likes.length + b.viewsCount - (a.likes.length + a.viewsCount))
      .map((p) => enrichPost(p, viewerId))
      .filter((p): p is PostItem => p !== null);

    if (category && category !== 'All') {
      posts = posts.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    if (q) {
      posts = posts.filter(
        (p) =>
          p.caption.toLowerCase().includes(q) ||
          p.author.username.toLowerCase().includes(q) ||
          p.author.displayName.toLowerCase().includes(q) ||
          (p.location && p.location.toLowerCase().includes(q)) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    const users = db.users
      .filter(
        (u) =>
          !q ||
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          u.bio.toLowerCase().includes(q),
      )
      .map((u) => toUserSummary(u, viewerId));

    res.json({ posts, users });
  });

  // Create Post or Reel (Authenticated)
  app.post('/api/posts', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const {
      mediaDataUrl,
      kind,
      filterId,
      caption,
      location,
      audioTrack,
      category,
    } = req.body as {
      mediaDataUrl?: string;
      kind?: 'photo' | 'video' | 'reel';
      filterId?: string;
      caption?: string;
      location?: string;
      audioTrack?: string;
      category?: string;
    };

    if (!mediaDataUrl) {
      res.status(400).json({ error: 'Please capture or select an image or video first.' });
      return;
    }

    let mediaUrl = '';
    let detectedType: 'image' | 'video' = 'image';
    if (mediaDataUrl.startsWith('data:')) {
      try {
        const saved = saveDataUrlUpload(mediaDataUrl);
        if (!saved) {
          res.status(400).json({ error: 'Unsupported media format. Use PNG, JPEG, WebP, MP4, or WebM.' });
          return;
        }
        mediaUrl = saved.url;
        detectedType = saved.mediaType;
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
        return;
      }
    } else if (isSafeInternalMediaPath(mediaDataUrl)) {
      mediaUrl = mediaDataUrl;
    } else {
      res.status(400).json({ error: 'Invalid media source.' });
      return;
    }

    const cleanCaption = (caption || '').trim().slice(0, 500);
    const extractedTags = Array.from(cleanCaption.matchAll(/#([a-zA-Z0-9_]+)/g)).map((m) =>
      m[1].toLowerCase(),
    );

    const resolvedKind: 'photo' | 'video' | 'reel' =
      kind === 'reel' ? 'reel' : detectedType === 'video' || kind === 'video' ? 'video' : 'photo';

    const newPost: StoredPost = {
      id: `p_${crypto.randomBytes(6).toString('hex')}`,
      authorId: viewerId,
      kind: resolvedKind,
      mediaUrl,
      posterUrl: detectedType === 'image' ? mediaUrl : undefined,
      isAnimatedPhoto: resolvedKind === 'reel' && detectedType === 'image',
      filterId: filterId || 'original',
      caption: cleanCaption || 'Shared via SnapGram Camera',
      location: location?.trim().slice(0, 80) || undefined,
      audioTrack:
        resolvedKind === 'reel'
          ? audioTrack?.trim().slice(0, 80) || 'Original Camera Audio'
          : undefined,
      category: category || (resolvedKind === 'reel' ? 'Video & Reels' : 'Photography'),
      tags: extractedTags.length > 0 ? extractedTags : ['snapgram'],
      likes: [],
      saves: [],
      viewsCount: 1,
      createdAt: Date.now(),
    };

    db.posts.unshift(newPost);
    awardActivityPoints({
      userId: viewerId,
      activity: 'post_created',
      points: 15,
      description: `Published original ${resolvedKind}`,
      referenceId: newPost.id,
      claimKey: `post:${newPost.id}`,
      dailyActivityCap: 5,
    });
    maybeQualifyReferralForUser(viewerId);
    saveDatabase();
    res.status(201).json({ post: enrichPost(newPost, viewerId) });
  });

  // Delete own post
  app.delete('/api/posts/:id', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const idx = db.posts.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    if (db.posts[idx].authorId !== viewerId) {
      res.status(403).json({ error: 'You can only delete your own posts.' });
      return;
    }
    const deletedPost = db.posts[idx];
    db.posts.splice(idx, 1);
    db.comments = db.comments.filter((c) => c.postId !== req.params.id);
    db.notifications = db.notifications.filter((n) => n.postId !== req.params.id);

    if (deletedPost.mediaUrl.startsWith('/uploads/')) {
      const stillReferenced =
        db.posts.some((p) => p.mediaUrl === deletedPost.mediaUrl) ||
        db.stories.some((s) => s.mediaUrl === deletedPost.mediaUrl) ||
        db.users.some((u) => u.avatarUrl === deletedPost.mediaUrl) ||
        db.messages.some((m) => m.mediaUrl === deletedPost.mediaUrl);
      if (!stillReferenced) {
        const fp = path.join(UPLOADS_DIR, path.basename(deletedPost.mediaUrl));
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    }

    saveDatabase();
    res.json({ ok: true });
  });

  // Create 24-hour Story (Authenticated)
  app.post('/api/stories', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const { mediaDataUrl, filterId, captionOverlay } = req.body as {
      mediaDataUrl?: string;
      filterId?: string;
      captionOverlay?: string;
    };

    if (!mediaDataUrl) {
      res.status(400).json({ error: 'Story media is required.' });
      return;
    }

    let mediaUrl = '';
    let mediaType: 'image' | 'video' = 'image';
    if (mediaDataUrl.startsWith('data:')) {
      try {
        const saved = saveDataUrlUpload(mediaDataUrl);
        if (!saved) {
          res.status(400).json({ error: 'Unsupported media format.' });
          return;
        }
        mediaUrl = saved.url;
        mediaType = saved.mediaType;
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
        return;
      }
    } else if (isSafeInternalMediaPath(mediaDataUrl)) {
      mediaUrl = mediaDataUrl;
    } else {
      res.status(400).json({ error: 'Invalid story media source.' });
      return;
    }

    const now = Date.now();
    const newStory: StoredStory = {
      id: `s_${crypto.randomBytes(6).toString('hex')}`,
      authorId: viewerId,
      mediaUrl,
      mediaType,
      filterId: filterId || 'original',
      captionOverlay: captionOverlay?.trim().slice(0, 140) || undefined,
      createdAt: now,
      expiresAt: now + 24 * 3600 * 1000,
      viewedBy: [],
    };
    db.stories.push(newStory);
    awardActivityPoints({
      userId: viewerId,
      activity: 'story_created',
      points: 10,
      description: 'Published 24-hour story',
      referenceId: newStory.id,
      claimKey: `story:${newStory.id}`,
      dailyActivityCap: 5,
    });
    saveDatabase();
    res.status(201).json({ ok: true, storyGroups: getActiveStoryGroups(viewerId) });
  });

  // Mark story viewed
  app.post('/api/stories/:id/view', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const story = db.stories.find((s) => s.id === req.params.id && s.expiresAt > Date.now());
    if (story && !story.viewedBy.includes(viewerId)) {
      story.viewedBy.push(viewerId);
      saveDatabase();
    }
    res.json({ ok: true });
  });

  // Reply to story -> sends private DM + notification
  app.post('/api/stories/:id/reply', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const story = db.stories.find((s) => s.id === req.params.id && s.expiresAt > Date.now());
    const { text } = req.body as { text?: string };
    if (!story) {
      res.status(404).json({ error: 'Story expired or not found.' });
      return;
    }
    if (story.authorId === viewerId) {
      res.status(400).json({ error: 'Cannot reply to your own story.' });
      return;
    }
    const clean = (text || '').trim().slice(0, 300);
    if (!clean) {
      res.status(400).json({ error: 'Reply cannot be empty.' });
      return;
    }

    const msg: StoredMessage = {
      id: `m_${crypto.randomBytes(6).toString('hex')}`,
      senderId: viewerId,
      recipientId: story.authorId,
      text: `Replied to your story: "${clean}"`,
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType,
      read: false,
      createdAt: Date.now(),
    };
    db.messages.push(msg);

    db.notifications.unshift({
      id: `n_${crypto.randomBytes(5).toString('hex')}`,
      userId: story.authorId,
      actorId: viewerId,
      type: 'story_reply',
      postPreviewUrl: story.mediaUrl,
      text: `replied to your story: "${clean}"`,
      read: false,
      createdAt: Date.now(),
    });
    saveDatabase();
    res.status(201).json({ ok: true, message: formatMessageForViewer(msg, viewerId) });
  });

  // Like / Unlike post
  app.post('/api/posts/:id/like', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    const idx = post.likes.indexOf(viewerId);
    let liked = false;
    if (idx === -1) {
      post.likes.push(viewerId);
      liked = true;
      if (post.authorId !== viewerId) {
        db.notifications.unshift({
          id: `n_${crypto.randomBytes(5).toString('hex')}`,
          userId: post.authorId,
          actorId: viewerId,
          type: 'like',
          postId: post.id,
          postPreviewUrl: post.posterUrl || post.mediaUrl,
          text: post.kind === 'reel' ? 'liked your reel' : 'liked your post',
          read: false,
          createdAt: Date.now(),
        });
        awardActivityPoints({
          userId: post.authorId,
          activity: 'like_received',
          points: 2,
          description: 'Verified like received on your post',
          referenceId: post.id,
          claimKey: `like:${post.id}:${viewerId}`,
          dailyActivityCap: 50,
        });
      }
    } else {
      post.likes.splice(idx, 1);
    }
    saveDatabase();
    res.json({ liked, likesCount: post.likes.length });
  });

  // Save / Unsave post
  app.post('/api/posts/:id/save', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    const idx = post.saves.indexOf(viewerId);
    let saved = false;
    if (idx === -1) {
      post.saves.push(viewerId);
      saved = true;
    } else {
      post.saves.splice(idx, 1);
    }
    saveDatabase();
    res.json({ saved });
  });

  // Add comment
  app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    const { text } = req.body as { text?: string };
    const clean = (text || '').trim().slice(0, 400);
    if (!clean) {
      res.status(400).json({ error: 'Comment text cannot be empty.' });
      return;
    }

    const newComment: StoredComment = {
      id: `c_${crypto.randomBytes(6).toString('hex')}`,
      postId: post.id,
      authorId: viewerId,
      text: clean,
      createdAt: Date.now(),
    };
    db.comments.push(newComment);

    if (post.authorId !== viewerId) {
      db.notifications.unshift({
        id: `n_${crypto.randomBytes(5).toString('hex')}`,
        userId: post.authorId,
        actorId: viewerId,
        type: 'comment',
        postId: post.id,
        postPreviewUrl: post.posterUrl || post.mediaUrl,
        text: `commented: "${clean}"`,
        read: false,
        createdAt: Date.now(),
      });
      awardActivityPoints({
        userId: post.authorId,
        activity: 'comment_received',
        points: 5,
        description: 'Verified comment received on your post',
        referenceId: post.id,
        claimKey: `comment:${post.id}:${viewerId}`,
        dailyActivityCap: 30,
      });
    }
    saveDatabase();

    const author = getUserById(viewerId)!;
    const enriched: PostComment = {
      id: newComment.id,
      postId: newComment.postId,
      authorId: viewerId,
      author: toUserSummary(author, viewerId),
      text: newComment.text,
      createdAt: newComment.createdAt,
    };
    res.status(201).json({ comment: enriched });
  });

  // Follow / Unfollow user
  app.post('/api/users/:id/follow', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const targetId = req.params.id;
    if (viewerId === targetId) {
      res.status(400).json({ error: 'Cannot follow yourself.' });
      return;
    }
    const target = getUserById(targetId);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const idx = db.follows.findIndex((f) => f.followerId === viewerId && f.followingId === targetId);
    let isFollowing = false;
    if (idx === -1) {
      db.follows.push({ followerId: viewerId, followingId: targetId, createdAt: Date.now() });
      isFollowing = true;
      db.notifications.unshift({
        id: `n_${crypto.randomBytes(5).toString('hex')}`,
        userId: targetId,
        actorId: viewerId,
        type: 'follow',
        text: 'started following you',
        read: false,
        createdAt: Date.now(),
      });
    } else {
      db.follows.splice(idx, 1);
    }
    saveDatabase();
    res.json({
      isFollowing,
      followersCount: db.follows.filter((f) => f.followingId === targetId).length,
    });
  });

  // Update own profile
  app.patch('/api/users/me', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const user = getUserById(viewerId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { username, displayName, bio, website, avatarDataUrl } = req.body as {
      username?: string;
      displayName?: string;
      bio?: string;
      website?: string;
      avatarDataUrl?: string;
    };

    if (typeof username === 'string') {
      const cleanUsername = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
        res.status(400).json({
          error: 'Username must be 3–24 characters using letters, numbers, or underscores.',
        });
        return;
      }
      if (db.users.some((u) => u.id !== viewerId && u.username === cleanUsername)) {
        res.status(409).json({ error: 'That username is already taken.' });
        return;
      }
      user.username = cleanUsername;
    }

    if (typeof displayName === 'string') {
      const cleanName = displayName.trim().slice(0, 40);
      if (!cleanName) {
        res.status(400).json({ error: 'Display name cannot be empty.' });
        return;
      }
      user.displayName = cleanName;
    }
    if (typeof bio === 'string') {
      user.bio = bio.trim().slice(0, 180);
    }
    if (typeof website === 'string') {
      user.website = website.trim().slice(0, 80) || undefined;
    }
    if (avatarDataUrl && avatarDataUrl.startsWith('data:image/')) {
      try {
        const saved = saveDataUrlUpload(avatarDataUrl);
        if (!saved) {
          res.status(400).json({ error: 'Unsupported profile photo format. Use PNG, JPEG, or WebP.' });
          return;
        }
        user.avatarUrl = saved.url;
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Photo upload failed.' });
        return;
      }
    }
    saveDatabase();
    res.json({ user: toAuthUser(user) });
  });

  // Get followers list for a user
  app.get('/api/users/:id/followers', (req, res) => {
    const viewerId = getViewerId(req);
    const target = db.users.find(
      (u) => u.id === req.params.id || u.username.toLowerCase() === req.params.id.toLowerCase(),
    );
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const followerIds = db.follows
      .filter((f) => f.followingId === target.id)
      .map((f) => f.followerId);
    const users = followerIds
      .map((fid) => getUserById(fid))
      .filter((u): u is StoredUser => Boolean(u))
      .map((u) => toUserSummary(u, viewerId));
    res.json({ users });
  });

  // Get following list for a user
  app.get('/api/users/:id/following', (req, res) => {
    const viewerId = getViewerId(req);
    const target = db.users.find(
      (u) => u.id === req.params.id || u.username.toLowerCase() === req.params.id.toLowerCase(),
    );
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const followingIds = db.follows
      .filter((f) => f.followerId === target.id)
      .map((f) => f.followingId);
    const users = followingIds
      .map((fid) => getUserById(fid))
      .filter((u): u is StoredUser => Boolean(u))
      .map((u) => toUserSummary(u, viewerId));
    res.json({ users });
  });

  // Get profile by username
  app.get('/api/users/:username', (req, res) => {
    const viewerId = getViewerId(req);
    const target = db.users.find(
      (u) => u.username.toLowerCase() === req.params.username.toLowerCase() || u.id === req.params.username,
    );
    if (!target) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    const userPosts = db.posts
      .filter((p) => p.authorId === target.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((p) => enrichPost(p, viewerId))
      .filter((p): p is PostItem => p !== null);

    const savedPosts =
      viewerId === target.id
        ? db.posts
            .filter((p) => p.saves.includes(viewerId))
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((p) => enrichPost(p, viewerId))
            .filter((p): p is PostItem => p !== null)
        : [];

    const payload: ProfilePayload = {
      user: toUserSummary(target, viewerId),
      posts: userPosts.filter((p) => p.kind !== 'reel'),
      reels: userPosts.filter((p) => p.kind === 'reel' || p.kind === 'video'),
      savedPosts,
      isOwnProfile: viewerId === target.id,
    };
    res.json(payload);
  });

  // Private Messaging (Authenticated)
  app.get('/api/messages', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const others = db.users.filter((u) => u.id !== viewerId);
    const threads: ConversationThread[] = others.map((partner) => {
      const msgs = db.messages
        .filter(
          (m) =>
            (m.senderId === viewerId && m.recipientId === partner.id) ||
            (m.senderId === partner.id && m.recipientId === viewerId),
        )
        .sort((a, b) => a.createdAt - b.createdAt);
      const lastMessage: DirectMessage | null =
        msgs.length > 0 ? formatMessageForViewer(msgs[msgs.length - 1], viewerId) : null;
      const unreadCount = msgs.filter((m) => m.recipientId === viewerId && !m.read).length;
      return {
        partner: toUserSummary(partner, viewerId),
        lastMessage,
        unreadCount,
      };
    });

    threads.sort((a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0));
    res.json({ threads });
  });

  app.get('/api/messages/:partnerId', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const partnerId = req.params.partnerId;
    const partner = getUserById(partnerId);
    if (!partner) {
      res.status(404).json({ error: 'Recipient not found.' });
      return;
    }
    let changed = false;
    const messages = db.messages
      .filter(
        (m) =>
          (m.senderId === viewerId && m.recipientId === partnerId) ||
          (m.senderId === partnerId && m.recipientId === viewerId),
      )
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const m of messages) {
      if (m.recipientId === viewerId && !m.read) {
        m.read = true;
        changed = true;
      }
    }
    if (changed) saveDatabase();

    res.json({
      partner: toUserSummary(partner, viewerId),
      messages: messages.map((m) => formatMessageForViewer(m, viewerId)),
    });
  });

  app.post('/api/messages/:partnerId', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const partnerId = req.params.partnerId;
    if (partnerId === viewerId) {
      res.status(400).json({ error: 'Cannot send a private message to yourself.' });
      return;
    }
    if (!getUserById(partnerId)) {
      res.status(404).json({ error: 'Recipient not found.' });
      return;
    }
    const { text, mediaDataUrl, isEphemeralSnap } = req.body as {
      text?: string;
      mediaDataUrl?: string;
      isEphemeralSnap?: boolean;
    };

    const cleanText = (text || '').trim().slice(0, 1000);
    let mediaUrl: string | undefined;
    let mediaType: 'image' | 'video' | undefined;

    if (mediaDataUrl) {
      if (mediaDataUrl.startsWith('data:')) {
        try {
          const saved = saveDataUrlUpload(mediaDataUrl, { isPrivate: true });
          if (!saved) {
            res.status(400).json({ error: 'Invalid media attachment.' });
            return;
          }
          mediaUrl = saved.url;
          mediaType = saved.mediaType;
        } catch (err) {
          res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed.' });
          return;
        }
      } else if (isSafeInternalMediaPath(mediaDataUrl)) {
        mediaUrl = mediaDataUrl;
        mediaType = 'image';
      } else {
        res.status(400).json({ error: 'Invalid media attachment source.' });
        return;
      }
    }

    if (!cleanText && !mediaUrl) {
      res.status(400).json({ error: 'Message text or media is required.' });
      return;
    }

    const msg: StoredMessage = {
      id: `m_${crypto.randomBytes(6).toString('hex')}`,
      senderId: viewerId,
      recipientId: partnerId,
      text: cleanText || (isEphemeralSnap ? 'Sent a Snap' : 'Sent media'),
      mediaUrl,
      mediaType,
      isEphemeralSnap: Boolean(isEphemeralSnap),
      snapOpenedByRecipient: false,
      read: false,
      createdAt: Date.now(),
    };
    db.messages.push(msg);
    saveDatabase();
    res.status(201).json({ message: formatMessageForViewer(msg, viewerId) });
  });

  app.post('/api/messages/:messageId/open-snap', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const msg = db.messages.find((m) => m.id === req.params.messageId);
    if (!msg) {
      res.status(404).json({ error: 'Snap not found.' });
      return;
    }
    if (msg.senderId !== viewerId && msg.recipientId !== viewerId) {
      res.status(403).json({ error: 'You are not authorized to view this private Snap.' });
      return;
    }
    if (msg.recipientId === viewerId && msg.isEphemeralSnap) {
      if (msg.snapOpenedByRecipient) {
        res.status(410).json({ error: 'This view-once Snap has already been opened.' });
        return;
      }
      const signedMediaUrl = msg.mediaUrl
        ? signPrivateMediaUrl(msg.mediaUrl, viewerId, 5 * 60 * 1000)
        : undefined;
      msg.snapOpenedByRecipient = true;
      saveDatabase();
      res.json({ message: { ...msg, mediaUrl: signedMediaUrl } });
      return;
    }
    res.json({ message: formatMessageForViewer(msg, viewerId) });
  });

  // Notifications (Authenticated)
  app.get('/api/notifications', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const items: AppNotification[] = db.notifications
      .filter((n) => n.userId === viewerId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((n) => {
        const actor = getUserById(n.actorId);
        return {
          ...n,
          actor: actor
            ? toUserSummary(actor, viewerId)
            : {
                id: n.actorId,
                username: 'creator',
                displayName: 'Creator',
                avatarUrl: '/src/assets/images/avatar_maya_1795026374635.jpg',
                bio: '',
                followersCount: 0,
                followingCount: 0,
                postsCount: 0,
              },
        };
      });
    res.json({ notifications: items });
  });

  app.post('/api/notifications/read', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    let changed = false;
    for (const n of db.notifications) {
      if (n.userId === viewerId && !n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) saveDatabase();
    res.json({ ok: true });
  });

  // =========================================================================
  // Advertising, Creator Monetization, Referrals, Stripe & Admin RBAC Routes
  // =========================================================================

  // Record deduplicated ad impression or click
  app.post(['/api/ads/:id/impression', '/api/ads/:id/click'], (req, res) => {
    const adId = req.params.id;
    const eventType: 'impression' | 'click' = req.path.endsWith('/click') ? 'click' : 'impression';
    const ad = db.ads.find((a) => a.id === adId && a.status === 'active' && a.policyCompliant);
    if (!ad) {
      res.status(404).json({ error: 'Ad campaign not active.' });
      return;
    }
    const viewerId = getViewerId(req);
    const viewer = viewerId ? getUserById(viewerId) : undefined;
    if (ad.ageRestricted18Plus && (!viewer || !viewer.ageVerified18Plus)) {
      res.status(403).json({ error: '18+ age verification required for this placement.' });
      return;
    }

    const viewerKey =
      viewerId ||
      crypto
        .createHash('sha256')
        .update(`${req.ip || 'anon'}:${req.headers['user-agent'] || ''}`)
        .digest('hex')
        .slice(0, 16);

    const tenMinsAgo = Date.now() - 10 * 60 * 1000;
    const recentDup = db.adEvents.some(
      (ev) =>
        ev.adId === ad.id &&
        ev.eventType === eventType &&
        ev.viewerKey === viewerKey &&
        ev.createdAt >= tenMinsAgo,
    );

    if (!recentDup && ad.spentCents < ad.budgetCents) {
      db.adEvents.push({
        id: `adev_${crypto.randomBytes(5).toString('hex')}`,
        adId: ad.id,
        eventType,
        viewerKey,
        createdAt: Date.now(),
      });
      if (eventType === 'impression') {
        ad.impressions += 1;
      } else {
        ad.clicks += 1;
      }

      if (ad.fundingStatus === 'funded') {
        const computedSpent =
          ad.billingModel === 'cpm'
            ? Math.floor((ad.impressions * ad.rateCents) / 1000)
            : ad.clicks * ad.rateCents;
        ad.spentCents = Math.min(ad.budgetCents, computedSpent);
        if (ad.spentCents >= ad.budgetCents) {
          ad.status = 'budget_exhausted';
        }
      }
      ad.updatedAt = Date.now();
      saveDatabase();
    }

    res.json({
      ok: true,
      impressions: ad.impressions,
      clicks: ad.clicks,
      spentCents: ad.spentCents,
      fundingStatus: ad.fundingStatus,
    });
  });

  // Hide or report an ad for compliance review
  app.post('/api/ads/:id/report', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const ad = db.ads.find((a) => a.id === req.params.id);
    if (!ad) {
      res.status(404).json({ error: 'Ad campaign not found.' });
      return;
    }
    const { reason, hideOnly } = req.body as { reason?: string; hideOnly?: boolean };
    const list = db.adHiddenByUser[viewerId] || [];
    if (!list.includes(ad.id)) {
      list.push(ad.id);
      db.adHiddenByUser[viewerId] = list;
    }
    if (!hideOnly) {
      const cleanReason = (reason || 'User flagged ad placement').trim().slice(0, 240);
      db.adReports.unshift({
        id: `rep_${crypto.randomBytes(5).toString('hex')}`,
        adId: ad.id,
        adTitle: ad.title,
        reporterId: viewerId,
        reason: cleanReason,
        status: 'open',
        createdAt: Date.now(),
      });
    }
    saveDatabase();
    res.json({ ok: true });
  });

  // Submit a new Sponsored Ad Campaign (requires 18+ & compliance review)
  app.post('/api/ads', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const user = getUserById(viewerId)!;
    if (!user.ageVerified18Plus && user.role !== 'admin') {
      res.status(403).json({
        error: 'You must complete 18+ age verification before submitting advertising campaigns.',
      });
      return;
    }

    const {
      advertiserName,
      title,
      body,
      mediaDataUrl,
      destinationUrl,
      ctaLabel,
      placement,
      billingModel,
      rateCents,
      budgetCents,
      ageRestricted18Plus,
      policyCategory,
    } = req.body as {
      advertiserName?: string;
      title?: string;
      body?: string;
      mediaDataUrl?: string;
      destinationUrl?: string;
      ctaLabel?: string;
      placement?: 'feed' | 'reels' | 'explore';
      billingModel?: 'cpm' | 'cpc';
      rateCents?: number;
      budgetCents?: number;
      ageRestricted18Plus?: boolean;
      policyCategory?: string;
    };

    const cleanTitle = (title || '').trim().slice(0, 90);
    const cleanBody = (body || '').trim().slice(0, 240);
    const cleanAdvertiser = (advertiserName || user.displayName).trim().slice(0, 60);
    const cleanDest = (destinationUrl || '').trim().slice(0, 240);

    if (!cleanTitle || !cleanBody || !cleanDest) {
      res.status(400).json({ error: 'Campaign title, ad copy, and HTTPS destination URL are required.' });
      return;
    }

    const complianceError = validateAdCompliance({
      title: cleanTitle,
      body: cleanBody,
      destinationUrl: cleanDest,
    });
    if (complianceError) {
      res.status(400).json({ error: complianceError });
      return;
    }

    let mediaUrl = '/src/assets/images/post_brutalist_light_1795026377758.jpg';
    if (mediaDataUrl) {
      if (mediaDataUrl.startsWith('data:image/')) {
        try {
          const saved = saveDataUrlUpload(mediaDataUrl);
          if (!saved) {
            res.status(400).json({ error: 'Unsupported ad creative image format.' });
            return;
          }
          mediaUrl = saved.url;
        } catch (err) {
          res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed.' });
          return;
        }
      } else if (isSafeInternalMediaPath(mediaDataUrl)) {
        mediaUrl = mediaDataUrl;
      } else {
        res.status(400).json({ error: 'Invalid ad media source.' });
        return;
      }
    }

    const cleanBudget = Math.max(500, Math.min(10000000, Math.round(Number(budgetCents) || 2500)));
    const cleanModel: 'cpm' | 'cpc' = billingModel === 'cpc' ? 'cpc' : 'cpm';
    const cleanRate =
      cleanModel === 'cpc'
        ? Math.max(10, Math.min(5000, Math.round(Number(rateCents) || 50)))
        : Math.max(100, Math.min(10000, Math.round(Number(rateCents) || 600)));

    const now = Date.now();
    const campaign: AdCampaign = {
      id: `ad_${crypto.randomBytes(5).toString('hex')}`,
      ownerUserId: viewerId,
      advertiserName: cleanAdvertiser,
      title: cleanTitle,
      body: cleanBody,
      mediaUrl,
      destinationUrl: cleanDest,
      ctaLabel: (ctaLabel || 'Learn more').trim().slice(0, 24) || 'Learn more',
      placement: placement === 'reels' || placement === 'explore' ? placement : 'feed',
      billingModel: cleanModel,
      rateCents: cleanRate,
      budgetCents: cleanBudget,
      spentCents: 0,
      impressions: 0,
      clicks: 0,
      fundingStatus: 'unfunded',
      status: 'pending_review',
      ageRestricted18Plus: Boolean(ageRestricted18Plus),
      policyCompliant: user.role === 'admin',
      policyCategory: (policyCategory || 'General Brand').trim().slice(0, 40),
      disclosedAsAd: true,
      createdAt: now,
      updatedAt: now,
    };

    db.ads.unshift(campaign);
    saveDatabase();
    res.status(201).json({ campaign });
  });

  // Fund an ad campaign via real Stripe Checkout
  app.post('/api/ads/:id/fund-checkout', requireAuth, async (req, res) => {
    const viewerId = res.locals.userId as string;
    const user = getUserById(viewerId)!;
    const ad = db.ads.find((a) => a.id === req.params.id);
    if (!ad) {
      res.status(404).json({ error: 'Campaign not found.' });
      return;
    }
    if (ad.ownerUserId !== viewerId && user.role !== 'admin') {
      res.status(403).json({ error: 'You do not have permission to fund this campaign.' });
      return;
    }
    if (!stripeClient) {
      res.status(503).json({
        error:
          'Stripe Checkout is not configured on this server (STRIPE_SECRET_KEY missing). Configure Stripe secrets to process real advertiser payments.',
        paymentProviderConfigured: false,
      });
      return;
    }

    try {
      const origin = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      const session = await stripeClient.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `SnapGram Ad Campaign: ${ad.title}`,
                description: `${ad.billingModel.toUpperCase()} sponsored placement (${ad.advertiserName})`,
              },
              unit_amount: ad.budgetCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          adId: ad.id,
          ownerUserId: ad.ownerUserId,
        },
        success_url: `${origin}/?ad_funded=${encodeURIComponent(ad.id)}`,
        cancel_url: `${origin}/?ad_funding_cancelled=${encodeURIComponent(ad.id)}`,
      });

      ad.stripeCheckoutSessionId = session.id;
      ad.updatedAt = Date.now();
      saveDatabase();
      res.json({ checkoutUrl: session.url, sessionId: session.id });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Stripe Checkout session creation failed.',
      });
    }
  });

  // Creator Monetization Dashboard Payload
  app.get('/api/monetization/dashboard', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const user = getUserById(viewerId)!;
    const eligibility = evaluateCreatorEligibility(user);
    const origin = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

    const userPayouts = db.payouts
      .filter((p) => p.userId === viewerId)
      .sort((a, b) => b.createdAt - a.createdAt);
    const pendingPayoutCents = userPayouts
      .filter((p) =>
        p.status === 'pending_review' ||
        p.status === 'approved_awaiting_provider' ||
        p.status === 'processing',
      )
      .reduce((acc, p) => acc + p.amountCents, 0);
    const paidOutCents = userPayouts
      .filter((p) => p.status === 'paid')
      .reduce((acc, p) => acc + p.amountCents, 0);

    const fundedSpentCents = db.ads
      .filter((a) => a.fundingStatus === 'funded')
      .reduce((acc, a) => acc + a.spentCents, 0);
    const creatorAdSharePoolCents = Math.floor(
      (fundedSpentCents * db.monetizationConfig.creatorRevenueSharePct) / 100,
    );

    const userReferrals = db.referrals.filter((r) => r.referrerUserId === viewerId);
    const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
    const monthlyQualifiedCount = userReferrals.filter(
      (r) => r.status === 'qualified' && (r.qualifiedAt || r.createdAt) >= monthAgo,
    ).length;

    const payload: CreatorMonetizationDashboard = {
      eligibility,
      compliance: {
        ageVerified18Plus: user.ageVerified18Plus,
        birthYear: user.birthYear,
        monetizationTermsAcceptedAt: user.monetizationTermsAcceptedAt,
        taxComplianceAccepted: user.taxComplianceAccepted,
        policyStrikes: user.policyStrikes,
        accountStatus: user.accountStatus,
      },
      balances: {
        pointsBalance: user.pointsBalance,
        redeemablePoints: eligibility.eligible ? user.pointsBalance : 0,
        estimatedEarningsCents: user.estimatedEarningsCents,
        approvedEarningsCents: user.approvedEarningsCents,
        pendingPayoutCents,
        paidOutCents,
        creatorAdSharePoolCents,
      },
      paymentProvider: {
        provider: 'stripe_connect',
        configured: Boolean(stripeClient),
        accountStatus: user.payoutAccountStatus,
        stripeAccountIdLast4: user.stripeAccountId ? user.stripeAccountId.slice(-4) : undefined,
      },
      config: db.monetizationConfig,
      pointsHistory: db.pointsLedger
        .filter((t) => t.userId === viewerId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50),
      referrals: {
        code: user.referralCode,
        shareUrl: `${origin}/?ref=${encodeURIComponent(user.referralCode)}`,
        totalCount: userReferrals.length,
        qualifiedCount: userReferrals.filter((r) => r.status === 'qualified').length,
        pendingCount: userReferrals.filter((r) => r.status === 'pending_qualification').length,
        monthlyQualifiedCount,
        records: userReferrals.sort((a, b) => b.createdAt - a.createdAt),
      },
      payouts: userPayouts,
      myCampaigns: db.ads
        .filter((a) => a.ownerUserId === viewerId)
        .sort((a, b) => b.createdAt - a.createdAt),
    };
    res.json(payload);
  });

  // Update 18+ age verification, monetization terms, and tax compliance
  app.post('/api/monetization/compliance', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const user = getUserById(viewerId)!;
    const { birthYear, acceptMonetizationTerms, acceptTaxCompliance } = req.body as {
      birthYear?: number;
      acceptMonetizationTerms?: boolean;
      acceptTaxCompliance?: boolean;
    };

    const currentYear = new Date().getFullYear();
    if (birthYear !== undefined && birthYear !== null) {
      const y = Number(birthYear);
      if (!Number.isInteger(y) || y < 1900 || y > currentYear - 13) {
        res.status(400).json({ error: 'Please provide a valid birth year.' });
        return;
      }
      user.birthYear = y;
      user.ageVerified18Plus = currentYear - y >= 18;
      if (!user.ageVerified18Plus) {
        saveDatabase();
        res.status(403).json({
          error:
            'Monetization, creator rewards, referrals, and 18+ placements require creators to be at least 18 years old.',
        });
        return;
      }
    }

    if (!user.ageVerified18Plus) {
      res.status(403).json({ error: 'Age 18+ verification is required before accepting monetization terms.' });
      return;
    }

    if (acceptMonetizationTerms) {
      user.monetizationTermsAcceptedAt = user.monetizationTermsAcceptedAt || Date.now();
    }
    if (typeof acceptTaxCompliance === 'boolean') {
      user.taxComplianceAccepted = acceptTaxCompliance;
    }

    maybeQualifyReferralForUser(viewerId);
    saveDatabase();
    res.json({ user: toAuthUser(user) });
  });

  // Redeem verified engagement points into Estimated Earnings (awaiting revenue settlement)
  app.post('/api/monetization/redeem', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const user = getUserById(viewerId)!;
    const eligibility = evaluateCreatorEligibility(user);
    if (!eligibility.eligible) {
      res.status(403).json({
        error: `Not yet eligible to redeem rewards: ${eligibility.reasons.join(', ')}.`,
      });
      return;
    }

    const { points } = req.body as { points?: number };
    const cleanPoints = Math.floor(Number(points) || 0);
    if (cleanPoints < db.monetizationConfig.pointsPerUsd) {
      res.status(400).json({
        error: `Minimum redemption is ${db.monetizationConfig.pointsPerUsd} points ($1.00 estimated credit).`,
      });
      return;
    }
    if (cleanPoints > user.pointsBalance) {
      res.status(400).json({ error: 'Insufficient verified points balance.' });
      return;
    }

    const cents = Math.floor((cleanPoints / db.monetizationConfig.pointsPerUsd) * 100);
    if (cents <= 0) {
      res.status(400).json({ error: 'Redemption amount must equal at least $0.01.' });
      return;
    }

    user.pointsBalance -= cleanPoints;
    user.estimatedEarningsCents += cents;
    db.pointsLedger.unshift({
      id: `pt_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      activity: 'points_redeemed',
      pointsDelta: -cleanPoints,
      description: `Redeemed ${cleanPoints} pts toward $${(cents / 100).toFixed(2)} estimated earnings (pending review)`,
      status: 'credited',
      createdAt: Date.now(),
    });
    saveDatabase();
    res.json({
      pointsBalance: user.pointsBalance,
      estimatedEarningsCents: user.estimatedEarningsCents,
    });
  });

  // Connect creator payout account via Stripe Connect Express
  app.post('/api/monetization/payout-account/connect', requireAuth, async (req, res) => {
    const viewerId = res.locals.userId as string;
    const user = getUserById(viewerId)!;
    if (!user.ageVerified18Plus || !user.monetizationTermsAcceptedAt) {
      res.status(403).json({
        error: 'Complete 18+ age verification and accept monetization terms before connecting Stripe.',
      });
      return;
    }
    if (!stripeClient) {
      res.status(503).json({
        error:
          'Stripe Connect is not configured on this server (STRIPE_SECRET_KEY missing). Configure Stripe secrets in deployment settings to onboard real creator payout accounts.',
        paymentProviderConfigured: false,
      });
      return;
    }

    try {
      if (!user.stripeAccountId) {
        const account = await stripeClient.accounts.create({
          type: 'express',
          email: user.email,
          capabilities: {
            transfers: { requested: true },
          },
          metadata: {
            snapgramUserId: user.id,
            username: user.username,
          },
        });
        user.stripeAccountId = account.id;
        user.payoutAccountStatus = 'onboarding_incomplete';
        saveDatabase();
      }

      const origin = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      const link = await stripeClient.accountLinks.create({
        account: user.stripeAccountId,
        refresh_url: `${origin}/?stripe_refresh=1`,
        return_url: `${origin}/?stripe_connected=1`,
        type: 'account_onboarding',
      });
      res.json({ onboardingUrl: link.url });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Could not initiate Stripe Connect onboarding.',
      });
    }
  });

  // Request a payout from Approved Balance
  app.post('/api/monetization/payouts/request', requireAuth, (req, res) => {
    const viewerId = res.locals.userId as string;
    const user = getUserById(viewerId)!;
    const eligibility = evaluateCreatorEligibility(user);
    if (!eligibility.eligible) {
      res.status(403).json({ error: `Ineligible for payouts: ${eligibility.reasons.join(', ')}.` });
      return;
    }
    if (!user.taxComplianceAccepted) {
      res.status(403).json({ error: 'Tax reporting acknowledgment is required before requesting payouts.' });
      return;
    }

    const { amountCents } = req.body as { amountCents?: number };
    const cleanAmount = Math.floor(Number(amountCents) || user.approvedEarningsCents);
    if (cleanAmount < db.monetizationConfig.minPayoutCents) {
      res.status(400).json({
        error: `Minimum payout threshold is $${(db.monetizationConfig.minPayoutCents / 100).toFixed(2)}.`,
      });
      return;
    }
    if (cleanAmount > user.approvedEarningsCents) {
      res.status(400).json({
        error:
          'Requested amount exceeds your Approved Available Balance. Estimated earnings require revenue settlement and admin audit before payout.',
      });
      return;
    }

    const now = Date.now();
    user.approvedEarningsCents -= cleanAmount;
    const payout: PayoutRequest = {
      id: `pay_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      amountCents: cleanAmount,
      currency: 'usd',
      provider: 'stripe_connect',
      status: 'pending_review',
      note:
        user.payoutAccountStatus === 'active'
          ? 'Queued for compliance & Stripe settlement'
          : 'Awaiting Stripe Connect payout onboarding completion',
      createdAt: now,
      updatedAt: now,
    };
    db.payouts.unshift(payout);
    saveDatabase();
    res.status(201).json({ payout });
  });

  // =========================================================================
  // Admin Dashboard Routes (Strict RBAC: role === 'admin')
  // =========================================================================

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const fundedAdRevenueCents = db.ads
      .filter((a) => a.fundingStatus === 'funded')
      .reduce((acc, a) => acc + a.spentCents, 0);
    const creatorPoolCents = Math.floor(
      (fundedAdRevenueCents * db.monetizationConfig.creatorRevenueSharePct) / 100,
    );
    const platformRevenueCents = fundedAdRevenueCents - creatorPoolCents;

    const users: AdminUserRow[] = db.users
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        role: u.role,
        accountStatus: u.accountStatus,
        ageVerified18Plus: u.ageVerified18Plus,
        monetizationTermsAccepted: Boolean(u.monetizationTermsAcceptedAt),
        policyStrikes: u.policyStrikes,
        pointsBalance: u.pointsBalance,
        estimatedEarningsCents: u.estimatedEarningsCents,
        approvedEarningsCents: u.approvedEarningsCents,
        postsCount: db.posts.filter((p) => p.authorId === u.id).length,
        followersCount: db.follows.filter((f) => f.followingId === u.id).length,
        createdAt: u.createdAt,
      }));

    const pendingPayouts = db.payouts.filter(
      (p) => p.status === 'pending_review' || p.status === 'approved_awaiting_provider',
    );

    const payload: AdminOverviewPayload = {
      paymentProviderConfigured: Boolean(stripeClient),
      metrics: {
        totalUsers: db.users.length,
        eligibleCreators: db.users.filter((u) => evaluateCreatorEligibility(u).eligible).length,
        activeAds: db.ads.filter((a) => a.status === 'active').length,
        pendingReviewAds: db.ads.filter((a) => a.status === 'pending_review').length,
        totalAdImpressions: db.ads.reduce((acc, a) => acc + a.impressions, 0),
        totalAdClicks: db.ads.reduce((acc, a) => acc + a.clicks, 0),
        fundedAdRevenueCents,
        platformRevenueCents,
        creatorPoolCents,
        pendingPayoutsCount: pendingPayouts.length,
        pendingPayoutsCents: pendingPayouts.reduce((acc, p) => acc + p.amountCents, 0),
        qualifiedReferrals: db.referrals.filter((r) => r.status === 'qualified').length,
      },
      config: db.monetizationConfig,
      ads: db.ads.slice().sort((a, b) => b.createdAt - a.createdAt),
      adReports: db.adReports.slice().sort((a, b) => b.createdAt - a.createdAt),
      payouts: db.payouts.slice().sort((a, b) => b.createdAt - a.createdAt),
      referrals: db.referrals
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => ({
          ...r,
          referrerUsername: getUserById(r.referrerUserId)?.username || 'unknown',
        })),
      users,
      auditLogs: db.auditLogs.slice(0, 60),
    };
    res.json(payload);
  });

  app.patch('/api/admin/config', requireAdmin, (req, res) => {
    const adminId = res.locals.userId as string;
    const body = req.body as Partial<MonetizationPolicyConfig>;
    const cfg = db.monetizationConfig;

    if (typeof body.minPostsRequired === 'number') {
      cfg.minPostsRequired = Math.max(0, Math.min(100, Math.floor(body.minPostsRequired)));
    }
    if (typeof body.minFollowersRequired === 'number') {
      cfg.minFollowersRequired = Math.max(0, Math.min(100000, Math.floor(body.minFollowersRequired)));
    }
    if (typeof body.pointsPerUsd === 'number') {
      cfg.pointsPerUsd = Math.max(10, Math.min(10000, Math.floor(body.pointsPerUsd)));
    }
    if (typeof body.minPayoutCents === 'number') {
      cfg.minPayoutCents = Math.max(500, Math.min(100000, Math.floor(body.minPayoutCents)));
    }
    if (typeof body.creatorRevenueSharePct === 'number') {
      cfg.creatorRevenueSharePct = Math.max(0, Math.min(80, Math.floor(body.creatorRevenueSharePct)));
    }
    if (typeof body.referralBonusPoints === 'number') {
      cfg.referralBonusPoints = Math.max(0, Math.min(2000, Math.floor(body.referralBonusPoints)));
    }
    if (typeof body.monthlyReferralCap === 'number') {
      cfg.monthlyReferralCap = Math.max(1, Math.min(200, Math.floor(body.monthlyReferralCap)));
    }
    if (typeof body.dailyPointsCap === 'number') {
      cfg.dailyPointsCap = Math.max(10, Math.min(2000, Math.floor(body.dailyPointsCap)));
    }

    recordAuditLog(adminId, 'update_monetization_config', 'global_config', 'Updated reward & eligibility thresholds');
    saveDatabase();
    res.json({ config: cfg });
  });

  app.patch('/api/admin/ads/:id', requireAdmin, (req, res) => {
    const adminId = res.locals.userId as string;
    const ad = db.ads.find((a) => a.id === req.params.id);
    if (!ad) {
      res.status(404).json({ error: 'Ad campaign not found.' });
      return;
    }
    const { status, ageRestricted18Plus, policyCompliant } = req.body as {
      status?: AdCampaign['status'];
      ageRestricted18Plus?: boolean;
      policyCompliant?: boolean;
    };

    if (typeof policyCompliant === 'boolean') ad.policyCompliant = policyCompliant;
    if (typeof ageRestricted18Plus === 'boolean') ad.ageRestricted18Plus = ageRestricted18Plus;
    if (status) {
      if (status === 'active' && !ad.policyCompliant) {
        res.status(400).json({ error: 'Cannot activate an ad that is not marked policy compliant.' });
        return;
      }
      ad.status = status;
    }
    ad.updatedAt = Date.now();
    recordAuditLog(adminId, 'moderate_ad', ad.id, `Ad "${ad.title}" set to status=${ad.status}`);
    saveDatabase();
    res.json({ ad });
  });

  app.patch('/api/admin/reports/:id', requireAdmin, (req, res) => {
    const adminId = res.locals.userId as string;
    const report = db.adReports.find((r) => r.id === req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }
    const { pauseAd } = req.body as { pauseAd?: boolean };
    report.status = 'resolved';
    if (pauseAd) {
      const ad = db.ads.find((a) => a.id === report.adId);
      if (ad) {
        ad.status = 'paused';
        ad.policyCompliant = false;
        ad.updatedAt = Date.now();
      }
    }
    recordAuditLog(
      adminId,
      'resolve_ad_report',
      report.id,
      pauseAd ? `Resolved report & paused ad ${report.adId}` : `Resolved report for ad ${report.adId}`,
    );
    saveDatabase();
    res.json({ report });
  });

  app.patch('/api/admin/payouts/:id', requireAdmin, async (req, res) => {
    const adminId = res.locals.userId as string;
    const payout = db.payouts.find((p) => p.id === req.params.id);
    if (!payout) {
      res.status(404).json({ error: 'Payout request not found.' });
      return;
    }
    const { action, note } = req.body as { action?: 'approve' | 'reject'; note?: string };
    const creator = getUserById(payout.userId);
    if (!creator) {
      res.status(404).json({ error: 'Creator account not found.' });
      return;
    }

    if (action === 'reject') {
      if (payout.status === 'paid') {
        res.status(400).json({ error: 'Cannot reject a payout that is already paid.' });
        return;
      }
      if (payout.status !== 'rejected') {
        creator.approvedEarningsCents += payout.amountCents;
      }
      payout.status = 'rejected';
      payout.note = (note || 'Rejected during compliance review').trim().slice(0, 180);
      payout.updatedAt = Date.now();
      recordAuditLog(adminId, 'reject_payout', payout.id, `Rejected payout for @${creator.username}`);
      saveDatabase();
      res.json({ payout, paymentProviderConfigured: Boolean(stripeClient) });
      return;
    }

    if (action === 'approve') {
      if (payout.status === 'paid') {
        res.json({ payout, paymentProviderConfigured: Boolean(stripeClient) });
        return;
      }
      if (!stripeClient || !creator.stripeAccountId || creator.payoutAccountStatus !== 'active') {
        payout.status = 'approved_awaiting_provider';
        payout.note = !stripeClient
          ? 'Approved in ledger; configure STRIPE_SECRET_KEY to execute live Stripe transfer.'
          : 'Approved in ledger; creator must complete Stripe Connect onboarding.';
        payout.updatedAt = Date.now();
        recordAuditLog(
          adminId,
          'approve_payout_awaiting_provider',
          payout.id,
          `Approved $${(payout.amountCents / 100).toFixed(2)} for @${creator.username} (awaiting Stripe settlement)`,
        );
        saveDatabase();
        res.json({
          payout,
          paymentProviderConfigured: Boolean(stripeClient),
          message: payout.note,
        });
        return;
      }

      try {
        const transfer = await stripeClient.transfers.create({
          amount: payout.amountCents,
          currency: payout.currency,
          destination: creator.stripeAccountId,
          metadata: {
            payoutId: payout.id,
            snapgramUserId: creator.id,
          },
        });
        payout.status = 'paid';
        payout.stripeTransferId = transfer.id;
        payout.note = `Settled via Stripe Transfer ${transfer.id}`;
        payout.updatedAt = Date.now();
        recordAuditLog(
          adminId,
          'settle_payout_stripe',
          payout.id,
          `Paid $${(payout.amountCents / 100).toFixed(2)} to @${creator.username} via ${transfer.id}`,
        );
        saveDatabase();
        res.json({ payout, paymentProviderConfigured: true });
      } catch (err) {
        res.status(502).json({
          error: err instanceof Error ? err.message : 'Stripe Transfer failed.',
        });
      }
      return;
    }

    res.status(400).json({ error: 'Specify action: "approve" or "reject".' });
  });

  app.patch('/api/admin/referrals/:id', requireAdmin, (req, res) => {
    const adminId = res.locals.userId as string;
    const ref = db.referrals.find((r) => r.id === req.params.id);
    if (!ref) {
      res.status(404).json({ error: 'Referral record not found.' });
      return;
    }
    const { status, reason } = req.body as { status?: 'qualified' | 'rejected'; reason?: string };
    const referrer = getUserById(ref.referrerUserId);
    if (!referrer) {
      res.status(404).json({ error: 'Referrer user not found.' });
      return;
    }

    if (status === 'rejected') {
      if (ref.status === 'qualified' && ref.rewardPoints > 0) {
        referrer.pointsBalance = Math.max(0, referrer.pointsBalance - ref.rewardPoints);
        db.pointsLedger.unshift({
          id: `pt_${crypto.randomBytes(6).toString('hex')}`,
          userId: referrer.id,
          activity: 'admin_adjustment',
          pointsDelta: -ref.rewardPoints,
          description: `Reversed referral points (${ref.referredUsername}): ${reason || 'Policy audit'}`,
          referenceId: ref.id,
          status: 'reversed',
          createdAt: Date.now(),
        });
      }
      ref.status = 'rejected';
      ref.rewardPoints = 0;
      ref.disqualificationReason = (reason || 'Rejected by compliance audit').trim().slice(0, 160);
    } else if (status === 'qualified') {
      if (ref.status !== 'qualified') {
        const bonus = db.monetizationConfig.referralBonusPoints;
        ref.status = 'qualified';
        ref.rewardPoints = bonus;
        ref.qualifiedAt = Date.now();
        ref.disqualificationReason = undefined;
        referrer.pointsBalance += bonus;
        db.pointsLedger.unshift({
          id: `pt_${crypto.randomBytes(6).toString('hex')}`,
          userId: referrer.id,
          activity: 'referral_qualified',
          pointsDelta: bonus,
          description: `Admin-approved referral reward for @${ref.referredUsername}`,
          referenceId: ref.id,
          status: 'credited',
          createdAt: Date.now(),
        });
      }
    } else {
      res.status(400).json({ error: 'Status must be "qualified" or "rejected".' });
      return;
    }

    recordAuditLog(adminId, 'moderate_referral', ref.id, `Referral ${ref.id} marked ${ref.status}`);
    saveDatabase();
    res.json({ referral: ref });
  });

  app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
    const adminId = res.locals.userId as string;
    const target = getUserById(req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const {
      accountStatus,
      policyStrikesDelta,
      pointsDelta,
      approveEstimatedCents,
      reason,
    } = req.body as {
      accountStatus?: UserAccountStatus;
      policyStrikesDelta?: number;
      pointsDelta?: number;
      approveEstimatedCents?: number;
      reason?: string;
    };

    if (accountStatus && target.id !== adminId) {
      target.accountStatus = accountStatus;
    }
    if (typeof policyStrikesDelta === 'number' && Number.isFinite(policyStrikesDelta)) {
      target.policyStrikes = Math.max(0, target.policyStrikes + Math.trunc(policyStrikesDelta));
    }
    if (typeof pointsDelta === 'number' && Number.isFinite(pointsDelta) && pointsDelta !== 0) {
      const delta = Math.trunc(pointsDelta);
      target.pointsBalance = Math.max(0, target.pointsBalance + delta);
      db.pointsLedger.unshift({
        id: `pt_${crypto.randomBytes(6).toString('hex')}`,
        userId: target.id,
        activity: 'admin_adjustment',
        pointsDelta: delta,
        description: (reason || 'Admin points adjustment').trim().slice(0, 140),
        status: delta >= 0 ? 'credited' : 'reversed',
        createdAt: Date.now(),
      });
    }
    if (typeof approveEstimatedCents === 'number' && approveEstimatedCents > 0) {
      const move = Math.min(target.estimatedEarningsCents, Math.floor(approveEstimatedCents));
      if (move > 0) {
        target.estimatedEarningsCents -= move;
        target.approvedEarningsCents += move;
      }
    }

    recordAuditLog(
      adminId,
      'manage_user',
      target.id,
      `Updated @${target.username}: status=${target.accountStatus}, strikes=${target.policyStrikes}`,
    );
    saveDatabase();
    res.json({ ok: true });
  });

  // Vite middleware in dev / static dist in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SnapGram server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SnapGram server:', err);
  process.exit(1);
});
