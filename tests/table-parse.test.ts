import { expect, test } from 'claude-code/testing'
import { splitTables } from '../hooks/table-parse'
import type { Segment, Table } from '../hooks/table-parse'

const join = (s: string) => splitTables(s).map(seg => (seg.kind === 'text' ? seg.text : seg.source)).join('')
const tables = (s: string): Table[] =>
  splitTables(s).flatMap((seg: Segment) => (seg.kind === 'table' ? [seg.table] : []))

const BASIC = 'intro\n\n| เดือน | ยอดขาย |\n|:---|---:|\n| ม.ค. | 1,200 |\n| ก.พ. | 3,400 |\n\noutro\n'

const FIXTURES = [
  '',
  'no table here\njust text\n',
  BASIC,
  '| a | b |\n|---|---|\n| 1 | 2 |',
  '| a | b |\r\n|---|---|\r\n| 1 | 2 |\r\n\r\ntail\r\n',
  'x\n```\n| a | b |\n|---|---|\n| 1 | 2 |\n```\ny\n',
  '| a | b |\n',
  'one\n\n| a |\n|---|\n| 1 |\n\ntwo\n\n| b | c |\n|---|---|\n| 2 | 3 |\n',
  '~~~md\n| a | b |\n|---|---|\n~~~\n',
]

test('no table gives one text segment equal to the input', () => {
  const s = 'hello\nworld\n'

  expect(splitTables(s)).toEqual([{ kind: 'text', text: s }])
})

test('a table between paragraphs gives text, table, text', () => {
  const segs = splitTables(BASIC)

  expect(segs.map(seg => seg.kind)).toEqual(['text', 'table', 'text'])
  const t = tables(BASIC)[0]

  expect(t?.header).toEqual(['เดือน', 'ยอดขาย'])
  expect(t?.align).toEqual(['left', 'right'])
  expect(t?.rows).toEqual([['ม.ค.', '1,200'], ['ก.พ.', '3,400']])
})

test('center and default alignment', () => {
  expect(tables('| a | b | c |\n|:---:|---|:-:|\n| 1 | 2 | 3 |\n')[0]?.align).toEqual(['center', null, 'center'])
})

test('two tables give two table segments', () => {
  const s = '| a |\n|---|\n| 1 |\n\ntext\n\n| b | c |\n|---|---|\n| 2 | 3 |\n'

  expect(splitTables(s).filter(seg => seg.kind === 'table')).toHaveLength(2)
})

test('a table inside a code fence stays text', () => {
  const backticks = '```\n| a | b |\n|---|---|\n| 1 | 2 |\n```\n'
  const tildes = '~~~md\n| a | b |\n|---|---|\n~~~\n'

  expect(splitTables(backticks)).toEqual([{ kind: 'text', text: backticks }])
  expect(splitTables(tildes)).toEqual([{ kind: 'text', text: tildes }])
})

test('a longer fence is not closed by a shorter one, and a table after it parses', () => {
  const s = '````\n```\n| a | b |\n|---|---|\n````\n| c | d |\n|---|---|\n| 1 | 2 |\n'

  expect(tables(s)).toHaveLength(1)
  expect(tables(s)[0]?.header).toEqual(['c', 'd'])
})

test('escaped pipes, inline code, Thai and thousands separators stay exact', () => {
  const s = '| h1 | h2 | h3 | h4 |\n|---|---|---|---|\n| a\\|b | `x|y` | สวัสดี | 1,200 |\n'
  const row = tables(s)[0]?.rows[0]

  expect(row).toEqual(['a|b', '`x|y`', 'สวัสดี', '1,200'])
})

test('a header with no separator row stays text', () => {
  const s = 'before\n\n| a | b |\n'
  const s2 = '| a | b |\n| 1 | 2 |\n'

  expect(splitTables(s)).toEqual([{ kind: 'text', text: s }])
  expect(splitTables(s2)).toEqual([{ kind: 'text', text: s2 }])
})

test('mismatched header and separator column counts stay text', () => {
  const s = '| a | b |\n|---|\n| 1 | 2 |\n'

  expect(tables(s)).toHaveLength(0)
})

test('rows without outer pipes parse', () => {
  const t = tables('a | b\n--- | ---\n1 | 2\n')[0]

  expect(t?.header).toEqual(['a', 'b'])
  expect(t?.rows).toEqual([['1', '2']])
})

test('short body rows pad and long ones are cut', () => {
  const t = tables('| a | b |\n|---|---|\n| 1 |\n| 1 | 2 | 3 |\n')[0]

  expect(t?.rows).toEqual([['1', ''], ['1', '2']])
})

test('a table ends at a non-pipe line', () => {
  const s = '| a |\n|---|\n| 1 |\nplain\n'
  const segs = splitTables(s)

  expect(segs.map(seg => seg.kind)).toEqual(['table', 'text'])
  expect(segs[1]).toEqual({ kind: 'text', text: 'plain\n' })
})

test('CRLF is preserved and cells exclude carriage returns', () => {
  const s = '| a | b |\r\n|---|---|\r\n| 1 | 2 |\r\n'

  expect(tables(s)[0]?.rows).toEqual([['1', '2']])
  expect(join(s)).toBe(s)
})

test('round trip is exact for every fixture', () => {
  for (const s of FIXTURES) {
    expect(join(s)).toBe(s)
  }
})
