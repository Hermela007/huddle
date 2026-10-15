# Security Review

In October 2026 I reviewed Huddle against the [OWASP Top 10](https://owasp.org/www-project-top-ten/). I looked at the Supabase schema and Row Level Security (RLS) policies, every place the React app talks to the database, the Vercel config and the dependencies.

## Summary

| # | OWASP category | Finding | Severity | Status |
|---|---|---|---|---|
| 1 | A01 Broken Access Control / A04 Insecure Design | Expense validation could be bypassed with direct API calls | High | ✅ Fixed |
| 2 | A04 Insecure Design | Payments could be recorded for any amount by the sender | Medium | ✅ Fixed |
| 3 | A05 Security Misconfiguration | No security headers, so the site could be framed (clickjacking) | Low | ✅ Fixed |
| 4 | A05 / A04 | Database functions callable by logged-out users; text length limits enforced only in the browser | Low | ⏳ Open |

## What already passed

- RLS is enabled on every table.
- No secrets are committed: `.env` files are ignored and only Supabase's publishable key is used in the frontend.
- No XSS sinks: React escapes all rendered text and `dangerouslySetInnerHTML` isn't used.
- `npm audit` reports 0 known vulnerabilities.
- Every `security definer` function sets `search_path = ''`, which stops attackers from hijacking it with lookalike functions.
- The post-login redirect only uses internal app routes, so there is no open redirect.

## Findings

### 1. Expense validation bypass (High, fixed)

**Problem.** The app saves expenses through a `save_expense` database function, which checks that everyone's shares add up to the total. But the RLS policies also let users write to the `expenses` and `expense_participants` tables directly through Supabase's API, which skips that check. A trip member could:

- change an expense's amount without changing the shares, which breaks the Balances page for the whole trip;
- give another member a bigger share than they should have;
- move an expense into a different trip, because the update policy didn't lock `trip_id`.

**How I reproduced it.** I ran this direct update from the browser console:

```js
await sb.from("expenses").update({ amount_pence: 999999 }).eq("id", "<expense id>").select()
```

It succeeded. The expense showed £9,999.99 with unchanged shares, and the Balances tab failed with "Balances must add up to 0".

**Fix.**
- Removed the direct insert and update policies on `expenses`, and the insert and delete policies on `expense_participants`.
- Made `save_expense` a `security definer` function that does its own checks: the caller must be a trip member, the payer and everyone sharing must be members, the shares must add up to the amount, and only the creator or the organiser can edit.
- All expense writes now go through this one validated function. Deleting an expense still works through its existing policy.

See [`supabase/security-fixes.sql`](supabase/security-fixes.sql).

**Verification.** After the fix, the same console command returned `data: []` (no rows changed). Editing the expense through the app still worked, and balances loaded correctly.

### 2. Fake payments (Medium, fixed)

**Problem.** The `payments` insert policy let the sender record a payment with any amount. A member could record a payment they never made, or one larger than they owed, and so make another member appear to owe them money.

**Fix.** Only the receiver can now record a payment (`to_user = auth.uid()`), and the settle-up button became "Mark received", shown only to the person being paid. The receiver is the one who knows the money arrived, so faking a payment can now only hurt the person who fakes it. Either party can still undo a payment recorded by mistake.

See [`supabase/security-fixes.sql`](supabase/security-fixes.sql).

### 3. Missing security headers (Low, fixed)

**Problem.** The site sent no Content Security Policy or framing protection, so another site could embed Huddle in a hidden frame and trick users into clicking things (clickjacking).

**Fix.** Added headers in [`vercel.json`](vercel.json):

- `Content-Security-Policy`: only allows the app's own scripts, Google Fonts and Supabase. It includes `frame-ancestors 'none'` to block framing.
- `X-Content-Type-Options: nosniff`: stops the browser from guessing file types.
- `Referrer-Policy: strict-origin-when-cross-origin`: stops full URLs, such as invite links, from leaking to other sites.

**Verification.** The headers appear in the live site's response headers, and the app loads with no CSP errors.

### 4. Minor hardening (Low, open)

- **Function access.** The database helper functions, such as `is_member`, can be called by logged-out users through the API. The risk is low because guessing IDs is impractical. Planned: revoke `execute` from the `anon` role.
- **Text length limits.** Limits on names, descriptions and poll text are enforced only by the form `maxLength`. Planned: matching `check` constraints in the database.

## What I learned

- **RLS policies and database functions together form the security boundary.** A rule enforced in only one of them can be bypassed through the other.
- **Assume any user can call the API directly.** In a Supabase app, the browser isn't a security layer. The database has to enforce every rule itself.
- **Prove the bug before fixing it.** Reproducing the exploit first gave me a concrete test to confirm the fix worked.
