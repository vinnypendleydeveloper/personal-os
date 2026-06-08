import { Fragment, ReactNode } from 'react'

// Inline: **bold**, *italic*, `code`
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Split on **bold**, *italic*, `code` while keeping delimiters
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  const parts = text.split(regex)
  parts.forEach((part, i) => {
    if (!part) return
    if (part.startsWith('**') && part.endsWith('**')) {
      nodes.push(<strong key={i} style={{ color: 'var(--fg)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>)
    } else if (part.startsWith('`') && part.endsWith('`')) {
      nodes.push(
        <code key={i} style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.85em',
          background: 'var(--bg-3)', padding: '1px 5px', borderRadius: 4, color: 'var(--accent)',
        }}>{part.slice(1, -1)}</code>
      )
    } else if (part.startsWith('*') && part.endsWith('*')) {
      nodes.push(<em key={i} style={{ color: 'var(--fg-2)' }}>{part.slice(1, -1)}</em>)
    } else {
      nodes.push(<Fragment key={i}>{part}</Fragment>)
    }
  })
  return nodes
}

/**
 * Minimal, dependency-free markdown renderer tuned for AI answers.
 * Handles headings (#/##/###), bold/italic/code, bullet & numbered lists.
 */
export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let listBuffer: { ordered: boolean; items: string[] } | null = null

  function flushList() {
    if (!listBuffer) return
    const { ordered, items } = listBuffer
    const ListTag = ordered ? 'ol' : 'ul'
    blocks.push(
      <ListTag key={`list-${blocks.length}`} style={{
        margin: '6px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4,
        listStyleType: ordered ? 'decimal' : 'disc',
      }}>
        {items.map((it, i) => (
          <li key={i} style={{ color: 'var(--fg-2)', lineHeight: 1.6 }}>{renderInline(it)}</li>
        ))}
      </ListTag>
    )
    listBuffer = null
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    const trimmed = line.trim()

    // blank line → flush list, spacer
    if (!trimmed) { flushList(); return }

    // headings
    const h = trimmed.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      flushList()
      const level = h[1].length
      const size = level === 1 ? 16 : level === 2 ? 14 : 13
      blocks.push(
        <div key={`h-${idx}`} style={{
          fontWeight: 700, fontSize: size, color: 'var(--fg)', marginTop: blocks.length ? 10 : 0, marginBottom: 2,
        }}>{renderInline(h[2])}</div>
      )
      return
    }

    // bullet list
    const bullet = trimmed.match(/^[-•*]\s+(.*)$/)
    if (bullet) {
      if (!listBuffer || listBuffer.ordered) { flushList(); listBuffer = { ordered: false, items: [] } }
      listBuffer.items.push(bullet[1])
      return
    }

    // numbered list
    const num = trimmed.match(/^\d+[.)]\s+(.*)$/)
    if (num) {
      if (!listBuffer || !listBuffer.ordered) { flushList(); listBuffer = { ordered: true, items: [] } }
      listBuffer.items.push(num[1])
      return
    }

    // paragraph
    flushList()
    blocks.push(
      <p key={`p-${idx}`} style={{ color: 'var(--fg-2)', lineHeight: 1.65, margin: '4px 0' }}>
        {renderInline(trimmed)}
      </p>
    )
  })
  flushList()

  return <div>{blocks}</div>
}
