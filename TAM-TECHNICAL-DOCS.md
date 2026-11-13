# wear.TAM — Technical Documentation
**The Alisa Musa | Put Together Every Day**

> Written for two audiences: the next developer taking over this project, and the business owner who wants to understand how everything works without needing to read code. If you are a developer, read everything. If you are the business owner, Sections 1–5 are written for you.

Last updated: July 2026

---

## Section 1 — What is this website?

wear.TAM is an online fashion store for The Alisa Musa brand, based in Abuja, Nigeria.

The website lets customers:
- Browse the Alpha Collection of clothing
- View each product with photos, descriptions, and pricing
- Add items to a bag and check out with their card, bank transfer, or USSD
- Create an account to save their measurements, delivery address, and view past orders
- Shop as a guest without creating an account
- Contact the brand via WhatsApp, Instagram, phone, or the contact form
- Sign up for the newsletter

The site is live at **weartam.com**.

---

## Section 2 — The tools and services keeping the site running

Every external service the site depends on is listed here. If any of these change, the developer will need to update the relevant code.

---

### 2.1 Netlify — Website Hosting

**What it does:** Netlify is where the website files live and are served from. When a code change is pushed to GitHub, Netlify automatically deploys it to the live site within about 30 seconds. It also handles the SSL certificate (the padlock in the browser) and enforces HTTPS.

**Account:** eddy-global Netlify account
**Live URL:** weartam.netlify.app (also accessible at weartam.com via DNS)
**GitHub repo:** github.com/eddy-global/weartam
**How deployment works:** Push code to the `main` branch on GitHub → Netlify detects the change → rebuilds and deploys automatically. No manual steps needed.
**Config file:** `netlify.toml` in the project root — handles security headers, HTTPS redirects, and clean URL rules (so the address bar shows `/account` instead of `/account.html`).

---

### 2.2 Spaceship — Domain Registrar

**What it does:** Spaceship is where the domain `weartam.com` was purchased and is managed. The DNS records there point the domain to Netlify.

**Key DNS records set up:**
- `@` (root) → `apex-loadbalancer.netlify.com` (points weartam.com to Netlify)
- `www` → `weartam.netlify.app` (makes www.weartam.com work)
- `resend._domainkey` → Resend DKIM record (proves emails from weartam.com are legitimate)
- `rsend` and `send` → Resend SPF records (email authentication)

**Important:** Do not delete any of these DNS records. Deleting the `@` or `www` records will take the site down. Deleting the Resend records will break email delivery.

---

### 2.3 Supabase — Database and User Accounts

**What it does:** Supabase is the backend database. It stores:
- User accounts (email, password — stored securely, passwords are never readable)
- User profiles (name, phone number, delivery address)
- Body measurements saved by users
- Every order placed on the site

**Project URL:** https://kaxhvzuzksntrlobktqi.supabase.co
**Dashboard:** supabase.com → TechByEdwina's Org → weartam project
**Keys (in `assets/js/config.js`):**
- `SUPABASE_URL` — the project address
- `SUPABASE_ANON_KEY` — the public key, safe to be in the frontend code. It only works within the security rules set up in Supabase.

**Tables in the database:**

| Table | What it stores |
|---|---|
| `profiles` | User's name, phone, delivery address |
| `measurements` | Saved body measurements (bust, waist, hips, etc.) |
| `orders` | Every order: customer details, items, total, Paystack reference, status |
| `products` | Exists but not used yet — products are currently hardcoded in the JS |

**Row Level Security (RLS):** Each user can only see their own data. A logged-in user cannot see another user's orders or measurements. This is enforced by Supabase, not just the frontend code.

**Email confirmation:** When someone signs up, Supabase sends them a confirmation email. They must click the link before they can log in. This is turned on under Authentication → Providers → Email in the Supabase dashboard.

---

### 2.4 Resend — Email Delivery

**What it does:** Resend is the service that actually sends emails from `hello@weartam.com`. Without it, Supabase's built-in email sender was limited to 2 emails per hour and often went to spam. Resend allows 3,000 emails per month on the free tier.

**Account:** charisglobaltech Resend account
**Domain verified:** weartam.com (DKIM and SPF records added to Spaceship DNS)
**Connected to:** Supabase → Authentication → Emails → SMTP Settings
**SMTP settings in Supabase:**
- Host: smtp.resend.com
- Port: 465
- Username: resend
- Password: [Resend API key — stored only in Supabase, never in the codebase]

**What emails it sends:**
1. Email confirmation when someone creates an account
2. Password reset link when someone requests it

**Email templates:** Customised with the wear.TAM brand (black header, gold logo, bone footer) — set in Supabase → Authentication → Emails → Templates.

---

### 2.5 Paystack — Payments

**What it does:** Paystack handles all payments on the site. When a customer clicks "Pay with Paystack", a Paystack popup appears where they can pay by card, bank transfer, USSD, or mobile money. The money goes directly to the TAM Paystack account.

**Public key (in `assets/js/config.js`):** `pk_live_41692022ffbef16159ef6fe1f8eac590709a79da`
This key is safe to be in the frontend code — it can only initiate payments, not access funds.
**The secret key** lives only in the Paystack dashboard and must never be put in the website code.
**Currency:** Nigerian Naira (NGN)
**Dashboard:** paystack.com — log in to see all transactions

**How a payment works (step by step):**
1. Customer fills in their details in the checkout form
2. Clicks "Pay with Paystack"
3. Paystack popup opens in the same tab
4. Customer pays
5. Paystack calls the `callback` function with a payment reference (e.g. `T123456789`)
6. The site saves the order to Supabase with that reference
7. An order notification email is sent to `hello@weartam.com` via Formspree
8. The customer sees a success screen with their order reference and a WhatsApp button

**Important technical note:** The Paystack popup must be triggered directly by a button click (a user action). It cannot be opened inside an `async` function that awaited something first, because browsers block popups that aren't directly triggered by the user. This is why the checkout form submit handler is kept synchronous.

---

### 2.6 Formspree — Contact and Order Emails

**What it does:** Formspree receives two types of form submissions and forwards them as emails to `hello@weartam.com`:
1. Messages from the "Let's Talk" contact form at the bottom of the homepage
2. Full order details after every successful Paystack payment

**Endpoint:** `https://formspree.io/f/xzerbdbl`
**Where it appears in code:** `assets/js/main.js` (contact form) and `assets/js/checkout.js` (order notification)
**Free tier:** 50 submissions per month. If the store gets busy, upgrade the Formspree plan.

**What the order notification email contains:**
- Payment reference from Paystack
- Customer name, email, phone number
- Delivery address
- Size or custom measurements
- List of items ordered with quantities
- Order total
- Any notes the customer added

---

### 2.7 Google Apps Script + Google Sheets — Newsletter

**What it does:** When someone enters their email in the "Stay in the Loop" newsletter section and clicks Subscribe, their email address is saved to a Google Sheet called **TAM Newsletter Subscribers**.

**Google Apps Script URL (in `assets/js/main.js`):**
`https://script.google.com/macros/s/AKfycbzaeCWndVSE7CZY8uSZJq1lKxI80M8Iwe_jcMkSAzU3xw2JTgLw9l6f8lLErEQ75eEO/exec`

**How it works:**
1. Customer types their email and clicks Subscribe
2. The site sends a POST request to the Google Apps Script URL
3. The script receives the email and appends it as a new row in the Google Sheet
4. The subscriber sees a "You're on the list" toast notification

**Note:** Because of browser security rules, the site uses `mode: 'no-cors'` for this request, which means it cannot read the response. If there's a network error, the site shows a generic error toast. If there's a problem with the script itself, the email might silently fail to save. Check the Google Sheet periodically to confirm emails are coming through.

**To access the Sheet:** Log in to the Google account that owns the Apps Script → Google Sheets → TAM Newsletter Subscribers.

---

### 2.8 Cloudinary — Video CDN

**What it does:** The hero video (the background video on the homepage) is hosted on Cloudinary, not in the GitHub repository. This is because video files are large and would slow down the site and eat up GitHub storage.

**Account:** edwinaeneabah@gmail.com Cloudinary account
**Cloud name:** lggmwg89
**Video URL:** `https://res.cloudinary.com/lggmwg89/video/upload/v1794560406/Tam-Main-Hero-Video.mp4`
**Where it appears in code:** `index.html` — the `<source src="...">` inside the `<video>` tag in the hero section

**To replace the video:** Upload a new video to Cloudinary → copy the new URL → update the `src` attribute in `index.html`.

---

## Section 3 — How the website is built

**Technology:** Pure HTML, CSS, and JavaScript. No frameworks (no React, no Vue). No build tools (no npm, no webpack). The code runs directly in the browser exactly as written.

**Why this approach:** It makes the site fast, simple to understand, and easy to hand off to any developer. There is no "build step" — you edit a file, push to GitHub, and it's live.

**Pages:**

| Page | File | Who can access |
|---|---|---|
| Homepage / Shop | `index.html` | Everyone |
| Account | `account.html` | Logged-in users only (redirects to home if not logged in) |

**JavaScript files:**

| File | What it does |
|---|---|
| `assets/js/config.js` | Holds the Supabase and Paystack keys. Loads first. |
| `assets/js/main.js` | Everything on the homepage: cart, product modal, nav, animations, newsletter, contact form, story image crossfade, WhatsApp button |
| `assets/js/auth.js` | Login, signup, password reset, session management, the auth modal |
| `assets/js/checkout.js` | The checkout form, Paystack payment, saving orders to Supabase, sending order email via Formspree |
| `assets/js/account.js` | The account page: profile, measurements, orders, sign out, delete account |

**CSS files:**

| File | What it does |
|---|---|
| `assets/css/style.css` | All styles for the homepage |
| `assets/css/account.css` | All styles for the account page |

**Images:** All in `assets/images/`. All in WebP format (smaller, faster than PNG/JPEG). The hero video is NOT here — it's on Cloudinary.

---

## Section 4 — How the key flows work

### 4.1 How a customer buys something

1. Customer browses the collection and clicks on a product card
2. A product modal opens with photos, description, and size options
3. Customer picks their size (UK sizing or custom measurements) and clicks "Add to Bag"
4. The item appears in the cart drawer (top right bag icon)
5. Customer clicks "Proceed to Payment"
6. A checkout form opens asking for name, email, phone, delivery address, and size confirmation
7. Customer clicks "Pay with Paystack" — the Paystack popup opens
8. Customer pays (card / bank transfer / USSD / mobile money)
9. On success:
   - Order is saved to Supabase database
   - Order notification email sent to hello@weartam.com
   - Cart is cleared
   - Success screen shown with order reference and WhatsApp button

**Guest checkout:** No account required. Anyone can buy without creating an account.

---

### 4.2 How the login and signup works

**Signup:**
1. Customer clicks the person icon in the top right nav
2. The signup form appears (first visit) or login form (returning visitor)
3. Customer fills in name, phone number, email, and password
4. Clicks "Create Account"
5. Supabase creates the account and sends a confirmation email via Resend
6. The site shows a "Check your inbox" screen
7. Customer clicks the link in the email → lands on their account page, logged in
8. Their name, phone, and email are saved to the `profiles` table in Supabase

**Login:**
1. Customer clicks the person icon
2. Enters email and password
3. Supabase verifies credentials
4. On success: modal closes, nav shows "Hi, [First Name]" in gold, session saved to browser
5. Session persists across page refreshes — customer stays logged in until they sign out

**Password reset:**
1. Customer clicks "Forgot your password" on the login form
2. Enters their email
3. Supabase sends a reset email via Resend
4. Customer clicks the link → lands on their account page with a "Change Password" form
5. Sets new password → done

**Email not confirmed:** If a customer tries to log in before confirming their email, the site automatically shows the "Check your inbox" screen with a resend button.

---

### 4.3 How the contact form works ("Let's Talk")

1. Customer fills in name, email, and message
2. Clicks "Send Message"
3. The site sends the data to Formspree
4. Formspree forwards it as an email to hello@weartam.com
5. Customer sees a "Message sent" toast

---

### 4.4 How the newsletter works ("Stay in the Loop")

1. Customer enters their email and clicks Subscribe
2. The site sends the email to a Google Apps Script
3. The script saves it to the TAM Newsletter Subscribers Google Sheet
4. Customer sees "You're on the list" toast

---

### 4.5 How orders are tracked

Every order saved to Supabase has a `status` field. The possible statuses are:

| Status | Meaning | Badge colour |
|---|---|---|
| `pending` | Order placed, payment received, not yet processed | Gold |
| `confirmed` | TAM has confirmed the order and is preparing it | Blue |
| `shipped` | Order has been shipped / sent out for delivery | Purple |
| `delivered` | Customer has received the order | Green |
| `cancelled` | Order was cancelled | Red |

**How TAM updates the status:** Go to supabase.com → weartam project → Table Editor → orders table → find the order → click on the `status` field → type the new status → save.

**How the customer sees it:** On their account page under the Orders tab, each order shows its current status with a colour-coded badge. The page automatically refreshes the order status every 60 seconds.

---

## Section 5 — Accounts and access

This is a list of every account involved in running this website and what it controls.

| Service | Account | What to do if access is lost |
|---|---|---|
| Netlify | eddy-global account | Recover via GitHub login |
| GitHub | eddy-global/weartam | Standard GitHub account recovery |
| Supabase | TechByEdwina's Org | Email recovery |
| Cloudinary | edwinaeneabah@gmail.com | Gmail account recovery |
| Paystack | Live account | Paystack support |
| Resend | charisglobaltech account | Email recovery |
| Formspree | Endpoint xzerbdbl | Formspree account recovery |
| Google Sheets | Newsletter sheet owner | Google account recovery |
| Spaceship | Domain registrar | Spaceship account recovery |

---

## Section 6 — The products (Alpha Collection)

Products are currently hardcoded in `assets/js/main.js` as a `products` object. To change a product's name, price, or description, edit that file directly.

| ID | Name | Price | Images used |
|---|---|---|---|
| 1 | Becca Denim Set | ₦72,500 | becca-main.webp, becca-main.webp (hover) |
| 2 | The Cherry Dress | ₦38,000 | red-dress-full.webp, red-dress-stylish.webp (hover) |
| 3 | Kayla Suit Set - Skirt | ₦70,000 | kayla-suit-skirt-main.webp |
| 4 | Lily Set | ₦49,000 | Lily-set-purple.webp, Lily-set-purple-02.webp (hover) |
| 5 | Kayla Suit Set - Pants | ₦69,000 | kayla-suit-set-pants-main.webp |
| 6 | Lily Set - Black | ₦49,000 | lily-set-black-main.webp |

**To add a new product:**
1. Add the product photos to `assets/images/` as WebP files
2. Add a new entry to the `products` object in `main.js` (copy an existing one and update the values)
3. Add a new product card `<div>` in `index.html` with the matching `data-id`
4. Add the CSS background image rules for the new card in `style.css`

---

## Section 7 — Security

**What is safe to be public (already in the code):**
- `SUPABASE_ANON_KEY` — this is a public key by design. It only works within Supabase's Row Level Security rules. It cannot access other users' data.
- `PAYSTACK_PUBLIC_KEY` — this is a public key by design. It can only initiate payment popups, not access funds or transactions.
- Cloudinary video URL — public by design, it's just a video file URL.

**What must NEVER be in the code:**
- Supabase service role key — only used in server-side Netlify Functions, stored as an environment variable in Netlify
- Paystack secret key — only in the Paystack dashboard
- Resend API key — only in Supabase SMTP settings

**Security headers** (set in `netlify.toml`): The site sends security headers with every response — these prevent clickjacking, MIME sniffing, and restrict which external resources can load on the page.

**Input sanitisation:** Every piece of user-provided text inserted into the page goes through an `escapeHtml()` function that prevents XSS (cross-site scripting) attacks.

---

## Section 8 — What still needs to be done

### Immediate
- [ ] Get transparent PNG or SVG export of the TAM logo for proper use in nav/footer
- [ ] Add TikTok, Twitter/X, Facebook social handles to the footer links
- [ ] Upgrade Formspree plan if orders exceed 50/month
- [ ] Add Paystack webhook to auto-update order status after payment (currently manual)

### Phase 2 — Admin panel
The TAM team currently updates order statuses directly in the Supabase dashboard. A proper admin panel would let TAM:
- See all orders in one place with filters
- Update order status with one click
- View customer details and measurements
- Manage products (add, edit, remove) without touching code

### Phase 3 — Growth features
- Wishlist / saved items
- Product reviews
- Multiple collections support
- Size guide modal with measurement diagram
- Blog / editorial content

---

## Section 9 — How to make changes and deploy

**To update text, prices, or images:**
1. Open the relevant file in a code editor (VS Code recommended)
2. Make the change
3. Open terminal in the project folder
4. Run: `git add -A` then `git commit -m "Description of what you changed"` then `git push`
5. Netlify deploys automatically within 30 seconds

**To update Supabase settings:** Log in to supabase.com → weartam project

**To update DNS:** Log in to Spaceship → weartam.com → DNS Management

**To replace the hero video:**
1. Upload new video to Cloudinary (edwinaeneabah@gmail.com account)
2. Copy the new video URL from Cloudinary
3. In `index.html`, find the `<source src="...">` inside the hero `<video>` tag
4. Replace the URL with the new one
5. Push to GitHub

---

*wear.TAM — The Alisa Musa. Put Together Every Day.*
*Document prepared July 2026*
