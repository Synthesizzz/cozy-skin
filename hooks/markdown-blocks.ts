// A small markdown reader, so cozy can redraw only the blocks of a reply that
// hold inline code and hand every other block, exactly as written (`source`),
// back to the engine's own Markdown. It knows headings, paragraphs, lists,
// fenced code and rules; anything else comes back as `other`.

export type Item = { indent: number; marker: string; text: string }

type Shape =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'list'; items: Item[] }
  | { kind: 'code'; lang: string; lines: string[] }
  | { kind: 'rule' }
  | { kind: 'other' }

export type Block = Shape & { source: string }

export type Span =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; spans: Span[] }
  | { kind: 'em'; spans: Span[] }
  | { kind: 'strike'; spans: Span[] }
  | { kind: 'link'; spans: Span[]; url: string }

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)/
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/
const RULE = /^ {0,3}([-*_])(\s*\1){2,}\s*$/
// Blocks this reader leaves to the engine: quotes, HTML, math, tables, indented code.
const OTHER = /^(\s*>|\s*<[a-zA-Z!/]|\s*\$\$|\s*\||\s*\\\[| {4,}\S)/

const isBlank = (line: string): boolean => line.trim() === ''

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || ITEM.test(line) || RULE.test(line) || OTHER.test(line)
}

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (isBlank(line)) {
      i++
      continue
    }
    const start = i
    // The block as written: from its first line up to where the reader stopped.
    const push = (shape: Shape) => blocks.push({ ...shape, source: lines.slice(start, i).join('\n').trimEnd() })

    const fence = FENCE.exec(line)

    if (fence !== null) {
      const mark = fence[1] ?? '```'
      const body: string[] = []

      i++
      while (i < lines.length && !new RegExp(`^ {0,3}${mark[0] === '`' ? '`' : '~'}{${mark.length},}\\s*$`).test(lines[i] ?? '')) {
        body.push(lines[i] ?? '')
        i++
      }
      i++ // the closing fence, or past the end when there is none
      push({ kind: 'code', lang: fence[2] ?? '', lines: body })
      continue
    }

    const heading = HEADING.exec(line)

    if (heading !== null) {
      i++
      push({ kind: 'heading', level: (heading[1] ?? '#').length, text: heading[2] ?? '' })
      continue
    }
    if (RULE.test(line)) {
      i++
      push({ kind: 'rule' })
      continue
    }
    if (ITEM.test(line)) {
      const items: Item[] = []

      while (i < lines.length && !isBlank(lines[i] ?? '')) {
        const current = lines[i] ?? ''
        const item = ITEM.exec(current)

        if (item !== null) {
          items.push({ indent: (item[1] ?? '').replace(/\t/g, '  ').length, marker: item[2] ?? '-', text: item[3] ?? '' })
        } else if (startsBlock(current) && !/^\s{2,}/.test(current)) {
          break
        } else {
          const last = items[items.length - 1]

          if (last !== undefined) {
            last.text += ` ${current.trim()}`
          }
        }
        i++
      }
      push({ kind: 'list', items })
      continue
    }
    if (OTHER.test(line)) {
      const body: string[] = []

      while (i < lines.length && !isBlank(lines[i] ?? '')) {
        body.push(lines[i] ?? '')
        i++
      }
      push({ kind: 'other' })
      continue
    }

    const body: string[] = []

    while (i < lines.length && !isBlank(lines[i] ?? '') && (body.length === 0 || !startsBlock(lines[i] ?? ''))) {
      body.push((lines[i] ?? '').trim())
      i++
    }
    push({ kind: 'para', text: body.join('\n') })
  }
  return blocks
}

// Inline marks, outermost first: code spans keep their content as typed.
const INLINE =
  /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)|\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*|(?<![\p{L}\p{N}_])__(?=\S)([\s\S]+?)(?<=\S)__(?![\p{L}\p{N}_])|~~(?=\S)([\s\S]+?)(?<=\S)~~|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|(?<![*\\])\*(?=[^\s*])([^*]*?[^\s*\\])\*(?!\*)|(?<![\p{L}\p{N}_\\])_(?=[^\s_])([^_]*?[^\s_\\])_(?![\p{L}\p{N}_])/u

export function parseInline(text: string): Span[] {
  const spans: Span[] = []
  let rest = text

  while (rest.length > 0) {
    const m = INLINE.exec(rest)

    if (m === null) {
      spans.push({ kind: 'text', text: rest })
      break
    }
    if (m.index > 0) {
      spans.push({ kind: 'text', text: rest.slice(0, m.index) })
    }
    if (m[2] !== undefined) {
      spans.push({ kind: 'code', text: m[2] })
    } else if (m[3] !== undefined || m[4] !== undefined) {
      spans.push({ kind: 'strong', spans: parseInline(m[3] ?? m[4] ?? '') })
    } else if (m[5] !== undefined) {
      spans.push({ kind: 'strike', spans: parseInline(m[5]) })
    } else if (m[6] !== undefined) {
      spans.push({ kind: 'link', spans: parseInline(m[6]), url: m[7] ?? '' })
    } else {
      spans.push({ kind: 'em', spans: parseInline(m[8] ?? m[9] ?? '') })
    }
    rest = rest.slice(m.index + m[0].length)
  }
  return spans
}

// Every character the reader keeps, in order: what the engine would show,
// less the marks. Tests use it to prove that no text is lost.
export function plainText(spans: readonly Span[]): string {
  return spans
    .map(span => (span.kind === 'text' || span.kind === 'code' ? span.text : plainText(span.spans)))
    .join('')
}

// Whether text holds an inline code span, at any depth.
export function hasInlineCode(text: string): boolean {
  const deep = (spans: readonly Span[]): boolean =>
    spans.some(span => span.kind === 'code' || (span.kind !== 'text' && deep(span.spans)))

  return deep(parseInline(text))
}
