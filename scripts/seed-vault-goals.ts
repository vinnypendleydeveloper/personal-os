/**
 * One-time seed script: pushes real goals from ~/Desktop/AI Brain/ into the dashboard.
 * Run: npx ts-node --esm scripts/seed-vault-goals.ts
 * Or:  npx tsx scripts/seed-vault-goals.ts
 *
 * Requires NEXT_PUBLIC_APP_URL and DASHBOARD_PASSWORD in .env.local (or set inline).
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const PASSWORD = process.env.DASHBOARD_PASSWORD ?? ''

if (!PASSWORD) {
  console.error('Set DASHBOARD_PASSWORD env var before running (or pass it inline).')
  process.exit(1)
}

// ── Real goals pulled from vault ──────────────────────────────────────────────

const WEEK_GOALS = [
  { id: crypto.randomUUID(), text: 'Hit gym 6 days (current split)', done: false },
  { id: crypto.randomUUID(), text: 'Follow up on internship outreach (Craig, Mike, Brian, Sam)', done: false },
  { id: crypto.randomUUID(), text: 'Work on freelance web dev client or AI business lead', done: false },
  { id: crypto.randomUUID(), text: 'Eat clean calorie surplus every day', done: false },
  { id: crypto.randomUUID(), text: 'Read / study something finance or econ-related', done: false },
]

const MONTH_GOALS = [
  { id: crypto.randomUUID(), text: 'Land 1+ summer internship or mentorship call', done: false },
  { id: crypto.randomUUID(), text: 'Hit 145 lbs (on track to 160 by end of summer)', done: false },
  { id: crypto.randomUUID(), text: 'Close 1 new web dev or AI business client', done: false },
  { id: crypto.randomUUID(), text: 'Finalize USC housing and orientation prep', done: false },
  { id: crypto.randomUUID(), text: 'Build first month of tennis lesson client base', done: false },
  { id: crypto.randomUUID(), text: 'Graduate Loyola High School', done: false },
]

// ── Auth + seed ───────────────────────────────────────────────────────────────

async function run() {
  // 1. Get auth cookie
  const loginRes = await fetch(`${APP_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
    redirect: 'manual',
  })

  const setCookie = loginRes.headers.get('set-cookie') ?? ''
  const cookieMatch = setCookie.match(/(pos_auth=[^;]+)/)
  if (!cookieMatch) {
    console.error('Auth failed — check DASHBOARD_PASSWORD or make sure the dev server is running.')
    process.exit(1)
  }
  const cookie = cookieMatch[1]

  // 2. Check existing goals (don't nuke user edits — merge instead)
  const getRes = await fetch(`${APP_URL}/api/goals`, {
    headers: { Cookie: cookie },
  })
  const existing = await getRes.json()

  const week = existing.week?.length > 0 ? existing.week : WEEK_GOALS
  const month = existing.month?.length > 0 ? existing.month : MONTH_GOALS

  if (existing.week?.length > 0) {
    console.log(`Goals already seeded (${existing.week.length} week, ${existing.month.length} month) — skipping overwrite.`)
    console.log('Delete goals from the dashboard first if you want to re-seed.')
    return
  }

  // 3. POST goals
  const postRes = await fetch(`${APP_URL}/api/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ week, month }),
  })

  if (!postRes.ok) {
    console.error('Failed to save goals:', await postRes.text())
    process.exit(1)
  }

  console.log(`✓ Seeded ${WEEK_GOALS.length} week goals and ${MONTH_GOALS.length} month goals.`)
  console.log('  Open the dashboard → goals card to see them.')
}

run().catch(e => { console.error(e); process.exit(1) })
