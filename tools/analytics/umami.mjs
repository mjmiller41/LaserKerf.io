#!/usr/bin/env node
/**
 * Umami auth helper for LaserKerf analytics (self-hosted fork at
 * analytics.mjmiller.cloud). The fork can't issue API keys, so we authenticate
 * with username/password and cache the returned JWT, re-logging-in when it dies.
 *
 * Config comes from `tools/analytics/.env` (gitignored) — see `.env.example`.
 * No dependencies (Node 20+ global fetch).
 *
 *   node tools/analytics/umami.mjs refresh   # force a fresh login → token file
 *   node tools/analytics/umami.mjs check     # is the cached token still valid?
 *   node tools/analytics/umami.mjs token      # print a valid token (refresh if needed)
 *
 * Reuse in other scripts:  import { getToken } from './umami.mjs'
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(HERE, '.env');
const DEFAULT_TOKEN_FILE = '/home/michael/Code/analytics-mjmiller-cloud-token.json';
// Config is merged from these files (later wins), then UMAMI_* from process.env.
// Non-secret config (base URL, website id) lives in tools/analytics/.env;
// credentials may live there or in the shared ~/Code/.env.umami (USER/PASSWORD).
const ENV_FILES = [ENV_FILE, '/home/michael/Code/.env.umami'];

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    if (/^\s*#/.test(raw) || !raw.includes('=')) continue;
    const i = raw.indexOf('=');
    out[raw.slice(0, i).trim()] = raw.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function loadConfig() {
  const cfg = {};
  for (const f of ENV_FILES) Object.assign(cfg, parseEnvFile(f));
  if (process.env.UMAMI_ENV_FILE) Object.assign(cfg, parseEnvFile(process.env.UMAMI_ENV_FILE));
  // Only UMAMI_-prefixed process.env overrides (so the shell's $USER never leaks in).
  for (const k of Object.keys(process.env)) if (k.startsWith('UMAMI_')) cfg[k] = process.env[k];
  const base = (cfg.UMAMI_BASE_URL || '').replace(/\/$/, '');
  if (!base) throw new Error(`Set UMAMI_BASE_URL in ${ENV_FILE}`);
  return {
    base,
    username: cfg.UMAMI_USERNAME || cfg.USER || '',
    password: cfg.UMAMI_PASSWORD || cfg.PASSWORD || '',
    websiteId: cfg.UMAMI_WEBSITE_ID || '',
    tokenFile: cfg.UMAMI_TOKEN_FILE || DEFAULT_TOKEN_FILE,
  };
}

function cachedToken(cfg) {
  try {
    return JSON.parse(readFileSync(cfg.tokenFile, 'utf8')).token || null;
  } catch {
    return null;
  }
}

/** A token is valid if an authenticated read succeeds (verify endpoint is absent on this fork). */
async function tokenValid(cfg, token) {
  if (!token || !cfg.websiteId) return false;
  const res = await fetch(`${cfg.base}/api/websites/${cfg.websiteId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status === 200;
}

async function login(cfg) {
  if (!cfg.username || !cfg.password) {
    throw new Error(`Set UMAMI_USERNAME and UMAMI_PASSWORD in ${ENV_FILE}`);
  }
  const res = await fetch(`${cfg.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: cfg.username, password: cfg.password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json(); // { token, user }
  const record = { token: data.token, user: data.user, obtainedAt: new Date().toISOString() };
  writeFileSync(cfg.tokenFile, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  return record.token;
}

/** Return a valid token, re-logging-in if the cached one is missing/expired. */
export async function getToken() {
  const cfg = loadConfig();
  const token = cachedToken(cfg);
  if (await tokenValid(cfg, token)) return token;
  return login(cfg);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const cmd = process.argv[2];
  try {
    const cfg = loadConfig();
    if (cmd === 'refresh') {
      await login(cfg);
      console.error(`✓ token refreshed → ${cfg.tokenFile}`);
    } else if (cmd === 'check') {
      const ok = await tokenValid(cfg, cachedToken(cfg));
      console.error(ok ? '✓ cached token valid' : '✗ cached token invalid/expired (run: refresh)');
      process.exit(ok ? 0 : 1);
    } else if (cmd === 'token') {
      process.stdout.write(await getToken());
    } else {
      console.error('usage: node tools/analytics/umami.mjs <refresh|check|token>');
      process.exit(2);
    }
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
