import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { presetOf } from '../hooks/presets'
import { SETTINGS_KEY } from '../hooks/settings'
import type { Settings } from '../hooks/settings'
import { toTsv } from '../hooks/table-export'
import { splitTables } from '../hooks/table-parse'
import { alignments, cellWidth, columnPages, columnShares, displayText, fitWidths, hasProseCode, longestWords, pickColumns, shortFolder, wrapCell } from '../hooks/table-layout'
import { FOLDER_KEY, GRID_COLUMNS, LONG_ROWS, SHORT_ROWS } from '../hooks/table-render'

const PLUGIN = 'cozy-skin'
const START = { cwd: 'C:/proj', surface: 'terminal', isInteractive: true } as const
const SURFACES = ['terminal', 'desktop'] as const

const TABLE = '| name | qty |\n| --- | ---: |\n| apple | 3 |\n| pear | 12 |\n'
const REPLY = `Before the table.\n\n${TABLE}\nAfter the table.\n`

const reply = (text: string) => ({ text, isFirstOfReply: true })

type World = {
  copies: { text: string; surface?: string }[]
  writes: Record<string, string>
  runs: string[][]
  failWrite: { on: boolean }
  copyFails: { on: boolean }
  // What the save question is answered with (null: dismissed), what it asked, and the Save dialog's pick ('' cancels).
  answer: { text: string | null }
  asked: string[]
  offered: string[][]
  stored: Map<string, unknown>
  picked: { path: string }
}

// The engine with the mod loaded, a stored settings object and stand-ins for
// the clipboard, the disk and PowerShell.
function world(on: On, stored: Partial<Settings> = {}): World {
  const seen: World = {
    copies: [],
    writes: {},
    runs: [],
    failWrite: { on: false },
    copyFails: { on: false },
    answer: { text: 'Project folder' },
    asked: [],
    offered: [],
    stored: new Map<string, unknown>(),
    picked: { path: '' },
  }

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: e.key === SETTINGS_KEY ? { mode: 'dark', ...stored } : seen.stored.get(e.key) }))
  on('store.set', (_, e) => (e.key === SETTINGS_KEY ? undefined : seen.stored.set(e.key, e.value), { value: undefined }))
  on('session.cwd', () => ({ value: START.cwd }))
  on('ui.copy', (_, e) => {
    seen.copies.push({ text: e.text, surface: e.surface })

    return seen.copyFails.on
      ? { value: { isCopied: false as const, reason: 'no-clipboard' as const } }
      : { value: { isCopied: true as const } }
  })
  on('fs.exists', (_, e) => ({ value: e.path.replaceAll('\\', '/') in seen.writes }))
  on('fs.write', (_, e) => {
    if (seen.failWrite.on) {
      return { deny: 'disk full' }
    }
    seen.writes[e.path.replaceAll('\\', '/')] = e.text

    return { value: undefined }
  })
  on('process.run', (_, e) => {
    seen.runs.push([...e.argv])
    const stdout = e.argv.some(a => a.endsWith('pick-save-path.ps1')) ? seen.picked.path : ''

    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  // The app's question dialog, as $.ui.ask raises it.
  on('tool.call', (_, e) => {
    const first = (e as unknown as { questions: { question: string; options: { label: string }[] }[] }).questions[0]
    const question = first?.question ?? ''

    seen.asked.push(question)
    seen.offered.push((first?.options ?? []).map(o => o.label))
    if (seen.answer.text === null) {
      return { deny: 'dismissed' } as never
    }
    return { result: { answers: { [question]: seen.answer.text } } } as never
  })
  on('ui.render', { component: 'AssistantMessage' }, (beneath, e) => {
    const { Text } = beneath.ui.resolve(e)

    return Text({ children: 'beneath' })
  })

  return seen
}

async function drawn($: Engine, surface: (typeof SURFACES)[number], text: string, columns = 100) {
  await $.session.start({ ...START, surface })

  return $.ui.mount({
    plugin: PLUGIN,
    surface,
    component: 'AssistantMessage',
    props: reply(text),
    viewport: { columns, rows: 40 },
  })
}

const labels = async (ui: Awaited<ReturnType<typeof drawn>>) =>
  (await ui.findAll({ type: 'Button' })).map(b => b.text)

test('a reply with no table draws what the next hook draws', async ($, on) => {
  world(on)

  for (const surface of SURFACES) {
    const ui = await drawn($, surface, 'Just words, and a | pipe.\n')

    expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
  }
})

test('tables off leaves the reply to the next hook', async ($, on) => {
  world(on, { tables: 'off' })

  for (const surface of SURFACES) {
    const ui = await drawn($, surface, REPLY)

    expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
  }
})

test('the skin switched off leaves the reply to the next hook', async ($, on) => {
  world(on, { enabled: false })

  const ui = await drawn($, 'terminal', REPLY)

  expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
})

test('a table inside a code fence stays code', async ($, on) => {
  world(on)

  const ui = await drawn($, 'terminal', `\`\`\`\n${TABLE}\`\`\`\n`)

  expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
})

test('a half-streamed table draws as plain markdown without a crash', async ($, on) => {
  world(on)

  for (const half of ['| name | qty |\n', '| name | qty |\n| ---', '|\n|\n']) {
    const ui = await drawn($, 'terminal', half)

    expect(await ui.find({ type: 'Button' })).toBeUndefined()
  }
})

test('a box table has the table, three buttons and the text around it as markdown', async ($, on) => {
  world(on)

  for (const surface of SURFACES) {
    const ui = await drawn($, surface, REPLY)
    const markdown = (await ui.findAll({ type: 'Markdown' })).map(m => m.props.text)

    expect(await labels(ui)).toEqual(['Copy', 'CSV', 'XLSX'])
    expect(markdown).toEqual(['Before the table.\n\n', '\nAfter the table.\n'])

    const boxes = await ui.findAll({ type: 'Box' })

    expect(boxes.filter(b => b.props.borderStyle !== undefined)).toHaveLength(1)
    expect(await ui.find({ type: 'Text', text: /apple/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeUndefined()
  }
})

test('two tables get two sets of buttons', async ($, on) => {
  world(on)

  const ui = await drawn($, 'terminal', `${TABLE}\nbetween\n\n${TABLE}`)

  expect(await labels(ui)).toEqual(['Copy', 'CSV', 'XLSX', 'Copy', 'CSV', 'XLSX'])
})

test('Copy puts the table on the clipboard of the surface that was pressed', async ($, on) => {
  const seen = world(on)
  const expected = toTsv((splitTables(TABLE)[0] as { table: Parameters<typeof toTsv>[0] }).table)

  for (const surface of SURFACES) {
    const ui = await drawn($, surface, REPLY)

    await ui.press({ key: 'copy-0' })
    expect(seen.copies.at(-1)).toEqual({ text: expected, surface })
    expect(await ui.find({ type: 'Text', text: /Copied/ })).toBeDefined()
  }
})

test('Copy says so when nothing took the text', async ($, on) => {
  world(on).copyFails.on = true

  const ui = await drawn($, 'terminal', REPLY)

  await ui.press({ key: 'copy-0' })
  expect((await ui.find({ type: 'Text', text: /not copied/i }))?.props.color).toBe(presetOf('kindle')?.dark.palette.err)
})

test('CSV writes a file under cozy-exports and the reply shows the path', async ($, on) => {
  const seen = world(on)

  for (const surface of SURFACES) {
    // Each pass looks only at its own save.
    for (const key of Object.keys(seen.writes)) {
      delete seen.writes[key]
    }
    const ui = await drawn($, surface, REPLY)

    await ui.press({ key: 'csv-0' })
    const paths = Object.keys(seen.writes).filter(p => p.endsWith('.csv'))
    const path = paths[0] ?? ''

    expect(paths).toHaveLength(1)
    expect(path).toMatch(/^C:\/proj\/cozy-exports\/table-\d{8}-\d{6}(-\d+)?\.csv$/)
    expect(seen.writes[path]).toContain('apple,3')
    expect(await ui.find({ type: 'Text', text: new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeDefined()
  }
})

test('XLSX saves through the zip script and the reply shows the path', async ($, on) => {
  const seen = world(on)
  const ui = await drawn($, 'desktop', REPLY)

  await ui.press({ key: 'xlsx-0' })
  expect(seen.runs.some(run => run.includes('-File'))).toBe(true)
  expect(await ui.find({ type: 'Text', text: /cozy-exports\/table-\d{8}-\d{6}(-\d+)?\.xlsx/ })).toBeDefined()
})

test('a failed save shows the error in the error colour and does not throw', async ($, on) => {
  const seen = world(on)

  seen.failWrite.on = true
  const ui = await drawn($, 'terminal', REPLY)

  await ui.press({ key: 'csv-0' })
  const note = await ui.find({ type: 'Text', text: /disk full/ })

  expect(note).toBeDefined()
  expect(note?.props.color).toBe(presetOf('kindle')?.dark.palette.err)
})

test('the text level draws aligned plain text with the same three buttons', async ($, on) => {
  world(on, { tables: 'text' })

  for (const surface of SURFACES) {
    const ui = await drawn($, surface, REPLY)

    expect(await labels(ui)).toEqual(['Copy', 'CSV', 'XLSX'])
    expect((await ui.findAll({ type: 'Box' })).some(b => b.props.borderStyle !== undefined)).toBe(false)
    expect(await ui.find({ type: 'Text', text: /apple\s+3/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /pear\s+12/ })).toBeDefined()
  }
})

test('a table wider than the terminal keeps its box: columns give way and cells wrap inside them', async ($, on) => {
  world(on)

  const table =
    '| Feature | What it does | Command |\n| --- | --- | --- |\n' +
    '| Presets | Nine colour presets, each with light and dark mode | /cozy <preset> |\n' +
    '| Table buttons | Copy, CSV and XLSX on every table | `/cozy tables box|text|off` |\n'
  const narrow = await drawn($, 'terminal', table, 60)
  const lines = (await narrow.findAll({ type: 'Box' })).filter(b => b.props.flexDirection === 'row' && b.props.backgroundColor !== undefined)

  expect((await narrow.findAll({ type: 'Box' })).some(b => b.props.borderStyle !== undefined)).toBe(true)
  // More lines than rows (cells wrapped), every line the same width, and inside the window.
  expect(lines.length).toBeGreaterThan(3)
  expect(new Set(lines.map(l => cellWidth(l.text))).size).toBe(1)
  expect(cellWidth(lines[0]!.text) + 2).toBeLessThanOrEqual(60)
  // Every word is still there, in order, within its own column.
  const words = lines.map(l => l.text).join(' ')

  for (const word of ['Nine', 'colour', 'presets,', 'dark', 'mode', 'Copy,', 'XLSX', 'box|text|off']) {
    expect(words).toContain(word)
  }
  expect(await labels(narrow)).toEqual(['Copy', 'CSV', 'XLSX'])
})

test('only a window too narrow for even two columns gets the text level', async ($, on) => {
  world(on)

  const ui = await drawn($, 'terminal', '| a | b | c | d | e | f |\n| - | - | - | - | - | - |\n| 1 | 2 | 3 | 4 | 5 | 6 |\n', 10)

  expect((await ui.findAll({ type: 'Box' })).some(b => b.props.borderStyle !== undefined)).toBe(false)
  expect(await labels(ui)).toEqual(['Copy', 'CSV', 'XLSX'])
})

test('fitWidths keeps natural widths that fit, narrows the widest first, and wrapCell splits by word', () => {
  expect(fitWidths([5, 8], [5, 8], 40)).toEqual([5, 8])
  // Budget 30 - (2 + 2*2 + 1) = 23: the 30-wide column gives way, the 5-wide one stays.
  expect(fitWidths([5, 30], [5, 6], 30)).toEqual([5, 18])
  expect(fitWidths([5, 5, 5], [5, 5, 5], 12)).toBeNull()
  expect(wrapCell('Nine colour presets, each with light', 12)).toEqual(['Nine colour', 'presets,', 'each with', 'light'])
  expect(wrapCell('aaaaaaaaaa', 4)).toEqual(['aaaa', 'aaaa', 'aa'])
  expect(wrapCell('สวัสดีครับ ✅ ok', 6).every(line => cellWidth(line) <= 6)).toBe(true)
})

test('icons ascii draws no non-ASCII glyph in the buttons or the table chrome', async ($, on) => {
  world(on, { icons: 'ascii', preset: 'nord' })

  const ui = await drawn($, 'terminal', REPLY)
  const chrome = [
    ...(await ui.findAll({ type: 'Button' })).map(b => b.text),
    ...(await ui.findAll({ type: 'Box' })).map(b => String(b.props.borderStyle ?? '')),
    ...(await ui.findAll({ type: 'Text' })).map(t => t.text),
  ].join('')

  expect(chrome).toMatch(/^[\x20-\x7e\n]*$/)
  expect(chrome).toContain('|')
})

test('cells with Thai, commas, pipes and code copy exactly', async ($, on) => {
  const seen = world(on)
  const table = '| ชื่อ | note |\n| --- | --- |\n| สมชาย | 1,200 |\n| a \\| b | `x | y` |\n'
  const ui = await drawn($, 'terminal', table)

  await ui.press({ key: 'copy-0' })
  expect(seen.copies.at(-1)?.text).toBe('ชื่อ\tnote\nสมชาย\t1,200\na | b\t`x | y`')

  await ui.press({ key: 'csv-0' })
  const csv = Object.entries(seen.writes).find(([p]) => p.endsWith('.csv'))?.[1] ?? ''

  expect(csv).toContain('สมชาย,"1,200"')
  expect(csv).toContain('a | b,`x | y`')
})

test('a zero-column table is plain text', async ($, on) => {
  world(on)

  const ui = await drawn($, 'terminal', '|\n|\n')

  expect(await ui.find({ type: 'Button' })).toBeUndefined()
})

test('cellWidth counts emoji, flags and joined emoji as two cells', () => {
  expect(cellWidth('✅')).toBe(2)
  expect(cellWidth('❌')).toBe(2)
  expect(cellWidth('⚠')).toBe(2)
  expect(cellWidth('⚠️')).toBe(2)
  expect(cellWidth('⭐')).toBe(2)
  expect(cellWidth('✔')).toBe(2)
  expect(cellWidth('🚀')).toBe(2)
  expect(cellWidth('🇹🇭')).toBe(2)
  expect(cellWidth('👩‍💻')).toBe(2)
  expect(cellWidth('❤️‍🔥')).toBe(2)
  expect(cellWidth('👍🏽')).toBe(2)
  expect(cellWidth('1️⃣')).toBe(2)
  expect(cellWidth('ok ✅ 🇯🇵')).toBe(8)
  // Text presentation and Thai marks keep their old widths.
  expect(cellWidth('→')).toBe(1)
  expect(cellWidth('สวัสดี')).toBe(4)
  expect(cellWidth('ab')).toBe(2)
})

test('a boxed table with emoji keeps every row the same width', async ($, on) => {
  world(on)

  const table = '| state | item |\n| --- | --- |\n| ✅ | done |\n| ❌ | failed |\n| ⚠️ | careful |\n| 🚀 | shipped |\n| 🇹🇭 | Thai |\n'
  const ui = await drawn($, 'terminal', table)
  const rows = (await ui.findAll({ type: 'Box' })).filter(b => b.props.flexDirection === 'row' && b.props.backgroundColor !== undefined)

  expect(rows).toHaveLength(6)
  const widths = rows.map(row => cellWidth(row.text))

  expect(new Set(widths).size).toBe(1)
  // The state column is two cells wide plus its padding: " ✅ " and " state ".
  expect(rows[1]?.text.startsWith(' ✅    │')).toBe(true)
})

test('displayText strips inline markdown and leaves snake_case alone', () => {
  expect(displayText('**bold** and __strong__')).toBe('bold and strong')
  expect(displayText('*em* and _em_')).toBe('em and em')
  expect(displayText('snake_case_name')).toBe('snake_case_name')
  expect(displayText('2 * 3 * 4')).toBe('2 * 3 * 4')
  expect(displayText('`a_b *c*`')).toBe('a_b *c*')
  expect(displayText('see [docs](https://example.com/x_y)')).toBe('see docs')
  expect(displayText('plain')).toBe('plain')
})

test('cells draw without markdown marks but copy and export the exact text', async ($, on) => {
  const seen = world(on)
  const table = '| name | link |\n| --- | --- |\n| **Ann** | [docs](https://example.com) |\n| `my_var` | _note_ |\n'
  const ui = await drawn($, 'terminal', table)
  const drawnText = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('\n')

  expect(drawnText).toContain('Ann')
  expect(drawnText).not.toContain('**')
  expect(drawnText).not.toContain('https://')
  expect(drawnText).toContain('my_var')
  expect(drawnText).not.toContain('`')
  expect(drawnText).not.toContain('_note_')

  await ui.press({ key: 'copy-0' })
  expect(seen.copies.at(-1)?.text).toBe('name\tlink\n**Ann**\t[docs](https://example.com)\n`my_var`\t_note_')

  await ui.press({ key: 'csv-0' })
  const csv = Object.entries(seen.writes).find(([p]) => p.endsWith('.csv'))?.[1] ?? ''

  expect(csv).toContain('**Ann**,[docs](https://example.com)')
  expect(csv).toContain('`my_var`,_note_')

  await ui.press({ key: 'xlsx-0' })
  const sheet = Object.entries(seen.writes).find(([p]) => p.endsWith('sheet1.xml'))?.[1] ?? ''

  expect(sheet).toContain('**Ann**')
  expect(sheet).toContain('[docs](https://example.com)')
  expect(sheet).toContain('_note_')
})

test('the desktop draws a framed grid in the preset colours that always fits', async ($, on) => {
  world(on, { preset: 'nord' })

  const nord = presetOf('nord')!.dark.palette
  const ui = await drawn($, 'desktop', '| item | **owner** | cost |\n| --- | --- | --- |\n| Q3 report | `ops` | 1,200 |\n| Audit | Finance | $350.50 |\n| Launch | Product | 12% |\n')
  const boxes = await ui.findAll({ type: 'Box' })
  const frame = boxes.filter(b => b.props.borderStyle !== undefined)

  // One frame on the preset paper, edged in its line colour.
  expect(frame).toHaveLength(1)
  expect(frame[0]?.props.borderColor).toBe(nord.line)
  expect(frame[0]?.props.backgroundColor).toBe(nord.bg)
  // The header on the preset surface, the second row on its zebra.
  const rows = boxes.filter(b => b.props.flexDirection === 'row' && b.props.paddingY === 'sm')

  expect(rows).toHaveLength(4)
  expect(rows.map(r => r.props.backgroundColor)).toEqual([nord.surface, undefined, nord.zebra, undefined])
  // Columns share the width in whole percent that add up to the whole, and the figures sit right.
  const cells = boxes.filter(b => typeof b.props.width === 'string' && String(b.props.width).endsWith('%'))
  const shares = cells.slice(0, 3).map(b => Number(String(b.props.width).slice(0, -1)))

  expect(cells).toHaveLength(12)
  expect(shares.reduce((sum, x) => sum + x, 0)).toBe(100)
  expect(cells.filter(b => b.props.justifyContent === 'flex-end')).toHaveLength(4)
  // Every cell wraps, so nothing runs past the frame; the words are in the preset ink.
  const texts = await ui.findAll({ type: 'Text' })

  expect(texts.filter(t => t.props.wrap === 'wrap' && t.props.color === nord.fg)).toHaveLength(12)
  // The code chip keeps its mark, in the preset accent.
  expect(texts.some(t => t.text.includes('ops') && t.props.mono === true && t.props.color === nord.accent)).toBe(true)
  // The footer: the size on the left, the three buttons on the right.
  expect(await ui.find({ type: 'Text', text: '3 rows · 3 columns' })).toBeDefined()
  expect(await labels(ui)).toEqual(['Copy', 'CSV', 'XLSX'])
})

test('a wide desktop table shares the width by rows that wrap, never under a word', async ($, on) => {
  world(on)

  const long = 'a long sentence that explains the finding in full for the reader'
  const ui = await drawn($, 'desktop', `| id | finding | owner |\n| --- | --- | --- |\n| 1 | ${long} | Compliance |\n`)
  const cells = (await ui.findAll({ type: 'Box' })).filter(b => typeof b.props.width === 'string' && String(b.props.width).endsWith('%'))

  expect(cells).toHaveLength(6)
  const shares = cells.slice(0, 3).map(b => Number(String(b.props.width).slice(0, -1)))

  expect(shares.reduce((s, x) => s + x, 0)).toBe(100)
  expect(shares.every(Number.isInteger)).toBe(true)
  expect((await ui.findAll({ type: 'Text' })).some(t => t.props.wrap === 'wrap' && t.text.includes('sentence'))).toBe(true)
})

test('alignments keep what the table wrote and right-align columns of figures', () => {
  expect(alignments({ header: ['a', 'b', 'c', 'd'], align: [null, null, 'center', null], rows: [['x', '1,200', '3', '-'], ['y', '-4.5%', '9', '€12']] })).toEqual([
    null,
    'right',
    'center',
    'right',
  ])
  expect(alignments({ header: ['v'], align: [null], rows: [['v1.2.3']] })).toEqual([null])
  expect(columnShares([2, 10, 100]).reduce((s, x) => s + x, 0)).toBe(100)
  expect(columnShares([3, 7, 11]).every(Number.isInteger)).toBe(true)
  expect(columnShares([2, 10, 100])[0]).toBeGreaterThan(0)
// The sample from the screenshot fits the compact layout; a column never gets less than its longest word.  expect(isCompact([15, 10, 8, 10, 8])).toBe(true)  expect(isCompact([4, 60, 10])).toBe(false)  expect(longestWords({ header: ['owner'], align: [null], rows: [['Compliance team']] })).toEqual([10])
})

test('CSV and XLSX ask where to save before writing anything', async ($, on) => {
  const seen = world(on)
  const ui = await drawn($, 'desktop', REPLY)

  await ui.press({ key: 'csv-0' })
  await ui.press({ key: 'xlsx-0' })
  expect(seen.asked).toHaveLength(2)
  expect(seen.asked[0]).toMatch(/CSV.*\?$/)
  expect(seen.asked[1]).toMatch(/XLSX.*\?$/)
})

test('Choose a folder opens the Save dialog and saves where it was pointed', async ($, on) => {
  const seen = world(on)

  seen.answer.text = 'Choose a folder…'
  seen.picked.path = 'D:/Reports/Q3 สรุป.csv'
  const ui = await drawn($, 'desktop', REPLY)

  await ui.press({ key: 'csv-0' })
  const dialog = seen.runs.find(run => run.some(a => a.endsWith('pick-save-path.ps1')))

  expect(dialog).toBeDefined()
  expect(dialog).toContain('-STA')
  expect(dialog?.[dialog.indexOf('-Kind') + 1]).toBe('csv')
  expect(seen.writes['D:/Reports/Q3 สรุป.csv']).toContain('apple,3')
  expect(await ui.find({ type: 'Text', text: 'Saved D:/Reports/Q3 สรุป.csv' })).toBeDefined()
})

test('a cancelled Save dialog or a dismissed question writes nothing', async ($, on) => {
  const seen = world(on)

  seen.answer.text = 'Choose a folder…'
  const ui = await drawn($, 'desktop', REPLY)

  await ui.press({ key: 'csv-0' })
  expect(Object.keys(seen.writes)).toHaveLength(0)
  expect(await ui.find({ type: 'Text', text: 'Not saved' })).toBeDefined()

  seen.answer.text = null
  await ui.press({ key: 'xlsx-0' })
  expect(Object.keys(seen.writes)).toHaveLength(0)
  expect(seen.runs.some(run => run.some(a => a.endsWith('zip-xlsx.ps1')))).toBe(false)
})

test('a path typed under Other is a folder or, with the extension, the file itself', async ($, on) => {
  const seen = world(on)
  const ui = await drawn($, 'desktop', REPLY)

  seen.answer.text = '"D:/Shared/board"'
  await ui.press({ key: 'csv-0' })
  expect(Object.keys(seen.writes).some(p => /^D:\/Shared\/board\/table-\d{8}-\d{6}(-\d+)?\.csv$/.test(p))).toBe(true)

  seen.answer.text = 'D:/Shared/final.CSV'
  await ui.press({ key: 'csv-0' })
  expect(seen.writes['D:/Shared/final.CSV']).toContain('pear,12')

  // Never over a file that is already there.
  await ui.press({ key: 'csv-0' })
  expect(await ui.find({ type: 'Text', text: /already there/ })).toBeDefined()
})

test("the dialog's [No preference] and a relative path save nothing", async ($, on) => {
  const seen = world(on)
  const ui = await drawn($, 'desktop', REPLY)

  seen.answer.text = '[No preference]'
  await ui.press({ key: 'csv-0' })
  expect(Object.keys(seen.writes)).toHaveLength(0)
  expect(await ui.find({ type: 'Text', text: 'Not saved' })).toBeDefined()

  seen.answer.text = 'reports'
  await ui.press({ key: 'csv-0' })
  expect(Object.keys(seen.writes)).toHaveLength(0)
  expect(await ui.find({ type: 'Text', text: /not a full path/ })).toBeDefined()
})

test('inline code follows the preset accent unless a colour is picked, and a fence is not inline code', async ($, on) => {
  world(on, { preset: 'gruvbox' })

  const accent = presetOf('gruvbox')!.dark.palette.accent
  const ui = await drawn($, 'desktop', 'Run `ls` first.\n')

  expect((await ui.findAll({ type: 'Text' })).some(t => t.text.includes('ls') && t.props.color === accent)).toBe(true)
  expect(hasProseCode('```\nls\n```\n')).toBe(false)
  expect(hasProseCode('- run `ls`\n')).toBe(true)
})

test('a redrawn list keeps each marker on the first line of its item', async ($, on) => {
  world(on)

  const ui = await drawn($, 'desktop', '- **Link:** the line with the `cozy` chip, long enough that it wraps onto a second line.\n- **Long table:** a second item.\n')
  const rows = (await ui.findAll({ type: 'Box' })).filter(b => b.props.flexDirection === 'row' && /^•/.test(b.text))

  expect(rows).toHaveLength(2)
  expect(rows.every(b => b.props.alignItems === 'flex-start')).toBe(true)
})

test('a web link in a redrawn line stays a link you can press; another target keeps its address', async ($, on) => {
  world(on)

  const ui = await drawn($, 'desktop', 'Run `ls`, then read [the docs](https://example.com/docs) or [notes](./notes.md).\n')
  const link = await ui.find({ type: 'Link' })

  expect(link?.props).toMatchObject({ href: 'https://example.com/docs', label: 'the docs' })
  expect(await ui.find({ type: 'Text', text: ' (./notes.md)' })).toBeDefined()
})

test('after a save elsewhere, the next one offers the last folder and the dialog opens there', async ($, on) => {
  const seen = world(on)

  seen.answer.text = 'Choose a folder…'
  seen.picked.path = 'D:/Reports/Q3/board.csv'
  const ui = await drawn($, 'desktop', REPLY)

  await ui.press({ key: 'csv-0' })
  expect(seen.stored.get(FOLDER_KEY)).toBe('D:/Reports/Q3')
  expect(seen.offered[0]).toEqual(['Project folder', 'Choose a folder…'])

  seen.answer.text = `Last folder (${shortFolder('D:/Reports/Q3')})`
  await ui.press({ key: 'xlsx-0' })
  expect(seen.offered[1]).toEqual(['Project folder', 'Last folder (…\\Reports\\Q3)', 'Choose a folder…'])
  expect(Object.keys(seen.writes).some(p => p.startsWith('D:/Reports/Q3/.tmp-'))).toBe(true)

  // The Save dialog starts in the last folder.
  seen.answer.text = 'Choose a folder…'
  await ui.press({ key: 'csv-0' })
  const dialog = seen.runs.filter(run => run.some(a => a.endsWith('pick-save-path.ps1'))).at(-1) ?? []

  expect(dialog[dialog.indexOf('-Folder') + 1]).toBe('D:/Reports/Q3')
})

test('a long table starts folded to its first rows, and a button shows all of them', async ($, on) => {
  const seen = world(on)
  const count = LONG_ROWS + 5
  const body = Array.from({ length: count }, (_, i) => `| row ${i + 1} | ${i + 1} |`).join('\n')
  const ui = await drawn($, 'desktop', `| name | n |\n| --- | --- |\n${body}\n`)
  const rowText = async () => (await ui.findAll({ type: 'Text' })).map(t => t.text).filter(t => /^row \d+$/.test(t))

  expect(await rowText()).toHaveLength(SHORT_ROWS)
  expect(await ui.find({ type: 'Button', key: 'more-0' })).toBeDefined()
  expect(await labels(ui)).toEqual([`Show all ${count} rows`, 'Copy', 'CSV', 'XLSX'])
  // The footer counts every row, and Copy takes them all.
  expect(await ui.find({ type: 'Text', text: `${count} rows · 2 columns` })).toBeDefined()
  await ui.press({ key: 'copy-0' })
  expect(seen.copies.at(-1)?.text.split('\n')).toHaveLength(count + 1)

  await ui.press({ key: 'more-0' })
  expect(await rowText()).toHaveLength(count)
  expect((await labels(ui))[0]).toBe('Show fewer rows')

  await ui.press({ key: 'more-0' })
  expect(await rowText()).toHaveLength(SHORT_ROWS)
})

test('a short table has no fold button', async ($, on) => {
  world(on)

  const ui = await drawn($, 'terminal', REPLY)

  expect(await ui.find({ type: 'Button', key: 'more-0' })).toBeUndefined()
})

test('a wide desktop table shows its first column and a page of the others, and the arrows step through them', async ($, on) => {
  const seen = world(on)

  const head = '| # | Project | Owner | Budget | Spent | Progress | Code |\n|---|---|---|---|---|---|---|\n'
  const rows = '| 2 | Data Warehouse | ops | $48,250.50 | $22,100 | 47% | A-12 |\n| 4 | Audit Prep | Compliance | $3,150 | $2,016 | 64% | +4% |\n'
  const ui = await drawn($, 'desktop', head + rows)
  const cells = async () =>
    (await ui.findAll({ type: 'Box' })).filter(b => typeof b.props.width === 'string' && String(b.props.width).endsWith('%'))
  const headers = async () => (await ui.findAll({ type: 'Text' })).filter(t => t.props.weight === 'semibold').map(t => t.text)

  // Page one: the pinned # and columns 2-5, each cell clipped with its padding inside its share.
  expect(await cells()).toHaveLength(GRID_COLUMNS * 3)
  expect((await cells()).every(b => b.props.overflow === 'hidden' && b.props.paddingX === undefined)).toBe(true)
  expect(await headers()).toEqual(['#', 'Project', 'Owner', 'Budget', 'Spent'])
  expect(await ui.find({ type: 'Text', text: 'Columns 2–5 of 7' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'left-0' })).toBeUndefined()
  // A column of figures, which cannot wrap, gets at least the room of a text column that can.
  const shares = (await cells()).slice(0, GRID_COLUMNS).map(b => Number(String(b.props.width).slice(0, -1)))

  expect(shares.reduce((s, x) => s + x, 0)).toBe(100)
  expect(shares[3]).toBeGreaterThanOrEqual(shares[1]!)

  // The last page is as full as the first: # and columns 4-7.
  await ui.press({ key: 'right-0' })
  expect(await headers()).toEqual(['#', 'Budget', 'Spent', 'Progress', 'Code'])
  expect(await ui.find({ type: 'Text', text: 'Columns 4–7 of 7' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'right-0' })).toBeUndefined()

  // The footer, Copy and the exports keep every column.
  expect(await ui.find({ type: 'Text', text: '2 rows · 7 columns' })).toBeDefined()
  await ui.press({ key: 'copy-0' })
  expect(seen.copies.at(-1)?.text.split('\n')[0]?.split('\t')).toHaveLength(7)

  await ui.press({ key: 'left-0' })
  expect(await headers()).toEqual(['#', 'Project', 'Owner', 'Budget', 'Spent'])
})

test('five columns or fewer on the desktop have no pages', async ($, on) => {
  world(on)

  const ui = await drawn($, 'desktop', '| a | b | c | d | e |\n| - | - | - | - | - |\n| 1 | 2 | 3 | 4 | 5 |\n')

  expect(await ui.find({ type: 'Button', key: 'right-0' })).toBeUndefined()
  expect(await labels(ui)).toEqual(['Copy', 'CSV', 'XLSX'])
})

test('a terminal table that would break its words pages its columns', async ($, on) => {
  world(on)

  const months = ['Region', 'January', 'February', 'March', 'April', 'May', 'June']
  const table = `| ${months.join(' | ')} |\n|${' --- |'.repeat(7)}\n| North | $12,400.50 | $13,100.25 | $14,000.75 | $15,200.00 | $16,900.10 | $17,450.90 |\n`
  const ui = await drawn($, 'terminal', table, 60)
  const boxed = async () => (await ui.findAll({ type: 'Box' })).some(b => b.props.borderStyle !== undefined)
  const top = async () =>
    (await ui.findAll({ type: 'Box' })).find(b => b.props.flexDirection === 'row' && b.props.backgroundColor !== undefined)?.text ?? ''

  expect(await boxed()).toBe(true)
  expect(await top()).toContain('Region')
  expect(await top()).not.toContain('June')
  expect(await ui.find({ type: 'Button', key: 'right-0' })).toBeDefined()
  // The box fits the window.
  expect(cellWidth(await top()) + 2).toBeLessThanOrEqual(60)

  for (let i = 0; i < 6 && (await ui.find({ type: 'Button', key: 'right-0' })) !== undefined; i++) {
    await ui.press({ key: 'right-0' })
  }
  expect(await top()).toContain('Region')
  expect(await top()).toContain('June')
  // Each figure is whole on its page.
  expect(await ui.find({ type: 'Text', text: /\$17,450\.90/ })).toBeDefined()
})

test('columnPages pins the first column and fills the last page back from the end', () => {
  const upTo = (k: number) => (cols: number[]) => cols.length <= k

  expect(columnPages(5, upTo(5))).toEqual([])
  expect(columnPages(7, upTo(5))).toEqual([
    [1, 2, 3, 4],
    [3, 4, 5, 6],
  ])
  expect(columnPages(4, upTo(2))).toEqual([[1], [2], [3]])
  expect(pickColumns({ header: ['a', 'b', 'c'], align: [null, 'right', null], rows: [['1', '2', '3']] }, [0, 2])).toEqual({
    header: ['a', 'c'],
    align: [null, null],
    rows: [['1', '3']],
  })
})

test('a long Thai cell and a file name wrap in a desktop cell, and copy as written', async ($, on) => {
  const seen = world(on)
  const thai = 'วันนี้อากาศดีมากเราจึงออกไปเดินเล่นที่สวนใกล้บ้านกันทั้งครอบครัว'
  const table = `| ไฟล์ | หมายเหตุ |\n| --- | --- |\n| รายงาน | ${thai} \`monthly_sales_report_v2.py\` |\n`
  const ui = await drawn($, 'desktop', table, 40)
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)

  // The drawn cell has places to break; nothing else changed.
  expect(texts.some(t => t.includes('\u200B') && t.replaceAll('\u200B', '').includes(thai))).toBe(true)
  expect(texts.some(t => t.replaceAll('\u200B', '').includes('monthly_sales_report_v2.py') && t.includes('_\u200B'))).toBe(true)

  await ui.press({ key: 'copy-0' })
  expect(seen.copies.at(-1)?.text).toBe(`ไฟล์\tหมายเหตุ\nรายงาน\t${thai} \`monthly_sales_report_v2.py\``)
})
