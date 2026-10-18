import type { Table } from './table-parse'

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'

// A cell becomes a number only when Excel would show exactly the same text:
// no leading zeros ("007", "0812345678"), no trailing zeros ("1.50"), no
// "-0", and at most 11 significant digits: past that Excel's General format
// shows a 13-digit ID as 1.23457E+12. "+4%", "1,200" and Thai stay text.
const PLAIN_NUMBER = /^-?(0|[1-9]\d*)(\.\d*[1-9])?$/
const MAX_DIGITS = 11

export function isSafeNumber(value: string): boolean {
  if (!PLAIN_NUMBER.test(value) || value === '-0') {
    return false
  }

  return value.replace(/[-.]/g, '').replace(/^0+/, '').length <= MAX_DIGITS
}

// Column widths in characters: the longest cell plus a little room, kept
// between Excel's default and a width that still fits on a screen. The
// header's own text is bold and shares its cell with the filter button, so
// it counts a little wider and the button's room comes on top.
const MIN_WIDTH = 8
const MAX_WIDTH = 80
const FILTER_ROOM = 4

function colsXml(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const count = Math.max(header.length, ...rows.map(row => row.length))
  const cols = Array.from({ length: count }, (_, c) => {
    const longest = Math.max(0, ...rows.map(row => Array.from(row[c] ?? '').length))
    const head = Math.ceil(Array.from(header[c] ?? '').length * 1.1) + FILTER_ROOM
    const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + 2, head))

    return `<col min="${c + 1}" max="${c + 1}" width="${width}" customWidth="1"/>`
  })

  return count === 0 ? '' : `<cols>${cols.join('')}</cols>`
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Control characters other than tab, newline and carriage return are not legal in XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

// 0 -> A, 25 -> Z, 26 -> AA.
export function columnName(index: number): string {
  let name = ''
  let n = index + 1

  while (n > 0) {
    const rem = (n - 1) % 26

    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }

  return name
}

// A figure written the way people write money, thousands and shares, which
// Excel can hold as a number and show as the same text under a format:
// "1,200" (#,##0), "$350.50" ("$"#,##0.00), "12.5%" (0.0%). A sign other
// than a leading minus, leading zeros, or more than 11 significant digits
// keep it text, as for a plain number.
export type Figure = { value: string; format: string }

const GROUPED = /^-?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/
const MONEY = /^(-?)([$€£¥฿])((?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)(?:\.\d+)?)$/
const SHARE = /^-?(0|[1-9]\d*)(\.\d+)?%$/

const decimals = (text: string): number => (text.includes('.') ? (text.split('.')[1] ?? '').length : 0)
const grouping = (text: string): string => (text.includes(',') ? '#,##0' : '0')
const places = (n: number): string => (n === 0 ? '' : `.${'0'.repeat(n)}`)
const digits = (text: string): number => text.replace(/[^0-9]/g, '').replace(/^0+/, '').length

export function asFigure(text: string): Figure | null {
  if (GROUPED.test(text) && digits(text) <= MAX_DIGITS) {
    return { value: text.replace(/,/g, ''), format: `#,##0${places(decimals(text))}` }
  }
  const money = MONEY.exec(text)

  if (money !== null && digits(text) <= MAX_DIGITS) {
    const sign = money[1] ?? ''
    const symbol = money[2] ?? ''
    const amount = money[3] ?? ''

    return { value: `${sign}${amount.replace(/,/g, '')}`, format: `"${symbol}"${grouping(amount)}${places(decimals(amount))}` }
  }
  if (SHARE.test(text) && digits(text) <= MAX_DIGITS) {
    const share = text.slice(0, -1)
    const scaled = Number(share) / 100

    return { value: String(Number(scaled.toPrecision(12))), format: `0${places(decimals(share))}%` }
  }
  return null
}

// The styles a sheet uses: 0 plain, 1 the header (bold on a light grey band,
// a thin line under it), then one per figure format, numbered from 164 as
// custom formats are.
type Styles = { formats: string[]; styleOf: (format: string) => number }

function stylesFor(table: Table): Styles {
  const formats = [...new Set(table.rows.flat().map(asFigure).filter((f): f is Figure => f !== null).map(f => f.format))]

  return { formats, styleOf: format => 2 + formats.indexOf(format) }
}

function stylesXml(styles: Styles): string {
  const numFmts = styles.formats.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${escapeXml(f)}"/>`).join('')
  const figureXfs = styles.formats
    .map((_, i) => `<xf numFmtId="${164 + i}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`)
    .join('')

  return (
    `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}">` +
    (styles.formats.length === 0 ? '' : `<numFmts count="${styles.formats.length}">${numFmts}</numFmts>`) +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${2 + styles.formats.length}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
    `${figureXfs}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  )
}

function cell(ref: string, value: string, styles: Styles, isHeader: boolean): string {
  const style = isHeader ? ' s="1"' : ''

  if (isSafeNumber(value)) {
    return `<c r="${ref}"${style}><v>${value}</v></c>`
  }
  const figure = isHeader ? null : asFigure(value)

  if (figure !== null) {
    return `<c r="${ref}" s="${styles.styleOf(figure.format)}"><v>${figure.value}</v></c>`
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

// The range the header's filter covers: A1 to the last column of the last row.
const filterRange = (table: Table): string => `A1:${columnName(Math.max(0, table.header.length - 1))}${table.rows.length + 1}`

// The same range as a workbook name wants it: $A$1:$C$5.
const absolute = (range: string): string => range.replace(/([A-Z]+)(\d+)/g, (_, col: string, row: string) => `$${col}$${row}`)

function sheetXml(table: Table, styles: Styles): string {
  const all = [table.header, ...table.rows]
  const rows = all.map((cells, r) => {
    const body = cells.map((value, c) => cell(`${columnName(c)}${r + 1}`, value, styles, r === 0)).join('')

    return `<row r="${r + 1}">${body}</row>`
  })
  // The header stays in view while the rows scroll, and carries the filter buttons.
  const frozen =
    table.rows.length === 0
      ? ''
      : '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
  const filter = table.header.length === 0 ? '' : `<autoFilter ref="${filterRange(table)}"/>`

  return `${XML_HEAD}<worksheet xmlns="${NS_MAIN}">${frozen}${colsXml(table.header, table.rows)}<sheetData>${rows.join('')}</sheetData>${filter}</worksheet>`
}

// The six parts of a small workbook, keyed by their path inside the zip.
// Strings are inline, so no shared-strings part is needed.
export function xlsxParts(table: Table): Record<string, string> {
  const styles = stylesFor(table)
  // Excel keeps a header filter's range under this hidden name.
  const filterName =
    table.header.length === 0
      ? ''
      : `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Sheet1!${absolute(filterRange(table))}</definedName></definedNames>`

  return {
    '[Content_Types].xml':
      `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
    '_rels/.rels':
      `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
      `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
      '</Relationships>',
    'xl/workbook.xml':
      `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
      `<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>${filterName}</workbook>`,
    'xl/_rels/workbook.xml.rels':
      `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
      `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>` +
      '</Relationships>',
    'xl/styles.xml': stylesXml(styles),
    'xl/worksheets/sheet1.xml': sheetXml(table, styles),
  }
}
