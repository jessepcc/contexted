# Supabase Email Templates

Branded email templates for Contexted auth flows. These replace the default Supabase "Confirm your signup" / "Your Magic Link" emails.

## Templates

| File | Supabase Template | Subject Line | When Sent |
|------|------------------|--------------|-----------|
| `confirmation.html` | **Confirm signup** | `You're almost in — Contexted` | New user signs up via `signInWithOtp` |
| `magic_link.html` | **Magic Link** | `Your sign-in link — Contexted` | Returning user signs in via `signInWithOtp` |

## How to Apply

Both test and production Supabase projects need updating:

### 1. Open the Email Templates page

- **Test**: https://supabase.com/dashboard/project/rldsdtlguqjhttuwotwv/auth/templates
- **Production**: https://supabase.com/dashboard/project/cweawdoqvsiczialzrbr/auth/templates

### 2. Update "Confirm signup"

- **Subject**: `You're almost in — Contexted`
- **Body**: Paste the contents of `confirmation.html`

### 3. Update "Magic Link"

- **Subject**: `Your sign-in link — Contexted`
- **Body**: Paste the contents of `magic_link.html`

### 4. Save each template

Click "Save" after pasting each one.

## Template Variables

These templates use Supabase's Go template syntax:

- `{{ .ConfirmationURL }}` — the auth confirmation/magic link URL
- `{{ .Email }}` — the recipient's email address
- `{{ .SiteURL }}` — the configured site URL
