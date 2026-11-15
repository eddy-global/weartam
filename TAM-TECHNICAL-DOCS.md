# wear.TAM Technical Documentation
The Alisa Musa | Put Together Every Day
Last updated: July 2026

Written for two audiences: the next developer taking over, and the business owner who wants to understand how everything works without reading code.

---

## 1. What is this website?

wear.TAM is an online fashion store for The Alisa Musa brand, Abuja, Nigeria. Live at weartam.com.

Customers can browse the Alpha Collection, pay by card/bank transfer/USSD, create an account to save measurements and view orders, or shop as a guest. They can also contact TAM via WhatsApp, the contact form, or sign up to the newsletter.

---

## 2. Every service keeping the site running

### Netlify (Website Hosting)
Hosts and serves all the website files. Auto-deploys within 30 seconds whenever code is pushed to GitHub.
- Account: eddy-global Netlify account
- Repo: github.com/eddy-global/weartam
- Config file: netlify.toml (security headers, clean URLs, HTTPS redirect)

### Spaceship (Domain Registrar)
Where weartam.com was purchased. DNS records here point the domain to Netlify and authenticate emails.
Do not delete any DNS records. The @ and www records keep the site live. The resend/send records enable email delivery.

### Supabase (Database and User Accounts)
Stores everything: user accounts, profiles, measurements, and orders.
- Dashboard: supabase.com > TechByEdwina's Org > weartam project
- Project URL: https://kaxhvzuzksntrlobktqi.supabase.co
- Keys in config.js: SUPABASE_URL and SUPABASE_ANON_KEY (both safe to be in frontend code)

Database tables:
- profiles: user name, phone, delivery address
- measurements: saved body measurements
- orders: every order with items, total, Paystack reference, status
- products: exists but unused, products are hardcoded in JS for now

How TAM updates order status: Supabase dashboard > Table Editor > orders > find order > click status field > type new status > save.

Order statuses:
- pending: payment received, not yet processed by TAM
- confirmed: TAM has confirmed the order
- shipped: sent out for delivery
- delivered: customer received it
- cancelled: order cancelled

### Resend (Email Delivery)
Sends confirmation and password reset emails from hello@weartam.com.
- Account: charisglobaltech Resend account
- Domain: weartam.com (verified, DNS records in Spaceship)
- Free tier: 3,000 emails/month
- Connected via Supabase > Authentication > Emails > SMTP Settings

### Paystack (Payments)
Handles all payments. Money goes directly to TAM's Paystack account.
- Public key in config.js: pk_live_41692022ffbef16159ef6fe1f8eac590709a79da (safe to be in code)
- Secret key: Paystack dashboard only. Never put in any code file.
- Dashboard: paystack.com (see all transactions)

Payment flow: customer fills checkout form > clicks Pay with Paystack > popup opens > pays > order saved to Supabase > email sent to hello@weartam.com > cart cleared > success screen shown.

Important: The Paystack popup must be triggered by a direct button click. It cannot open inside an async function. This is why the checkout submit handler is kept synchronous.

### Formspree (Contact and Order Emails)
Receives two types of submissions and forwards as emails to hello@weartam.com:
1. Messages from the contact form (Let's Talk section)
2. Full order details after every successful payment

Endpoint: https://formspree.io/f/xzerbdbl
Free tier: 50 submissions/month. Upgrade if orders exceed this.

### Google Apps Script + Google Sheets (Newsletter)
Saves subscriber emails to the TAM Newsletter Subscribers Google Sheet when someone signs up.

Script URL in main.js:
https://script.google.com/macros/s/AKfycbwBR-O-TjmGQH96Y6FQeO3tXRLFzDLB7dk-hZy_mGR3ngvmhcn5rf-MTy0j9ojjqCaE/exec

Uses mode: no-cors so no response can be read back. Check the Sheet periodically to confirm emails are coming in.

### Cloudinary (Video CDN)
Hosts the hero video. Not in the GitHub repo because large video files slow down deployment.
- Account: edwinaeneabah@gmail.com, cloud name: lggmwg89
- Video URL: https://res.cloudinary.com/lggmwg89/video/upload/v1794560406/Tam-Main-Hero-Video.mp4
- In code: index.html, the source src inside the hero video tag

To replace the video: upload new file to Cloudinary > copy URL > update src in index.html > push to GitHub.

---

## 3. All accounts and logins

| Service | Account | If access is lost |
|---|---|---|
| Netlify | eddy-global account | Recover via GitHub |
| GitHub | eddy-global/weartam | Standard GitHub recovery |
| Supabase | TechByEdwina's Org | Email recovery |
| Cloudinary | edwinaeneabah@gmail.com | Gmail recovery |
| Paystack | Live account | Paystack support |
| Resend | charisglobaltech account | Email recovery |
| Formspree | Endpoint xzerbdbl | Formspree account |
| Google Sheets | Newsletter sheet owner | Google account recovery |
| Spaceship | Domain registrar | Spaceship account recovery |

---

## 4. How the key flows work

### Buying something (guest checkout)
1. Customer browses, clicks a product card
2. Product modal opens with photos, sizes, description
3. Picks size (UK sizing or custom measurements) > Add to Bag
4. Cart drawer opens (top right bag icon)
5. Proceed to Payment > checkout form
6. Fills name, email, phone, delivery address > Pay with Paystack
7. Paystack popup opens > customer pays
8. Order saved to Supabase, email sent to hello@weartam.com, cart cleared, success screen shown

No account required. Anyone can buy.

### Creating an account
1. Click person icon in nav > signup form
2. Fill name, phone, email, password
3. Create Account > Supabase creates account > Resend sends confirmation email to customer
4. Customer sees Check your inbox screen
5. Customer clicks link in email > lands on account page, logged in
6. Name and phone saved to profiles table in Supabase

### Logging in
1. Click person icon > login form
2. Enter email and password > Supabase verifies
3. Nav shows Hi, [First Name] in gold, session saved to browser
4. Session persists across page refreshes until sign out

### Password reset
1. Forgot password on login form > enter email
2. Resend delivers branded reset email
3. Customer clicks link > lands on account page > Change Password form > sets new password

### Contact form
Customer fills Let's Talk form > Formspree > email delivered to hello@weartam.com.

### Newsletter
Customer enters email > Google Apps Script > saved to TAM Newsletter Subscribers Google Sheet.

---

## 5. The Alpha Collection products

Products are currently hardcoded in assets/js/main.js as a products object. To change a name, price, or description, edit that file.

| ID | Product | Price |
|---|---|---|
| 1 | Becca Denim Set | 72,500 |
| 2 | The Cherry Dress | 38,000 |
| 3 | Kayla Suit Set - Skirt | 70,000 |
| 4 | Lily Set | 49,000 |
| 5 | Kayla Suit Set - Pants | 69,000 |
| 6 | Lily Set - Black | 49,000 |

To add a new product:
1. Add photos to assets/images/ as WebP files
2. Add an entry to the products object in main.js (copy an existing one)
3. Add a product card div in index.html with matching data-id
4. Add the CSS background image rules in style.css

---

## 6. File structure (for developers)

weartam/
  index.html              The entire homepage (single page application)
  account.html            Account page (profile, measurements, orders tabs)
  netlify.toml            Netlify config: security headers, clean URLs, HTTPS redirect
  .gitignore              Excludes video files from git
  TAM-TECHNICAL-DOCS.md  This document
  assets/
    css/
      style.css           All homepage styles
      account.css         Account page styles
    js/
      config.js           Supabase URL, Anon Key, Paystack Key, SITE_URL constant
      main.js             Cart, product modal, nav, animations, newsletter, contact form
      auth.js             Login, signup, password reset, session management, auth modal
      checkout.js         Checkout form, Paystack payment, save order to Supabase
      account.js          Account page: profile, measurements, orders, sign out
    images/
      (all product photos in WebP format)
      (hero video is NOT here - it is on Cloudinary)

Script load order in index.html (must stay in this order):
1. Paystack SDK
2. Supabase JS from CDN
3. config.js (keys must load before anything else)
4. main.js
5. auth.js
6. checkout.js

---

## 7. Security (for developers)

Safe to be in the code (already there):
- SUPABASE_ANON_KEY: public by design, protected by Row Level Security
- PAYSTACK_PUBLIC_KEY: public by design, can only initiate payment popups
- Cloudinary URL: just a video file URL

Must NEVER be in any code file:
- Supabase service role key: has full database admin access
- Paystack secret key: has full payment access
- Resend API key: stored in Supabase SMTP settings only

Security headers set in netlify.toml:
X-Frame-Options, X-Content-Type-Options, Content-Security-Policy, Referrer-Policy, Permissions-Policy.

XSS protection: all user-provided text inserted into the DOM goes through escapeHtml() in every JS file.

---

## 8. How to deploy changes

git add -A
git commit -m "Description of what changed"
git push

Netlify deploys automatically in about 30 seconds. No build step needed.

To update DNS: Spaceship > weartam.com > DNS Management
To update Supabase settings: supabase.com > weartam project
To replace hero video: upload to Cloudinary > copy URL > update source src in index.html > push

---

## 9. What still needs to be done

Immediate:
- Get transparent PNG or SVG of the TAM logo for proper nav/footer use
- Add TikTok, Twitter/X, Facebook social handles to footer links
- Upgrade Formspree plan if orders exceed 50/month
- Add Paystack webhook to auto-update order status after payment

Phase 2 - Admin panel:
TAM currently updates order status directly in Supabase dashboard. A proper admin panel would let TAM manage orders with one click, view customer details, and add/edit products without touching code.

Phase 3 - Growth features:
- Delete account feature (needs Netlify serverless function with service role key)
- Order status colour badges on account page
- Wishlist and saved items
- Product reviews
- Multiple collections
- Size guide modal

---

## 10. Things intentionally turned off (and how to turn them back on)

### Product modal thumbnails (small clickable photos below the main image)

Status: Hidden. The thumbnail strip in the product modal has been turned off until more colour variants are available for each product.

How to bring them back (two steps):

Step 1 — in assets/js/main.js, find this block:
  /* ── THUMBNAILS HIDDEN (restore when more colour variants are ready) ──

Remove that opening comment line and the closing line:
  ── END THUMBNAILS ── */

Also delete the two lines immediately after the closing comment:
  if (thumbsEl) thumbsEl.innerHTML = ''
  setMainImage(product.gradient)

Step 2 — in assets/css/style.css, find:
  .modal-thumbs { display: none; ... }

Replace with:
  .modal-thumbs { display: flex; gap: 8px; padding: 12px; background: rgba(245,245,240,0.8); }

That's it. The thumbnails will reappear showing all product images including hover and extra images.

---

wear.TAM - The Alisa Musa. Put Together Every Day.
Document last updated: July 2026
