# PawMart Qatar

Production-quality pet & home catalogue platform for Qatar.

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Prisma + SQLite (dev) / PostgreSQL (production)
- NextAuth.js

## Quick Start

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

- **Public site:** http://localhost:3000
- **Admin:** http://localhost:3000/admin
- **Login:** admin@pawmart.qa / admin123

## Catalogue Data

Initial data imported from 3 Excel files (~569 products):

- Pet Products (117)
- Households (51)
- Multi Tools (401)

## Features

- Dynamic categories from Google product taxonomy
- Image & video URLs from Excel (R2 CDN)
- WhatsApp direct chat with pre-filled product messages
- Admin import/export, products, categories, settings
- SEO: sitemap, robots, JSON-LD, metadata

## Production (Hostinger)

1. Set `DATABASE_URL` to PostgreSQL
2. Change `provider` in `prisma/schema.prisma` to `postgresql`
3. Set `AUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`
4. Run `npm run build && npm start`
