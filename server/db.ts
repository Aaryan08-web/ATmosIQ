import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  organization TEXT,
  role TEXT NOT NULL DEFAULT 'analyst',
  password_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Failed-login tracking is per (email, client IP), so a stranger cannot lock a real user out of their account.
CREATE TABLE IF NOT EXISTS login_failures (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);

-- Historical environmental snapshots
CREATE TABLE IF NOT EXISTS environmental_snapshots (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  fire_count INTEGER NOT NULL,
  unhealthy_aqi_count INTEGER NOT NULL,
  worst_aqi INTEGER,
  worst_city TEXT,
  total_frp REAL,
  created_at INTEGER NOT NULL
);

-- Persistent environmental alerts with deduplication fingerprint
CREATE TABLE IF NOT EXISTS environmental_alerts (
  id TEXT PRIMARY KEY,
  fingerprint TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  source TEXT NOT NULL,
  details TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`);

export interface EnvironmentalAlertRow {
  id: string;
  fingerprint: string;
  type: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  title: string;
  location: string;
  lat: number;
  lon: number;
  source: string;
  details: string;
  acknowledged: number;
  created_at: string;
}

export interface EnvironmentalSnapshotRow {
  id: string;
  timestamp: string;
  fire_count: number;
  unhealthy_aqi_count: number;
  worst_aqi: number | null;
  worst_city: string | null;
  total_frp: number | null;
  created_at: number;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  role: 'admin' | 'analyst' | 'researcher' | 'observer';
  password_hash: string;
  failed_attempts: number;
  locked_until: number;
  created_at: string;
}
