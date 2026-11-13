# wear.TAM Auth & Account System — Audit Report

Read-only audit of the Supabase auth and account system. Files audited:
`assets/js/auth.js`, `assets/js/account.js`, `account.html`, `index.html`.
Supporting files read for context: `assets/js/config.js`, `TAM-TECHNICAL-DOCS.md`.

---

## Summary (answers to the 10 questions)

1. **Signup → confirm email → land on /account logged in?** — **No, incomplete.**
   The in-app half works (confirm panel shows after `signUp`), but `signUp` does not set `emailRedirectTo`, so the confirmation email sends the user to the Supabase dashboard "Site URL" (the home page), not `/account`. `auth.js` on the home page does not detect the confirmation hash or redirect to `/account`, so the user just lands on the home page with a stale `#access_token=...` left in the address bar.

2. **Password reset end-to-end?** — **Mostly complete but fragile (timing race).**
   `sendPasswordReset` correctly sets `redirectTo: 'https://weartam.com/account'` (`auth.js:64-66`), the Change Password form exists and works for a recovery session (`account.js:194` `initPasswordForm`). **However**, `account.js:13-39` `initAccountPage` reads the session with `getSession()` immediately on load. `getSession()` never parses the URL hash; it only returns an already-stored session. The hash is parsed asynchronously by Supabase's `detectSessionInUrl` (default on). If that hasn't finished when `getSession()` runs, the code redirects to `/` (`account.js:28`) and the recovery token in the URL is lost. So the reset link can intermittently bounce the user to home with no way to recover except requesting a new link.

3. **Delete account feature?** — **Not present. No code, no UI.** A safe implementation requires a serverless function with the service-role key (see Recommendations).

4. **Broken element references?** — **No hard breaks.** Every `getElementById`/`querySelector` in `auth.js` resolves on `index.html`, and every one in `account.js` resolves on `account.html`. One cosmetic mismatch: `account.html`'s nav has no `#authNavLabel` span, so `updateNavUser`'s `if (label) label.textContent = ...` (`account.js:67-68`) is a guarded no-op there (the account-page user icon shows no name label). It cannot crash because of the guard.

5. **Account page protected?** — **Yes**, with the same timing caveat as Q2. `initAccountPage` redirects to `/` when there is no session (`account.js:25-30`). Content is hidden behind `#accountLoading` until auth is confirmed, so no account data leaks before the redirect. For a returning logged-in user (session already in localStorage) this is reliable. The risk is only for the hash-based flows (Q2/Q8), where a valid token can be present but not yet established when `getSession()` is called.

6. **Race conditions / timing bugs in session handling?** — **Yes, one significant one (Q2/Q8).** The `getSession()`-before-hash-is-parsed race in `initAccountPage`. Also a minor double-welcome-toast race in `auth.js:71-83` (`onSignedIn` runs once from `initAuth`'s `getSession()` restore and again from `onAuthStateChange`'s `INITIAL_SESSION`; the `tam_welcomed` flag is only set *inside* a 1500 ms `setTimeout`, so two rapid calls can both pass the guard).

7. **Auth modal wired to all 4 panels?** — **Yes, correctly.** `showPanel` (`auth.js:189`) handles `login`, `signup`, `reset`, and `confirm`. All `data-switch` buttons exist and map to `signup`/`login`/`reset`; the confirm panel is intentionally reachable only via JS (`showPanel('confirm')` after signup or on "Email not confirmed" login error). All panel IDs exist in `index.html`.

8. **Does `account.js` handle the Supabase hash token correctly after confirmation redirect?** — **Not reliably, and the redirect never reaches it for signup.** (a) Signup confirmation never lands on `/account` (Q1), so `account.js`'s hash handler is never exercised by signup. (b) For the reset flow that does land on `/account` with a hash, the handler at `account.js:16-22` is racy: it calls `getSession()` (which does not parse the hash) and only clears the hash if a session is already present. The comment at `account.js:16` ("Must be done before getSession() so the session is established first") reflects a misunderstanding — calling `getSession()` does not establish a session from the hash.

9. **Missing error handlers / unhandled rejections?** — **A few low-severity ones.**
   - `auth.js:397` calls async `initAuth()` with no `await`/`.catch`; a `getSession()` rejection becomes an unhandled rejection.
   - `account.js:416` `initAccountPage().then(...)` has no `.catch`; a rejection inside `initAccountPage` leaves none of the tab/avatar/profile/measurement/sign-out initializers running and surfaces as an unhandled rejection.
   - `account.js:343-344` `initSignOut`: `await db.auth.signOut()` is not in a `try/catch`; if it rejects, the redirect line is skipped and the promise rejects (the `onAuthStateChange` listener at `account.js:48-49` would still redirect on `SIGNED_OUT`, so the user is still logged out, but the rejection is unhandled).
   - `friendlyError` (`auth.js:384+`) falls through to `return msg` for unrecognized errors, so raw Supabase error text can be shown to the user.
   - `loadUserMeasurements` (`auth.js`) and `loadProfile`/`loadOrders` (`account.js`) swallow DB errors silently (acceptable, since "no row yet" is normal, but errors are never surfaced).

10. **Sign out working + redirect?** — **Yes.** `account.js:343-344` signs out and redirects to `/`. Redundantly, the `onAuthStateChange` listener registered in `showAccountContent` (`account.js:48-49`) also redirects to `/` on `SIGNED_OUT`. Both target `/`, so it works; the double-redirect is harmless but redundant. `auth.js:57` also defines a `signOut()` helper that is never called from `auth.js` (dead on the home page; the account page uses its own inline handler).

---

## Evidence — file/symbol citations

### `assets/js/auth.js`
- **Client init, no options** (`auth.js:8-10`): `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)` with no options → relies on Supabase defaults (`detectSessionInUrl: true`).
- **`initAuth`** (`auth.js:15-33`): restores session via `getSession()` (line 18) then subscribes `onAuthStateChange` (line 24). Called from `DOMContentLoaded` at `auth.js:397` without `await`/`.catch`.
- **`signUp`** (`auth.js:36-47`): passes only `options.data.full_name`. **No `emailRedirectTo`** — confirmation email uses the dashboard Site URL.
- **`signIn`** (`auth.js:50-54`): standard.
- **`signOut`** (`auth.js:57-61`): defined but unused on the home page (account page has its own).
- **`sendPasswordReset`** (`auth.js:63-69`): `redirectTo: 'https://weartam.com/account'` hardcoded. This is the only flow that targets `/account`.
- **`onSignedIn`** (`auth.js:71-83`): welcome-back toast guard uses `sessionStorage.getItem('tam_welcomed')` and only sets the flag *inside* a 1500 ms `setTimeout` (lines ~79-82) → double-fire race (Q6).
- **`initAuthModal`** (`auth.js:157+`): wires overlay/modal/close/nav/panels.
  - **`showPanel`** (`auth.js:189-196`): handles all four panels; hides via `classList.add('hidden')`.
  - **`authNavBtn` click** (`auth.js:210-217`): signed-in → `/account`; signed-out → `openModal(returning ? 'login' : 'signup')`.
  - **Login submit** (`auth.js:~221-243`): on `Email not confirmed` stores `signupForm.dataset.lastEmail = email` (line 250) then `showPanel('confirm')` (line 251) — good.
  - **Signup submit** (`auth.js:~246-273`): stores `lastEmail` before `signupForm.reset()`, then `showPanel('confirm')`. `reset()` clears inputs but not `dataset`, so `lastEmail` survives — correct.
  - **Reset submit** (`auth.js:~276-289`): calls `sendPasswordReset`.
  - **`resendConfirm`** (`auth.js:315-329`): reads `signupForm?.dataset?.lastEmail` → `db.auth.resend({ type: 'signup', email })`. Wired correctly.
  - **`saveMeasurementsBtn`** (`auth.js:331+`): reads `mBust..mNeck` and calls `saveUserMeasurements`. All those IDs exist in `index.html` (lines 730-815, button at 822).
- **`friendlyError`** (`auth.js:384+`): unrecognized messages fall through to raw `msg`.

### `assets/js/account.js`
- **Client init** (`account.js:8-10`): creates its own `db` (config.js only defines constants, no client — so exactly one client per page).
- **`initAccountPage`** (`account.js:13-39`): the racy hash handler.
  - Lines 16-22: `if (hash.includes('access_token') || hash.includes('type=recovery'))` → `getSession()` → clear hash only if `data?.session`. **`getSession()` does not parse the hash**, so this works only if `detectSessionInUrl` has already stored the session.
  - Lines 25-30: second `getSession()`; `if (!session?.user) window.location.href = '/'`. This is the bounce that can discard a valid recovery/confirmation token.
  - Comment line 16 ("Must be done before getSession() so the session is established first") is technically wrong.
- **`showAccountContent`** (`account.js:40-52`): unhides content, sets email, and subscribes `onAuthStateChange` (line 48) that redirects to `/` when `!session` (line 49).
- **`updateNavUser`** (`account.js:~63-68`): `document.getElementById('authNavLabel')` returns null on `account.html` (no such element) → guarded `if (label)` no-op.
- **`initAvatarUpload`** (`account.js:80+`): upload in `try/catch`, 2 MB limit, upsert to `avatars` bucket, `updateUser({ data: { avatar_url } })`. Fine.
- **`loadProfile`** (`account.js:140+`): `profiles.select().eq().single()`; ignores `error`, falls back to `user_metadata.full_name`. No throw, but errors never surfaced.
- **`initPasswordForm`** (`account.js:194+`): `db.auth.updateUser({ password })` — works for a recovery session. This is the "set new password" half of the reset flow.
- **`loadOrders`** (`account.js:~230+`): guards `Array.isArray(order.items)`; uses `escapeHtml` for output. OK.
- **`initSignOut`** (`account.js:341-347`): `await db.auth.signOut()` then `window.location.href = '/'`. No `try/catch` (Q9).
- **Boot** (`account.js:414+`): `initAccountPage().then(() => { initTabs(); initAvatarUpload(); ... })` — no `.catch` (Q9).

### `index.html`
- Nav: `authNavBtn` (line 62), `authNavLabel` (line 64).
- Auth modal: `authOverlay` (877), `authModal` (878), `authModalClose` (879); panels `authPanelLogin` (887), `authPanelSignup` (910), `authPanelConfirm` (943), `authPanelReset` (954); forms `loginForm` (891), `signupForm` (914), `resetForm` (958); `resendConfirm` (949), `resendMsg` (950); measurement fields `mBust..mNeck` (730-815) and `saveMeasurementsBtn` (822); `toast` (865).
- Scripts (1087-1092): paystack, supabase-js, `config.js`, `main.js`, `auth.js`, `checkout.js`. **`account.js` is NOT loaded on the home page** — so the home page has no `initAccountPage`/hash clearing. `showToast` is defined in `main.js` (line 848) which loads before `auth.js`, so `auth.js`'s `showToast` calls resolve.
- **No JS on the home page handles the confirmation hash** (only `account.js` does, and it isn't loaded here).

### `account.html`
- Nav has `authNavBtn` but **no `authNavLabel`** (the only mismatch; guarded, no crash).
- All account.js-referenced IDs exist: `accountLoading`, `accountContent`, `accountUserEmail`, `accountUserName`, `avatarInput/Preview/Icon`, `profileFullName/Phone/Email/Address`, `profileForm`, `profileMsg`, `passwordForm`, `newPassword`, `confirmPassword`, `passwordMsg`, `accountMeasurementsForm`, `aBust..aNeck`, `measurementsMsg`, `ordersList`, `ordersEmpty`, `signOutBtn`, `hamburger`, `mobileMenu`, `toast`.
- Scripts: supabase-js, `config.js`, `account.js` only (no `auth.js`/`main.js`) — so `showToast` comes from `account.js:404`.

### `assets/js/config.js`
- Defines only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PAYSTACK_PUBLIC_KEY`. Does **not** create a `db` client and exposes no site-URL constant (the `weartam.com/account` string is hardcoded in `auth.js:66`).

### `TAM-TECHNICAL-DOCS.md`
- Section 11 lists auth as "Planned (Phase 2)": login modal, signup modal, "Forgot password flow (Supabase sends reset email — needs live Netlify URL)", persistent session, nav updates. It does **not** document email-confirmation redirect to `/account` or any delete-account feature — consistent with those being genuine gaps, not just undocumented.

---

## Conclusions

The login, signup, in-modal confirm panel, resend, password-reset request, password change, profile, measurements, orders, and sign-out flows are present and internally consistent. The two real defects are:

- **A. Signup confirmation never lands on `/account`.** `signUp` omits `emailRedirectTo`, so Supabase sends the user to the dashboard Site URL (home). The home page logs them in via `onAuthStateChange` but does not redirect to `/account` and does not clear the hash. (Q1, Q8.)
- **B. The hash→session handoff on `/account` is racy.** `initAccountPage` calls `getSession()` (which does not parse the hash) and redirects to `/` if it returns null. Because `detectSessionInUrl` runs asynchronously, a valid confirmation/recovery token can be present yet unread when `getSession()` fires, causing an intermittent bounce to `/` that discards the token. This is the most user-impacting bug because it can make a password-reset link unusable. (Q2, Q6, Q8.)

Plus the missing delete-account feature (Q3) and a handful of low-severity unhandled-rejection paths (Q9).

---

## Recommendations (implement nothing — design only)

**Fix A — point signup confirmation at `/account`.**
In `auth.js:36-47` `signUp`, add `options.emailRedirectTo: 'https://weartam.com/account'` (ideally a `SITE_URL` constant in `config.js` shared with `sendPasswordReset`). This makes the confirm email land on `/account`, where `account.js` already has hash handling and a logged-in account page. Also clear the hash on the home page (or skip home entirely once `emailRedirectTo` is set).

**Fix B — make `/account` wait for the hash to be processed before deciding to bounce.**
Replace the `getSession()`-based guard in `account.js:13-39` with an `onAuthStateChange`-driven approach: on load, if a hash is present, do **not** call `getSession()`/redirect immediately; instead subscribe `onAuthStateChange` and act on the first `INITIAL_SESSION`/`SIGNED_IN`/`PASSWORD_RECOVERY` event (show account, clear hash) or `SIGNED_OUT` (then redirect to `/`). Only when there is **no** hash should the existing synchronous `getSession()` guard be used. This removes the race and stops valid tokens from being lost. As a defense-in-depth, keep `detectSessionInUrl: true` (the default).

**Fix C — add Delete Account (requires a serverless function).**
A client cannot delete its own Supabase auth user with the anon key (`auth.admin.deleteUser` needs the service-role key and must never ship to the browser). Recommended shape:
1. UI: a "Danger Zone" section in `account.html` (Profile tab) with a confirm-typed "Delete my account" button + a typed-confirm gate (e.g. type `DELETE` to enable).
2. Client (`account.js`): call a Netlify Function, e.g. `POST /.netlify/functions/delete-account` with the current user's JWT (from `db.auth.getSession()`), then `db.auth.signOut()` and `window.location.href = '/'` on success.
3. Function (`netlify/functions/delete-account.js`): verify the caller's JWT with the Supabase service-role key (`SUPABASE_SERVICE_ROLE_KEY` env var, never exposed to the client), delete related rows (`profiles`, `measurements`, `orders`) for that `user_id`, then `auth.admin.deleteUser(userId)`. Return 200 only on full success. Optionally remove the user's `avatars/<id>.*` storage objects.
This matches the architecture already referenced in `TAM-TECHNICAL-DOCS.md` (Phase 3 admin uses `is_admin` + Supabase auth) and the existing Paystack-function pattern noted in the docs.

**Fix D — tighten error handling (low severity).**
- `auth.js:397`: `initAuth().catch(console.error)` (or a small handler).
- `account.js:416`: add `.catch(...)` to the `initAccountPage().then(...)` chain.
- `account.js:343-344`: wrap `signOut()` in `try/catch` so a failure still redirects (or surfaces a toast) instead of an unhandled rejection.
- Optional: stop the double welcome toast by setting `tam_welcomed` immediately (before the `setTimeout`) in `auth.js:onSignedIn`, or de-dupe via a module-level flag.

**Fix E — minor.** Add an `authNavLabel` to `account.html`'s nav (or drop the label-write) so the account-page icon can show the user's name like the home page does. Optionally attach a click handler to `account.html`'s `authNavBtn` (currently inert on the account page).

**Priority:** B (token loss) and A (no `/account` landing) first — they are the two things the user explicitly reported ("after signing up... I never receive an email to confirm" / wanting signup → confirm → account, and "password reset and stuff works even delete account"). C is the missing feature the user named. D/E are polish.
