import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { classifyCapture } from '@/lib/router/classifyCapture'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface TelegramUpdate {
  message?: {
    message_id: number
    from?: { id: number }
    chat: { id: number }
    text?: string
    voice?: { file_id: string; duration: number }
  }
  callback_query?: {
    id: string
    from: { id: number }
    message?: { chat: { id: number }; message_id: number }
    data?: string
  }
}

async function sendTelegram(chatId: number, text: string, extra?: Record<string, unknown>) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra }),
  })
}

async function answerCallback(callbackQueryId: string) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  })
}

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update: TelegramUpdate = await req.json()

  // Handle urgency override via inline keyboard
  if (update.callback_query) {
    const { id, from, message, data } = update.callback_query
    if (String(from.id) !== process.env.TELEGRAM_USER_ID) {
      await answerCallback(id)
      return NextResponse.json({ ok: true })
    }

    // data format: "urgency:taskId:value"
    if (data?.startsWith('urgency:') && message) {
      const [, taskId, urgency] = data.split(':')
      const db = getServiceClient()
      await db.from('tasks').update({ urgency, updated_at: new Date().toISOString() }).eq('id', taskId)
      await answerCallback(id)
      await sendTelegram(message.chat.id, `✓ Updated urgency to *${urgency.replace('_', ' ')}*`)
    }
    return NextResponse.json({ ok: true })
  }

  const msg = update.message
  if (!msg) return NextResponse.json({ ok: true })

  // Only respond to your Telegram ID
  if (String(msg.from?.id) !== process.env.TELEGRAM_USER_ID) {
    return NextResponse.json({ ok: true })
  }

  const chatId = msg.chat.id
  let text = msg.text ?? ''

  // Transcribe voice note
  if (msg.voice) {
    try {
      // Get file path from Telegram
      const fileRes = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${msg.voice.file_id}`
      )
      const fileData = await fileRes.json()
      const filePath = fileData.result.file_path

      // Download the audio
      const audioRes = await fetch(
        `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`
      )
      const audioBuffer = await audioRes.arrayBuffer()
      const audioFile = new File([audioBuffer], 'voice.ogg', { type: 'audio/ogg' })

      // Transcribe with Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
      })
      text = transcription.text
      await sendTelegram(chatId, `🎙 *Transcribed:* ${text}`)
    } catch (err) {
      console.error('Whisper transcription error:', err)
      await sendTelegram(chatId, '❌ Failed to transcribe voice note. Try sending as text.')
      return NextResponse.json({ ok: true })
    }
  }

  if (!text) return NextResponse.json({ ok: true })

  // Classify
  const classification = await classifyCapture(text)

  // Write raw capture
  const db = getServiceClient()
  const { data: capture } = await db.from('raw_captures').insert({
    user_id: USER_ID,
    source: 'telegram',
    raw_text: text,
    classification,
    llm_source: 'anthropic',
    routed_to: classification.kind,
  }).select().single()

  // Route to task if applicable
  let taskId: string | null = null
  if (classification.kind === 'task' && capture) {
    const { data: task } = await db.from('tasks').insert({
      user_id: USER_ID,
      title: classification.summary,
      description: text,
      urgency: classification.urgency,
      key: classification.key,
      tags: classification.tags,
      priority_score: classification.key ? 10 : 5,
    }).select().single()
    if (task) taskId = task.id
  }

  // Audit log
  if (capture) {
    await db.from('audit_log').insert({
      user_id: USER_ID,
      action: 'capture',
      resource_type: 'raw_captures',
      resource_id: capture.id,
      metadata: { kind: classification.kind, source: 'telegram' },
    })
  }

  // Reply with confirmation + urgency override keyboard (if it was a task)
  const confirmText = `✓ Captured as *${classification.kind}*\n_${classification.summary}_`

  if (classification.kind === 'task' && taskId) {
    await sendTelegram(chatId, confirmText, {
      reply_markup: {
        inline_keyboard: [[
          { text: '🔴 Today', callback_data: `urgency:${taskId}:today` },
          { text: '🟡 This Week', callback_data: `urgency:${taskId}:this_week` },
          { text: '🔵 This Month', callback_data: `urgency:${taskId}:this_month` },
          { text: '⚪ Someday', callback_data: `urgency:${taskId}:someday` },
        ]],
      },
    })
  } else {
    await sendTelegram(chatId, confirmText)
  }

  return NextResponse.json({ ok: true })
}
