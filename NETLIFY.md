# Deploy TFRC Vita Nova to Netlify

## Quick steps

1. **Push this repo to GitHub** (GitLab or Bitbucket also work).

2. **Prepare the production database** (once, on your PC):
   ```bash
   npm run db:prepare-prod
   git add prisma/prod.db
   git commit -m "Add production SQLite for Netlify"
   git push
   ```
   `prod.db` is a read-only copy of your catalogue for serverless hosting.

3. **Create a site on [Netlify](https://app.netlify.com)**  
   - **Add new site → Import an existing project**  
   - Connect your Git provider and select this repository  
   - Netlify reads `netlify.toml` automatically

4. **Set environment variables** in Netlify → Site configuration → Environment variables:

   | Variable | Value |
   |----------|--------|
   | `DATABASE_URL` | `file:./prisma/prod.db` |
   | `AUTH_SECRET` | Random 32+ char string ([generate](https://generate-secret.vercel.app/32)) |
   | `AUTH_URL` | `https://YOUR-SITE.netlify.app` |
   | `NEXT_PUBLIC_SITE_URL` | `https://YOUR-SITE.netlify.app` |
   | `NEXT_PUBLIC_SITE_NAME` | `TFRC Vita Nova` |
   | `NEXT_PUBLIC_WHATSAPP_PHONE` | `97455049229` |

   Optional (Meta ads):
   - `NEXT_PUBLIC_META_PIXEL_ID`
   - `NEXT_PUBLIC_META_APP_ID`
   - `META_DOMAIN_VERIFICATION`

5. **Deploy** — Netlify runs `npm run netlify:build` and publishes the site.

6. After deploy, open `https://YOUR-SITE.netlify.app` and test `/pawmart`, `/hardware`, `/household`.

---

## Important notes

### SQLite on Netlify
- The catalogue **storefront is read-only** on Netlify (browse, cart, WhatsApp) — this is fine for customers.
- **Admin imports and DB writes** do not persist on Netlify serverless. Use admin locally, then run `npm run db:prepare-prod` and redeploy to update products.
- For full admin in production, use **PostgreSQL** (Neon or [Prisma Postgres Netlify extension](https://docs.netlify.com/integrations/database/) instead of SQLite.

### Custom domain
1. Netlify → Domain management → Add custom domain  
2. Update `AUTH_URL` and `NEXT_PUBLIC_SITE_URL` to your domain  
3. Redeploy

### Build fails?
- Ensure `prisma/prod.db` is committed to Git  
- Node 20 is set in `netlify.toml`  
- Check build logs for missing env vars

---

## CLI deploy (optional)

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

Set the same environment variables in the Netlify dashboard before going live.
