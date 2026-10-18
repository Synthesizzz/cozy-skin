// How a table is measured and laid out, apart from how it is drawn: cell
// widths in terminal cells, cells without their markdown marks, column
// alignment and widths, a bordered table fitted to a window, a cell wrapped
// to its column. Plain functions, so the tests read them directly.

import { hasInlineCode, parseBlocks } from './markdown-blocks'
import type { Align, Table } from './table-parse'

// Display width in terminal cells: combining marks (Thai vowels and tone
// marks among them) take none, East Asian wide characters and emoji take two.
const ZERO = /^[\p{Mn}\p{Me}\p{Cf}]$/u

const ZWJ = 0x200d
const EMOJI_STYLE = 0xfe0f

// Code points below U+1F000 that terminals draw as two-cell emoji: the
// Emoji_Presentation ones, plus ⚠ and ✔, which replies use as emoji.
const EMOJI_WIDE = new Set([
  0x231a, 0x231b, 0x23e9, 0x23ea, 0x23eb, 0x23ec, 0x23f0, 0x23f3, 0x25fd, 0x25fe,
  0x2614, 0x2615, 0x267f, 0x2693, 0x26a0, 0x26a1, 0x26aa, 0x26ab, 0x26bd, 0x26be,
  0x26c4, 0x26c5, 0x26ce, 0x26d4, 0x26ea, 0x26f2, 0x26f3, 0x26f5, 0x26fa, 0x26fd,
  0x2705, 0x270a, 0x270b, 0x2714, 0x2728, 0x274c, 0x274e, 0x2753, 0x2754, 0x2755,
  0x2757, 0x2795, 0x2796, 0x2797, 0x27b0, 0x27bf, 0x2b1b, 0x2b1c, 0x2b50, 0x2b55,
])

const isRegional = (cp: number | undefined): boolean => cp !== undefined && cp >= 0x1f1e6 && cp <= 0x1f1ff
const isSkinTone = (cp: number): boolean => cp >= 0x1f3fb && cp <= 0x1f3ff

function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2648 && cp <= 0x2653) ||
    EMOJI_WIDE.has(cp) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f000 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  )
}

// A flag (two regional indicators) and a ZWJ sequence are one two-cell glyph;
// U+FE0F turns the narrow glyph before it into a two-cell emoji.
export function cellWidth(text: string): number {
  const cps = Array.from(text, ch => ch.codePointAt(0) ?? 0)
  let width = 0
  let lastNarrow = false

  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i] ?? 0

    if (isRegional(cp)) {
      width += 2
      lastNarrow = false
      if (isRegional(cps[i + 1])) {
        i++
      }
      continue
    }
    if (cp === ZWJ) {
      // The next glyph joins the one before: it adds no width.
      if (i > 0 && i + 1 < cps.length) {
        i++
      }
      lastNarrow = false
      continue
    }
    if (cp === EMOJI_STYLE) {
      if (lastNarrow) {
        width += 1
      }
      lastNarrow = false
      continue
    }
    if (isSkinTone(cp) && i > 0) {
      continue
    }
    if (ZERO.test(String.fromCodePoint(cp))) {
      continue
    }
    const wide = isWide(cp)

    width += wide ? 2 : 1
    lastNarrow = !wide
  }
  return width
}

// A zero-width space: a place the desktop may wrap a line, drawn as nothing.
const SOFT = '\u200B'

// A run of text wider than this, with no space in it, gets places to break.
const LONG_RUN = 10

// A mark that belongs to the letter before it (a Thai vowel or tone mark):
// a break never goes before one.
const MARK = /^\p{M}/u

// Places to break a long run inside a grid cell, which the desktop cannot
// wrap anywhere but at a space: Thai has none between words, and a file name
// or an identifier has none at all, so the cell clipped them. Words are found
// with the platform's word breaker where it has one; a file name or an
// identifier breaks after its `_ . / \ : -`; any piece still too long breaks
// every few cells, never before a mark. Only the drawing gets these; Copy
// and the exports keep the text as written.
export function softBreaks(text: string): string {
  return text
    .split(/(\s+)/)
    .map(token => (cellWidth(token) > LONG_RUN ? breakRun(token).join(SOFT) : token))
    .join('')
}

function breakRun(run: string): string[] {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  const words = Segmenter === undefined ? [run] : Array.from(new Segmenter('th', { granularity: 'word' }).segment(run), s => s.segment)

  return words.flatMap(word => word.split(/(?<=[_./\\:-])(?=.)/u)).flatMap(piece => (cellWidth(piece) > LONG_RUN + 2 ? chop(piece) : [piece]))
}

// A piece cut every LONG_RUN cells or fewer, each cut before a letter.
function chop(piece: string): string[] {
  const parts: string[] = []
  let part = ''

  for (const ch of piece) {
    if (part !== '' && !MARK.test(ch) && cellWidth(part + ch) > LONG_RUN) {
      parts.push(part)
      part = ''
    }
    part += ch
  }
  if (part !== '') {
    parts.push(part)
  }
  return parts
}

// What a cell shows: inline markdown marks go, the words stay. Code spans
// keep their content as typed. Copy and the exports use the cell as written.
export function displayText(cell: string): string {
  const parts = cell.split(/(`+)([^`]|[^`].*?[^`])\1(?!`)/)
  let out = ''

  // split with two groups: text, fence, code, text, fence, code, ..., text
  for (let i = 0; i < parts.length; i += 3) {
    out += stripMarks(parts[i] ?? '')
    if (i + 2 < parts.length) {
      out += parts[i + 2] ?? ''
    }
  }
  return out
}

// Links become their text; `**x**`, `__x__`, `*x*` and `_x_` become x. An
// underscore pair counts only at word edges, so snake_case stays whole, and
// a mark next to a space (`2 * 3 * 4`) is not emphasis.
function stripMarks(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)\s]*(?:\s+"[^"]*")?\)/g, '$1')
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '$1')
    .replace(/(?<![\p{L}\p{N}_])__(?=\S)(.+?)(?<=\S)__(?![\p{L}\p{N}_])/gu, '$1')
    .replace(/(?<![*\\])\*(?=[^\s*])([^*]*?[^\s*\\])\*(?!\*)/g, '$1')
    .replace(/(?<![\p{L}\p{N}_\\])_(?=[^\s_])([^_]*?[^\s_\\])_(?![\p{L}\p{N}_])/gu, '$1')
}

export function columnWidths(table: Table): number[] {
  return table.header.map((head, c) => Math.max(1, cellWidth(head), ...table.rows.map(row => cellWidth(row[c] ?? ''))))
}

// A figure: an optional sign or currency mark, digits with separators, an
// optional unit or percent. A column of them (header aside) reads right-aligned.
const FIGURE = /^[-+−]?[$€£¥฿]?\s?\d[\d,.\s]*(%|[kKmMbB]|x)?$/

// Each column's alignment: as the table wrote it, else right for a column of
// figures, else left.
export function alignments(table: Table): Align[] {
  return table.header.map((_, c) => {
    const written = table.align[c] ?? null

    if (written !== null) {
      return written
    }
    const cells = table.rows.map(row => (row[c] ?? '').trim()).filter(cell => cell !== '' && cell !== '-' && cell !== '—')

    return cells.length > 0 && cells.every(cell => FIGURE.test(cell)) ? 'right' : null
  })
}

// The widest word of each column, header included: the least room a column
// can take before a word would run into the next one.
export function longestWords(table: Table): number[] {
  return table.header.map((head, c) =>
    Math.max(1, ...[head, ...table.rows.map(row => row[c] ?? '')].flatMap(cell => cell.split(/\s+/)).map(cellWidth)),
  )
}

// Each column's share of a desktop table's width, in whole percent (the only
// kind a Box takes). What a column cannot do without comes first: its widest
// word, which cannot wrap (a figure such as $48,250.50 is all one word), counted
// a quarter wider as the app's face runs wider than one cell a character. A
// column of longer text gets half its extra length on top, as it can wrap.
// What flooring leaves goes to the widest column.
export function columnShares(widths: readonly number[], words: readonly number[] = widths): number[] {
  const kept = widths.map((w, c) => {
    const need = Math.ceil((words[c] ?? 1) * 1.25) + 2
    const want = Math.min(Math.max(w, 4), 40)

    return need + Math.max(0, want - need) / 2
  })
  const total = kept.reduce((sum, w) => sum + w, 0)
  const shares = kept.map(w => Math.max(1, Math.floor((w / total) * 100)))
  const widest = kept.indexOf(Math.max(...kept))

  shares[widest] = (shares[widest] ?? 0) + 100 - shares.reduce((sum, s) => sum + s, 0)
  return shares
}

export function padCell(text: string, width: number, align: Align): string {
  const room = Math.max(0, width - cellWidth(text))

  if (align === 'right') {
    return ' '.repeat(room) + text
  }
  if (align === 'center') {
    const left = Math.floor(room / 2)

    return ' '.repeat(left) + text + ' '.repeat(room - left)
  }
  return text + ' '.repeat(room)
}

// Columns a bordered table takes: two border cells, each cell and its two
// spaces of padding, and the rule between cells.
export function boxWidth(widths: readonly number[]): number {
  return 2 + widths.reduce((sum, w) => sum + w + 2, 0) + Math.max(0, widths.length - 1)
}

// Whether a reply has inline code where it is redrawn: in a paragraph, a
// heading or a list item, never inside a fenced block, whose backticks are
// not inline code.
export function hasProseCode(text: string): boolean {
  return parseBlocks(text).some(block =>
    block.kind === 'para' || block.kind === 'heading'
      ? hasInlineCode(block.text)
      : block.kind === 'list' && block.items.some(item => hasInlineCode(item.text)),
  )
}

// A folder as an answer label shows it: its last two parts, `…\\Shared\\board`.
export function shortFolder(folder: string): string {
  const parts = folder.split(/[\\/]+/).filter(Boolean)

  return parts.length <= 2 ? folder : `…\\${parts.slice(-2).join('\\')}`
}

// The narrowest a column of a fitted box goes, in cells.
const NARROWEST = 3

// Column widths that fit a bordered table into `room` cells: each column at
// its widest cell when that fits; else the widest columns give way first,
// down to their longest word, then (only if that still does not fit) to
// NARROWEST, breaking words. Null when even that cannot fit.
export function fitWidths(widths: readonly number[], words: readonly number[], room: number): number[] | null {
  const budget = room - boxWidth(widths.map(() => 0))
  const fitted = [...widths]
  const total = () => fitted.reduce((sum, w) => sum + w, 0)

  if (budget < NARROWEST * widths.length) {
    return null
  }
  for (const floor of [(c: number) => Math.min(widths[c] ?? 1, Math.max(NARROWEST, words[c] ?? 1)), () => NARROWEST]) {
    while (total() > budget) {
      let widest = -1

      fitted.forEach((w, c) => {
        if (w > floor(c) && (widest === -1 || w > (fitted[widest] ?? 0))) {
          widest = c
        }
      })
      if (widest === -1) {
        break
      }
      fitted[widest] = (fitted[widest] ?? 1) - 1
    }
  }
  return total() <= budget ? fitted : null
}

// Whether columns of `widths` fit `room` without breaking a word: fitWidths
// may narrow them, but none below its longest word (or NARROWEST).
export function fitsWhole(widths: readonly number[], words: readonly number[], room: number): boolean {
  const fitted = fitWidths(widths, words, room)

  return fitted !== null && fitted.every((w, c) => w >= Math.min(widths[c] ?? 1, Math.max(NARROWEST, words[c] ?? 1)))
}

// A table too wide to show whole, in pages of columns: the first column is
// pinned on every page and the others step past it, as a sideways scroll
// would move them (a reply has no scroll of its own). Each page holds the
// columns after the pinned one that `fits` takes, and the last is filled back
// from the end, so it is as full as the others. None when every column fits.
export function columnPages(count: number, fits: (cols: number[]) => boolean): number[][] {
  if (count <= 1 || fits(Array.from({ length: count }, (_, c) => c))) {
    return []
  }
  const pages: number[][] = []
  let page: number[] = []

  for (let c = 1; c < count; c++) {
    if (page.length > 0 && !fits([0, ...page, c])) {
      pages.push(page)
      page = []
    }
    page.push(c)
  }
  pages.push(page)
  const last = pages[pages.length - 1] ?? []

  while ((last[0] ?? 1) > 1 && fits([0, (last[0] ?? 1) - 1, ...last])) {
    last.unshift((last[0] ?? 1) - 1)
  }
  return pages
}

// The table with only the columns `cols`, in that order.
export function pickColumns<T extends Table>(table: T, cols: readonly number[]): T {
  const pick = <V>(row: readonly V[], blank: V) => cols.map(c => row[c] ?? blank)

  return { ...table, header: pick(table.header, ''), align: pick(table.align, null), rows: table.rows.map(row => pick(row, '')) }
}

// A cell's text as lines at most `width` cells wide: by word, and a word wider
// than the column split where it runs out.
export function wrapCell(text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''

  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word

    while (cellWidth(rest) > width) {
      if (line !== '') {
        lines.push(line)
        line = ''
      }
      let head = ''

      for (const ch of Array.from(rest)) {
        if (cellWidth(head + ch) > width) {
          break
        }
        head += ch
      }
      lines.push(head)
      rest = rest.slice(head.length)
    }
    if (line === '') {
      line = rest
    } else if (cellWidth(`${line} ${rest}`) <= width) {
      line = `${line} ${rest}`
    } else {
      lines.push(line)
      line = rest
    }
  }
  lines.push(line)
  return lines
}
