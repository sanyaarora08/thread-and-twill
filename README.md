# Thread and Twill: online store

A small, complete online store with Razorpay checkout. It needs no installs: it runs on Node.js 18 or newer and uses nothing else.

## What is in the folder

| Path | What it does |
|---|---|
| `public/` | The website customers see (`index.html`, `styles.css`, `app.js`, `policies.html`) |
| `products.json` | Your catalogue: names, prices, sizes, descriptions. Edit this to change what is sold |
| `server.js` and `lib/` | The server: prices every order itself, creates the Razorpay order, checks every payment |
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
4. Under Environment add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (any long random text you choose) and `TRUST_PROXY` set to `1`.
5. Deploy. You get an address like `thread-and-twill.onrender.com`. Check Render's current plans: some free instances go to sleep when idle, which makes the first visit slow. For a real shop choose an always-on plan.

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

- Send order confirmation emails or WhatsApp messages. For now check Razorpay's dashboard for new orders.
- Track stock, apply coupon codes, offer cash on delivery or create GST invoices and shipping labels.
- Give you an admin screen. Orders are in Razorpay and in `data/orders.jsonl`. Many hosts wipe the disk on each deploy, so treat Razorpay as the permanent record, or set `DATA_DIR` to a persistent disk.

These can be added later, or by moving the catalogue to a platform like Shopify once the shop grows.

## Safety notes

- Prices and the payment amount are always set by the server, so a customer cannot change them from their browser.
- Your secret key lives only in the host's environment settings. Never paste it into the website files.
- Every payment and every webhook is checked against Razorpay's signature.
