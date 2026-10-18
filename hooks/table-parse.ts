export type Align = 'left' | 'center' | 'right' | null
export type Table = { header: string[]; align: Align[]; rows: string[][] }
export type Segment = { kind: 'text'; text: string } | { kind: 'table'; table: Table; source: string }

type Row = { cells: string[]; pipes: number }

// Split a line into cells on unescaped `|` outside inline code. A backtick
// run only opens a code span when a run of the same length closes it later
// on the same line. Cells are trimmed and `\|` is unescaped; backticks stay.
function parseRow(line: string): Row {
  const raw: string[] = []
  let cur = ''
  let i = 0

  while (i < line.length) {
    const ch = line[i] ?? ''

    if (ch === '\\' && line[i + 1] === '|') {
      cur += '|'
      i += 2
    } else if (ch === '\\' && i + 1 < line.length) {
      cur += ch + (line[i + 1] ?? '')
      i += 2
    } else if (ch === '`') {
      let end = i

      while (line[end] === '`') {
        end++
      }
      const run = end - i
      let close = -1

      for (let j = end; j < line.length; j++) {
        if (line[j] !== '`') {
          continue
        }
        let k = j

        while (line[k] === '`') {
          k++
        }
        if (k - j === run) {
          close = k
          break
        }
        j = k - 1
      }
      const stop = close === -1 ? end : close

      cur += line.slice(i, stop).replace(/\\\|/g, '|')
      i = stop
    } else if (ch === '|') {
      raw.push(cur)
      cur = ''
      i++
    } else {
      cur += ch
      i++
    }
  }
  raw.push(cur)
  const pipes = raw.length - 1

  if (pipes === 0) {
    return { cells: [line.trim()], pipes }
  }
  const cells = raw.map(c => c.trim())

  if (line.trim().startsWith('|')) {
    cells.shift()
  }
  if (cells.length > 0 && raw[raw.length - 1]?.trim() === '' && pipes > 0) {
    cells.pop()
  }
  return { cells, pipes }
}

const SEP_CELL = /^:?-+:?$/

function alignOf(cell: string): Align {
  const left = cell.startsWith(':')
  const right = cell.endsWith(':')

  return left && right ? 'center' : left ? 'left' : right ? 'right' : null
}

function content(line: string): string {
  return line.replace(/\r?\n$/, '')
}

function openFence(line: string): { ch: string; len: number } | null {
  const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(content(line))

  if (m === null) {
    return null
  }
  const run = m[1] ?? ''

  if (run[0] === '`' && (m[2] ?? '').includes('`')) {
    return null
  }
  return { ch: run[0] ?? '', len: run.length }
}

function closesFence(line: string, fence: { ch: string; len: number }): boolean {
  const m = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(content(line))
  const run = m?.[1] ?? ''

  return run !== '' && run[0] === fence.ch && run.length >= fence.len
}

function separator(line: string, columns: number): Align[] | null {
  const row = parseRow(content(line))

  if (row.pipes === 0 || row.cells.length !== columns || !row.cells.every(c => SEP_CELL.test(c))) {
    return null
  }
  return row.cells.map(alignOf)
}

export function splitTables(markdown: string): Segment[] {
  const lines = markdown.match(/[^\n]*\n|[^\n]+/g) ?? []
  const out: Segment[] = []
  let text = ''
  let fence: { ch: string; len: number } | null = null
  let i = 0

  const flush = () => {
    if (text !== '') {
      out.push({ kind: 'text', text })
      text = ''
    }
  }

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (fence !== null) {
      if (closesFence(line, fence)) {
        fence = null
      }
      text += line
      i++
      continue
    }
    const opened = openFence(line)

    if (opened !== null) {
      fence = opened
      text += line
      i++
      continue
    }
    const head = parseRow(content(line))
    const next = lines[i + 1]
    const align = head.pipes > 0 && next !== undefined ? separator(next, head.cells.length) : null

    if (align === null) {
      text += line
      i++
      continue
    }
    const rows: string[][] = []
    let end = i + 2

    while (end < lines.length) {
      const row = parseRow(content(lines[end] ?? ''))

      if (row.pipes === 0) {
        break
      }
      const cells = row.cells.slice(0, align.length)

      while (cells.length < align.length) {
        cells.push('')
      }
      rows.push(cells)
      end++
    }
    flush()
    out.push({ kind: 'table', table: { header: head.cells, align, rows }, source: lines.slice(i, end).join('') })
    i = end
  }
  flush()
  return out
}
