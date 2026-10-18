import { expect, test } from 'claude-code/testing'
import { cellWidth, softBreaks } from '../hooks/table-layout'

const ZWSP = '\u200B'
const pieces = (text: string) => text.split(/[\s\u200B]+/).filter(Boolean)

test('short words are left as they are', () => {
  expect(softBreaks('Copy, CSV and XLSX')).toBe('Copy, CSV and XLSX')
  expect(softBreaks('ผ่าน')).toBe('ผ่าน')
})

test('a long identifier can break after its punctuation, the text unchanged once the breaks are gone', () => {
  const text = 'monthly_sales_report_v2.py'
  const soft = softBreaks(text)

  expect(soft.replaceAll(ZWSP, '')).toBe(text)
  expect(soft).toContain(`_${ZWSP}`)
  expect(Math.max(...pieces(soft).map(cellWidth))).toBeLessThanOrEqual(12)
})

test('a long Thai run gets a break at least every few cells, never before a vowel or tone mark', () => {
  const text = 'วันนี้อากาศดีมากเราจึงออกไปเดินเล่นที่สวนใกล้บ้านกันทั้งครอบครัว'
  const soft = softBreaks(text)

  expect(soft.replaceAll(ZWSP, '')).toBe(text)
  expect(Math.max(...pieces(soft).map(cellWidth))).toBeLessThanOrEqual(12)
  // A break never lands before a combining mark, so no mark is left without its letter.
  expect(/\u200B[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(soft)).toBe(false)
})

test('a run with no place to break still breaks, and the spaces stay', () => {
  const soft = softBreaks('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa next')

  expect(soft.replaceAll(ZWSP, '')).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa next')
  expect(Math.max(...pieces(soft).map(cellWidth))).toBeLessThanOrEqual(12)
})
