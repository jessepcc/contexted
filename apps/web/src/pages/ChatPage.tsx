import { motion } from 'motion/react';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, apiRequestRaw, HttpError } from '../api.js';
import { useAppContext } from '../AppContext.js';
import { getViewerIdFromToken } from '../auth.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { useReducedMotion } from '../hooks/useDelight.js';
import { usePolling } from '../polling.js';
import type { MatchResponse, MessageList } from '../types.js';

type ReportStatus = 'idle' | 'submitting' | 'submitted' | 'rate_limited';

export function ChatPage(): ReactElement {
  const { appState } = useAppContext();
  const reduced = useReducedMotion();
  const countdown = useCountdown(
    appState?.match?.chat_expires_at ?? null,
    appState?.serverNow ?? new Date().toISOString()
  );
  const [messages, setMessages] = useState<Array<{ id: string; body: string; senderId: string; createdAt?: string }>>([]);
  const cursorRef = useRef<string | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const etagRef = useRef<string | null>(null);
  const [pollInterval, setPollInterval] = useState(5000);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [reportReason, setReportReason] = useState('');
  const [reportStatus, setReportStatus] = useState<ReportStatus>('idle');

  const [match, setMatch] = useState<MatchResponse | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showReport, setShowReport] = useState(false);
  const viewerId = getViewerIdFromToken();

  const isTimeLow = countdown !== null && countdown < '01:00:00';

  const loadMatch = useCallback(async () => {
    const current = await apiRequest<MatchResponse>('/v1/matches/current');
    matchIdRef.current = current.match_id;
    setMatch(current);
  }, []);

  const loadMessages = useCallback(async () => {
    const id = matchIdRef.current;
    if (!id) {
      return;
    }

    const cursor = cursorRef.current;
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const raw = await apiRequestRaw(`/v1/matches/${id}/messages${params}`, {
      headers: {
        'If-None-Match': etagRef.current ?? '',
        'X-App-Background': document.visibilityState === 'hidden' ? '1' : '0'
      }
    });

    if (raw.status === 304) {
      return;
    }

    etagRef.current = raw.headers.get('etag');
    const response = (await raw.json()) as MessageList;
    setPollInterval(response.poll_after_ms ?? 5000);

    if (response.items.length > 0) {
      setMessages((current) => {
        const seen = new Set(current.map((m) => m.id));
        const fresh = response.items.filter((m) => !seen.has(m.id));
        return fresh.length > 0 ? [...current, ...fresh] : current;
      });
      cursorRef.current = response.next_cursor;
    }
  }, []);

  useEffect(() => {
    void loadMatch()
      .then(() => {
        if (matchIdRef.current) {
          apiRequest('/v1/matches/' + matchIdRef.current + '/read', { method: 'POST' }).catch(() => {});
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load your conversation.'));
  }, [loadMatch]);

  usePolling({
    enabled: true,
    intervalMs: pollInterval,
    backgroundIntervalMs: 30000,
    onTick: async () => {
      try {
        await loadMessages();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Failed to refresh messages.');
      }
    }
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }, [messages, reduced]);

  const send = useCallback(async () => {
    if (!matchIdRef.current || body.trim().length === 0) {
      return;
    }

    try {
      await apiRequest(`/v1/matches/${matchIdRef.current}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          client_message_id: `${Date.now()}`,
          body
        })
      });

      setBody('');
      await loadMessages();
    } catch (reason) {
      setError(reason instanceof HttpError ? reason.payload.message : 'Failed to send your message.');
    }
  }, [body, loadMessages]);

  const submitReport = useCallback(async () => {
    if (!matchIdRef.current || reportReason.trim().length === 0) return;

    const vid = getViewerIdFromToken();
    const partnerId = messages.find((m) => m.senderId !== vid)?.senderId;
    if (!partnerId) return;

    setReportStatus('submitting');
    try {
      await apiRequest('/v1/reports', {
        method: 'POST',
        body: JSON.stringify({
          match_id: matchIdRef.current,
          reported_id: partnerId,
          reason: reportReason.trim()
        })
      });
      setReportStatus('submitted');
    } catch (reason) {
      if (reason instanceof HttpError && reason.status === 429) {
        setReportStatus('rate_limited');
      } else {
        setReportStatus('idle');
        setError(reason instanceof Error ? reason.message : 'Failed to submit your report.');
      }
    }
  }, [reportReason, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const spring = { type: 'spring' as const, stiffness: 200, damping: 20 };

  const renderReportPanel = (fieldId: string): ReactElement =>
    reportStatus === 'submitted' ? (
      <p className="text-sm text-text-secondary">Report received. Thank you.</p>
    ) : reportStatus === 'rate_limited' ? (
      <p className="text-sm text-text-secondary">You&rsquo;ve hit today&rsquo;s report limit.</p>
    ) : (
      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium text-text-primary">
          Tell us where this felt off
        </label>
        <textarea
          id={fieldId}
          className="w-full rounded-2xl border border-border-default bg-bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:border-accent focus:outline-none"
          placeholder="Describe what happened..."
          value={reportReason}
          onChange={(event) => setReportReason(event.target.value)}
          rows={4}
        />
        <button
          className="self-end rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition-opacity disabled:opacity-40"
          onClick={submitReport}
          disabled={reportStatus === 'submitting' || reportReason.trim().length === 0}
          type="button"
        >
          {reportStatus === 'submitting' ? 'Submitting\u2026' : 'Send report'}
        </button>
      </div>
    );

  const sharedContextCards =
    match?.my_confession && match?.partner_confession ? (
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-bold tracking-[0.16em] text-accent-ink">WHAT YOU BOTH BROUGHT IN</span>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1 rounded-2xl bg-accent-soft p-4">
            <span className="text-[11px] font-semibold text-accent-ink">You</span>
            <p className="text-sm leading-[1.6] text-text-primary">{match.my_confession}</p>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-positive-soft p-4">
            <span className="text-[11px] font-semibold text-positive-ink">Them</span>
            <p className="text-sm leading-[1.6] text-text-primary">{match.partner_confession}</p>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <main id="main-content" className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col lg:px-6 lg:py-6">
      <div
        className="flex min-h-dvh w-full flex-col lg:min-h-[calc(100dvh-3rem)] lg:flex-row lg:overflow-hidden lg:rounded-[32px] lg:border lg:border-border-default"
        style={{ background: 'color-mix(in srgb, var(--color-bg-card) 88%, transparent)' }}
      >
        <aside
          className="hidden lg:flex lg:w-[22rem] xl:w-[25rem] lg:flex-col lg:border-r lg:border-border-default"
          style={{ background: 'color-mix(in srgb, var(--color-bg-card) 72%, var(--color-bg-elevated))' }}
        >
          <div className="border-b border-border-default px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-chatgpt) 100%)' }}
                >
                  <span className="font-heading text-sm font-bold text-accent-contrast">?</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-heading text-lg font-semibold text-text-primary">Same Chapter</span>
                  <span className="max-w-[9rem] truncate text-[11px] text-text-muted">
                    {match?.match_id ? `${match.match_id.slice(0, 4)}...${match.match_id.slice(-4)}` : '...'}
                  </span>
                </div>
              </div>

              {countdown ? (
                <div
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 ${isTimeLow ? 'bg-negative-soft' : 'bg-accent-soft'}`}
                >
                  <svg
                    className={`h-3 w-3 ${isTimeLow ? 'text-negative' : 'text-accent-ink'}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className={`text-[11px] font-semibold ${isTimeLow ? 'text-negative' : 'text-accent-ink'}`}>
                    {countdown}
                  </span>
                </div>
              ) : null}
            </div>

            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              You&rsquo;ve made it past the reveal. Now see whether the overlap holds once you start talking.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
            {sharedContextCards ? <div className="pb-6">{sharedContextCards}</div> : null}

            <div className="mt-auto flex flex-col gap-3 border-t border-border-default pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold tracking-[0.16em] text-text-muted">SAFETY</p>
                  <p className="mt-1 text-sm text-text-secondary">If anything feels off, tell us quietly and directly.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReport((prev) => !prev)}
                  className="rounded-full border border-border-default bg-bg-card px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-accent hover:text-accent-ink"
                  aria-expanded={showReport}
                >
                  {showReport ? 'Close report' : 'Report'}
                </button>
              </div>

              {showReport ? (
                <div id="chat-report-desktop" className="rounded-[24px] bg-bg-card p-4">
                  {renderReportPanel('report-reason-desktop')}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="flex min-h-dvh flex-1 flex-col lg:min-h-0">
          <div className="flex items-center justify-between border-b border-border-default bg-bg-card px-4 py-3 sm:px-6 lg:px-8 lg:py-5">
            <div className="flex items-center gap-3 lg:hidden">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-chatgpt) 100%)' }}
              >
                <span className="font-heading text-sm font-bold text-accent-contrast">?</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-heading font-semibold text-[15px] text-text-primary">Same Chapter</span>
                <span className="max-w-[120px] truncate text-[11px] text-text-muted">
                  {match?.match_id ? `${match.match_id.slice(0, 4)}...${match.match_id.slice(-4)}` : '...'}
                </span>
              </div>
            </div>

            <div className="hidden lg:flex lg:flex-col">
              <span className="text-[11px] font-bold tracking-[0.16em] text-text-muted">CONVERSATION</span>
              <span className="mt-1 font-heading text-xl font-semibold text-text-primary">Say the first real thing.</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {countdown ? (
                <div
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 ${isTimeLow ? 'bg-negative-soft' : 'bg-accent-soft'}`}
                >
                  <svg
                    className={`h-3 w-3 ${isTimeLow ? 'text-negative' : 'text-accent-ink'}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className={`text-[11px] font-semibold ${isTimeLow ? 'text-negative' : 'text-accent-ink'}`}>
                    {countdown}
                  </span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setShowReport((prev) => !prev)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-border-default bg-bg-card px-3 text-text-muted transition-colors hover:border-accent hover:text-accent-ink lg:hidden"
                aria-label="Report"
                aria-expanded={showReport}
              >
                <svg
                  className="h-[18px] w-[18px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </button>
            </div>
          </div>

          {sharedContextCards ? (
            <motion.div
              className="border-b border-border-default bg-bg-card px-4 py-4 sm:px-6 lg:hidden"
              {...(reduced
                ? {}
                : {
                    initial: { opacity: 0, y: 10 },
                    animate: { opacity: 1, y: 0 },
                    transition: spring,
                  })}
            >
              {sharedContextCards}
            </motion.div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-6"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {messages.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="max-w-md text-center text-sm leading-relaxed text-text-secondary">
                    You&rsquo;re in. Start with the overlap that felt real.
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.senderId === viewerId;
                  return (
                    <motion.div
                      key={message.id}
                      className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}
                      {...(reduced
                        ? {}
                        : {
                            initial: { opacity: 0, x: isMine ? 20 : -20 },
                            animate: { opacity: 1, x: 0 },
                            transition: spring,
                          })}
                    >
                      <div
                        className={`flex max-w-[85%] flex-col gap-1 px-3.5 py-2.5 md:max-w-[72%] xl:max-w-[42rem] ${
                          isMine
                            ? 'rounded-2xl rounded-br-md bg-accent text-accent-contrast'
                            : 'rounded-2xl rounded-bl-md bg-bg-card text-text-primary'
                        }`}
                      >
                        <span className="text-sm leading-relaxed">{message.body}</span>
                        {message.createdAt ? (
                          <span className={`text-[11px] ${isMine ? 'text-accent-contrast/70' : 'text-text-muted'}`}>
                            {formatTime(message.createdAt)}
                          </span>
                        ) : null}
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {error ? (
              <div className="px-4 py-2 sm:px-6 lg:px-8">
                <p className="text-sm text-negative" role="alert">{error}</p>
              </div>
            ) : null}

            {showReport ? (
              <div id="chat-report-mobile" className="border-t border-border-default bg-bg-card px-4 py-3 sm:px-6 lg:hidden">
                {renderReportPanel('report-reason-mobile')}
              </div>
            ) : null}

            <div className="border-t border-border-default bg-bg-card px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
              <div className="flex items-center gap-3">
                <label htmlFor="chat-message" className="sr-only">
                  Message
                </label>
                <input
                  id="chat-message"
                  type="text"
                  className="h-11 flex-1 rounded-full border border-border-default bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  placeholder="Send the first real message..."
                  aria-label="Message"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <motion.button
                  type="button"
                  onClick={send}
                  disabled={body.trim().length === 0}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast transition-opacity disabled:opacity-40"
                  aria-label="Send"
                  {...(reduced ? {} : { whileTap: { scale: 0.9, transition: { type: 'spring', stiffness: 500, damping: 15 } } })}
                >
                  <svg
                    className="h-[18px] w-[18px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </motion.button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
