import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  Lock,
  Megaphone,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import type { AuthUser, CreatorMonetizationDashboard } from '../types';

interface MonetizationViewProps {
  currentUser: AuthUser | null;
  onRequireAuth: (reason: string) => void;
  onUserUpdated: (user: AuthUser) => void;
  onToast: (msg: string) => void;
}

type MonetizationTab = 'overview' | 'points' | 'referrals' | 'earnings' | 'advertise';

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function MonetizationView({
  currentUser,
  onRequireAuth,
  onUserUpdated,
  onToast,
}: MonetizationViewProps) {
  const [tab, setTab] = useState<MonetizationTab>('overview');
  const [data, setData] = useState<CreatorMonetizationDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compliance form state
  const [birthYearInput, setBirthYearInput] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptTax, setAcceptTax] = useState(false);
  const [savingCompliance, setSavingCompliance] = useState(false);

  // Redeem points state
  const [redeemInput, setRedeemInput] = useState('100');
  const [redeeming, setRedeeming] = useState(false);

  // Payout state
  const [payoutAmountUsd, setPayoutAmountUsd] = useState('');
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);

  // Ad submission state
  const [adTitle, setAdTitle] = useState('');
  const [adBody, setAdBody] = useState('');
  const [adAdvertiser, setAdAdvertiser] = useState('');
  const [adDestUrl, setAdDestUrl] = useState('https://');
  const [adPlacement, setAdPlacement] = useState<'feed' | 'reels' | 'explore'>('feed');
  const [adBillingModel, setAdBillingModel] = useState<'cpm' | 'cpc'>('cpm');
  const [adRateUsd, setAdRateUsd] = useState('6.00');
  const [adBudgetUsd, setAdBudgetUsd] = useState('50.00');
  const [adAge18Plus, setAdAge18Plus] = useState(false);
  const [adCategory, setAdCategory] = useState('Creative Tools');
  const [creatingAd, setCreatingAd] = useState(false);

  async function loadDashboard() {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMonetizationDashboard();
      setData(res);
      if (res.compliance.birthYear) setBirthYearInput(String(res.compliance.birthYear));
      setAcceptTerms(Boolean(res.compliance.monetizationTermsAcceptedAt));
      setAcceptTax(res.compliance.taxComplianceAccepted);
      if (!adAdvertiser) setAdAdvertiser(currentUser.displayName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load monetization dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="max-w-lg mx-auto my-12 px-6 py-10 bg-[#121216] border border-white/[0.08] rounded-3xl text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-amber-400">
          <Lock className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-white">Creator Rewards &amp; Monetization</h2>
        <p className="text-sm text-zinc-400">
          Sign in to check your 18+ eligibility, track verified engagement points, share referrals,
          or manage sponsored campaigns.
        </p>
        <button
          type="button"
          onClick={() => onRequireAuth('Sign in to access Creator Rewards & Monetization.')}
          className="h-11 px-6 rounded-xl bg-white text-zinc-950 font-semibold text-sm hover:bg-zinc-200"
        >
          Sign in
        </button>
      </div>
    );
  }

  async function handleSaveCompliance(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingCompliance(true);
    try {
      const res = await api.updateCompliance({
        birthYear: birthYearInput ? Number(birthYearInput) : undefined,
        acceptMonetizationTerms: acceptTerms,
        acceptTaxCompliance: acceptTax,
      });
      onUserUpdated(res.user);
      await loadDashboard();
      onToast('Compliance & eligibility updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update compliance status.');
    } finally {
      setSavingCompliance(false);
    }
  }

  async function handleRedeemPoints(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRedeeming(true);
    try {
      await api.redeemPoints(Number(redeemInput));
      await loadDashboard();
      onToast('Points redeemed toward estimated earnings (pending review)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Redemption failed.');
    } finally {
      setRedeeming(false);
    }
  }

  async function handleConnectStripe() {
    setError(null);
    setConnectingStripe(true);
    try {
      const res = await api.connectPayoutAccount();
      window.location.href = res.onboardingUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect Stripe account.');
    } finally {
      setConnectingStripe(false);
    }
  }

  async function handleRequestPayout(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRequestingPayout(true);
    try {
      const cents = Math.round(Number(payoutAmountUsd || 0) * 100);
      await api.requestPayout(cents);
      setPayoutAmountUsd('');
      await loadDashboard();
      onToast('Payout request submitted for compliance review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payout request failed.');
    } finally {
      setRequestingPayout(false);
    }
  }

  async function handleCreateAd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatingAd(true);
    try {
      await api.createAdCampaign({
        advertiserName: adAdvertiser.trim() || currentUser?.displayName || 'Creator',
        title: adTitle,
        body: adBody,
        destinationUrl: adDestUrl,
        placement: adPlacement,
        billingModel: adBillingModel,
        rateCents: Math.round(Number(adRateUsd || 6) * 100),
        budgetCents: Math.round(Number(adBudgetUsd || 50) * 100),
        ageRestricted18Plus: adAge18Plus,
        policyCategory: adCategory,
      });
      setAdTitle('');
      setAdBody('');
      await loadDashboard();
      onToast('Campaign submitted for policy review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ad campaign.');
    } finally {
      setCreatingAd(false);
    }
  }

  async function handleFundCampaign(adId: string) {
    setError(null);
    try {
      const res = await api.fundAdCheckout(adId);
      window.location.href = res.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout unavailable.');
    }
  }

  function handleCopyReferral(text: string) {
    navigator.clipboard?.writeText(text).then(() => onToast('Referral link copied')).catch(() => {});
  }

  const tabs: { id: MonetizationTab; label: string; icon: typeof Award }[] = [
    { id: 'overview', label: 'Eligibility', icon: ShieldCheck },
    { id: 'points', label: 'Points', icon: Award },
    { id: 'referrals', label: 'Referrals', icon: Users },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
    { id: 'advertise', label: 'Advertise', icon: Megaphone },
  ];

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Creator Monetization &amp; Ads
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Transparent eligibility, verified points, referrals, Stripe payouts, and sponsored ads
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#121216] border border-white/[0.08] rounded-xl overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  active ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-sm text-rose-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-4">
          <div className="h-32 rounded-2xl bg-zinc-900 animate-pulse" />
          <div className="h-56 rounded-2xl bg-zinc-900 animate-pulse" />
        </div>
      ) : data ? (
        <>
          {/* Compliance & Non-Guarantee Banner */}
          <div className="px-4 py-3 rounded-2xl bg-[#121216] border border-white/[0.08] text-xs text-zinc-400 leading-relaxed">
            <span className="text-zinc-200 font-semibold">Monetization Disclosure: </span>
            SnapGram does not guarantee income or automatic payouts. Estimated earnings reflect
            tracked activity and require 18+ age verification, anti-fraud review, funded ad-pool
            reconciliation, a {formatUsd(data.config.minPayoutCents)} minimum balance, and Stripe
            Connect settlement.
          </div>

          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Live Server Eligibility Checks */}
              <section className="lg:col-span-7 bg-[#121216] border border-white/[0.08] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white">Creator Eligibility Status</h2>
                  <span
                    className={`text-xs font-semibold ${
                      data.eligibility.eligible ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {data.eligibility.eligible ? 'Eligible' : 'Action Required'}
                  </span>
                </div>

                <div className="divide-y divide-white/[0.06]">
                  {data.eligibility.checks.map((c) => (
                    <div key={c.label} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white">{c.label}</div>
                        <div className="text-xs text-zinc-400 mt-0.5">{c.detail}</div>
                      </div>
                      {c.passed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-zinc-500 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* 18+ Age & Legal Policy Verification Form */}
              <form
                onSubmit={handleSaveCompliance}
                className="lg:col-span-5 bg-[#121216] border border-white/[0.08] rounded-2xl p-5 space-y-4"
              >
                <h2 className="text-base font-bold text-white">Age &amp; Policy Compliance</h2>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Birth Year (18+ required for rewards &amp; payouts)
                  </label>
                  <input
                    type="number"
                    min={1900}
                    max={new Date().getFullYear() - 13}
                    value={birthYearInput}
                    onChange={(e) => setBirthYearInput(e.target.value)}
                    placeholder="e.g. 1998"
                    className="w-full h-11 px-3.5 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white tabular-nums focus:outline-none focus:border-amber-500"
                  />
                </div>

                <label className="flex items-start gap-3 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-700 bg-zinc-950 text-amber-500"
                  />
                  <span>
                    I accept the SnapGram Creator Monetization Terms, FTC Sponsored Disclosure Rules,
                    and anti-fraud policies.
                  </span>
                </label>

                <label className="flex items-start gap-3 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTax}
                    onChange={(e) => setAcceptTax(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-700 bg-zinc-950 text-amber-500"
                  />
                  <span>
                    I acknowledge tax reporting requirements (e.g., W-9 / W-8BEN via Stripe) before
                    receiving creator payouts.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={savingCompliance}
                  className="w-full h-11 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50"
                >
                  {savingCompliance ? 'Verifying...' : 'Save Compliance Verification'}
                </button>
              </form>
            </div>
          )}

          {tab === 'points' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5">
                  <div className="text-xs text-zinc-400">Verified Points Balance</div>
                  <div className="text-2xl font-bold text-white tabular-nums mt-1">
                    {data.balances.pointsBalance} pts
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 tabular-nums">
                    Daily earn cap: {data.config.dailyPointsCap} pts / 24h
                  </div>
                </div>

                <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5">
                  <div className="text-xs text-zinc-400">Conversion Rate</div>
                  <div className="text-2xl font-bold text-amber-400 tabular-nums mt-1">
                    {data.config.pointsPerUsd} pts = $1.00
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Converts to estimated credit pending ad-pool review
                  </div>
                </div>

                <form
                  onSubmit={handleRedeemPoints}
                  className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 space-y-2.5"
                >
                  <label className="block text-xs text-zinc-400">
                    Redeem Verified Points (min {data.config.pointsPerUsd})
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={data.config.pointsPerUsd}
                      step={10}
                      value={redeemInput}
                      onChange={(e) => setRedeemInput(e.target.value)}
                      className="flex-1 h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-sm text-white tabular-nums focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={redeeming || !data.eligibility.eligible || data.balances.pointsBalance < data.config.pointsPerUsd}
                      className="h-10 px-4 rounded-xl bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 disabled:opacity-40 whitespace-nowrap"
                    >
                      {redeeming ? 'Redeeming...' : 'Redeem'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Eligible Activities Rules */}
              <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-white">Verified Activity Rules (Anti-Abuse Enforced)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/60">
                    <div className="font-semibold text-white">Publish Post / Reel</div>
                    <div className="text-amber-400 tabular-nums mt-0.5">+15 pts · max 5/day</div>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60">
                    <div className="font-semibold text-white">Publish 24h Story</div>
                    <div className="text-amber-400 tabular-nums mt-0.5">+10 pts · max 5/day</div>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60">
                    <div className="font-semibold text-white">Unique Likes &amp; Comments</div>
                    <div className="text-amber-400 tabular-nums mt-0.5">+2 / +5 pts (no self-likes)</div>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60">
                    <div className="font-semibold text-white">Qualified Referral</div>
                    <div className="text-amber-400 tabular-nums mt-0.5">
                      +{data.config.referralBonusPoints} pts after 1st post
                    </div>
                  </div>
                </div>
              </div>

              {/* Points History Table */}
              <div className="bg-[#121216] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.07]">
                  <h2 className="text-sm font-bold text-white">Points Ledger</h2>
                </div>
                {data.pointsHistory.length === 0 ? (
                  <div className="py-10 text-center text-xs text-zinc-500">
                    No points recorded yet. Complete 18+ eligibility and publish original content to earn verified points.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-zinc-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="px-5 py-2.5 font-medium">Activity</th>
                          <th className="px-5 py-2.5 font-medium">Status</th>
                          <th className="px-5 py-2.5 font-medium text-right">Points</th>
                          <th className="px-5 py-2.5 font-medium text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {data.pointsHistory.map((item) => (
                          <tr key={item.id} className="hover:bg-white/[0.02]">
                            <td className="px-5 py-3 text-zinc-200">{item.description}</td>
                            <td className="px-5 py-3 text-zinc-400 capitalize">{item.status}</td>
                            <td
                              className={`px-5 py-3 text-right font-semibold tabular-nums ${
                                item.pointsDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {item.pointsDelta >= 0 ? `+${item.pointsDelta}` : item.pointsDelta}
                            </td>
                            <td className="px-5 py-3 text-right text-zinc-500 tabular-nums">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'referrals' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <section className="lg:col-span-7 bg-[#121216] border border-white/[0.08] rounded-2xl p-5 space-y-4">
                  <h2 className="text-base font-bold text-white">Your Referral Code &amp; Link</h2>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      readOnly
                      value={data.referrals.shareUrl}
                      className="flex-1 h-11 px-3.5 bg-zinc-950 border border-white/[0.1] rounded-xl text-xs font-mono text-zinc-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyReferral(data.referrals.shareUrl)}
                      className="h-11 px-4 rounded-xl bg-white text-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-zinc-200 whitespace-nowrap"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Link ({data.referrals.code})
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-1 text-center tabular-nums">
                    <div className="p-3 rounded-xl bg-zinc-900/60">
                      <div className="text-lg font-bold text-white">{data.referrals.qualifiedCount}</div>
                      <div className="text-[11px] text-zinc-400">Qualified</div>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/60">
                      <div className="text-lg font-bold text-amber-400">{data.referrals.pendingCount}</div>
                      <div className="text-[11px] text-zinc-400">Pending 1st Post</div>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/60">
                      <div className="text-lg font-bold text-zinc-200">
                        {data.referrals.monthlyQualifiedCount}/{data.config.monthlyReferralCap}
                      </div>
                      <div className="text-[11px] text-zinc-400">Monthly Cap</div>
                    </div>
                  </div>
                </section>

                <section className="lg:col-span-5 bg-[#121216] border border-white/[0.08] rounded-2xl p-5 space-y-2.5 text-xs text-zinc-400 leading-relaxed">
                  <h2 className="text-base font-bold text-white">Transparent Referral Rules</h2>
                  <p>1. Both referrer and invited user must verify age 18+ and maintain active accounts in good standing.</p>
                  <p>
                    2. Referrals remain pending until the invited user verifies 18+ and publishes at least
                    1 original post (prevents automated/empty signup abuse).
                  </p>
                  <p>
                    3. Qualified referrals award +{data.config.referralBonusPoints} pts, capped at{' '}
                    {data.config.monthlyReferralCap} qualified referrals per 30 days.
                  </p>
                </section>
              </div>

              <div className="bg-[#121216] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.07]">
                  <h2 className="text-sm font-bold text-white">Referral Attribution Log</h2>
                </div>
                {data.referrals.records.length === 0 ? (
                  <div className="py-10 text-center text-xs text-zinc-500">
                    No referrals recorded yet. Share your link above to invite verified creators.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-zinc-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="px-5 py-2.5 font-medium">Invited User</th>
                          <th className="px-5 py-2.5 font-medium">Status</th>
                          <th className="px-5 py-2.5 font-medium text-right">Reward</th>
                          <th className="px-5 py-2.5 font-medium text-right">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {data.referrals.records.map((r) => (
                          <tr key={r.id}>
                            <td className="px-5 py-3 text-white font-medium">@{r.referredUsername}</td>
                            <td className="px-5 py-3 text-zinc-300 capitalize">
                              {r.status.replace(/_/g, ' ')}
                            </td>
                            <td className="px-5 py-3 text-right tabular-nums text-amber-400">
                              {r.rewardPoints > 0 ? `+${r.rewardPoints} pts` : '0 pts'}
                            </td>
                            <td className="px-5 py-3 text-right tabular-nums text-zinc-500">
                              {new Date(r.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'earnings' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4">
                  <div className="text-xs text-zinc-400">Estimated (Unsettled)</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    {formatUsd(data.balances.estimatedEarningsCents)}
                  </div>
                </div>
                <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4">
                  <div className="text-xs text-zinc-400">Approved Available</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {formatUsd(data.balances.approvedEarningsCents)}
                  </div>
                </div>
                <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4">
                  <div className="text-xs text-zinc-400">Pending Payouts</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {formatUsd(data.balances.pendingPayoutCents)}
                  </div>
                </div>
                <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4">
                  <div className="text-xs text-zinc-400">Paid Out</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {formatUsd(data.balances.paidOutCents)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Stripe Connect Onboarding */}
                <section className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-400" />
                      Payout Provider (Stripe Connect)
                    </h2>
                    <span className="text-xs text-zinc-400">
                      {data.paymentProvider.configured ? 'Provider Ready' : 'API Key Required'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Account status:{' '}
                    <span className="text-zinc-200 font-medium capitalize">
                      {data.paymentProvider.accountStatus.replace(/_/g, ' ')}
                    </span>
                    {data.paymentProvider.stripeAccountIdLast4 &&
                      ` (••${data.paymentProvider.stripeAccountIdLast4})`}
                    . Funded platform creator share pool:{' '}
                    <span className="text-zinc-200 tabular-nums">
                      {formatUsd(data.balances.creatorAdSharePoolCents)}
                    </span>
                    .
                  </p>
                  <button
                    type="button"
                    disabled={connectingStripe}
                    onClick={handleConnectStripe}
                    className="h-10 px-4 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {connectingStripe ? 'Connecting...' : 'Connect Payout Account (Stripe)'}
                  </button>
                </section>

                {/* Withdrawal Request */}
                <form
                  onSubmit={handleRequestPayout}
                  className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 space-y-3"
                >
                  <h2 className="text-base font-bold text-white">Request Payout</h2>
                  <p className="text-xs text-zinc-400">
                    Withdrawals draw strictly from Approved Available Balance (min{' '}
                    {formatUsd(data.config.minPayoutCents)}). Estimated earnings must first pass
                    revenue settlement in Admin review.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={data.config.minPayoutCents / 100}
                      step="0.01"
                      value={payoutAmountUsd}
                      onChange={(e) => setPayoutAmountUsd(e.target.value)}
                      placeholder={(data.config.minPayoutCents / 100).toFixed(2)}
                      className="flex-1 h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-sm text-white tabular-nums focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={
                        requestingPayout ||
                        data.balances.approvedEarningsCents < data.config.minPayoutCents
                      }
                      className="h-10 px-4 rounded-xl bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 disabled:opacity-40 whitespace-nowrap"
                    >
                      {requestingPayout ? 'Submitting...' : 'Request Withdrawal'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Payout History */}
              <div className="bg-[#121216] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.07]">
                  <h2 className="text-sm font-bold text-white">Payout &amp; Payment Status History</h2>
                </div>
                {data.payouts.length === 0 ? (
                  <div className="py-10 text-center text-xs text-zinc-500">
                    No payout requests submitted yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-zinc-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="px-5 py-2.5 font-medium">Amount</th>
                          <th className="px-5 py-2.5 font-medium">Status</th>
                          <th className="px-5 py-2.5 font-medium">Details</th>
                          <th className="px-5 py-2.5 font-medium text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {data.payouts.map((p) => (
                          <tr key={p.id}>
                            <td className="px-5 py-3 font-semibold text-white tabular-nums">
                              {formatUsd(p.amountCents)}
                            </td>
                            <td className="px-5 py-3 text-amber-300 capitalize">
                              {p.status.replace(/_/g, ' ')}
                            </td>
                            <td className="px-5 py-3 text-zinc-400">{p.note || p.stripeTransferId || '—'}</td>
                            <td className="px-5 py-3 text-right tabular-nums text-zinc-500">
                              {new Date(p.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'advertise' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <form
                onSubmit={handleCreateAd}
                className="lg:col-span-5 bg-[#121216] border border-white/[0.08] rounded-2xl p-5 space-y-3.5"
              >
                <h2 className="text-base font-bold text-white">Submit Sponsored Ad Campaign</h2>
                <p className="text-xs text-zinc-400">
                  All ads require policy review, explicit Sponsored disclosure, HTTPS destination URL,
                  and Stripe Checkout funding before live billing.
                </p>

                <input
                  type="text"
                  required
                  value={adAdvertiser}
                  onChange={(e) => setAdAdvertiser(e.target.value)}
                  placeholder="Advertiser / Brand Name"
                  className="w-full h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  required
                  value={adTitle}
                  onChange={(e) => setAdTitle(e.target.value)}
                  placeholder="Campaign headline"
                  className="w-full h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
                <textarea
                  rows={2}
                  required
                  value={adBody}
                  onChange={(e) => setAdBody(e.target.value)}
                  placeholder="Transparent ad description..."
                  className="w-full px-3 py-2 bg-zinc-950 border border-white/[0.1] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                />
                <input
                  type="url"
                  required
                  value={adDestUrl}
                  onChange={(e) => setAdDestUrl(e.target.value)}
                  placeholder="https://yourbrand.com"
                  className="w-full h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />

                <div className="grid grid-cols-2 gap-2.5">
                  <select
                    value={adPlacement}
                    onChange={(e) => setAdPlacement(e.target.value as 'feed' | 'reels' | 'explore')}
                    className="h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-xs text-white"
                  >
                    <option value="feed">Feed Placement</option>
                    <option value="explore">Explore Placement</option>
                    <option value="reels">Reels Placement</option>
                  </select>
                  <select
                    value={adBillingModel}
                    onChange={(e) => setAdBillingModel(e.target.value as 'cpm' | 'cpc')}
                    className="h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-xs text-white"
                  >
                    <option value="cpm">CPM (per 1k views)</option>
                    <option value="cpc">CPC (per click)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      Rate USD ({adBillingModel.toUpperCase()})
                    </label>
                    <input
                      type="number"
                      step="0.10"
                      min="0.10"
                      value={adRateUsd}
                      onChange={(e) => setAdRateUsd(e.target.value)}
                      className="w-full h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-sm text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Budget (USD)</label>
                    <input
                      type="number"
                      step="1"
                      min="5"
                      value={adBudgetUsd}
                      onChange={(e) => setAdBudgetUsd(e.target.value)}
                      className="w-full h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-sm text-white tabular-nums"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  value={adCategory}
                  onChange={(e) => setAdCategory(e.target.value)}
                  placeholder="Policy category (e.g. Creative Tools)"
                  className="w-full h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-sm text-white"
                />

                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adAge18Plus}
                    onChange={(e) => setAdAge18Plus(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-950 text-amber-500"
                  />
                  <span>Restrict placement strictly to 18+ verified users</span>
                </label>

                <button
                  type="submit"
                  disabled={creatingAd}
                  className="w-full h-11 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50"
                >
                  {creatingAd ? 'Submitting...' : 'Submit Campaign for Review'}
                </button>
              </form>

              <section className="lg:col-span-7 bg-[#121216] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.07]">
                  <h2 className="text-sm font-bold text-white">Your Ad Campaigns</h2>
                </div>
                {data.myCampaigns.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-500">
                    No campaigns submitted yet.
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {data.myCampaigns.map((c) => (
                      <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="text-sm font-semibold text-white truncate">{c.title}</div>
                          <div className="text-xs text-zinc-400 tabular-nums">
                            {c.status.replace(/_/g, ' ')} · {c.fundingStatus} · {c.impressions} views ·{' '}
                            {c.clicks} clicks · {formatUsd(c.spentCents)} / {formatUsd(c.budgetCents)}
                          </div>
                        </div>
                        {c.fundingStatus !== 'funded' && (
                          <button
                            type="button"
                            onClick={() => handleFundCampaign(c.id)}
                            className="h-9 px-3.5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-400 shrink-0 whitespace-nowrap"
                          >
                            <span>Fund via Stripe</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
