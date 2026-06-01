import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import * as ExcelJS from 'exceljs'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(req: NextRequest) {
  // Auth: either cron secret or api secret
  const auth = req.headers.get('authorization')
  const apiSecret = req.headers.get('x-api-secret')
  const validCron = auth === `Bearer ${process.env.CRON_SECRET}`
  const validApi = apiSecret === process.env.API_SECRET
  const isManualRefresh = new URL(req.url).searchParams.get('refresh') === '1'

  if (!validCron && !validApi && !isManualRefresh) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sheetId = process.env.GOOGLE_SHEETS_FINANCE_ID
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

  if (!sheetId || !serviceEmail || !serviceKey) {
    return NextResponse.json({ error: 'Finance not configured' }, { status: 400 })
  }

  // Get OAuth2 token for service account
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: serviceEmail,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const { createSign } = await import('crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(serviceKey.replace(/\\n/g, '\n'), 'base64url')
  const jwt = `${header}.${payload}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const { access_token } = await tokenRes.json()

  // Download XLSX via Drive export
  const xlsxRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${sheetId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  )
  const xlsxBuffer = await xlsxRes.arrayBuffer()

  // Parse all sheets
  const workbook = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(Buffer.from(xlsxBuffer) as any)

  const sheetDump: Record<string, (string | number | null)[][]> = {}
  workbook.worksheets.forEach(ws => {
    const rows: (string | number | null)[][] = []
    ws.eachRow(row => {
      rows.push(row.values as (string | number | null)[])
    })
    sheetDump[ws.name] = rows.slice(0, 50) // First 50 rows per sheet
  })

  // Send to Claude
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You are a financial data extractor. Given spreadsheet data (JSON of sheets → rows), extract net worth information.
Return ONLY this JSON:
{
  "net_worth": number,
  "currency": "USD",
  "as_of": "YYYY-MM-DD",
  "categories": [{ "name": string, "value": number }],
  "notes": string (flag any ambiguity or double-counting concerns)
}
Avoid double-counting. Use the most recent data. No markdown.`,
    messages: [{ role: 'user', content: JSON.stringify(sheetDump) }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text.trim()
  let financeData: Record<string, unknown>
  try {
    financeData = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  // Save snapshot to daily_logs
  const db = getServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', today).single()

  const notes = existing?.notes ?? {}
  notes.finance = { ...financeData, updated_at: new Date().toISOString() }

  existing
    ? await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await db.from('daily_logs').insert({ user_id: USER_ID, log_date: today, notes })

  return NextResponse.json({ ok: true, data: financeData })
}
