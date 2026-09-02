# TFRC Vita Nova — Multi-catalogue platform

Production catalogue platform for TFRC (PawMart, Pro Tools, Kitchen & Home, + admin-created stores).

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- Prisma + SQLite (dev/Docker) or PostgreSQL (production scale)
- NextAuth.js admin

## Quick Start (local)

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

- **Public site:** http://localhost:3000
- **Admin:** http://localhost:3000/admin
- **Login:** admin@pawmart.qa with the securely provisioned administrator password

## Catalogues

| Slug | Store |
|------|-------|
| `/pawmart` | PawMart — pet products |
| `/hardware` | Pro Tools — tools & hardware |
| `/household` | Kitchen & Home |

Admin can create additional catalogues without code changes.

## Features

- Multi-catalogue stores with admin CRUD
- Cart + WhatsApp order messages (plain language + product links)
- Silent customer activity tracking (admin only) + Excel export
- Meta product catalog feeds per catalogue
- Responsive mobile/tablet/desktop UI

## Production (Hostinger)

See **[HOSTINGER.md](./HOSTINGER.md)** for the full deployment guide.

Quick checklist:

1. Set `NEXT_PUBLIC_SITE_URL=https://yourdomain.com` **before build**
2. Set `AUTH_SECRET` and `AUTH_URL=https://yourdomain.com`
3. Use Docker (`docker compose up`) or `npm run build && npm start`
4. Change default admin password
5. Configure WhatsApp in Admin → Settings
6. Register Meta catalog feeds per catalogue
7. Test orders from all catalogues

## Other hosting

- [VERCEL.md](./VERCEL.md)
- [NETLIFY.md](./NETLIFY.md)
- [AWS.md](./AWS.md)
