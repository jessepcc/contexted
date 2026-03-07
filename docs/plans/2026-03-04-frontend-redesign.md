# Frontend Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite all frontend pages to match the Pencil design — warm cream aesthetic, Sora/Inter typography, terracotta CTA buttons, blur blob backgrounds, and rich component layouts across all 9 screens.

**Architecture:** Pure visual/JSX rewrite with Tailwind CSS v4. All business logic (API calls, state management, routing, polling) stays untouched. New shared UI components replace the current generic `<Panel>`. One new page (VibeCheckPage) added to the router between Processing and Preferences.

**Tech Stack:** Tailwind CSS v4 + `@tailwindcss/vite`, Google Fonts (Sora + Inter), React 19, TanStack Router (existing)

---

## Design Token Reference

From the Pencil design file variables (light theme values used):

| Token | Value | Usage |
|-------|-------|-------|
| `bg-deep` | `#F5F3EF` | Page background |
| `bg-elevated` | `#F0EDE8` | Elevated surfaces, countdown boxes |
| `bg-card` | `#FFFFFF` | Card backgrounds |
| `accent-red` | `#D4714E` | Primary CTA buttons, labels |
| `accent-red-soft` | `#D4714E15` | Soft background tints |
| `chatgpt-green` | `#10A37F` | ChatGPT brand elements |
| `claude-terracotta` | `#D4714E` | Claude brand elements |
| `text-primary` | `#1A1A1A` | Headings, body text |
| `text-secondary` | `#6B6B6B` | Subheadings |
| `text-muted` | `#9CA3AF` | Muted labels, placeholders |
| `border-default` | `#E8E5DF` | Default borders |
| `border-strong` | `#D5D0C8` | Strong borders |
| `purple-accent` | `#7C5CFC` | Purple accents |
| `status-positive` | `#10A37F` | Success/online indicators |

Typography: Sora (headings, bold UI), Inter (body, labels)

---

### Task 1: Install Tailwind CSS v4

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`

**Step 1: Install packages**

Run from repo root:
```bash
cd apps/web && npm install tailwindcss @tailwindcss/vite
```

**Step 2: Add Vite plugin**

Modify `apps/web/vite.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/v1': apiProxyTarget,
      '/r': apiProxyTarget,
      '/health': apiProxyTarget
    }
  },
  build: {
    target: 'es2022'
  }
});
```

**Step 3: Verify build still works**

Run: `cd apps/web && npx vite build`
Expected: Build succeeds (CSS will be processed by Tailwind now)

**Step 4: Commit**
```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/vite.config.ts
git commit -m "feat(web): add Tailwind CSS v4 with Vite plugin"
```

---

### Task 2: Design Tokens, Fonts, and Global Styles

**Files:**
- Modify: `apps/web/index.html`
- Rewrite: `apps/web/src/styles.css`

**Step 1: Add Google Fonts to index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#D4714E" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@400;600;700&display=swap" rel="stylesheet" />
    <title>Contexted</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 2: Rewrite styles.css with Tailwind + design tokens**

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-heading: "Sora", ui-sans-serif, system-ui, sans-serif;

  --color-bg-deep: #F5F3EF;
  --color-bg-elevated: #F0EDE8;
  --color-bg-card: #FFFFFF;

  --color-accent: #D4714E;
  --color-accent-soft: #D4714E15;

  --color-chatgpt: #10A37F;
  --color-claude: #D4714E;

  --color-text-primary: #1A1A1A;
  --color-text-secondary: #6B6B6B;
  --color-text-muted: #9CA3AF;

  --color-border-default: #E8E5DF;
  --color-border-strong: #D5D0C8;

  --color-purple: #7C5CFC;
  --color-purple-soft: #7C5CFC15;

  --color-positive: #10A37F;
}

body {
  @apply bg-bg-deep text-text-primary font-sans antialiased;
  min-height: 100dvh;
}

* {
  box-sizing: border-box;
}
```

**Step 3: Update main.tsx import**

The import `import './styles.css'` in `main.tsx` already exists — no change needed.

**Step 4: Verify build**

Run: `cd apps/web && npx vite build`
Expected: Build succeeds with Tailwind processing the new CSS

**Step 5: Commit**
```bash
git add apps/web/index.html apps/web/src/styles.css
git commit -m "feat(web): add design tokens, fonts, and Tailwind theme"
```

---

### Task 3: Shared UI Components

**Files:**
- Create: `apps/web/src/components/PageShell.tsx`
- Create: `apps/web/src/components/BlurBlobs.tsx`
- Create: `apps/web/src/components/Button.tsx`
- Create: `apps/web/src/components/Countdown.tsx`
- Create: `apps/web/src/components/StepHeader.tsx`
- Create: `apps/web/src/components/RadioPill.tsx`
- Modify: `apps/web/src/components/RootLayout.tsx`

**Step 1: Create BlurBlobs component**

Each page has blurred ellipses for depth. Provide preset configs.

`apps/web/src/components/BlurBlobs.tsx`:
```tsx
import type { ReactElement } from 'react';

interface Blob {
  color: string;
  width: number;
  height: number;
  x: number;
  y: number;
  blur: number;
}

const presets: Record<string, Blob[]> = {
  landing: [
    { color: '#10A37F20', width: 320, height: 320, x: -60, y: 80, blur: 90 },
    { color: '#D4714E18', width: 280, height: 280, x: 180, y: 350, blur: 90 },
    { color: '#7C5CFC12', width: 200, height: 200, x: 50, y: 700, blur: 70 },
  ],
  upload: [
    { color: '#10A37F18', width: 300, height: 300, x: -50, y: 120, blur: 85 },
    { color: '#D4714E15', width: 260, height: 260, x: 160, y: 500, blur: 85 },
  ],
  processing: [
    { color: '#D4714E15', width: 350, height: 350, x: 30, y: 100, blur: 100 },
    { color: '#10A37F15', width: 250, height: 250, x: -40, y: 400, blur: 80 },
  ],
  vibeCheck: [
    { color: '#7C5CFC15', width: 280, height: 280, x: -80, y: 60, blur: 90 },
    { color: '#D4714E12', width: 300, height: 300, x: 150, y: 400, blur: 90 },
  ],
  preferences: [
    { color: '#10A37F15', width: 280, height: 280, x: 150, y: 50, blur: 85 },
    { color: '#D4714E12', width: 250, height: 250, x: -60, y: 300, blur: 85 },
  ],
  waiting: [
    { color: '#7C5CFC12', width: 320, height: 320, x: -70, y: 80, blur: 90 },
    { color: '#10A37F15', width: 280, height: 280, x: 180, y: 350, blur: 85 },
  ],
  reveal: [
    { color: '#D4714E15', width: 300, height: 300, x: -60, y: 100, blur: 90 },
    { color: '#10A37F12', width: 260, height: 260, x: 160, y: 450, blur: 85 },
  ],
  expired: [
    { color: '#D4714E15', width: 300, height: 300, x: 100, y: 80, blur: 90 },
    { color: '#7C5CFC12', width: 280, height: 280, x: -50, y: 500, blur: 85 },
  ],
};

export function BlurBlobs({ variant }: { variant: keyof typeof presets }): ReactElement {
  const blobs = presets[variant] ?? presets.landing;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            background: b.color,
            width: b.width,
            height: b.height,
            left: b.x,
            top: b.y,
            filter: `blur(${b.blur}px)`,
          }}
        />
      ))}
    </div>
  );
}

export type BlobVariant = keyof typeof presets;
```

**Step 2: Create PageShell component**

`apps/web/src/components/PageShell.tsx`:
```tsx
import type { ReactElement, ReactNode } from 'react';
import { BlurBlobs } from './BlurBlobs.js';
import type { BlobVariant } from './BlurBlobs.js';

export function PageShell({
  children,
  blobs,
}: {
  children: ReactNode;
  blobs: BlobVariant;
}): ReactElement {
  return (
    <div className="relative min-h-dvh w-full max-w-[402px] mx-auto overflow-hidden">
      <BlurBlobs variant={blobs} />
      <div className="relative z-10 flex flex-col">{children}</div>
    </div>
  );
}
```

**Step 3: Create Button components**

`apps/web/src/components/Button.tsx`:
```tsx
import type { ButtonHTMLAttributes, ReactElement } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'chatgpt' | 'claude';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white',
  secondary: 'bg-transparent border-[1.5px] border-border-strong text-text-primary',
  chatgpt: 'bg-chatgpt text-white',
  claude: 'bg-claude text-white',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }): ReactElement {
  return (
    <button
      className={`flex items-center justify-center rounded-lg px-8 py-4 font-heading text-base font-semibold transition-opacity disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

**Step 4: Create Countdown component**

`apps/web/src/components/Countdown.tsx`:
```tsx
import type { ReactElement } from 'react';

interface CountdownProps {
  days: string;
  hours: string;
  minutes: string;
  label?: string;
}

function TimeBox({ value, unit }: { value: string; unit: string }): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-md bg-bg-elevated w-12 h-[52px]">
      <span className="font-heading text-[22px] font-bold text-text-primary">{value}</span>
      <span className="text-[8px] font-bold tracking-widest text-text-muted">{unit}</span>
    </div>
  );
}

export function Countdown({ days, hours, minutes, label = 'NEXT DROP' }: CountdownProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[11px] font-bold tracking-[2px] text-accent">{label}</span>
      <div className="flex items-center gap-2">
        <TimeBox value={days} unit="DAYS" />
        <span className="font-heading text-xl font-bold text-text-muted">:</span>
        <TimeBox value={hours} unit="HRS" />
        <span className="font-heading text-xl font-bold text-text-muted">:</span>
        <TimeBox value={minutes} unit="MIN" />
      </div>
    </div>
  );
}
```

**Step 5: Create StepHeader component**

`apps/web/src/components/StepHeader.tsx`:
```tsx
import type { ReactElement } from 'react';

export function StepHeader({
  step,
  totalSteps,
  onBack,
}: {
  step: number;
  totalSteps: number;
  onBack: () => void;
}): ReactElement {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-text-primary text-sm">
        <span className="text-lg">&lsaquo;</span> Back
      </button>
      <span className="text-xs font-medium text-text-muted">
        Step {step} of {totalSteps}
      </span>
    </div>
  );
}
```

**Step 6: Create RadioPill component**

`apps/web/src/components/RadioPill.tsx`:
```tsx
import type { ReactElement } from 'react';

export function RadioPill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-5 py-3 text-[15px] font-medium transition-colors ${
        selected
          ? 'border-accent bg-accent text-white'
          : 'border-border-default bg-bg-card text-text-primary'
      }`}
    >
      {label}
    </button>
  );
}
```

**Step 7: Update RootLayout**

Remove the old topbar/brand. The new design has no persistent header — each page manages its own layout.

`apps/web/src/components/RootLayout.tsx`:
```tsx
import { Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import type { ReactElement } from 'react';

export function RootLayout(): ReactElement {
  const navigate = useNavigate();

  useEffect(() => {
    function handleUnauthorized() {
      void navigate({ to: '/auth/login' });
    }
    window.addEventListener('contexted:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('contexted:unauthorized', handleUnauthorized);
    };
  }, [navigate]);

  return <Outlet />;
}
```

**Step 8: Verify typecheck passes**

Run: `cd /Users/jessechow/development/contexted && npm run typecheck`
Expected: Passes (new components don't break anything since nothing uses them yet)

**Step 9: Commit**
```bash
git add apps/web/src/components/
git commit -m "feat(web): add shared UI components for redesign"
```

---

### Task 4: Landing Page

**Files:**
- Rewrite: `apps/web/src/pages/LandingPage.tsx`

The landing page is the most visually rich screen: logo, headline, ChatGPT/Claude brain buttons, countdown timer, live counter badge, and a "How It Works" section with 4 steps.

**Step 1: Rewrite LandingPage.tsx**

```tsx
import type { ReactElement } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PageShell } from '../components/PageShell.js';
import { Button } from '../components/Button.js';
import { Countdown } from '../components/Countdown.js';

const steps = [
  { num: '01', title: 'Upload your memory', desc: 'Export from ChatGPT or Claude', color: 'text-accent' },
  { num: '02', title: 'Get your Vibe Check', desc: 'AI-generated personality card', color: 'text-accent' },
  { num: '03', title: 'Wait for the Drop', desc: 'Matches happen on schedule, not on demand', color: 'text-accent' },
  { num: '04', title: 'Confess & Connect', desc: 'Exchange vulnerable answers to unlock chat', color: 'text-accent' },
];

export function LandingPage(): ReactElement {
  const navigate = useNavigate();

  return (
    <PageShell blobs="landing">
      {/* Hero */}
      <div className="flex flex-col items-center gap-6 px-6 pt-10 pb-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-chatgpt to-claude" />
          <span className="font-heading text-[22px] font-bold tracking-tight text-text-primary">
            context
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-heading text-[34px] font-bold leading-[1.05] tracking-[-1.5px] text-text-primary text-center">
          Dating based on{'\n'}your AI's memory{'\n'}of you.
        </h1>
        <p className="text-base text-text-secondary text-center">
          Zero swiping. Pure latent compatibility.
        </p>

        {/* Brain buttons */}
        <span className="text-[11px] font-bold tracking-[2px] text-accent">PICK YOUR BRAIN</span>
        <div className="flex gap-3 w-full">
          <Button
            variant="chatgpt"
            className="flex-1 flex-col gap-1 !py-5"
            onClick={() => navigate({ to: '/auth/login' })}
          >
            <span className="text-base font-semibold">ChatGPT</span>
            <span className="text-base font-semibold">Brain</span>
          </Button>
          <Button
            variant="claude"
            className="flex-1 flex-col gap-1 !py-5"
            onClick={() => navigate({ to: '/auth/login' })}
          >
            <span className="text-base font-semibold">Claude</span>
            <span className="text-base font-semibold">Brain</span>
          </Button>
        </div>
      </div>

      {/* Bottom section */}
      <div className="flex flex-col items-center gap-5 px-6 pt-6 pb-10">
        <div className="h-0.5 w-10 bg-accent" />

        <Countdown days="02" hours="14" minutes="37" />

        {/* Live counter badge */}
        <div className="flex items-center gap-2 rounded-full border border-border-default bg-bg-card px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-positive" />
          <span className="text-[13px] font-medium text-text-secondary">
            47,382 minds in the queue
          </span>
        </div>

        {/* How it works */}
        <span className="text-[11px] font-bold tracking-[2px] text-text-muted">HOW IT WORKS</span>
        <div className="flex flex-col gap-4 w-full">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-3">
              <span className={`text-sm font-bold ${s.color}`}>{s.num}</span>
              <div>
                <p className="text-sm font-semibold text-text-primary">{s.title}</p>
                <p className="text-xs text-text-secondary">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
```

**Step 2: Verify typecheck**

Run: `npm run typecheck`

**Step 3: Commit**
```bash
git add apps/web/src/pages/LandingPage.tsx
git commit -m "feat(web): redesign Landing Page to match Pencil design"
```

---

### Task 5: Login + Verify Pages

**Files:**
- Rewrite: `apps/web/src/pages/LoginPage.tsx`
- Rewrite: `apps/web/src/pages/VerifyPage.tsx`

These pages don't have explicit Pencil screens but should use the new design system.

**Step 1: Rewrite LoginPage.tsx**

```tsx
import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { apiRequest, HttpError } from '../api.js';
import { PageShell } from '../components/PageShell.js';
import { Button } from '../components/Button.js';

export function LoginPage(): ReactElement {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        <div className="flex flex-col items-center gap-6 px-6 pt-24">
          <h1 className="font-heading text-3xl font-bold text-text-primary text-center">
            Check your email
          </h1>
          <p className="text-base text-text-secondary text-center">
            We sent a magic link to <strong className="text-text-primary">{email}</strong>.
          </p>
          <p className="text-sm text-text-muted text-center">
            Click the link in the email to sign in.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell blobs="landing">
      <div className="flex flex-col gap-8 px-6 pt-24">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold text-text-primary">Sign in</h1>
          <p className="text-sm text-text-secondary">Enter your email to receive a magic link.</p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-xs font-medium text-text-secondary">
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
              className="h-12 rounded-lg border border-border-default bg-bg-card px-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Sending...' : 'Send Magic Link'}
          </Button>
        </form>
      </div>
    </PageShell>
  );
}
```

**Step 2: Rewrite VerifyPage.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PageShell } from '../components/PageShell.js';

export function parseHashToken(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get('access_token');
}

export function VerifyPage(): ReactElement {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = parseHashToken(window.location.hash);
    if (token) {
      localStorage.setItem('contexted_token', token);
      void navigate({ to: '/app' });
    } else {
      setError('No access token found. Please request a new magic link.');
    }
  }, [navigate]);

  return (
    <PageShell blobs="landing">
      <div className="flex flex-col items-center gap-6 px-6 pt-24">
        {error ? (
          <>
            <h1 className="font-heading text-3xl font-bold text-text-primary">Verification Failed</h1>
            <p role="alert" className="text-sm text-red-500">{error}</p>
            <a href="/auth/login" className="text-sm font-semibold text-accent underline">
              Try Again
            </a>
          </>
        ) : (
          <>
            <h1 className="font-heading text-3xl font-bold text-text-primary">Verifying...</h1>
            <p className="text-sm text-text-secondary">Completing sign-in...</p>
          </>
        )}
      </div>
    </PageShell>
  );
}
```

**Step 3: Verify typecheck + tests**

Run: `npm run typecheck && cd apps/web && npx vitest run`
Expected: All pass (VerifyPage exports parseHashToken which is tested in auth.test.tsx)

**Step 4: Commit**
```bash
git add apps/web/src/pages/LoginPage.tsx apps/web/src/pages/VerifyPage.tsx
git commit -m "feat(web): redesign Login and Verify pages"
```

---

### Task 6: Upload Page

**Files:**
- Rewrite: `apps/web/src/pages/UploadPage.tsx`

Design: Step header (Step 1 of 3), drag-drop zone, paste textarea, tutorial section with ChatGPT/Claude export instructions, privacy note. All existing upload logic stays.

**Step 1: Rewrite UploadPage.tsx**

```tsx
import { useNavigate } from '@tanstack/react-router';
import type { DragEvent, FormEvent, ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';
import { apiRequest, HttpError } from '../api.js';
import { PageShell } from '../components/PageShell.js';
import { StepHeader } from '../components/StepHeader.js';
import { Button } from '../components/Button.js';

interface InitResponse {
  ingestion_id: string;
  upload_url: string;
  upload_headers: Record<string, string>;
  expires_at: string;
  max_bytes: number;
}

interface CompleteResponse {
  job_id: string;
}

async function computeSha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function xhrPut(
  url: string,
  headers: Record<string, string>,
  body: File,
  onProgress: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded / e.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(body);
  });
}

export function UploadPage(): ReactElement {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<'chatgpt' | 'claude' | 'both'>('chatgpt');
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File | undefined) => {
    if (f) {
      setFile(f);
      setError(null);
      setProgress(0);
    }
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!file) return;

      setBusy(true);
      setError(null);
      setProgress(0);

      try {
        const sha256 = await computeSha256(file);

        const init = await apiRequest<InitResponse>('/v1/uploads/init', {
          method: 'POST',
          body: JSON.stringify({
            source,
            file_name: file.name,
            file_size: file.size,
            sha256
          })
        });

        await xhrPut(init.upload_url, init.upload_headers, file, setProgress);

        const complete = await apiRequest<CompleteResponse>('/v1/uploads/complete', {
          method: 'POST',
          headers: {
            'Idempotency-Key': `upload-${init.ingestion_id}`
          },
          body: JSON.stringify({
            ingestion_id: init.ingestion_id
          })
        });

        navigate({ to: '/app/processing', search: { jobId: complete.job_id } });
      } catch (reason) {
        setError(
          reason instanceof HttpError
            ? reason.payload.message
            : reason instanceof Error
              ? reason.message
              : 'Upload failed.'
        );
      } finally {
        setBusy(false);
      }
    },
    [file, navigate, source]
  );

  const pct = Math.round(progress * 100);

  return (
    <PageShell blobs="upload">
      <StepHeader step={1} totalSteps={3} onBack={() => navigate({ to: '/' })} />

      <form className="flex flex-col gap-8 px-6 pb-10" onSubmit={onSubmit}>
        {/* Title */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-heading text-[28px] font-bold text-text-primary">
            Upload Your Memory
          </h1>
          <p className="text-sm text-text-secondary text-center">
            Your raw data is processed &amp; destroyed within 5 minutes. We literally can't sell it.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed bg-bg-card h-[180px] transition-colors ${
            dragOver ? 'border-accent bg-accent-soft' : 'border-border-strong'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.txt"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {file ? (
            <p className="text-sm font-medium text-text-primary">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          ) : (
            <>
              <svg className="h-10 w-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-sm font-semibold text-text-primary">Drag & drop your memory file</p>
              <p className="text-xs text-text-muted">.json or .txt — max 10MB</p>
              <button
                type="button"
                className="rounded-full border border-border-strong px-4 py-1.5 text-xs font-medium text-text-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse files
              </button>
            </>
          )}
        </div>

        {/* Or paste */}
        <p className="text-center text-xs text-text-muted">— or paste your memory text —</p>
        <textarea
          className="h-[100px] rounded-lg border border-border-default bg-bg-card p-4 text-sm text-text-primary placeholder:text-text-muted outline-none resize-none focus:border-accent"
          placeholder="Paste your ChatGPT/Claude memory export here..."
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />

        {/* Tutorial */}
        <div className="flex flex-col gap-4">
          <span className="text-[11px] font-bold tracking-[2px] text-text-muted">HOW TO EXPORT</span>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-5 w-5 rounded-full bg-chatgpt" />
            <div>
              <p className="text-sm font-semibold text-text-primary">From ChatGPT</p>
              <p className="text-xs text-chatgpt">Settings &rarr; Personalization &rarr; Memory &rarr; Export</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-5 w-5 rounded-full bg-claude" />
            <div>
              <p className="text-sm font-semibold text-text-primary">From Claude</p>
              <p className="text-xs text-claude">Visit claude.ai/export-memory &rarr; Download</p>
            </div>
          </div>
        </div>

        {/* Privacy note */}
        <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p className="text-xs text-text-secondary">
            Your raw file is deleted within 5 minutes. Only your vibe embedding is kept.
          </p>
        </div>

        {/* Progress bar */}
        {busy && (
          <div className="h-1.5 w-full rounded-full bg-bg-elevated overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-150"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        )}

        {/* Submit */}
        <Button type="submit" disabled={busy || !file} className="w-full">
          {busy ? `Uploading ${pct}%...` : 'Start Ingestion'}
        </Button>

        {error ? <p role="alert" className="text-sm text-red-500 text-center">{error}</p> : null}
      </form>
    </PageShell>
  );
}
```

**Step 2: Verify typecheck**

Run: `npm run typecheck`

**Step 3: Commit**
```bash
git add apps/web/src/pages/UploadPage.tsx
git commit -m "feat(web): redesign Upload Page to match Pencil design"
```

---

### Task 7: Processing Page

**Files:**
- Rewrite: `apps/web/src/pages/ProcessingPage.tsx`

Design: Animated ring, "Generating your Vibe Check..." headline, progress bar with percentage, privacy timeline checklist (PII scrubbed, profile generated, embedding computed, raw file destroyed).

**Step 1: Rewrite ProcessingPage.tsx**

```tsx
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { apiRequest } from '../api.js';
import { PageShell } from '../components/PageShell.js';
import { usePolling } from '../polling.js';

const timelineSteps = [
  { label: 'PII scrubbed from memory', key: 'scrubbed' },
  { label: 'Personality profile generated', key: 'profile' },
  { label: 'Embedding vector computed...', key: 'embedding' },
  { label: 'Raw file destroyed', key: 'destroyed' },
];

function getCompletedSteps(progress: number): number {
  if (progress >= 100) return 4;
  if (progress >= 75) return 3;
  if (progress >= 50) return 2;
  if (progress >= 25) return 1;
  return 0;
}

export function ProcessingPage(): ReactElement {
  const navigate = useNavigate();
  const { jobId } = useSearch({ from: '/app/processing' });
  const [job, setJob] = useState<{ state: string; progress: number; poll_after_ms?: number } | null>(null);
  const [pollInterval, setPollInterval] = useState(2000);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) {
      setError('No job id found.');
      return;
    }

    const response = await apiRequest<{ state: string; progress: number; poll_after_ms?: number }>('/v1/ingest/jobs/' + jobId);
    setJob(response);
    setPollInterval(response.poll_after_ms ?? 2000);

    if (response.state === 'succeeded') {
      navigate({ to: '/app/preferences' });
    }
  }, [jobId, navigate]);

  usePolling({
    enabled: Boolean(jobId),
    intervalMs: pollInterval,
    backgroundIntervalMs: 30000,
    onTick: async () => {
      try {
        await fetchJob();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Failed to poll ingestion job.');
      }
    }
  });

  const progress = job?.progress ?? 0;
  const completedSteps = getCompletedSteps(progress);

  return (
    <PageShell blobs="processing">
      <div className="flex flex-col items-center gap-10 px-6 pt-20 pb-10">
        {/* Animated ring */}
        <div className="relative h-[120px] w-[120px]">
          <div className="absolute inset-0 rounded-full border-4 border-accent/30" />
          <div
            className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin"
            style={{ animationDuration: '2s' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="h-10 w-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-3 w-full">
          <h1 className="font-heading text-[28px] font-bold text-text-primary text-center leading-tight">
            Generating your{'\n'}Vibe Check...
          </h1>
          <p className="text-sm text-text-secondary" aria-live="polite">
            This usually takes 30-60 seconds
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full flex flex-col items-center gap-2">
          <div className="h-1.5 w-full rounded-full bg-bg-elevated overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-heading text-base font-bold text-text-primary">{progress}%</span>
        </div>

        {/* Privacy timeline */}
        <div className="flex flex-col gap-4 w-full">
          {timelineSteps.map((step, i) => {
            const done = i < completedSteps;
            const active = i === completedSteps;
            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${done ? 'bg-positive' : active ? 'bg-accent' : 'bg-border-default'}`} />
                <span className={`text-sm ${done ? 'text-text-primary' : 'text-text-muted'}`}>
                  {step.label}
                </span>
                {done && <span className="text-positive ml-auto">&#10003;</span>}
              </div>
            );
          })}
        </div>

        {error ? <p role="alert" className="text-sm text-red-500">{error}</p> : null}
      </div>
    </PageShell>
  );
}
```

**Step 2: Verify typecheck**

Run: `npm run typecheck`

**Step 3: Commit**
```bash
git add apps/web/src/pages/ProcessingPage.tsx
git commit -m "feat(web): redesign Processing Page to match Pencil design"
```

---

### Task 8: Preferences Page

**Files:**
- Rewrite: `apps/web/src/pages/PreferencesPage.tsx`

Design: Step header (Step 2 of 3), "Quick Preferences" title, radio pill groups for identity/attraction, age range inputs, "Enter the Queue" button.

**Step 1: Rewrite PreferencesPage.tsx**

```tsx
import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { apiRequest, HttpError } from '../api.js';
import { PageShell } from '../components/PageShell.js';
import { StepHeader } from '../components/StepHeader.js';
import { RadioPill } from '../components/RadioPill.js';
import { Button } from '../components/Button.js';

const genderOptions = [
  { value: 'M' as const, label: 'Male' },
  { value: 'F' as const, label: 'Female' },
  { value: 'NB' as const, label: 'NB' },
];

const attractedOptions = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'NB', label: 'NB' },
  { value: 'ANY', label: 'Any' },
];

export function PreferencesPage(): ReactElement {
  const navigate = useNavigate();
  const [genderIdentity, setGenderIdentity] = useState<'M' | 'F' | 'NB'>('M');
  const [attractedTo, setAttractedTo] = useState<Set<string>>(new Set(['F']));
  const [ageMin, setAgeMin] = useState(22);
  const [ageMax, setAgeMax] = useState(35);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAttracted = useCallback((value: string) => {
    if (value === 'ANY') {
      setAttractedTo(new Set(['M', 'F', 'NB']));
      return;
    }
    setAttractedTo((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        if (next.size > 1) next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }, []);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBusy(true);
      setError(null);

      try {
        await apiRequest('/v1/preferences', {
          method: 'POST',
          body: JSON.stringify({
            gender_identity: genderIdentity,
            attracted_to: [...attractedTo],
            age_min: ageMin,
            age_max: ageMax
          })
        });

        await apiRequest('/v1/waitlist/enroll', {
          method: 'POST',
          body: JSON.stringify({})
        });

        navigate({ to: '/app/waiting' });
      } catch (reason) {
        setError(reason instanceof HttpError ? reason.payload.message : 'Failed to save preferences.');
      } finally {
        setBusy(false);
      }
    },
    [ageMax, ageMin, attractedTo, genderIdentity, navigate]
  );

  return (
    <PageShell blobs="preferences">
      <StepHeader step={2} totalSteps={3} onBack={() => navigate({ to: '/app/upload' })} />

      <form className="flex flex-col gap-8 px-6 pt-6 pb-10" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-[28px] font-bold text-text-primary">Quick Preferences</h1>
          <p className="text-sm text-text-secondary">Safety gate, not a feature. This takes 10 seconds.</p>
        </div>

        {/* Identity */}
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-bold tracking-[2px] text-text-muted">I IDENTIFY AS</span>
          <div className="flex gap-3">
            {genderOptions.map((g) => (
              <RadioPill
                key={g.value}
                label={g.label}
                selected={genderIdentity === g.value}
                onClick={() => setGenderIdentity(g.value)}
              />
            ))}
          </div>
        </div>

        {/* Attracted to */}
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-bold tracking-[2px] text-text-muted">INTERESTED IN</span>
          <div className="flex gap-3">
            {attractedOptions.map((g) => (
              <RadioPill
                key={g.value}
                label={g.label}
                selected={g.value === 'ANY' ? attractedTo.size === 3 : attractedTo.has(g.value)}
                onClick={() => toggleAttracted(g.value)}
              />
            ))}
          </div>
        </div>

        {/* Age range */}
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-bold tracking-[2px] text-text-muted">AGE RANGE</span>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min={18}
              max={99}
              value={ageMin}
              onChange={(e) => setAgeMin(Number.parseInt(e.target.value, 10) || 18)}
              className="h-12 w-20 rounded-lg border border-border-default bg-bg-card px-3 text-center font-heading text-lg font-bold text-text-primary outline-none focus:border-accent"
            />
            <span className="text-sm text-text-muted">to</span>
            <input
              type="number"
              min={18}
              max={99}
              value={ageMax}
              onChange={(e) => setAgeMax(Number.parseInt(e.target.value, 10) || 40)}
              className="h-12 w-20 rounded-lg border border-border-default bg-bg-card px-3 text-center font-heading text-lg font-bold text-text-primary outline-none focus:border-accent"
            />
          </div>
        </div>

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Saving...' : 'Enter the Queue'}
        </Button>

        {error ? <p role="alert" className="text-sm text-red-500 text-center">{error}</p> : null}
      </form>
    </PageShell>
  );
}
```

**Step 2: Verify typecheck**

Run: `npm run typecheck`

**Step 3: Commit**
```bash
git add apps/web/src/pages/PreferencesPage.tsx
git commit -m "feat(web): redesign Preferences Page to match Pencil design"
```

---

### Task 9: Waiting Page

**Files:**
- Rewrite: `apps/web/src/pages/WaitingPage.tsx`

Design: "You're in the queue" headline, live counter, countdown, pool position stat card, vibe of the day quote, friend compatibility upsell.

**Step 1: Rewrite WaitingPage.tsx**

```tsx
import type { ReactElement } from 'react';
import { PageShell } from '../components/PageShell.js';
import { Countdown } from '../components/Countdown.js';

export function WaitingPage(): ReactElement {
  return (
    <PageShell blobs="waiting">
      <div className="flex flex-col gap-6 px-6 pt-6 pb-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <h1 className="font-heading text-[32px] font-bold text-text-primary text-center">
            You're in the queue
          </h1>

          {/* Live counter */}
          <div className="flex items-center gap-2 rounded-full border border-border-default bg-bg-card px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-positive" />
            <span className="text-[13px] font-medium text-text-secondary">
              47,382 minds in the queue
            </span>
          </div>

          <Countdown days="02" hours="14" minutes="37" />
        </div>

        {/* Pool position stat */}
        <div className="flex flex-col items-center gap-4 rounded-xl bg-gradient-to-b from-[#EEEAFC] to-[#F5F3FF] border border-[#D5D0E8] p-5">
          <span className="text-[11px] font-bold tracking-[2px] text-text-muted">YOUR POOL POSITION</span>
          <p className="font-heading text-[22px] font-bold text-text-primary text-center leading-tight">
            More chaotic than 87% of the pool
          </p>
          <button className="flex items-center gap-2 rounded-full bg-purple text-white px-4 py-2 text-xs font-semibold">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share stat
          </button>
        </div>

        {/* Vibe of the day */}
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-bold tracking-[2px] text-text-muted">VIBE CHECK OF THE DAY</span>
          <div className="rounded-xl border border-border-default bg-bg-card p-4">
            <p className="text-sm italic text-text-secondary leading-relaxed">
              "An aspiring poet trapped in a data analyst's body who uses AI to proofread therapy journal entries and generate Spotify playlists for cats."
            </p>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-claude" />
                <span className="text-xs text-text-muted">Claude Brain</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-text-muted">
                <span>&hearts;</span> 342
              </div>
            </div>
          </div>
        </div>

        {/* Friend upsell */}
        <div className="flex items-center gap-3 rounded-xl border border-chatgpt bg-bg-card p-4">
          <div className="flex flex-col gap-1 flex-1">
            <p className="text-sm font-semibold text-text-primary">Friend Compatibility</p>
            <p className="text-xs text-text-secondary">Upload a friend's memory. Get a compatibility breakdown.</p>
          </div>
          <span className="text-sm font-bold text-chatgpt">$4.99</span>
        </div>
      </div>
    </PageShell>
  );
}
```

**Step 2: Verify typecheck**

Run: `npm run typecheck`

**Step 3: Commit**
```bash
git add apps/web/src/pages/WaitingPage.tsx
git commit -m "feat(web): redesign Waiting Page to match Pencil design"
```

---

### Task 10: Match Reveal Page (formerly RevealPage)

**Files:**
- Rewrite: `apps/web/src/pages/RevealPage.tsx`

Design: "It's a match." headline, deadline countdown bar, synergy points with quote marks, confession prompt card with textarea, "Submit Confession" button.

**Step 1: Rewrite RevealPage.tsx**

```tsx
import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, HttpError } from '../api.js';
import { useAppContext } from '../AppContext.js';
import { PageShell } from '../components/PageShell.js';
import { Button } from '../components/Button.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { usePolling } from '../polling.js';
import type { MatchResponse } from '../types.js';

export function RevealPage(): ReactElement {
  const navigate = useNavigate();
  const { appState } = useAppContext();
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [pollInterval, setPollInterval] = useState(5000);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const countdown = useCountdown(
    match?.deadline_at ?? appState?.match?.deadline_at ?? null,
    appState?.serverNow ?? new Date().toISOString()
  );

  const load = useCallback(async () => {
    const current = await apiRequest<MatchResponse>('/v1/matches/current');
    setMatch(current);
    setPollInterval(current.poll_after_ms ?? 5000);
    if (current.state === 'unlocked') {
      navigate({ to: '/app/chat' });
    }
  }, [navigate]);

  useEffect(() => {
    void load().catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load reveal.'));
  }, [load]);

  usePolling({
    enabled: true,
    intervalMs: pollInterval,
    backgroundIntervalMs: 30000,
    onTick: async () => {
      await load();
    }
  });

  const submit = useCallback(async () => {
    if (!match?.match_id) {
      return;
    }

    try {
      await apiRequest<{ state: string; version: number }>(`/v1/matches/${match.match_id}/confession`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': `confession-${Date.now()}`
        },
        body: JSON.stringify({ answer, expected_version: match.version })
      });
      setAnswer('');
      await load();
    } catch (reason) {
      setError(reason instanceof HttpError ? reason.payload.message : 'Failed to submit confession.');
    }
  }, [answer, load, match?.match_id, match?.version]);

  return (
    <PageShell blobs="reveal">
      <div className="flex flex-col gap-6 px-6 pt-6 pb-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-heading text-[32px] font-bold text-text-primary">It's a match.</h1>
          <p className="text-sm text-text-secondary">Here's why our AI paired you</p>
        </div>

        {/* Deadline bar */}
        {countdown && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-accent-soft px-4 py-2.5">
            <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="text-sm font-medium text-accent">{countdown} remaining to respond</span>
          </div>
        )}

        {/* Synergy points */}
        {match?.synergy_points?.length ? (
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-bold tracking-[2px] text-accent">SYNERGY POINTS</span>
            <div className="flex flex-col gap-3">
              {match.synergy_points.map((point, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-lg text-accent/60 leading-none">&ldquo;</span>
                  <p className="text-sm text-text-primary leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted text-center">No active match yet.</p>
        )}

        {/* Confession prompt */}
        {match?.confession_prompt && (
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-bold tracking-[2px] text-accent">CONFESSION PROMPT</span>
            <div className="rounded-xl border border-border-default bg-bg-card p-5">
              <p className="font-heading text-lg font-bold text-text-primary leading-snug">
                {match.confession_prompt}
              </p>
              <p className="text-xs text-text-muted mt-2">
                Both of you answer. Answers revealed simultaneously.
              </p>
              <textarea
                className="mt-4 w-full h-20 rounded-lg border border-border-default bg-bg-deep p-3 text-sm text-text-primary placeholder:text-text-muted outline-none resize-none focus:border-accent"
                placeholder="Type your confession..."
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
              />
            </div>
          </div>
        )}

        <Button onClick={submit} className="w-full" type="button">
          Submit Confession
        </Button>

        {error ? <p role="alert" className="text-sm text-red-500 text-center">{error}</p> : null}
      </div>
    </PageShell>
  );
}
```

**Step 2: Verify typecheck**

Run: `npm run typecheck`

**Step 3: Commit**
```bash
git add apps/web/src/pages/RevealPage.tsx
git commit -m "feat(web): redesign Match Reveal Page to match Pencil design"
```

---

### Task 11: Chat Page

**Files:**
- Rewrite: `apps/web/src/pages/ChatPage.tsx`

Design: Header with avatar + "Anonymous Match" + timer + flag button, confession reveal section, chat message bubbles (left = theirs, right = mine in accent color), input bar with send button.

**Step 1: Rewrite ChatPage.tsx**

```tsx
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, apiRequestRaw, HttpError } from '../api.js';
import { useAppContext } from '../AppContext.js';
import { getViewerIdFromToken } from '../auth.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { usePolling } from '../polling.js';
import type { MatchResponse, MessageList } from '../types.js';

type ReportStatus = 'idle' | 'submitting' | 'submitted' | 'rate_limited';

export function ChatPage(): ReactElement {
  const { appState } = useAppContext();
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
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [reportReason, setReportReason] = useState('');
  const [reportStatus, setReportStatus] = useState<ReportStatus>('idle');
  const [showReport, setShowReport] = useState(false);

  const viewerId = getViewerIdFromToken();

  const loadMatch = useCallback(async () => {
    const current = await apiRequest<MatchResponse>('/v1/matches/current');
    matchIdRef.current = current.match_id;
    setMatch(current);
  }, []);

  const loadMessages = useCallback(async () => {
    const id = matchIdRef.current;
    if (!id) return;

    const cursor = cursorRef.current;
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const raw = await apiRequestRaw(`/v1/matches/${id}/messages${params}`, {
      headers: {
        'If-None-Match': etagRef.current ?? '',
        'X-App-Background': document.visibilityState === 'hidden' ? '1' : '0'
      }
    });

    if (raw.status === 304) return;

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
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load match.'));
  }, [loadMatch]);

  usePolling({
    enabled: true,
    intervalMs: pollInterval,
    backgroundIntervalMs: 30000,
    onTick: async () => {
      try {
        await loadMessages();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Failed to poll messages.');
      }
    }
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async () => {
    if (!matchIdRef.current || body.trim().length === 0) return;

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
      setError(reason instanceof HttpError ? reason.payload.message : 'Failed to send message.');
    }
  }, [body, loadMessages]);

  const submitReport = useCallback(async () => {
    if (!matchIdRef.current || reportReason.trim().length === 0) return;

    const partnerId = messages.find((m) => m.senderId !== viewerId)?.senderId;
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
        setError(reason instanceof Error ? reason.message : 'Failed to submit report.');
      }
    }
  }, [reportReason, messages, viewerId]);

  return (
    <div className="flex flex-col h-dvh max-w-[402px] mx-auto bg-bg-deep">
      {/* Header */}
      <div className="flex items-center justify-between bg-bg-card border-b border-border-default px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-bg-elevated flex items-center justify-center text-lg">?</div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Anonymous Match</p>
            <p className="text-xs text-text-muted">{match?.match_id?.slice(0, 4)}...{match?.match_id?.slice(-4)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {countdown && (
            <span className="flex items-center gap-1 text-xs text-accent">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {countdown}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowReport(!showReport)}
            className="text-text-muted hover:text-text-primary"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Confession reveals */}
      {match?.my_confession && match?.partner_confession && (
        <div className="flex flex-col gap-2 px-6 py-3">
          <span className="text-[10px] font-bold tracking-[1.5px] text-accent">CONFESSIONS UNLOCKED</span>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-accent-soft p-3">
              <p className="text-[10px] font-semibold text-accent mb-1">You</p>
              <p className="text-xs text-text-primary">{match.my_confession}</p>
            </div>
            <div className="flex-1 rounded-lg bg-bg-elevated p-3">
              <p className="text-[10px] font-semibold text-text-muted mb-1">Them</p>
              <p className="text-xs text-text-primary">{match.partner_confession}</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3" aria-live="polite">
        {messages.map((message) => {
          const isMine = message.senderId === viewerId;
          return (
            <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isMine
                    ? 'bg-accent text-white rounded-br-md'
                    : 'bg-bg-card text-text-primary rounded-bl-md'
                }`}
              >
                <p className="text-sm">{message.body}</p>
                {message.createdAt && (
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-text-muted'}`}>
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Report section */}
      {showReport && (
        <div className="px-6 py-3 border-t border-border-default bg-bg-card">
          {reportStatus === 'submitted' ? (
            <p className="text-sm text-positive">Report submitted</p>
          ) : reportStatus === 'rate_limited' ? (
            <p className="text-sm text-text-muted">Daily limit reached</p>
          ) : (
            <div className="flex flex-col gap-2">
              <textarea
                placeholder="Describe the issue..."
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border-default bg-bg-deep p-3 text-sm text-text-primary placeholder:text-text-muted outline-none resize-none"
              />
              <button
                className="text-sm font-semibold text-accent disabled:opacity-50"
                onClick={submitReport}
                disabled={reportStatus === 'submitting' || reportReason.trim().length === 0}
                type="button"
              >
                {reportStatus === 'submitting' ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-3 bg-bg-card border-t border-border-default px-4 py-3">
        <input
          type="text"
          className="flex-1 h-10 rounded-full bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-muted outline-none"
          placeholder="Type a message..."
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
        />
        <button
          type="button"
          onClick={() => void send()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>

      {error ? <p role="alert" className="text-sm text-red-500 text-center px-6 pb-2">{error}</p> : null}
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `npm run typecheck`

**Step 3: Commit**
```bash
git add apps/web/src/pages/ChatPage.tsx
git commit -m "feat(web): redesign Chat Page to match Pencil design"
```

---

### Task 12: Expired Page

**Files:**
- Rewrite: `apps/web/src/pages/ExpiredPage.tsx`

Design: "Time's up." headline with clock icon, star rating row, next match countdown, priority badge, "Back to Waiting Room" + "Share Your Vibe Check Again" buttons.

**Step 1: Rewrite ExpiredPage.tsx**

```tsx
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, HttpError } from '../api.js';
import { PageShell } from '../components/PageShell.js';
import { Button } from '../components/Button.js';
import { Countdown } from '../components/Countdown.js';
import type { MatchResponse } from '../types.js';

type FeedbackStatus = 'idle' | 'submitting' | 'submitted' | 'error';

export function ExpiredPage(): ReactElement {
  const [matchId, setMatchId] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('idle');

  useEffect(() => {
    apiRequest<MatchResponse>('/v1/matches/current')
      .then((res) => {
        setMatchId(res.match_id);
      })
      .catch(() => {});
  }, []);

  const submitFeedback = useCallback(
    async (rating: number) => {
      if (!matchId) return;
      setSelectedRating(rating);
      setFeedbackStatus('submitting');
      try {
        await apiRequest(`/v1/matches/${matchId}/feedback`, {
          method: 'POST',
          body: JSON.stringify({ rating })
        });
        setFeedbackStatus('submitted');
      } catch (reason) {
        setFeedbackStatus('error');
      }
    },
    [matchId]
  );

  return (
    <PageShell blobs="expired">
      <div className="flex flex-col items-center gap-8 px-6 pt-16 pb-10">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border-default bg-bg-card">
          <svg className="h-10 w-10 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
            <line x1="4" y1="4" x2="20" y2="20" />
          </svg>
        </div>

        {/* Headline */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="font-heading text-[32px] font-bold text-text-primary">Time's up.</h1>
          <p className="text-sm text-text-secondary text-center">
            This chat window has expired.{'\n'}But your next match is closer than you think.
          </p>
        </div>

        {/* Rating */}
        {matchId && feedbackStatus !== 'submitted' && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border-default bg-bg-card p-5 w-full">
            <span className="text-[11px] font-bold tracking-[2px] text-text-muted">RATE THIS MATCH</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => submitFeedback(n)}
                  disabled={feedbackStatus === 'submitting'}
                  type="button"
                  className="text-3xl transition-transform hover:scale-110"
                >
                  {selectedRating !== null && n <= selectedRating ? (
                    <span className="text-accent">&#9733;</span>
                  ) : (
                    <span className="text-border-strong">&#9734;</span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted">Your rating helps improve match quality</p>
            {feedbackStatus === 'error' && <p className="text-xs text-red-500">Failed to submit feedback.</p>}
          </div>
        )}

        {feedbackStatus === 'submitted' && (
          <p className="text-sm text-positive">Thanks for your feedback!</p>
        )}

        {/* Next drop */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm font-semibold text-text-primary">Your next match drops Sunday</p>
          <Countdown days="02" hours="14" minutes="37" />
        </div>

        {/* Priority badge */}
        <div className="flex items-center justify-center gap-2 rounded-lg bg-[#10A37F15] px-4 py-3 w-full">
          <svg className="h-4 w-4 text-positive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-sm font-medium text-positive">You have priority re-queue status</span>
        </div>

        {/* Buttons */}
        <Button className="w-full" onClick={() => { window.location.href = '/app/waiting'; }}>
          Back to Waiting Room
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => {}}>
          Share Your Vibe Check Again
        </Button>
      </div>
    </PageShell>
  );
}
```

**Step 2: Verify typecheck**

Run: `npm run typecheck`

**Step 3: Commit**
```bash
git add apps/web/src/pages/ExpiredPage.tsx
git commit -m "feat(web): redesign Expired Page to match Pencil design"
```

---

### Task 13: Error + AppGateway Pages

**Files:**
- Rewrite: `apps/web/src/pages/ErrorPage.tsx`
- Rewrite: `apps/web/src/pages/AppGatewayPage.tsx`

Minimal reskin using the new design system.

**Step 1: Rewrite ErrorPage.tsx**

```tsx
import type { ReactElement } from 'react';
import { PageShell } from '../components/PageShell.js';
import { Button } from '../components/Button.js';

export function ErrorPage(): ReactElement {
  return (
    <PageShell blobs="landing">
      <div className="flex flex-col items-center gap-6 px-6 pt-24">
        <h1 className="font-heading text-3xl font-bold text-text-primary">Something Went Wrong</h1>
        <p className="text-sm text-text-secondary text-center">
          We could not complete your request. Please try again.
        </p>
        <Button onClick={() => { window.location.href = '/app'; }} className="w-full">
          Retry
        </Button>
      </div>
    </PageShell>
  );
}
```

**Step 2: Rewrite AppGatewayPage.tsx**

```tsx
import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { useContext, useEffect, useState } from 'react';
import { apiRequest } from '../api.js';
import { AppContext } from '../AppContext.js';
import { PageShell } from '../components/PageShell.js';
import type { BootstrapResponse } from '../types.js';

export function AppGatewayPage(): ReactElement {
  const navigate = useNavigate();
  const appCtx = useContext(AppContext);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function routeByPhase(): Promise<void> {
      try {
        const bootstrap = await apiRequest<BootstrapResponse>('/v1/bootstrap');
        if (!mounted) return;

        appCtx?.setAppState({
          serverNow: bootstrap.server_now,
          match: bootstrap.match
        });

        const target =
          bootstrap.phase === 'upload'
            ? '/app/upload'
            : bootstrap.phase === 'processing'
              ? '/app/processing'
              : bootstrap.phase === 'waiting'
                ? bootstrap.has_preferences
                  ? '/app/waiting'
                  : '/app/preferences'
                : bootstrap.phase === 'matched_locked'
                  ? '/app/reveal'
                  : bootstrap.phase === 'chat_unlocked'
                    ? '/app/chat'
                    : '/app/expired';

        navigate({ to: target });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Failed to load bootstrap state.');
        navigate({ to: '/app/error' });
      }
    }

    void routeByPhase();
    return () => { mounted = false; };
  }, [navigate, appCtx]);

  return (
    <PageShell blobs="landing">
      <div className="flex flex-col items-center gap-6 px-6 pt-24">
        <h1 className="font-heading text-3xl font-bold text-text-primary">Loading...</h1>
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <div className="h-8 w-8 rounded-full border-4 border-accent border-t-transparent animate-spin" />
        )}
      </div>
    </PageShell>
  );
}
```

**Step 3: Verify typecheck**

Run: `npm run typecheck`

**Step 4: Commit**
```bash
git add apps/web/src/pages/ErrorPage.tsx apps/web/src/pages/AppGatewayPage.tsx
git commit -m "feat(web): redesign Error and AppGateway pages"
```

---

### Task 14: Cleanup Old Code

**Files:**
- Delete: `apps/web/src/components/Panel.tsx`
- Verify no remaining imports of Panel

**Step 1: Verify no more Panel imports**

Run: `grep -r "Panel" apps/web/src/ --include="*.tsx" --include="*.ts"`
Expected: Should return only the Panel.tsx file itself (no other files should import it)

**Step 2: Delete Panel.tsx**

Remove `apps/web/src/components/Panel.tsx`.

**Step 3: Verify full build**

Run: `npm run typecheck && cd apps/web && npx vitest run`
Expected: All pass. If any test imports Panel directly, update accordingly.

**Step 4: Commit**
```bash
git add -A apps/web/src/components/Panel.tsx
git commit -m "chore(web): remove unused Panel component"
```

---

### Task 15: Final Verification

**Step 1: Full typecheck across monorepo**

Run: `npm run typecheck`
Expected: Passes

**Step 2: Full test suite**

Run: `npm run test`
Expected: Passes — all behavior unchanged, only visual changes

**Step 3: Build check**

Run: `npm run build`
Expected: Clean build

**Step 4: Visual smoke test**

Run: `cd apps/web && npm run dev`
Open http://localhost:5173 and verify:
- Landing page shows warm cream background, gradient logo, ChatGPT/Claude buttons, countdown, "How it works" steps
- Navigate through the flow: the design matches the Pencil screenshots
- Mobile-sized viewport (402px wide) looks correct

**Step 5: Final commit if any fixes needed**
```bash
git add -A
git commit -m "fix(web): final visual adjustments from smoke test"
```
