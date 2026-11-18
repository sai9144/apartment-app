# Green Valley Apartments - Hosting & Deployment Guide

## Overview
This document covers free hosting options for the apartment society app (50+ users), including Oracle Cloud Always Free tier and modern alternatives that require no credit card.

---

## Option 1: Oracle Cloud Always Free (Recommended for Full-Stack)

### What You Get (2026 Limits)
| Resource | Always Free Limit |
|----------|-------------------|
| **Arm Ampere A1 VMs** | 2 OCPUs / 12 GB RAM total (1 VM with 2 OCPUs OR 2 VMs with 1 OCPU each) |
| **AMD Micro VMs** | 2 instances × 1/8 OCPU / 1 GB RAM each |
| **Block Volume** | 200 GB total |
| **Object Storage** | 10 GB |
| **Autonomous Database** | 2 databases (OLTP + DW) |
| **Load Balancer** | 1 (10 Mbps) |
| **Outbound Data** | 10 TB/month |

### Key Constraints
- **Home region only** — pick carefully at signup (can't change)
- **Idle reclamation** — VMs stopped >7 days may be reclaimed
- **Database auto-stop** — Autonomous DB stops after ~7 days inactivity
- **Capacity issues** — Popular regions (Ashburn, Phoenix, London) often "out of capacity" for Arm VMs
- **Pay As You Go upgrade** — gets old 4 OCPU/24 GB Arm limits

### Sign Up Process
1. Go to https://cloud.oracle.com/free
2. Click **Start for free**
3. Email → verify → **Home Region** (choose one with Arm capacity)
4. **Phone verification** required (SMS/call)
5. **Credit card** required for identity verification (not charged for Always Free)

### Deploy This App on Oracle

#### 1. Create VM Instance
```bash
# In Oracle Console: Compute → Instances → Create Instance
# - Name: apartment-app
# - Image: Canonical Ubuntu 22.04 (or 24.04)
# - Shape: VM.Standard.A1.Flex (Arm) — 2 OCPUs, 12 GB RAM
# - Network: Create new VCN with public subnet
# - SSH Keys: Paste your public key
```

#### 2. Configure Security List / Network Security Group
Allow ingress:
- **22** (SSH) — your IP only
- **80** (HTTP) — 0.0.0.0/0
- **443** (HTTPS) — 0.0.0.0/0
- **3000** (App dev) — your IP only (optional)

#### 3. SSH & Setup
```bash
ssh ubuntu@<PUBLIC_IP>

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (process manager)
sudo npm i -g pm2

# Clone / upload your app
git clone <your-repo> apartment-app
cd apartment-app/server
npm ci --production

# Build client (if needed) - already static files
cd ../client
# No build step needed for vanilla PWA
```

#### 4. Configure PM2
```bash
# ecosystem.config.js in server/
cat > ecosystem.config.js << 'EOF'
export default {
  apps: [{
    name: 'apartment-app',
    script: 'server.js',
    cwd: '/home/ubuntu/apartment-app/server',
    env: {
      PORT: 3000,
      NODE_ENV: 'production'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M'
  }]
}
EOF

pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

#### 5. Nginx Reverse Proxy + HTTPS (Let's Encrypt)
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Nginx config
sudo tee /etc/nginx/sites-available/apartment-app << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/apartment-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## Option 2: Render.com (Easiest Free Full-Stack)

### Free Tier Limits
- **Web Service**: 512 MB RAM, 0.1 vCPU, 750 hrs/month
- **Spins down** after 15 min inactivity (~30-60s cold start)
- **No credit card** required
- **Custom domains** + free TLS

### Deploy Steps
1. Push code to GitHub
2. Go to https://dashboard.render.com → **New → Web Service**
3. Connect repo → select `apartment-app/server`
4. Settings:
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Plan**: Free
5. Add environment variables if needed
6. Deploy → get `https://your-app.onrender.com`

### Client Hosting (Static)
1. **New → Static Site** → connect same repo
2. **Build Command**: (empty)
3. **Publish Directory**: `client`
4. Deploy → `https://your-app.pages.dev`

---

## Option 3: Koyeb (No Credit Card, Global Free Tier)

### Free Tier
- **1 service**: 512 MB RAM, 0.1 vCPU, 100 GB egress/month
- Regions: Frankfurt, Washington DC
- No spin-down (always running)
- Custom domains + TLS

### Deploy
```bash
# Install Koyeb CLI
curl -fsSL https://cli.koyeb.com/install.sh | sh

# Deploy from GitHub
koyeb init github <your-username>/<repo> --branch main \
  --name apartment-app \
  --build-command "cd server && npm ci" \
  --run-command "cd server && npm start" \
  --port 3000 \
  --region fra
```

---

## Option 4: Railway (Trial Then $5/mo)

- $5 credit/month (covers small app)
- No spin-down
- Excellent DX, PostgreSQL included
- Need credit card after trial

---

## Option 5: Fly.io (Free Allowance)

- **3 shared-cpu-1x VMs** (256 MB RAM each) free
- **3 GB persistent volume** free
- **160 GB outbound** free
- Credit card required (for abuse prevention)

```bash
flyctl launch --name apartment-app --region fra
flyctl deploy
```

---

## Option 6: Static-Only Hosting (Client Only)

If you use a **separate backend** (see below), host the PWA for free:

| Platform | Limits | Custom Domain | Notes |
|----------|--------|---------------|-------|
| **Cloudflare Pages** | Unlimited bandwidth, 100k req/day Workers | ✅ | Best for static + edge functions |
| **Vercel Hobby** | 100 GB/mo, 1M edge req | ✅ | Personal/non-commercial only |
| **Netlify Free** | 300 credits/mo, 100 GB | ✅ | One project over limit pauses all |
| **GitHub Pages** | Unlimited (static only) | ✅ | One site per account/org |
| **Deno Deploy** | 1M req, 20 GB egress | ✅ | Deno-native, edge runtime |

---

## Option 7: Backend-as-a-Service (Replace Node Server)

If you want **zero server management**, swap the Express backend:

| Service | Free Tier | Best For |
|---------|-----------|----------|
| **Supabase** | 500 MB DB, 2 GB bandwidth, 50 MB file storage | Postgres + Auth + Realtime |
| **Appwrite Cloud** | 1 project, 1 GB DB, 10 GB bandwidth | Full backend (auth, DB, storage, functions) |
| **PocketBase** | Self-host (single binary) | SQLite, auth, realtime, file storage |
| **Firebase** | Spark plan: 1 GB DB, 10 GB hosting, 50k auth/mo | Mobile-first, Google ecosystem |
| **Nhost** | 1 project, 500 MB Postgres, 1 GB storage | GraphQL + Hasura + Auth |

### Quick Supabase Migration
1. Create project at https://supabase.com
2. Run SQL from `docs/supabase-schema.sql` (see below)
3. Update `client/js/app.js` API calls to use Supabase client
4. Deploy client to Cloudflare Pages

---

## Recommended Architecture for 50+ Users

```
┌─────────────────┐     HTTPS      ┌──────────────────┐
│   PWA Client    │ ◄─────────────► │   Backend API    │
│ (Cloudflare     │                 │  (Oracle VM /    │
│  Pages / Vercel)│                 │   Render / Koyeb)│
└─────────────────┘                 └────────┬─────────┘
                                             │
                                    ┌────────┴─────────┐
                                    │   JSON Files /   │
                                    │   SQLite /       │
                                    │   Supabase PG    │
                                    └──────────────────┘
```

### Why This Split?
- **Client on CDN** — global, free, instant loads, offline-capable PWA
- **Backend on VM** — full control, WebSocket support, no cold starts
- **Database** — JSON files work for 50 users; migrate to Supabase/SQLite when needed

---

## Quick Decision Matrix

| Priority | Recommendation |
|----------|----------------|
| **Zero cost, full control, learning** | Oracle Always Free VM |
| **Zero cost, zero ops, fastest deploy** | Render (backend) + Cloudflare Pages (frontend) |
| **Always-on, no sleep, global** | Koyeb (backend) + Cloudflare Pages |
| **Scale later, managed DB** | Supabase + Cloudflare Pages |
| **Team collab, preview deploys** | Vercel (if personal) / Netlify |

---

## SSL/TLS for Custom Domains

All platforms above provide **automatic HTTPS**:
- Render / Koyeb / Railway / Fly.io → built-in Let's Encrypt
- Cloudflare Pages / Vercel / Netlify → built-in
- Oracle VM → Nginx + Certbot (see deploy steps)

---

## Environment Variables Checklist

Create `.env` on server (never commit):
```env
PORT=3000
NODE_ENV=production
# If using external DB:
# DATABASE_URL=postgresql://...
# SUPABASE_URL=...
# SUPABASE_KEY=...
```

---

## Monitoring & Maintenance (Free)

| Tool | Purpose |
|------|---------|
| **UptimeRobot** | Free 50 monitors, 5-min checks, email/Telegram alerts |
| **Better Stack** | Free log aggregation + uptime |
| **pm2 monit** | Local process monitoring |
| **Oracle Cloud Monitoring** | Built-in metrics for VM |

---

## Cost at Scale (When You Grow)

| Users | Recommended | Est. Monthly |
|-------|-------------|--------------|
| 50 | Oracle Free / Render Free | $0 |
| 200 | Oracle A1 Flex (paid) / Render Starter | $7-15 |
| 500 | Dedicated VM + Managed DB | $25-50 |
| 1000+ | Kubernetes / Serverless | $100+ |

---

## Security Checklist

- [ ] HTTPS everywhere (enforced)
- [ ] Helmet.js headers (included)
- [ ] CORS restricted to your domain
- [ ] Rate limiting (add `express-rate-limit`)
- [ ] Input validation (add `zod` or `joi`)
- [ ] Secure cookies (if using sessions)
- [ ] Regular `npm audit`
- [ ] Backups: `pm2 save` + data directory snapshots

---

## Quick Start: One-Command Deploy to Render

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "Initial"
gh repo create apartment-app --public --push

# 2. Deploy backend on Render (via dashboard or CLI)
# 3. Deploy frontend on Cloudflare Pages (connect same repo, publish dir: client)

# Done! Your app lives at:
# - API: https://apartment-app-api.onrender.com
# - App: https://apartment-app.pages.dev
```

---

## Support & Troubleshooting

| Issue | Fix |
|-------|-----|
| Oracle "Out of capacity" | Try different home region at signup; or use AMD Micro |
| Render cold starts | Upgrade to Starter ($7/mo) or use Koyeb |
| PWA not installing | Check manifest.json, HTTPS, service worker scope |
| CORS errors | Ensure backend CORS allows your frontend origin |
| Data loss on VM recreate | Mount block volume for `/home/ubuntu/apartment-app/server/data` |

---

## References

- [Oracle Cloud Free Tier FAQ](https://www.oracle.com/cloud/free/faq/)
- [OCI Always Free Resources and Limits](https://rythium.com/oracle-cloud-free-tier/)
- [Render Free Tier Docs](https://render.com/docs/free)
- [Koyeb Free Tier](https://www.koyeb.com/free-tier)
- [Cloudflare Pages Limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Supabase Free Tier](https://supabase.com/pricing)
- [Every Hosting Free Tier Compared (Sept 2026)](https://flaviocopes.com/hosting-free-tiers/)
- [Free Hosting Without Credit Card](https://blog.light-cloud.com/comparisons/free-hosting-no-credit-card)