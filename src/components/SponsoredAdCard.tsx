import { useEffect, useRef, useState } from 'react';
import { ExternalLink, EyeOff, Flag, Info, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import type { SponsoredAdItem } from '../types';

interface SponsoredAdCardProps {
  ad: SponsoredAdItem;
  isAuthenticated: boolean;
  onRequireAuth: (reason: string) => void;
  onHidden: (adId: string) => void;
}

export function SponsoredAdCard({
  ad,
  isAuthenticated,
  onRequireAuth,
  onHidden,
}: SponsoredAdCardProps) {
  const impressionSent = useRef(false);
  const [showInfo, setShowInfo] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (impressionSent.current) return;
    impressionSent.current = true;
    api.recordAdEvent(ad.id, 'impression').catch(() => {});
  }, [ad.id]);

  function handleAdClick() {
    api.recordAdEvent(ad.id, 'click').catch(() => {});
  }

  async function handleHide() {
    if (!isAuthenticated) {
      onHidden(ad.id);
      return;
    }
    try {
      await api.reportAd(ad.id, { hideOnly: true });
      onHidden(ad.id);
    } catch {
      onHidden(ad.id);
    }
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireAuth('Sign in to report an advertisement for policy review.');
      return;
    }
    setSubmitting(true);
    try {
      await api.reportAd(ad.id, {
        reason: reportReason.trim() || 'Misleading or irrelevant advertisement',
        hideOnly: false,
      });
      setReportOpen(false);
      onHidden(ad.id);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article
      aria-label={`Sponsored post by ${ad.advertiserName}`}
      className="bg-[#121216] border border-white/[0.08] rounded-2xl overflow-hidden"
    >
      {/* Header with explicit FTC Sponsored Disclosure */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
            <span>{ad.advertiserName}</span>
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="text-amber-300 font-medium">Sponsored</span>
            <span aria-hidden="true">·</span>
            <span>{ad.policyCategory}</span>
            {ad.ageRestricted18Plus && (
              <>
                <span aria-hidden="true">·</span>
                <span>18+</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="Why this ad"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleHide}
            aria-label="Hide ad"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <EyeOff className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setReportOpen((v) => !v)}
            aria-label="Report ad"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/[0.05] transition-colors"
          >
            <Flag className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-zinc-900/90 border border-white/[0.07] text-xs text-zinc-300 space-y-1">
          <p className="font-semibold text-white">Advertising Transparency</p>
          <p className="text-zinc-400 leading-relaxed">
            This placement is labeled Sponsored in compliance with FTC advertising disclosure rules.
            Billing model: {ad.billingModel.toUpperCase()} ·{' '}
            {ad.fundingStatus === 'funded'
              ? 'Funded campaign supporting platform & eligible creator revenue pools.'
              : 'Unfunded house/review placement ($0.00 billed).'}
          </p>
        </div>
      )}

      {reportOpen && (
        <form
          onSubmit={handleSubmitReport}
          className="mx-4 mb-3 p-3 rounded-xl bg-zinc-900 border border-rose-500/25 space-y-2"
        >
          <p className="text-xs font-medium text-white">Report ad for policy review</p>
          <input
            type="text"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Reason (e.g. misleading claim, inappropriate content)"
            className="w-full h-9 px-3 bg-zinc-950 border border-white/[0.1] rounded-lg text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="h-8 px-3 rounded-lg text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-8 px-3 rounded-lg bg-rose-500 text-white text-xs font-semibold hover:bg-rose-400 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit & Hide'}
            </button>
          </div>
        </form>
      )}

      {/* Creative Media */}
      <div className="relative aspect-[16/10] bg-zinc-950 overflow-hidden">
        <img
          src={ad.mediaUrl}
          alt={ad.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Ad Copy & CTA */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-bold text-white leading-snug">{ad.title}</h3>
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{ad.body}</p>
        </div>
        <a
          href={ad.destinationUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleAdClick}
          className="h-10 px-4 rounded-xl bg-amber-500 text-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-400 transition-colors shrink-0 whitespace-nowrap"
        >
          <span>{ad.ctaLabel}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </article>
  );
}
