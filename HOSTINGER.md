# Deploying TFRC Vita Nova on Hostinger

Guide for **Hostinger Node.js** (Deployments panel) and **Docker VPS**.

Repository Hostinger must use: https://github.com/Pradev18/vitanovaservice
(Do not connect Hostinger to `tfrc` — that repo is a copy, not the live deploy source.)

---

## Hostinger Node.js panel (your setup)

Use these **exact settings** in **Websites → vitanovaservices.com → Deployments → Settings and redeploy**:

| Setting | Value |
|---------|--------|
| Framework | Next.js |
| Branch | `main` |
| **Node version** | **20.x** (not 22 — more stable for builds) |
| Root directory | `./` |
| **Build command** | `npm run build` |
| Package manager | `npm` |
| **Output directory** | `.next` |
| **Start command** | `npm start` ← must be this (creates/copies the database) |

> Critical: Start command must be **`npm start`**, not `next start`.  
> `npm start` copies the product database before the app boots. Without it, `/pawmart` returns 500 while `/` still looks fine.

### Environment variables (Hostinger panel)

**Remove** all `SMTP_*` variables — they are from the old visa site and are **not used** by this catalogue app.

**Use these only** (copy from `env.vitanovaservices.com.example`):

```env
DATABASE_URL=file:./prod.db
AUTH_SECRET=<your-secret>
AUTH_URL=https://www.vitanovaservices.com
NEXT_PUBLIC_SITE_URL=https://www.vitanovaservices.com
NEXT_PUBLIC_SITE_NAME=TFRC Vita Nova
NEXT_PUBLIC_WHATSAPP_PHONE=97455049229
MEDIA_STORAGE=local
NODE_ENV=production
PORT=3000
```

**Hostinger SQLite URL:** use `file:./prod.db`. Prisma resolves relative file URLs from `prisma/schema.prisma`; the startup script converts this to an absolute path.

### After first successful build

Open **Hostinger Terminal / SSH** for the site and run once:

```bash
cd /path/to/your/app
npm run hostinger:setup
```

This creates the database and loads products + admin user.

Then **Save and redeploy** or restart the app.

### Admin login (change password immediately)

- URL: `https://www.vitanovaservices.com/admin`
- Email: `admin@pawmart.qa`
- Password: use the securely provisioned administrator password

---

## Docker VPS (alternative)

## What you need

- Hostinger **VPS** or plan with **Node.js 20+** (not static hosting only)
- A domain pointed to your server (e.g. `shop.yourdomain.com`)
- SSL certificate (Let's Encrypt via Hostinger panel or Certbot)
- WhatsApp Business number for orders

---

## 1. Server setup

```bash
# SSH into your Hostinger VPS
ssh root@your-server-ip

# Install Docker (recommended)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Or install Node 20 without Docker
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 2. Upload the project

```bash
git clone <your-repo-url> /var/www/tfrc-catalogue
cd /var/www/tfrc-catalogue
```

Or upload via Hostinger File Manager / SFTP.

---

## 3. Environment variables

Copy `.env.example` to `.env` and fill in **production values**:

```env
# Database — Option A: SQLite with Docker volume (simple, single server)
DATABASE_URL="file:/app/prisma/prod.db"

# Database — Option B: PostgreSQL (recommended for heavy admin use)
# DATABASE_URL="postgresql://user:password@localhost:5432/tfrc?schema=public"
# Then change provider in prisma/schema.prisma to postgresql

# Auth — REQUIRED
AUTH_SECRET="paste-output-of-openssl-rand-base64-32"
AUTH_URL="https://shop.yourdomain.com"

# Site — REQUIRED (must match your live HTTPS domain)
NEXT_PUBLIC_SITE_URL="https://shop.yourdomain.com"
NEXT_PUBLIC_SITE_NAME="TFRC Vita Nova"

# WhatsApp — must match Admin → WhatsApp settings
NEXT_PUBLIC_WHATSAPP_PHONE="97455049229"

# Meta ads (optional)
NEXT_PUBLIC_META_PIXEL_ID=""
META_DOMAIN_VERIFICATION=""
```

**Critical:** `NEXT_PUBLIC_SITE_URL` must be set **before** `npm run build`. Product links in WhatsApp messages use this URL.

Generate auth secret:

```bash
openssl rand -base64 32
```

---

## 4. Deploy with Docker (recommended)

```bash
cd /var/www/tfrc-catalogue

# Build with your production domain baked into the client bundle
export NEXT_PUBLIC_SITE_URL=https://shop.yourdomain.com
docker compose build

# First-time database setup
docker compose run --rm tfrc npx prisma db push
docker compose run --rm tfrc npm run db:seed

# Start
docker compose up -d
```

The app runs on port **3000**. Point Nginx/reverse proxy to it.

**Persistent data** (docker-compose mounts):
- `tfrc-db` — SQLite database file
- `tfrc-uploads` — admin-uploaded catalogue logos/images

---

## 5. Deploy without Docker

```bash
npm ci
npx prisma generate
npx prisma db push
npm run db:seed

# Build with production URL
NEXT_PUBLIC_SITE_URL=https://shop.yourdomain.com npm run build

# Run with PM2 (keeps app alive)
npm install -g pm2
pm2 start npm --name tfrc -- start
pm2 save
pm2 startup
```

Ensure `public/uploads/` persists and is writable.

---

## 6. Reverse proxy + SSL (Nginx example)

```nginx
server {
    listen 443 ssl http2;
    server_name shop.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/shop.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shop.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 7. Before going live — checklist

### Security
- [ ] Store the administrator password securely and rotate it when access changes
- [ ] Set strong `AUTH_SECRET`
- [ ] Never commit `.env` to git

### Site & WhatsApp (all catalogues)
- [ ] `NEXT_PUBLIC_SITE_URL` = your HTTPS domain
- [ ] Test order from **PawMart** (`/pawmart`) — message has correct link
- [ ] Test order from **Pro Tools** (`/hardware`) — link uses `/hardware/product/...`
- [ ] Test order from **Kitchen & Home** (`/household`) — link uses `/household/product/...`
- [ ] Test **multi-item cart** across catalogues — each item shows catalogue name + link
- [ ] Admin → **WhatsApp Settings** — phone & greeting match live messages
- [ ] Admin → **Customer activity** — orders are recorded
- [ ] Download **Excel export** from customer activity page

### Meta / WhatsApp Business catalog
- [ ] Register catalog feeds in Meta Commerce Manager:
  - `https://shop.yourdomain.com/api/feeds/meta-catalog/pawmart`
  - `https://shop.yourdomain.com/api/feeds/meta-catalog/hardware`
  - `https://shop.yourdomain.com/api/feeds/meta-catalog/household`
- [ ] Verify product `id` in feed matches WhatsApp catalog Content ID
- [ ] Add domain verification tag (`META_DOMAIN_VERIFICATION`)
- [ ] Set Meta Pixel ID if running ads

### Admin & content
- [ ] Upload catalogue logos — confirm they survive server restart
- [ ] Create/edit a test product in admin
- [ ] Import Excel for a catalogue if needed

### SEO
- [ ] Visit `/sitemap.xml` — URLs use production domain
- [ ] Visit `/robots.txt`

---

## 8. After deploy — smoke test URLs

| URL | Expected |
|-----|----------|
| `/` | Landing with all catalogues |
| `/pawmart` | PawMart store |
| `/hardware` | Pro Tools store |
| `/household` | Kitchen & Home store |
| `/admin` | Admin login |
| `/admin/inquiries` | Customer order records |
| `/api/feeds/meta-catalog/pawmart` | CSV product feed |

---

## 9. Updating the site

```bash
cd /var/www/tfrc-catalogue
git pull
export NEXT_PUBLIC_SITE_URL=https://shop.yourdomain.com
docker compose build
docker compose up -d
# Or: npm run build && pm2 restart tfrc
```

Run `npx prisma db push` if the schema changed.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| WhatsApp links show `localhost` | Rebuild with `NEXT_PUBLIC_SITE_URL` set |
| Admin login fails | Check `AUTH_SECRET` and `AUTH_URL` match domain |
| Uploads disappear | Mount `public/uploads` volume or use cloud storage |
| No products | Run `npm run db:seed` or import via admin |
| Prisma error on Windows dev | Normal — use `npx prisma db push` on server |

---

## Catalogues supported

WhatsApp order messages work the same for:

- **PawMart** (`/pawmart`) — pet products
- **Pro Tools** (`/hardware`) — tools & hardware
- **Kitchen & Home** (`/household`) — household items
- **Any new catalogue** created in Admin → Create catalogue

Each product link uses `/{catalogue-slug}/product/{slug}` automatically.
