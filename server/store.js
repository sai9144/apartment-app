// store.js - JSON-file based persistence (works on any free server, no DB needed)
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const files = {
  users: 'users.json',
  apartments: 'apartments.json',
  visitors: 'visitors.json',
  notices: 'notices.json',
  polls: 'polls.json',
  messages: 'messages.json',
  complaints: 'complaints.json',
  settings: 'settings.json',
};

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function read(name) {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, files[name]), 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function readOne(name, id) {
  const items = await read(name);
  return items.find((i) => i.id === id) || null;
}

async function write(name, items) {
  await ensureDir();
  await fs.writeFile(path.join(DATA_DIR, files[name]), JSON.stringify(items, null, 2));
}

async function insert(name, item) {
  const items = await read(name);
  items.push(item);
  await write(name, items);
  return item;
}

async function update(name, id, patch) {
  const items = await read(name);
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch, id, updatedAt: new Date().toISOString() };
  await write(name, items);
  return items[idx];
}

async function remove(name, id) {
  const items = await read(name);
  const next = items.filter((i) => i.id !== id);
  await write(name, next);
  return items.length !== next.length;
}

async function readSettings() {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, files.settings), 'utf8');
    return JSON.parse(raw);
  } catch {
    return defaultSettings();
  }
}

async function writeSettings(obj) {
  await ensureDir();
  await fs.writeFile(path.join(DATA_DIR, files.settings), JSON.stringify(obj, null, 2));
}

function defaultSettings() {
  return {
    societyName: 'Green Valley Apartments',
    address: '123 Green Valley Road, Sample City',
    contactEmail: 'admin@greenvalley.example',
    contactPhone: '+91-98765-43210',
    gateHours: '06:00 - 23:00',
    maintenancePhone: '+91-98765-43299',
    createdAt: new Date().toISOString(),
  };
}

function uid(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

export { read, readOne, insert, update, remove, readSettings, writeSettings, uid, DATA_DIR };