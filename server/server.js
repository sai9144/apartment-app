// server.js - Apartment Society App Backend
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import { read, readOne, insert, update, remove, readSettings, writeSettings, uid } from './store.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json({ limit: '2mb' }));
app.use(express.static('../client'));

// ---- Auth helpers ----
async function hashPassword(pwd) {
  return bcrypt.hash(pwd, 10);
}

async function checkPassword(pwd, hash) {
  return bcrypt.compare(pwd, hash);
}

function authMiddleware(requiredRole = null) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    const user = await readOne('users', token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = user;
    next();
  };
}

// ============ AUTH ============
app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, apartment, role = 'resident', password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const existing = (await read('users')).find(u => u.email === email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await hashPassword(password);
  const user = {
    id: uid('usr'),
    name, email, phone, apartment, role,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  await insert('users', user);

  // Return user without passwordHash + token (id doubles as token for simplicity)
  const { passwordHash: _, ...safeUser } = user;
  res.status(201).json({ user: safeUser, token: user.id });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const users = await read('users');
  const user = users.find(u => u.email === email);
  if (!user || !(await checkPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser, token: user.id });
});

app.get('/api/auth/me', authMiddleware(), (req, res) => {
  const { passwordHash: _, ...safeUser } = req.user;
  res.json(safeUser);
});

// ============ SETTINGS ============
app.get('/api/settings', async (req, res) => {
  const settings = await readSettings();
  res.json(settings);
});

app.put('/api/settings', authMiddleware('admin'), async (req, res) => {
  const settings = await readSettings();
  const updated = { ...settings, ...req.body, updatedAt: new Date().toISOString() };
  await writeSettings(updated);
  res.json(updated);
});

// ============ APARTMENTS ============
app.get('/api/apartments', authMiddleware(), async (req, res) => {
  const items = await read('apartments');
  res.json(items);
});

app.post('/api/apartments', authMiddleware('admin'), async (req, res) => {
  const { number, tower, floor, bedrooms, areaSqft } = req.body;
  if (!number || !tower) return res.status(400).json({ error: 'number and tower required' });
  const item = { id: uid('apt'), number, tower, floor, bedrooms, areaSqft, createdAt: new Date().toISOString() };
  await insert('apartments', item);
  res.status(201).json(item);
});

app.put('/api/apartments/:id', authMiddleware('admin'), async (req, res) => {
  const item = await update('apartments', req.params.id, req.body);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.delete('/api/apartments/:id', authMiddleware('admin'), async (req, res) => {
  const ok = await remove('apartments', req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// ============ VISITORS (MyGate-like) ============
app.get('/api/visitors', authMiddleware(), async (req, res) => {
  let items = await read('visitors');
  // filter by user's apartment if resident
  if (req.user.role === 'resident') {
    items = items.filter(v => v.apartment === req.user.apartment);
  }
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

app.post('/api/visitors', authMiddleware(), async (req, res) => {
  const { visitorName, visitorPhone, purpose, vehicleNumber, expectedArrival, durationMins = 120 } = req.body;
  if (!visitorName || !purpose) return res.status(400).json({ error: 'visitorName and purpose required' });

  const item = {
    id: uid('vis'),
    apartment: req.user.apartment,
    residentId: req.user.id,
    visitorName,
    visitorPhone,
    purpose,
    vehicleNumber,
    expectedArrival: expectedArrival || new Date().toISOString(),
    durationMins,
    status: 'pending', // pending, approved, rejected, checked_in, checked_out
    guardNotes: '',
    createdAt: new Date().toISOString(),
  };
  await insert('visitors', item);
  res.status(201).json(item);
});

app.put('/api/visitors/:id/status', authMiddleware('guard'), async (req, res) => {
  const { status, guardNotes } = req.body; // approved, rejected, checked_in, checked_out
  const valid = ['pending', 'approved', 'rejected', 'checked_in', 'checked_out'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const item = await update('visitors', req.params.id, { status, guardNotes });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// ============ NOTICES ============
app.get('/api/notices', authMiddleware(), async (req, res) => {
  const items = await read('notices');
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

app.post('/api/notices', authMiddleware('admin'), async (req, res) => {
  const { title, body, priority = 'normal', pinned = false } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });
  const item = {
    id: uid('not'),
    title, body, priority, pinned,
    authorId: req.user.id,
    authorName: req.user.name,
    createdAt: new Date().toISOString(),
  };
  await insert('notices', item);
  res.status(201).json(item);
});

app.put('/api/notices/:id', authMiddleware('admin'), async (req, res) => {
  const item = await update('notices', req.params.id, req.body);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.delete('/api/notices/:id', authMiddleware('admin'), async (req, res) => {
  const ok = await remove('notices', req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// ============ POLLS ============
app.get('/api/polls', authMiddleware(), async (req, res) => {
  const items = await read('polls');
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

app.post('/api/polls', authMiddleware('admin'), async (req, res) => {
  const { question, options, expiresAt } = req.body;
  if (!question || !options || options.length < 2) return res.status(400).json({ error: 'question and at least 2 options required' });
  const item = {
    id: uid('pol'),
    question,
    options: options.map(o => ({ id: uid('opt'), text: o, votes: 0 })),
    expiresAt: expiresAt || null,
    createdAt: new Date().toISOString(),
    votes: {}, // userId -> optionId
  };
  await insert('polls', item);
  res.status(201).json(item);
});

app.post('/api/polls/:id/vote', authMiddleware(), async (req, res) => {
  const { optionId } = req.body;
  const poll = await readOne('polls', req.params.id);
  if (!poll) return res.status(404).json({ error: 'Not found' });
  if (poll.votes[req.user.id]) return res.status(409).json({ error: 'Already voted' });
  if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) return res.status(400).json({ error: 'Poll expired' });

  const opt = poll.options.find(o => o.id === optionId);
  if (!opt) return res.status(400).json({ error: 'Invalid option' });

  opt.votes++;
  poll.votes[req.user.id] = optionId;
  await update('polls', req.params.id, { options: poll.options, votes: poll.votes });
  res.json(poll);
});

// ============ COMPLAINTS / MAINTENANCE ============
app.get('/api/complaints', authMiddleware(), async (req, res) => {
  let items = await read('complaints');
  if (req.user.role === 'resident') {
    items = items.filter(c => c.residentId === req.user.id);
  }
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

app.post('/api/complaints', authMiddleware(), async (req, res) => {
  const { title, description, category, priority = 'normal', photos = [] } = req.body;
  if (!title || !description || !category) return res.status(400).json({ error: 'title, description, category required' });
  const item = {
    id: uid('cmp'),
    title, description, category, priority, photos,
    residentId: req.user.id,
    residentName: req.user.name,
    apartment: req.user.apartment,
    status: 'open', // open, in_progress, resolved, closed
    assignedTo: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await insert('complaints', item);
  res.status(201).json(item);
});

app.put('/api/complaints/:id', authMiddleware('admin'), async (req, res) => {
  const item = await update('complaints', req.params.id, { ...req.body, updatedAt: new Date().toISOString() });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.delete('/api/complaints/:id', authMiddleware('admin'), async (req, res) => {
  const ok = await remove('complaints', req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// ============ MESSAGES (internal messaging) ============
app.get('/api/messages', authMiddleware(), async (req, res) => {
  const items = await read('messages');
  const filtered = items.filter(m => m.toUserId === req.user.id || m.fromUserId === req.user.id);
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(filtered);
});

app.post('/api/messages', authMiddleware(), async (req, res) => {
  const { toUserId, subject, body } = req.body;
  if (!toUserId || !body) return res.status(400).json({ error: 'toUserId and body required' });
  const item = {
    id: uid('msg'),
    fromUserId: req.user.id,
    fromUserName: req.user.name,
    toUserId,
    subject: subject || '',
    body,
    read: false,
    createdAt: new Date().toISOString(),
  };
  await insert('messages', item);
  res.status(201).json(item);
});

app.put('/api/messages/:id/read', authMiddleware(), async (req, res) => {
  const item = await update('messages', req.params.id, { read: true });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// ============ DIRECTORY ============
app.get('/api/directory', authMiddleware(), async (req, res) => {
  const users = await read('users');
  const safe = users.map(u => ({
    id: u.id,
    name: u.name,
    apartment: u.apartment,
    phone: u.phone,
    role: u.role,
  }));
  res.json(safe);
});

// ============ STATS for dashboard ============
app.get('/api/stats', authMiddleware(), async (req, res) => {
  const [users, visitors, notices, polls, complaints] = await Promise.all([
    read('users'), read('visitors'), read('notices'), read('polls'), read('complaints')
  ]);
  res.json({
    totalResidents: users.filter(u => u.role === 'resident').length,
    pendingVisitors: visitors.filter(v => v.status === 'pending').length,
    activeNotices: notices.filter(n => !n.expiresAt || new Date(n.expiresAt) > new Date()).length,
    openComplaints: complaints.filter(c => c.status === 'open' || c.status === 'in_progress').length,
    activePolls: polls.filter(p => !p.expiresAt || new Date(p.expiresAt) > new Date()).length,
  });
});

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`API base: http://localhost:${PORT}/api`);
});