# Thread and Twill: online store

A small, complete online store with Razorpay checkout. It needs no installs: it runs on Node.js 18 or newer and uses nothing else.

## What is in the folder

| Path | What it does |
|---|---|
| `public/` | The website customers see (`index.html`, `styles.css`, `app.js`, `policies.html`) |
| `products.json` | Your catalogue: names, prices, sizes, descriptions. Edit this to change what is sold |
| `server.js` and `lib/` | The server: prices every order itself, creates the Razorpay order, checks every payment |
| `public/admin.html` and friends | The private admin page at `/admin` |
| `public/images/` | Product photos (see "Adding product photos") |
| `test/` | Automated checks. Run with `npm test` |
| `.env.example` | The settings the server needs (keys and secrets) |

How a purchase works: the customer fills the bag and delivery form, the server works out the total from `products.json` (never from the browser), Razorpay opens its payment window, and after payment the server checks Razorpay's signature before showing "Order placed". Razorpay also calls the server (webhook) so a payment is recorded even if the customer closes the tab.

## Step 1: Razorpay account

1. Sign up at razorpay.com and complete the business KYC. They typically ask for PAN, a business bank account and your website address. Activation can take a few days.
2. While waiting, use **Test mode**. In the dashboard open Account & Settings, then API Keys, and generate Test keys (they start with `rzp_test_`). Razorpay's documentation lists test card and UPI details for trying payments without real money.
3. Razorpay usually expects your site to show shipping, returns, privacy and terms pages. `public/policies.html` is a template. Fill in the [bracketed] parts and delete the template box.

## Step 2: Try it on your own computer (optional)

1. Install Node.js 18 or newer from nodejs.org.
2. In this folder, copy `.env.example` to `.env` and paste in your **Test** keys.
3. Run `npm start` and open http://localhost:3000.

Without keys the shop still opens, but the Pay button shows "Online payment is not switched on yet".

## Step 3: Put it online

Render is the simplest host for this. Railway and Fly.io work in a similar way.

1. Create a **private** repository on GitHub and upload this folder. Do not upload your `.env` file (`.gitignore` already blocks it).
2. On render.com choose New, then Web Service, and connect the repository.
3. Settings: runtime Node, build command `echo no build step`, start command `node server.js`.
4. Under Environment add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (any long random text you choose) `TRUST_PROXY` set to `1`, and `ADMIN_PASSWORD` (a long private password for the admin page).
5. Deploy. You get an address like `thread-and-twill.onrender.com`. Check Render's current plans: some free instances go to sleep when idle, which makes the first visit slow. For a real shop choose an always-on plan.

## Admin page: see your orders

Open `https://your-site/admin` and sign in with your admin password.

1. In Render, add one more environment variable: `ADMIN_PASSWORD`, a long private password (12 or more characters). Without it the admin page stays off.
2. Save. The site restarts, and you can sign in at `/admin`.

What it shows: paid orders, sales, average order, unpaid attempts, a sales-by-day chart, your most ordered pieces, and every order with the customer's name, phone, email, delivery address, items, payment method and status. You can filter, search, and **download a CSV** for your accountant. A badge at the top says TEST MODE or LIVE.

Good to know:
- Orders are read from Razorpay each time (refreshed at most every 20 seconds), so nothing is lost when the site restarts.
- "Not paid" means a customer started the payment window and did not finish. These are normal.
- It shows up to the latest 500 orders in a range. Pick a shorter range to see them all.
- Five wrong passwords in 15 minutes locks sign-in for a while. Sign-ins last 12 hours.
- It shows sales only. For visitor numbers, add Cloudflare Web Analytics or Google Analytics (both have free plans).
- Anyone with the password sees customer details, so don't share it widely. Change it in Render if you ever need to.

## Adding product photos

1. Shrink each photo to under about 500 KB (JPG or WebP, portrait, roughly 3:4). squoosh.app is free.
2. On GitHub open the `public/images` folder, choose **Add file, Upload files**, and upload them. Use a new file name each time you replace a photo (`rukmini-1.jpg`, `rukmini-2.jpg`), because browsers keep old pictures for about an hour.
3. Open `products.json` on GitHub, click the pencil icon, and add the photos to the piece:
   ```
   "images": ["/images/rukmini-1.jpg", "/images/rukmini-2.jpg"]
   ```
   The first photo is the one shown on the shop page. More photos appear as small pictures in the product view. A piece without `images` keeps its drawing.
4. Click **Commit changes**. Render redeploys by itself in a minute or two.

## Step 4: Webhook

In Razorpay: Account & Settings, then Webhooks, then Add.
- URL: `https://your-site/api/razorpay-webhook`
- Secret: the same text as `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured`, `payment.failed`, `order.paid`

## Step 5: Your own web address

1. Buy a domain such as threadandtwill.in from a registrar (GoDaddy, Namecheap, Hostinger and similar). Check it is available first.
2. In Render open the service, then Settings, then Custom Domains, and add the domain. Render shows the DNS records to add at your registrar. HTTPS is set up for you.
3. Update the webhook URL in Razorpay to the new domain.

## Step 6: Test, then go live

1. With Test keys on the live site, buy something. Check it appears in Razorpay under Orders with the customer's name, phone and address in the notes.
2. Once Razorpay activates your account, generate **Live** keys, replace the two key values in Render, and redeploy.
3. Make one small real payment and refund it from the Razorpay dashboard.

## Before real customers arrive

- Replace the placeholder email `hello@yourdomain.in` in `public/index.html` and fill in `public/policies.html`.
- The ₹5,000 free-shipping line and ₹99 flat rate are samples. Change them in `products.json` (`config`) and the banner text at the top of `public/index.html`.
- Check whether your prices include GST and say so in the policies.
- Replace the drawn garments with product photos. Ask Claude to help with this.
- Ask a developer to review the site once before launch if you can.

## What this version does not do yet

- Send order confirmation emails or WhatsApp messages. For now check the admin page or Razorpay's dashboard for new orders.
- Track stock, apply coupon codes, offer cash on delivery or create GST invoices and shipping labels.
- Keep its own order database. The admin page reads orders from Razorpay, which is the permanent record. The small log in `data/orders.jsonl` is wiped on many hosts when the site redeploys.

These can be added later, or by moving the catalogue to a platform like Shopify once the shop grows.

## Safety notes

- Prices and the payment amount are always set by the server, so a customer cannot change them from their browser.
- Your secret key lives only in the host's environment settings. Never paste it into the website files.
- Every payment and every webhook is checked against Razorpay's signature.
