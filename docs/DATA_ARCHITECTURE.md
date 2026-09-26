# TFRC data architecture (proper ecommerce)

## Better plan (what we use)

**One Neon Postgres project** (`TFRC_Catalogue`) with **three schemas** — not three separate Neon databases.

| Schema | Purpose | Main tables |
|--------|---------|-------------|
| `auth` | Admin login & permissions | `User`, `LoginApproval`, `LoginThrottle`, `Role`, `Permission`, `UserRole`, `RolePermission`, `AuditLog` |
| `catalog` | Catalogues & products | `Environment`, `Product`, `ProductImage`, `ProductVideo`, `Price`, `Brand`, `Category`, `ShopCategory`, `Inventory`, `Promotion`, `Banner`, `ImportJob`, site settings, … |
| `activity` | Customer / commerce activity | `CustomerInquiry`, `CustomerInquiryItem`, `OfficeReport*`, … |

### Why not 3 Neon databases?

- Orders/inquiries must join **catalog products** + **customer activity**
- Admin import needs **auth user** + **catalog**
- Neon Free = 1 project; 3 DBs = 3 Prisma clients, no transactions, more failure points
- Industry standard for this scale: **one DB, domain schemas**

## Zero data loss rule

| What | Where it lives | Survives Hostinger redeploy? |
|------|----------------|------------------------------|
| Catalogues, products, prices, logins, inquiries | **Neon Postgres** | **Yes** — code-only deploys |
| Admin-uploaded images | **Cloudflare R2** (+ CDN) | **Yes** |
| Excel product images | Usually **external HTTPS URLs** in Excel | **Yes** (not on Hostinger disk) |

Hostinger only receives **code updates**. It must never hold the source of truth for catalogues.

## Cloudflare images (fast)

1. Cloudflare dashboard → **R2** → Create bucket `tfrc-media`
2. Enable public access via **Custom Domain** e.g. `media.tfrcwholesale.com` (best — uses Cloudflare Cache) **or** `r2.dev` for testing
3. R2 → Manage API tokens → Create read/write token
4. Hostinger env:

```env
MEDIA_STORAGE=r2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=tfrc-media
R2_PUBLIC_URL=https://media.tfrcwholesale.com
```

New admin uploads then go to R2 and load via Cloudflare CDN.

## Deploy checklist

```env
DATABASE_URL=postgresql://…neon…/neondb?sslmode=require
TFRC_DATA_DIR=../tfrc-persistent
MEDIA_STORAGE=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=tfrc-media
R2_PUBLIC_URL=https://media.tfrcwholesale.com
```

After first Postgres deploy: `/admin` → re-import each catalogue Excel (**Replace**). That data stays in Neon forever across pushes.
