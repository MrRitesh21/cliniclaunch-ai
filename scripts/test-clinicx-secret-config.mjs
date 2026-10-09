#!/usr/bin/env node
// Preflight only: never prints values or loads application/provider code.
// VITE_* is public build-time configuration, NOT a place for server credentials.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export function publicEnvironmentFindings(environment) {
  const findings = [];
  for (const [name, value] of Object.entries(environment)) {
    if (!name.startsWith('VITE_')) continue;
    const text = String(value ?? '').trim();
    if (/(?:^|_)(?:PRIVATE(?:_KEY)?|SECRET|PASSWORD|SERVICE_ROLE(?:_KEY)?|DATABASE_URL|DB_URL|ACCESS_TOKEN|REFRESH_TOKEN|WEBHOOK)(?:_|$)/i.test(name)) {
      findings.push({ name, reason: 'server-only name uses browser-exposed prefix' });
      continue;
    }
    if (text.startsWith('sb_secret_')) {
      findings.push({ name, reason: 'Supabase secret key must be server-only' });
      continue;
    }
    for (const token of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
      try {
        const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
        if (claims.role && claims.role !== 'anon') findings.push({ name, reason: 'non-anon JWT must not be browser build configuration' });
      } catch { /* ordinary public strings need not be JWTs */ }
    }
    if (/(?:postgres(?:ql)?|mysql|redis):\/\/[^\s/]*:[^\s/]*@/i.test(text)) {
      findings.push({ name, reason: 'credential-bearing connection URL must be server-only' });
    }
  }
  return findings;
}
export function checkPublicEnvironment(root = process.cwd(), environment = process.env) {
  const findings = publicEnvironmentFindings(environment);
  // Check every local env variant, so --mode cannot bypass the guard. Values are
  // checked separately instead of merged: an override must not conceal a leak.
  for (const filename of fs.readdirSync(root).filter(name => /^\.env(?:\.[a-zA-Z0-9_-]+)*$/.test(name) && name !== '.env.example')) {
    const file = path.join(root, filename);
    if (!fs.statSync(file).isFile()) continue;
    const values = {};
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?(VITE_[A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (match) values[match[1]] = match[2].replace(/^['"]|['"]\s*(?:#.*)?$/g, '').trim();
    }
    for (const finding of publicEnvironmentFindings(values)) findings.push({ ...finding, file: filename });
  }
  return findings;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const findings = checkPublicEnvironment();
  if (findings.length) {
    for (const finding of findings) console.error(`Public environment rejected: ${finding.name}${finding.file ? ` (${finding.file})` : ''}: ${finding.reason}`);
    process.exitCode = 1;
  }
}
