import { expect, test } from 'claude-code/testing'
import { hasInlineCode, parseBlocks, parseInline, plainText } from '../hooks/markdown-blocks'

test('parseBlocks reads headings, paragraphs, lists, code and rules, each with its source', () => {
  const text = '# Title\n\nSome **bold** text\nnext line\n\n- one\n- two\n  more\n\n```ts\nconst x = 1\n```\n\n---'
  const blocks = parseBlocks(text)

  expect(blocks.map(b => b.kind)).toEqual(['heading', 'para', 'list', 'code', 'rule'])
  expect(blocks.map(b => b.source)).toEqual([
    '# Title',
    'Some **bold** text\nnext line',
    '- one\n- two\n  more',
    '```ts\nconst x = 1\n```',
    '---',
  ])
  expect(blocks[2]).toMatchObject({ items: [{ text: 'one' }, { text: 'two more' }] })
})

test('blocks the reader does not know keep their source for the engine', () => {
  const quote = '> a quote\n> goes on'
  const blocks = parseBlocks(`Before\n\n${quote}\n\n$$\nx^2\n$$`)

  expect(blocks[1]).toEqual({ kind: 'other', source: quote })
  expect(blocks[2]).toEqual({ kind: 'other', source: '$$\nx^2\n$$' })
})

test('an unclosed fence keeps the rest as code', () => {
  expect(parseBlocks('```\nline 1\nline 2')).toEqual([{ kind: 'code', lang: '', lines: ['line 1', 'line 2'], source: '```\nline 1\nline 2' }])
})

test('inline marks go and every word stays', () => {
  const text = 'Use `my_var` with **bold _and_ italic**, ~~old~~ and [docs](https://example.com) in snake_case 2 * 3 * 4'

  expect(plainText(parseInline(text))).toBe('Use my_var with bold and italic, old and docs in snake_case 2 * 3 * 4')
  expect(plainText(parseInline('สวัสดี **ครับ** ✅'))).toBe('สวัสดี ครับ ✅')
})

test('hasInlineCode finds code spans at any depth and only there', () => {
  expect(hasInlineCode('Run `ls` now')).toBe(true)
  expect(hasInlineCode('**see `x`**')).toBe(true)
  expect(hasInlineCode('No code, just snake_case and 2 * 3')).toBe(false)
})
