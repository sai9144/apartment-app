# Green Valley Apartments — Society Management PWA

A MyGate-inspired apartment society management app built as a **Progressive Web App** (works on PC, Android, iOS) with a Node.js/Express backend.

## Features

| Module | Resident | Guard | Admin |
|--------|:--------:|:-----:|:-----:|
| **Visitors** — add, view, approve/reject, check-in/out | ✅ | ✅ | ✅ |
| **Complaints** — raise maintenance requests | ✅ | 👁️ | ✅ |
| **Notices** — society announcements (pin, priority) | 👁️ | 👁️ | ✅ |
| **Polls** — community voting | ✅ | 👁️ | ✅ |
| **Directory** — resident contact list | ✅ | ✅ | ✅ |
| **Messages** — internal messaging | ✅ | ✅ | ✅ |
| **Settings** — society config | | | ✅ |

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS PWA (no build step)
  - Service Worker for offline support
  - Web App Manifest for installability
  - Responsive: mobile-first, works on desktop
- **Backend**: Node.js 20 + Express
  - JSON file storage (zero config, works anywhere)
  - JWT-like token auth (user ID as bearer token)
  - Role-based access: resident / guard / admin
- **Deployment**: Any Node host (Oracle Free, Render, Koyeb, Fly.io, Railway)

## Quick Start (Local)

```bash
# 1. Install dependencies
cd server && npm ci

# 2. Start server
npm start
# Server runs on http://localhost:3000

# 3. Open in browser
# Visit http://localhost:3000
```

### First Run
1. Open http://localhost:3000
2. Click **"Create Account"** → register as **admin** (first user becomes admin)
3. Sign in → you're in!

### Test Accounts
After first admin registers, create test users:
- **Resident**: apartment "A-101"
- **Guard**: role "guard" (set manually in data/users.json)
- **Admin**: role "admin"

## Project Structure

```
apartment-app/
├── client/                 # PWA Frontend
│   ├── index.html          # Single HTML shell
│   ├── css/app.css         # Complete styling (dark mode, responsive)
│   ├── js/app.js           # App logic (tabs, modals, API calls)
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service Worker
│   └── icons/              # App icons (72-512px)
├── server/                 # Node.js Backend
│   ├── server.js           # Express app + all routes
│   ├── store.js            # JSON file persistence
│   ├── package.json
│   └── data/               # Auto-created JSON databases
├── docs/
│   ├── HOSTING.md          # Complete deployment guide
│   └── supabase-schema.sql # Supabase migration schema
├── generate-icons.js       # Icon generator (sharp)
└── README.md
```

## API Endpoints

| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/api/auth/register` | — | — |
| POST | `/api/auth/login` | — | — |
| GET | `/api/auth/me` | ✅ | any |
| GET | `/api/stats` | ✅ | any |
| GET/POST | `/api/visitors` | ✅ | resident |
| PUT | `/api/visitors/:id/status` | ✅ | guard |
| GET/POST | `/api/complaints` | ✅ | resident |
| PUT | `/api/complaints/:id` | ✅ | admin |
| GET/POST | `/api/notices` | ✅ | admin (write) |
| GET/POST | `/api/polls` | ✅ | admin (write) |
| POST | `/api/polls/:id/vote` | ✅ | resident |
| GET | `/api/directory` | ✅ | any |
| GET/POST | `/api/messages` | ✅ | any |
| GET/PUT | `/api/settings` | ✅ | admin (write) |
| GET | `/api/health` | — | — |

## Deploy for Free (50+ Users)

### Option A: Oracle Cloud Always Free (Full Control)
- 2 OCPUs / 12 GB Arm VM — always free
- Run Node + Nginx + PM2
- See `docs/HOSTING.md` for step-by-step

### Option B: Render + Cloudflare Pages (Easiest)
```
Backend:  Render Web Service (Free)     → https://api.yourapp.onrender.com
Frontend: Cloudflare Pages (Free)       → https://yourapp.pages.dev
```
1. Push to GitHub
2. Connect repo to Render (build: `npm ci`, start: `npm start`)
3. Connect same repo to Cloudflare Pages (publish dir: `client`)

### Option C: Supabase + Cloudflare Pages (Zero Server)
1. Run `docs/supabase-schema.sql` in Supabase
2. Update `client/js/app.js` to use Supabase JS client
3. Deploy `client/` to Cloudflare Pages

## PWA Features

- **Installable**: "Add to Home Screen" on Android/iOS/Chrome/Edge
- **Offline**: Service Worker caches shell + API GET responses
- **Responsive**: 320px - 1920px+, bottom nav on mobile, drawer on desktop
- **Dark Mode**: Automatic via `prefers-color-scheme`

## Development

```bash
# Server with auto-reload
cd server && npm run dev

# Generate icons (after editing client/icons/icon.svg)
node generate-icons.js
```

## Data Storage

Default: JSON files in `server/data/`
- `users.json`, `apartments.json`, `visitors.json`
- `notices.json`, `polls.json`, `messages.json`
- `complaints.json`, `settings.json`

For production scale (>200 users), migrate to:
- **Supabase** (PostgreSQL) — see `docs/supabase-schema.sql`
- **SQLite** (better performance than JSON)
- **MongoDB Atlas** (free tier)

## Security Notes

- Passwords hashed with bcrypt (cost 10)
- Helmet.js security headers
- CORS enabled (configure for production)
- Role checks on every mutating endpoint
- Input validation on all forms

## License

MIT — free for personal and commercial use.

## Support

- **Hosting Guide**: `docs/HOSTING.md`
- **Issues**: GitHub Issues
- **MyGate Reference**: This app mimics core MyGate flows (visitor management, complaints, notices, polls)