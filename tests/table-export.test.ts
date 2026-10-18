import { expect, test } from 'claude-code/testing'
import type { ExportHost } from '../hooks/table-export'
import { exportName, saveCsv, saveXlsx, toCsv, toTsv } from '../hooks/table-export'
import { asFigure, xlsxParts } from '../hooks/xlsx'
import type { Table } from '../hooks/table-parse'

const table = (header: string[], rows: string[][]): Table => ({ header, align: header.map(() => null), rows })

test('toTsv joins cells with tabs and rows with newlines', () => {
  expect(toTsv(table(['a', 'b'], [['1', '2']]))).toBe('a\tb\n1\t2')
  expect(toTsv(table(['a\tx', 'b'], [['1\n2', '3']]))).toBe('a x\tb\n1 2\t3')
})

test('toCsv has a BOM, RFC 4180 quoting and CRLF line ends', () => {
  const csv = toCsv(table(['ชื่อ', 'ยอด'], [['สมชาย', '1,200'], ['say "hi"', 'a\nb'], ['plain', '+4%']]))

  expect(csv.startsWith('\uFEFF')).toBe(true)
  expect(csv).toContain('"1,200"')
  expect(csv).toContain('"say ""hi"""')
  expect(csv).toContain('"a\nb"')
  expect(csv).toContain('สมชาย')
  expect(csv).toContain('plain,+4%')
  expect(csv.slice(1).split('\r\n')[0]).toBe('ชื่อ,ยอด')
  expect(csv.endsWith('\r\n')).toBe(false)
})

test('toCsv keeps the cells Excel would change as exact text', () => {
  const csv = toCsv(table(['a', 'b', 'c', 'd', 'e', 'f'], [['007', '120.50', '12345678901234', '-0', '42', '-3.5']]))
  const row = csv.split('\r\n')[1]

  expect(row).toBe('"=""007""","=""120.50""","=""12345678901234""","=""-0""",42,-3.5')
})

test('xlsxParts holds the six parts with escaped inline strings and a styled header', () => {
  const parts = xlsxParts(table(['A&B', '<x>'], [['ไทย', '1,200'], ['+4%', 'q > r']]))

  expect(Object.keys(parts).sort()).toEqual([
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/workbook.xml',
    'xl/worksheets/sheet1.xml',
  ])

  const sheet = parts['xl/worksheets/sheet1.xml'] ?? ''

  // The header is style 1: bold, on a grey band, a thin line under it.
  expect(sheet).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">A&amp;B</t></is></c>')
  expect(sheet).toContain('&lt;x&gt;')
  expect(sheet).toContain('q &gt; r')
  expect(sheet).toContain('ไทย')
  // "1,200" is the number 1200 shown as #,##0; "+4%" stays text, as Excel would drop the plus.
  expect(sheet).toContain('<c r="B2" s="2"><v>1200</v></c>')
  expect(sheet).toContain('<c r="A3" t="inlineStr"><is><t xml:space="preserve">+4%</t></is></c>')
  expect(parts['xl/styles.xml']).toContain('<numFmt numFmtId="164" formatCode="#,##0"/>')
  expect(parts['xl/styles.xml']).toContain('<font><b/>')
  expect(parts['[Content_Types].xml']).toContain('/xl/styles.xml')
  expect(parts['xl/_rels/workbook.xml.rels']).toContain('Target="styles.xml"')
  expect(parts['xl/workbook.xml']).toContain('name="Sheet1"')
})

test('xlsxParts freezes the header and puts filter buttons on it', () => {
  const parts = xlsxParts(table(['a', 'b', 'c'], [['1', '2', '3'], ['4', '5', '6']]))
  const sheet = parts['xl/worksheets/sheet1.xml'] ?? ''

  expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>')
  expect(sheet.indexOf('<sheetViews>')).toBeLessThan(sheet.indexOf('<cols>'))
  expect(sheet).toContain('<autoFilter ref="A1:C3"/>')
  expect(sheet.indexOf('</sheetData>')).toBeLessThan(sheet.indexOf('<autoFilter'))
  expect(parts['xl/workbook.xml']).toContain('Sheet1!$A$1:$C$3</definedName>')
})

test('asFigure turns money, thousands and shares into numbers that show the same text', () => {
  expect(asFigure('1,200')).toEqual({ value: '1200', format: '#,##0' })
  expect(asFigure('-48,250.50')).toEqual({ value: '-48250.50', format: '#,##0.00' })
  expect(asFigure('$350.50')).toEqual({ value: '350.50', format: '"$"0.00' })
  expect(asFigure('$12,400')).toEqual({ value: '12400', format: '"$"#,##0' })
  expect(asFigure('-฿1,000')).toEqual({ value: '-1000', format: '"฿"#,##0' })
  expect(asFigure('12%')).toEqual({ value: '0.12', format: '0%' })
  expect(asFigure('-4.5%')).toEqual({ value: '-0.045', format: '0.0%' })
  for (const text of ['+4%', '007', '05%', '1,20', '12,345,678,901,234', '$-5', '1.2.3', 'ok', '']) {
    expect(asFigure(text), text).toBeNull()
  }
})

test('xlsxParts writes a number only when Excel would show the same text', () => {
  const numbers = ['120400', '-4.5', '0', '0.5', '12345678901', '-1234567.8901']
  const texts = ['007', '0812345678', '1.50', '1.', '123456789012', '1234567890123', '1234567890123456', '-0', '007x', '1e5', '.5', '', '+4%']
  const sheet = xlsxParts(table(['n'], [...numbers, ...texts].map(v => [v])))['xl/worksheets/sheet1.xml'] ?? ''

  numbers.forEach((v, i) => expect(sheet).toContain(`<c r="A${i + 2}"><v>${v}</v></c>`))
  texts.forEach((v, i) => expect(sheet).toContain(`<c r="A${numbers.length + i + 2}" t="inlineStr">`))
  // Past 11 significant digits Excel's General format shows 1.23457E+12: such IDs stay text.
  expect(sheet).not.toContain('<v>123456789012</v>')
  expect(sheet).not.toContain('<v>1234567890123</v>')
})

test('xlsxParts sizes each column to its longest cell, and the header to its text and filter button', () => {
  const sheet = xlsxParts(table(['id', 'name'], [['1', 'a much longer name'], ['22', 'b']]))['xl/worksheets/sheet1.xml'] ?? ''

  expect(sheet).toContain('<cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="2" width="20" customWidth="1"/></cols>')
  expect(sheet.indexOf('<cols>')).toBeLessThan(sheet.indexOf('<sheetData>'))

  const long = xlsxParts(table(['x'], [['y'.repeat(500)]]))['xl/worksheets/sheet1.xml'] ?? ''

  expect(long).toContain('<col min="1" max="1" width="80" customWidth="1"/>')

  // Region, Revenue, Growth: bold header text and the filter button both fit.
  const heads = xlsxParts(table(['Region', 'Revenue', 'Growth'], [['North', '$12,400', '4.2%']]))['xl/worksheets/sheet1.xml'] ?? ''

  expect(heads).toContain('<col min="1" max="1" width="11" customWidth="1"/><col min="2" max="2" width="12" customWidth="1"/><col min="3" max="3" width="11" customWidth="1"/>')
})

test('xlsxParts names columns past Z', () => {
  const header = Array.from({ length: 28 }, (_, i) => `h${i}`)
  const sheet = xlsxParts(table(header, []))['xl/worksheets/sheet1.xml'] ?? ''

  expect(sheet).toContain('r="Z1"')
  expect(sheet).toContain('r="AA1"')
  expect(sheet).toContain('r="AB1"')
})

test('exportName uses local time', () => {
  expect(exportName(new Date(2026, 9, 16, 19, 5, 9), 'csv')).toBe('table-20261016-190509.csv')
  expect(exportName(new Date(2026, 0, 2, 3, 4, 5), 'xlsx')).toBe('table-20260102-030405.xlsx')
})

type Seen = { writes: Record<string, string>; runs: string[][] }

type Fail = { writeThrows?: boolean; zipRejects?: boolean; existsRejects?: boolean }

function mount(exit = 0, fail: Fail = {}) {
  const seen: Seen = { writes: {}, runs: [] }
  const host: ExportHost = {
    fs: {
      exists: async path => {
        if (fail.existsRejects === true) {
          throw new Error('no access')
        }

        return path in seen.writes
      },
      write: async (path, text) => {
        if (fail.writeThrows === true) {
          throw new Error('disk full')
        }
        seen.writes[path] = text
      },
    },
    process: {
      run: async argv => {
        seen.runs.push([...argv])

        // Only the zip call fails; the cleanup call that follows must still work.
        if (fail.zipRejects === true && argv.includes('-File')) {
          throw new Error('timed out')
        }

        return { exitCode: exit, stdout: '', stderr: exit === 0 ? '' : 'boom', isStdoutTruncated: false, isStderrTruncated: false }
      },
    },
    plugin: { root: 'C:/mod' },
  }

  return { seen, host }
}

test('saveCsv writes under cozy-exports and returns the path', async () => {
  const { seen, host } = mount()
  const path = await saveCsv(host, table(['a'], [['1']]), 'C:/proj')

  expect(path).toMatch(/^C:\/proj\/cozy-exports\/table-\d{8}-\d{6}(-\d+)?\.csv$/)
  expect(seen.writes[path]?.startsWith('\uFEFF')).toBe(true)
})

test('two CSV saves in the same second give two files', async () => {
  const { seen, host } = mount()
  const now = new Date(2026, 9, 16, 19, 5, 9)
  const first = await saveCsv(host, table(['a'], [['1']]), 'C:/same', now)
  const second = await saveCsv(host, table(['a'], [['2']]), 'C:/same', now)
  const third = await saveCsv(host, table(['a'], [['3']]), 'C:/same', now)

  expect(first).toBe('C:/same/cozy-exports/table-20261016-190509.csv')
  expect(second).toBe('C:/same/cozy-exports/table-20261016-190509-2.csv')
  expect(third).toBe('C:/same/cozy-exports/table-20261016-190509-3.csv')
  expect(Object.keys(seen.writes).filter(p => p.endsWith('.csv'))).toHaveLength(3)
})

test('a name on disk from an earlier session is not overwritten', async () => {
  const { seen, host } = mount()
  const stamp = exportName(new Date(), 'csv')

  seen.writes[`C:/old/cozy-exports/${stamp}`] = 'kept'
  const path = await saveCsv(host, table(['a'], [['1']]), 'C:/old')

  expect(seen.writes[`C:/old/cozy-exports/${stamp}`]).toBe('kept')
  expect(path).not.toBe(`C:/old/cozy-exports/${stamp}`)
})

test('names used this session stay unique when the disk cannot be asked', async () => {
  const { host } = mount(0, { existsRejects: true })
  const first = await saveCsv(host, table(['a'], [['1']]), 'C:/blind')
  const second = await saveCsv(host, table(['a'], [['1']]), 'C:/blind')

  expect(second).not.toBe(first)
})

test('two XLSX saves in the same second use two temp folders and two files', async () => {
  const { seen, host } = mount()
  const now = new Date(2026, 9, 16, 19, 5, 9)
  const first = await saveXlsx(host, table(['a'], [['1']]), 'C:/twice', now)
  const second = await saveXlsx(host, table(['a'], [['1']]), 'C:/twice', now)
  const temps = new Set(Object.keys(seen.writes).map(p => p.slice(0, p.indexOf('/', 'C:/twice/cozy-exports/'.length))))

  expect(first).toBe('C:/twice/cozy-exports/table-20261016-190509.xlsx')
  expect(second).toBe('C:/twice/cozy-exports/table-20261016-190509-2.xlsx')
  expect([...temps].every(t => t.startsWith('C:/twice/cozy-exports/.tmp-'))).toBe(true)
  expect(temps.size).toBe(2)
})

test('saveXlsx writes the parts, zips them and returns the path', async () => {
  const { seen, host } = mount()
  const path = await saveXlsx(host, table(['a'], [['1']]), 'C:/proj')

  expect(path).toMatch(/^C:\/proj\/cozy-exports\/table-\d{8}-\d{6}(-\d+)?\.xlsx$/)
  expect(Object.keys(seen.writes).some(p => p.includes('/.tmp-') && p.endsWith('xl/worksheets/sheet1.xml'))).toBe(true)
  expect(seen.runs).toHaveLength(1)
  expect(seen.runs[0]).toContain('-File')
  expect(seen.runs[0]).toContain(path)
})

test('saveXlsx rejects with the script error when zipping fails', async () => {
  const { host } = mount(1)

  await expect(saveXlsx(host, table(['a'], [['1']]), 'C:/proj')).rejects.toThrow('boom')
})

const cleanups = (seen: Seen) => seen.runs.filter(run => run.join(' ').includes('Remove-Item') && run.join(' ').includes('.tmp-'))

test('saveXlsx cleans up and rethrows when a write throws', async () => {
  const { seen, host } = mount(0, { writeThrows: true })

  await expect(saveXlsx(host, table(['a'], [['1']]), 'C:/proj')).rejects.toThrow('disk full')
  expect(cleanups(seen)).toHaveLength(1)
})

test('saveXlsx cleans up and rethrows when the zip call rejects', async () => {
  const { seen, host } = mount(0, { zipRejects: true })

  await expect(saveXlsx(host, table(['a'], [['1']]), 'C:/proj')).rejects.toThrow('timed out')
  expect(cleanups(seen)).toHaveLength(1)
})

test('a failing cleanup does not hide the original error', async () => {
  const { host } = mount(0, { writeThrows: true })
  const failing: ExportHost = { ...host, process: { run: async () => { throw new Error('no powershell') } } }

  await expect(saveXlsx(failing, table(['a'], [['1']]), 'C:/proj')).rejects.toThrow('disk full')
})
