import React, { useEffect, useState, useMemo } from 'react';
import { validatePayPageParams, buildUpiAppLaunchUri } from '../utils/upiUtils';
import { ShieldCheck, Copy, Check, AlertCircle } from 'lucide-react';

export const PayPage: React.FC = () => {
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Inject strict no-referrer and noindex meta tags
  useEffect(() => {
    let metaReferrer = document.querySelector('meta[name="referrer"]');
    let addedReferrer = false;
    if (!metaReferrer) {
      metaReferrer = document.createElement('meta');
      metaReferrer.setAttribute('name', 'referrer');
      document.head.appendChild(metaReferrer);
      addedReferrer = true;
    }
    metaReferrer.setAttribute('content', 'no-referrer');

    let metaRobots = document.querySelector('meta[name="robots"]');
    let addedRobots = false;
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.setAttribute('name', 'robots');
      document.head.appendChild(metaRobots);
      addedRobots = true;
    }
    metaRobots.setAttribute('content', 'noindex, nofollow');

    return () => {
      if (addedReferrer && metaReferrer?.parentNode) {
        metaReferrer.parentNode.removeChild(metaReferrer);
      }
      if (addedRobots && metaRobots?.parentNode) {
        metaRobots.parentNode.removeChild(metaRobots);
      }
    };
  }, []);

  // Parse and validate query parameters: pa, pn, am, tn, tr
  const validationResult = useMemo(() => {
    if (typeof window === 'undefined') {
      return { isValid: false, error: 'Window undefined' };
    }
    const params = new URLSearchParams(window.location.search);
    return validatePayPageParams(params);
  }, []);

  const { isValid, data } = validationResult;

  const handlePayClick = () => {
    if (!data) return;
    const uri = buildUpiAppLaunchUri({
      upiId: data.upiId,
      payeeName: data.payeeName,
      amount: data.amount,
      note: data.note,
      tr: data.tr,
    });
    window.location.href = uri;
  };

  const handleCopyUpi = async () => {
    if (!data?.upiId) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(data.upiId);
      }
    } catch {
      // clipboard fallback
    } finally {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const formattedAmount = useMemo(() => {
    if (!data?.amount) return '';
    const num = parseFloat(data.amount);
    return '₹' + new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }, [data?.amount]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-[#161f30] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 overflow-hidden">
        {!isValid || !data ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Invalid Payment Link
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This payment link is not valid. Ask the academy for a new link.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Header / Payee Name */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>UPI Payment</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white pt-2 break-words">
                {data.payeeName}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 break-words">
                {data.note}
              </p>
            </div>

            {/* Prominent Amount Box */}
            <div className="bg-slate-50 dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a] rounded-xl p-5 text-center space-y-2">
              <p className="text-xs uppercase font-medium tracking-wider text-slate-500 dark:text-slate-400">
                Amount to Pay
              </p>
              <div className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">
                {formattedAmount}
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 pt-1">
                Make sure the amount in your UPI app matches {formattedAmount}.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Confirm the amount in your UPI app before paying.
              </p>
            </div>

            {/* Prominent UPI ID Verification Section */}
            <div className="space-y-2 text-center">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Check that this UPI ID is the one you know for MIX with Me Classes before you pay.
              </p>
              <div className="inline-block px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-sm font-bold text-slate-900 dark:text-slate-100 break-all select-all">
                {data.upiId}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handlePayClick}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-base shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Pay {formattedAmount} with UPI
              </button>

              <button
                type="button"
                onClick={handleCopyUpi}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:bg-slate-100 text-slate-700 dark:text-slate-200 font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-slate-400"
              >
                {copiedUpi ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>UPI ID Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy UPI ID</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 pt-1">
                If nothing opens, copy the UPI ID and pay from your UPI app.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
