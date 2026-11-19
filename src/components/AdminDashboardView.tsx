import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  DollarSign,
  Lock,
  Megaphone,
  Pause,
  ShieldCheck,
  Sliders,
  Users,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { AdminOverviewPayload, AuthUser, MonetizationPolicyConfig } from '../types';

interface AdminDashboardViewProps {
  currentUser: AuthUser | null;
  onToast: (msg: string) => void;
}

type AdminTab = 'overview' | 'ads' | 'payouts' | 'referrals' | 'users';

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AdminDashboardView({ currentUser, onToast }: AdminDashboardViewProps) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<AdminOverviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<MonetizationPolicyConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  async function loadOverview() {
    if (!currentUser || currentUser.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminOverview();
      setData(res);
      setConfigDraft(res.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin overview.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, [currentUser?.id, currentUser?.role]);

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto my-12 px-6 py-10 bg-[#121216] border border-white/[0.08] rounded-3xl text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-rose-400">
          <Lock className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-white">Administrator Access Required</h2>
        <p className="text-sm text-zinc-400">
          This console is protected by server-side RBAC and restricted to platform administrators.
        </p>
      </div>
    );
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!configDraft) return;
    setSavingConfig(true);
    setError(null);
    try {
      await api.updateAdminConfig(configDraft);
      await loadOverview();
      onToast('Monetization policy config updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update config.');
    } finally {
      setSavingConfig(false);
    }
  }

  const tabs: { id: AdminTab; label: string; icon: typeof ShieldCheck }[] = [
    { id: 'overview', label: 'Overview & Policy', icon: Sliders },
    { id: 'ads', label: 'Advertisements', icon: Megaphone },
    { id: 'payouts', label: 'Payouts', icon: DollarSign },
    { id: 'referrals', label: 'Referrals', icon: ShieldCheck },
    { id: 'users', label: 'Users & Audit', icon: Users },
  ];

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Admin Monetization Console
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Manage ad campaigns, creator eligibility rules, payouts, referrals, and user compliance
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#121216] border border-white/[0.08] rounded-xl overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  tab === t.id ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-white'
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
        <div className="h-64 rounded-2xl bg-zinc-900 animate-pulse" />
      ) : data ? (
        <>
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4">
                  <div className="text-xs text-zinc-400">Funded Ad Revenue</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {formatUsd(data.metrics.fundedAdRevenueCents)}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    Platform: {formatUsd(data.metrics.platformRevenueCents)} · Pool:{' '}
                    {formatUsd(data.metrics.creatorPoolCents)}
                  </div>
                </div>
                <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4">
                  <div className="text-xs text-zinc-400">Ads &amp; Delivery</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    {data.metrics.activeAds} active · {data.metrics.pendingReviewAds} review
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {data.metrics.totalAdImpressions} impressions · {data.metrics.totalAdClicks} clicks
                  </div>
                </div>
                <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4">
                  <div className="text-xs text-zinc-400">Creators &amp; Referrals</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {data.metrics.eligibleCreators} / {data.metrics.totalUsers} eligible
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {data.metrics.qualifiedReferrals} qualified referrals
                  </div>
                </div>
                <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4">
                  <div className="text-xs text-zinc-400">Payment Provider</div>
                  <div
                    className={`text-sm font-bold mt-1.5 ${
                      data.paymentProviderConfigured ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {data.paymentProviderConfigured
                      ? 'Stripe Configured'
                      : 'Stripe Keys Not Configured'}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {data.metrics.pendingPayoutsCount} pending ({formatUsd(data.metrics.pendingPayoutsCents)})
                  </div>
                </div>
              </div>

              {configDraft && (
                <form
                  onSubmit={handleSaveConfig}
                  className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-white">Monetization Policy Parameters</h2>
                    <button
                      type="submit"
                      disabled={savingConfig}
                      className="h-9 px-4 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50"
                    >
                      {savingConfig ? 'Saving...' : 'Save Policy'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1">Min Posts</label>
                      <input
                        type="number"
                        value={configDraft.minPostsRequired}
                        onChange={(e) =>
                          setConfigDraft({ ...configDraft, minPostsRequired: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Min Followers</label>
                      <input
                        type="number"
                        value={configDraft.minFollowersRequired}
                        onChange={(e) =>
                          setConfigDraft({ ...configDraft, minFollowersRequired: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Points per $1 USD</label>
                      <input
                        type="number"
                        value={configDraft.pointsPerUsd}
                        onChange={(e) =>
                          setConfigDraft({ ...configDraft, pointsPerUsd: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Creator Pool Share %</label>
                      <input
                        type="number"
                        value={configDraft.creatorRevenueSharePct}
                        onChange={(e) =>
                          setConfigDraft({
                            ...configDraft,
                            creatorRevenueSharePct: Number(e.target.value),
                          })
                        }
                        className="w-full h-10 px-3 bg-zinc-950 border border-white/[0.1] rounded-xl text-white tabular-nums"
                      />
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {tab === 'ads' && (
            <div className="space-y-5">
              <div className="bg-[#121216] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.07]">
                  <h2 className="text-sm font-bold text-white">Sponsored Campaigns</h2>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {data.ads.map((ad) => (
                    <div
                      key={ad.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="text-sm font-semibold text-white">
                          {ad.title}{' '}
                          <span className="text-xs font-normal text-zinc-400">
                            · {ad.advertiserName}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 tabular-nums">
                          {ad.status} · {ad.fundingStatus} · {ad.placement} · {ad.billingModel.toUpperCase()}{' '}
                          {formatUsd(ad.rateCents)} · {ad.impressions} imp / {ad.clicks} clicks ·{' '}
                          {formatUsd(ad.spentCents)} / {formatUsd(ad.budgetCents)}
                          {ad.ageRestricted18Plus ? ' · 18+ Only' : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            await api.moderateAd(ad.id, { policyCompliant: true, status: 'active' });
                            await loadOverview();
                            onToast('Ad approved & active');
                          }}
                          className="h-8 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Activate
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.moderateAd(ad.id, { status: 'paused' });
                            await loadOverview();
                            onToast('Ad paused');
                          }}
                          className="h-8 px-3 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          Pause
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.moderateAd(ad.id, { policyCompliant: false, status: 'rejected' });
                            await loadOverview();
                            onToast('Ad rejected');
                          }}
                          className="h-8 px-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {data.adReports.length > 0 && (
                <div className="bg-[#121216] border border-white/[0.08] rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-white/[0.07]">
                    <h2 className="text-sm font-bold text-white">Reported Ad Placements</h2>
                  </div>
                  <div className="divide-y divide-white/[0.06]">
                    {data.adReports.map((rep) => (
                      <div key={rep.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-semibold text-white">{rep.adTitle}</div>
                          <div className="text-zinc-400">
                            {rep.reason} · {rep.status}
                          </div>
                        </div>
                        {rep.status === 'open' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await api.resolveAdReport(rep.id, true);
                              await loadOverview();
                              onToast('Report resolved & ad paused');
                            }}
                            className="h-8 px-3 rounded-lg bg-rose-500 text-white font-semibold"
                          >
                            Pause Ad &amp; Resolve
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'payouts' && (
            <div className="bg-[#121216] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.07]">
                <h2 className="text-sm font-bold text-white">Creator Payout Queue</h2>
              </div>
              {data.payouts.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  No payout requests queued.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {data.payouts.map((p) => (
                    <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs space-y-1">
                        <div className="text-sm font-semibold text-white tabular-nums">
                          @{p.username} · {formatUsd(p.amountCents)}
                        </div>
                        <div className="text-zinc-400">
                          {p.status.replace(/_/g, ' ')} · {p.note || 'Pending review'}
                        </div>
                      </div>
                      {(p.status === 'pending_review' || p.status === 'approved_awaiting_provider') && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await api.moderatePayout(p.id, { action: 'approve' });
                              await loadOverview();
                              onToast(res.message || 'Payout processed');
                            }}
                            className="h-8 px-3 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold"
                          >
                            Approve / Settle
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.moderatePayout(p.id, { action: 'reject' });
                              await loadOverview();
                              onToast('Payout rejected & refunded to approved balance');
                            }}
                            className="h-8 px-3 rounded-lg bg-zinc-800 text-rose-300 text-xs font-semibold"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'referrals' && (
            <div className="bg-[#121216] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.07]">
                <h2 className="text-sm font-bold text-white">Referral Fraud &amp; Qualification Review</h2>
              </div>
              {data.referrals.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  No referrals recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {data.referrals.map((r) => (
                    <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          @{r.referrerUsername} invited @{r.referredUsername}
                        </div>
                        <div className="text-zinc-400 tabular-nums">
                          Code {r.codeUsed} · {r.status.replace(/_/g, ' ')} · {r.rewardPoints} pts
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            await api.moderateReferral(r.id, { status: 'qualified' });
                            await loadOverview();
                            onToast('Referral approved');
                          }}
                          className="h-8 px-3 rounded-lg bg-zinc-800 text-emerald-300 font-semibold"
                        >
                          Qualify
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.moderateReferral(r.id, { status: 'rejected' });
                            await loadOverview();
                            onToast('Referral rejected');
                          }}
                          className="h-8 px-3 rounded-lg bg-zinc-800 text-rose-300 font-semibold"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-5">
              <div className="bg-[#121216] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.07]">
                  <h2 className="text-sm font-bold text-white">Creator Accounts &amp; Compliance</h2>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {data.users.map((u) => (
                    <div
                      key={u.id}
                      className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="text-sm font-semibold text-white">
                          @{u.username}{' '}
                          <span className="text-xs font-normal text-zinc-400">
                            · {u.role} · {u.accountStatus} · {u.ageVerified18Plus ? '18+ Verified' : 'Age Unverified'}
                          </span>
                        </div>
                        <div className="text-zinc-400 tabular-nums">
                          {u.pointsBalance} pts · Est: {formatUsd(u.estimatedEarningsCents)} · Approved:{' '}
                          {formatUsd(u.approvedEarningsCents)} · Strikes: {u.policyStrikes}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {u.estimatedEarningsCents > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              await api.manageAdminUser(u.id, {
                                approveEstimatedCents: u.estimatedEarningsCents,
                                reason: 'Admin settled estimated creator earnings',
                              });
                              await loadOverview();
                              onToast(`Approved estimated balance for @${u.username}`);
                            }}
                            className="h-8 px-3 rounded-lg bg-amber-500 text-zinc-950 font-semibold"
                          >
                            Approve Est. Balance
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await api.manageAdminUser(u.id, {
                              policyStrikesDelta: 1,
                              reason: 'Policy warning issued',
                            });
                            await loadOverview();
                            onToast(`Policy strike added to @${u.username}`);
                          }}
                          className="h-8 px-3 rounded-lg bg-zinc-800 text-zinc-200 font-semibold"
                        >
                          +1 Strike
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            type="button"
                            onClick={async () => {
                              const next = u.accountStatus === 'suspended' ? 'active' : 'suspended';
                              await api.manageAdminUser(u.id, { accountStatus: next });
                              await loadOverview();
                              onToast(`@${u.username} set to ${next}`);
                            }}
                            className={`h-8 px-3 rounded-lg font-semibold ${
                              u.accountStatus === 'suspended'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {u.accountStatus === 'suspended' ? 'Restore' : 'Suspend'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {data.auditLogs.length > 0 && (
                <div className="bg-[#121216] border border-white/[0.08] rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-white/[0.07]">
                    <h2 className="text-sm font-bold text-white">Admin Audit Trail</h2>
                  </div>
                  <div className="divide-y divide-white/[0.05] text-xs">
                    {data.auditLogs.slice(0, 15).map((log) => (
                      <div key={log.id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="text-zinc-200">
                          <span className="font-semibold text-white">@{log.adminUsername}</span>{' '}
                          <span className="text-zinc-400">({log.action})</span> — {log.detail}
                        </div>
                        <span className="text-zinc-500 tabular-nums shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
