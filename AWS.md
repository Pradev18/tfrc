# Deploy TFRC Vita Nova on AWS

Repo: [github.com/Pradev18/tfrc](https://github.com/Pradev18/tfrc)

I cannot log into your AWS account directly. After you create your paid account, follow **Option A (recommended)** below — it runs the same app as local, with full database support.

---

## Option A — EC2 + Docker (recommended)

Best match for local: SQLite works, admin imports persist, full Next.js SSR.

### 1. Create AWS account
- [aws.amazon.com](https://aws.amazon.com) → create account & add payment method

### 2. Launch EC2 instance
1. **EC2 → Launch instance**
2. Name: `tfrc-catalogue`
3. AMI: **Ubuntu 24.04 LTS**
4. Instance type: **t3.small** (2 GB RAM — comfortable for Next.js)
5. Key pair: create & download `.pem` file
6. Security group — allow:
   - **SSH (22)** — your IP only
   - **HTTP (80)** — anywhere
   - **HTTPS (443)** — anywhere
   - **Custom TCP 3000** — anywhere (or only your IP while testing)
7. Storage: **20 GB** gp3
8. Launch

### 3. Connect & install Docker

```bash
ssh -i "your-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP

sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu
exit
```

SSH in again, then:

```bash
git clone https://github.com/Pradev18/tfrc.git
cd tfrc
```

### 4. Create environment file

```bash
nano .env
```

Paste (replace values):

```env
AUTH_SECRET=your-long-random-secret-here
AUTH_URL=http://YOUR_EC2_PUBLIC_IP:3000
NEXT_PUBLIC_SITE_URL=http://YOUR_EC2_PUBLIC_IP:3000
```

Save: `Ctrl+O`, Enter, `Ctrl+X`

### 5. Build & run

```bash
docker compose up -d --build
```

Wait ~3–5 minutes for first build. Then open:

**http://YOUR_EC2_PUBLIC_IP:3000**

Test: `/`, `/pawmart`, `/hardware`, `/household`

### 6. Admin login
- URL: `/admin/login`
- Email: `admin@pawmart.qa`
- Password: `admin123`

### 7. Custom domain + HTTPS (optional)
Install Caddy or Nginx reverse proxy + Let's Encrypt on port 443, pointing to `localhost:3000`. Update `AUTH_URL` and `NEXT_PUBLIC_SITE_URL` to your domain, then `docker compose up -d --build`.

---

## Option B — AWS Amplify (easier, like Vercel)

1. [AWS Amplify Console](https://console.aws.amazon.com/amplify/) → **Create new app** → **Host web app**
2. Connect **GitHub → Pradev18/tfrc**
3. Build settings: auto-detect Next.js
4. Environment variables (same as Vercel):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `file:./prisma/prod.db` |
| `AUTH_SECRET` | random 32+ chars |
| `AUTH_URL` | your Amplify URL |
| `NEXT_PUBLIC_SITE_URL` | your Amplify URL |
| `NEXT_PUBLIC_SITE_NAME` | `TFRC Vita Nova` |
| `NEXT_PUBLIC_WHATSAPP_PHONE` | `97455049229` |

5. Deploy

**Note:** Amplify is serverless — admin DB writes won't persist (same as Vercel). Use **Option A** if you need full admin on AWS.

---

## Option C — AWS Lightsail ($10/mo)

1. Lightsail → **Create instance** → Linux, $10 plan
2. Same Docker steps as Option A (SSH in, clone, `docker compose up`)

---

## Updating the live site (EC2)

```bash
cd tfrc
git pull
docker compose up -d --build
```

To refresh products from local:

```bash
# On your PC
npm run db:prepare-prod
git add prisma/prod.db && git commit -m "Update catalogue" && git push

# On EC2
git pull && docker compose up -d --build
```

---

## Cost estimate (Option A)

| Service | ~Monthly |
|---------|----------|
| EC2 t3.small | ~$15 |
| 20 GB storage | ~$2 |
| Data transfer | ~$1–5 |
| **Total** | **~$18–22/mo** |

Lightsail $10 plan is simpler if you prefer fixed pricing.

---

## What’s in the repo for AWS

- `Dockerfile` — production container
- `docker-compose.yml` — one-command deploy
- `prisma/prod.db` — full product catalogue

Need help after you create the AWS account? Share your EC2 public IP and I can walk you through the SSH + deploy commands step by step.
