# Deploy TFRC Vita Nova on Vercel

Repo: [github.com/Pradev18/tfrc](https://github.com/Pradev18/tfrc)

## 1. Import project (if not done)

1. [vercel.com/new](https://vercel.com/new)
2. Import **Pradev18/tfrc** from GitHub
3. Framework: **Next.js** (auto-detected)
4. Root directory: **./** (leave default)
5. Build command: **`npm run build`** (default)
6. Install command: **`npm install`** (default — runs `prisma generate` via postinstall)

Click **Deploy** once. It may fail or show errors until env vars are set — that's normal.

---

## 2. Environment variables (required)

Vercel → your project → **Settings → Environment Variables**

Add these for **Production**, **Preview**, and **Development**:

| Name | Value |
|------|--------|
| `DATABASE_URL` | `file:./prisma/prod.db` |
| `AUTH_SECRET` | Long random string (32+ chars). Generate: [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32) |
| `AUTH_URL` | `https://YOUR-PROJECT.vercel.app` |
| `NEXT_PUBLIC_SITE_URL` | `https://YOUR-PROJECT.vercel.app` |
| `NEXT_PUBLIC_SITE_NAME` | `TFRC Vita Nova` |
| `NEXT_PUBLIC_WHATSAPP_PHONE` | `97455049229` |

Optional (Meta ads):

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_META_PIXEL_ID` | Your pixel ID |
| `NEXT_PUBLIC_META_APP_ID` | Your app ID |
| `META_DOMAIN_VERIFICATION` | Meta domain verification code |

**Important:** Replace `YOUR-PROJECT.vercel.app` with your real Vercel URL (e.g. `tfrc.vercel.app`). You see it after the first deploy under **Domains**.

---

## 3. Redeploy

After saving env vars:

**Deployments → latest deploy → ⋮ → Redeploy**

Or push any commit to GitHub — Vercel redeploys automatically.

---

## 4. Test (same as local)

| URL | Should work |
|-----|-------------|
| `/` | Landing page |
| `/pawmart` | PawMart store |
| `/hardware` | Pro Tools |
| `/household` | Kitchen & Home |
| `/pawmart/catalogue?shop=leashes-collars` | Category filter |
| `/admin/login` | Admin panel |

**Admin login** (from seeded database):

- Email: `admin@pawmart.qa`
- Password: use the securely provisioned administrator password

Change this password after going live.

---

## 5. Custom domain (optional)

1. Vercel → **Settings → Domains** → Add domain  
2. Update `AUTH_URL` and `NEXT_PUBLIC_SITE_URL` to your domain  
3. Redeploy  

---

## Notes

### Database on Vercel
- Uses **`prisma/prod.db`** (bundled in Git) — same products as local.
- **Storefront** (browse, cart, WhatsApp) works fully.
- **Admin imports/writes** do not persist on serverless. Update locally → `npm run db:prepare-prod` → commit `prod.db` → push to refresh live catalogue.

### Build fails?
- Check **Deployments → Build logs**
- Confirm all env vars above are set
- Confirm `AUTH_URL` matches your exact Vercel URL (https, no trailing slash)

### Auto deploy
Every `git push` to `main` on GitHub triggers a new Vercel deployment.
