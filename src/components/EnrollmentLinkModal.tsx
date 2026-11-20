import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Select } from './Select';
import { supabase } from '../lib/supabase';
import type { EnrollmentLink } from '../types';
import { Copy, Check, Share2, AlertCircle, Link2, XCircle } from 'lucide-react';

interface EnrollmentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnrollmentLinkModal: React.FC<EnrollmentLinkModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [maxSubmissions, setMaxSubmissions] = useState<number>(5);
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Existing links
  const [links, setLinks] = useState<EnrollmentLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const fetchLinks = async () => {
    setLoadingLinks(true);
    try {
      const { data, error } = await supabase
        .from('enrollment_links')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (!error && data) {
        setLinks(data as EnrollmentLink[]);
      }
    } catch {
      // non-blocking
    } finally {
      setLoadingLinks(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setGeneratedUrl(null);
      setError(null);
      setCopied(false);
      fetchLinks();
    }
  }, [isOpen]);

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError('Authentication required to create enrollment links.');
        setIsGenerating(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-enrollment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          max_submissions: Number(maxSubmissions),
          expires_in_days: Number(expiresInDays),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to generate enrollment link.');
      } else {
        setGeneratedUrl(data.url);
        await fetchLinks();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard.');
    }
  };

  const handleRevokeLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to revoke this registration link? No more parents will be able to register through it.')) {
      return;
    }
    try {
      const { error } = await supabase
        .from('enrollment_links')
        .update({ status: 'revoked' })
        .eq('id', linkId);
      if (!error) {
        await fetchLinks();
      } else {
        alert('Failed to revoke link: ' + error.message);
      }
    } catch {
      alert('Failed to revoke link.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send Student Registration Form"
      description="Create a secure enrollment link for parents to register new students"
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Generator Controls */}
        <div className="bg-slate-50 dark:bg-[#1a2540] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Generate New Link
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Max Registrations (1–20)
              </label>
              <Select
                value={String(maxSubmissions)}
                onChange={(e) => setMaxSubmissions(Number(e.target.value))}
                options={[
                  { value: '1', label: '1 registration (Single-use)' },
                  { value: '3', label: '3 registrations' },
                  { value: '5', label: '5 registrations (Recommended)' },
                  { value: '10', label: '10 registrations' },
                  { value: '20', label: '20 registrations' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Link Expiry (1–30 days)
              </label>
              <Select
                value={String(expiresInDays)}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                options={[
                  { value: '1', label: '1 day' },
                  { value: '3', label: '3 days' },
                  { value: '7', label: '7 days (1 week)' },
                  { value: '14', label: '14 days (2 weeks)' },
                  { value: '30', label: '30 days (1 month)' },
                ]}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handleGenerateLink}
            loading={isGenerating}
            className="w-full sm:w-auto"
          >
            Generate Link
          </Button>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Generated Link Display */}
          {generatedUrl && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl space-y-2.5">
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                Registration Link Ready!
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedUrl}
                  className="flex-1 text-xs bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 rounded-lg px-2.5 py-1.5 font-mono select-all text-slate-800 dark:text-slate-200"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCopy}
                  icon={copied ? Check : Copy}
                  className="shrink-0"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Hello! Please complete student registration for our music academy using this secure link: ${generatedUrl}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shrink-0"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Recent Links History */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Active &amp; Recent Registration Links
          </h4>
          {loadingLinks ? (
            <p className="text-xs text-slate-400 py-3">Loading links...</p>
          ) : links.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No links created yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              {links.map((link) => {
                const isExpired = new Date(link.expires_at).getTime() < Date.now();
                const isFull = link.submissions_count >= link.max_submissions;
                const isRevoked = link.status === 'revoked';
                const isActive = !isExpired && !isFull && !isRevoked;

                return (
                  <div
                    key={link.id}
                    className="p-3 bg-white dark:bg-[#131c2e] flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            isActive ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {link.submissions_count} / {link.max_submissions} registrations
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : isRevoked
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {isRevoked ? 'Revoked' : isExpired ? 'Expired' : isFull ? 'Limit Reached' : 'Active'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Created {new Date(link.created_at).toLocaleDateString('en-IN')} &bull; Expires{' '}
                        {new Date(link.expires_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>

                    {isActive && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRevokeLink(link.id)}
                        className="text-xs text-rose-600 hover:text-rose-700 shrink-0"
                        icon={XCircle}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
