#!/usr/bin/env node
// Refuses to start the dev server when .env points at a hosted Supabase project.
// QA writes against production are the failure mode this exists to prevent (CLIAA-44).
import { readFileSync, existsSync } from 'node:fs'

const ENV_PATH = new URL('../.env', import.meta.url)
if (!existsSync(ENV_PATH)) process.exit(0)

const urls = readFileSync(ENV_PATH, 'utf8')
  .split('\n')
  .filter((l) => /^\s*(VITE_)?SUPABASE_URL=/.test(l))
  .map((l) => ({ key: l.split('=')[0].trim(), value: l.slice(l.indexOf('=') + 1).trim() }))

const hosted = urls.filter(({ value }) => /\.supabase\.(co|in)/.test(value))

if (hosted.length > 0) {
  console.error(
    [
      '',
      '  REFUSING TO START: .env points at a hosted Supabase project.',
      '',
      ...hosted.map(({ key, value }) => `    ${key}=${value}`),
      '',
      '  The dev server must run against the local stack (supabase start,',
      '  http://127.0.0.1:54321). Running QA against a hosted project writes',
      '  test bookings, patients, and accounts into real clinic data.',
      '',
      '  Fix: restore local values in .env from `supabase status`.',
      '',
    ].join('\n'),
  )
  process.exit(1)
}
