import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { motion } from 'motion/react';
import { PageShell } from '../components/PageShell.js';
import { Button } from '../components/Button.js';
import { apiRequest, HttpError } from '../api.js';
import { useReducedMotion, useSpring } from '../hooks/useDelight.js';

export function LoginPage(): ReactElement {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const reduced = useReducedMotion();
  const spring = useSpring(reduced);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await apiRequest<{ sent: boolean }>('/v1/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({
          email,
          redirect_to: window.location.origin + '/auth/verify'
        })
      });
      setSent(true);
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.payload.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <PageShell blobs="landing">
        <motion.div
          className="flex flex-col items-center gap-3 px-6 pt-24 text-center"
          {...spring.enter}
        >
          <h1 className="font-heading text-3xl font-bold text-text-primary">
            Check your inbox — your place is waiting
          </h1>
          <p className="text-text-secondary">
            We sent a magic link to <strong>{email}</strong> so we can tie this memory entry to you without a password.
          </p>
          <p className="text-center text-sm text-text-muted">
            Open it on this device and we&rsquo;ll drop you back into the alpha.
          </p>
        </motion.div>
      </PageShell>
    );
  }

  return (
    <PageShell blobs="landing">
      <motion.div
        className="flex flex-col items-center pt-24 px-6 gap-8"
        {...spring.enter}
      >
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold text-text-primary">
            Save your place in the alpha
          </h1>
          <p className="mt-2 text-text-secondary text-sm">
            We use a magic link so your memory stays attached to you, not to another password.
          </p>
        </div>

        <form
          className="flex w-full flex-col gap-4"
          onSubmit={handleSubmit}
          aria-describedby={error ? 'login-error' : undefined}
        >
          <label htmlFor="email" className="text-sm font-medium text-text-primary">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'login-error' : undefined}
            className="min-h-12 w-full rounded-lg border border-border-default bg-bg-card px-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />

          {error && (
            <p id="login-error" role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <motion.span
                className="inline-block h-5 w-5 rounded-full bg-accent-contrast"
                animate={reduced ? {} : { scale: [1, 0.8, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              />
            ) : (
              'Send me the link'
            )}
          </Button>
        </form>
      </motion.div>
    </PageShell>
  );
}
