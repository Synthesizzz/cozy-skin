import { expect, test } from 'claude-code/testing'
import { KEPT_SENT, agoLabel, mergeSent, parseTranscriptTimes, rememberSent, saneSent, sentAt, transcriptPath } from '../hooks/prompt-times'

const MINUTE = 60_000

test('a sent prompt keeps its latest time, matched as its row shows it', () => {
  let kept = rememberSent({}, 'hello   there', 1000)

  kept = rememberSent(kept, 'hello there', 5000)
  expect(sentAt(kept, 'hello there')).toBe(5000)
  expect(Object.keys(kept)).toHaveLength(1)
  expect(sentAt(kept, 'never sent')).toBeUndefined()
})

test('the kept times stay bounded, dropping the oldest', () => {
  let kept = {}

  for (let i = 0; i < KEPT_SENT + 5; i++) {
    kept = rememberSent(kept, `prompt ${i}`, i)
  }
  expect(Object.keys(kept)).toHaveLength(KEPT_SENT)
  expect(sentAt(kept, 'prompt 0')).toBeUndefined()
  expect(sentAt(kept, `prompt ${KEPT_SENT + 4}`)).toBe(KEPT_SENT + 4)
})

test('stored times that are broken are dropped', () => {
  expect(saneSent({ a: 1, b: 'x', c: null })).toEqual({ a: 1 })
  expect(saneSent(['a'])).toEqual({})
  expect(saneSent(undefined)).toEqual({})
})

test('the time reads as the app words it', () => {
  const now = 10 * 24 * 60 * MINUTE

  expect(agoLabel(now, now - 20_000)).toBe('just now')
  expect(agoLabel(now, now - MINUTE)).toBe('1 minute ago')
  expect(agoLabel(now, now - 5 * MINUTE)).toBe('5 minutes ago')
  expect(agoLabel(now, now - 2 * 60 * MINUTE)).toBe('2 hours ago')
  expect(agoLabel(now, now - 30 * 60 * MINUTE)).toBe('yesterday')
  expect(agoLabel(now, now - 3 * 24 * 60 * MINUTE)).toBe('3 days ago')
})

test("a session's transcript is where Claude Code keeps it", () => {
  expect(transcriptPath('C:\\Users\\me\\', 'C:\\Users\\me\\mods\\cozy-skin', 'abc')).toBe(
    'C:\\Users\\me/.claude/projects/C--Users-me-mods-cozy-skin/abc.jsonl',
  )
})

test("the script's output reads as prompts and times, and junk is skipped", () => {
  const out = '\uFEFF[{"t":"2026-10-18T07:02:52.883Z","text":"สวัสดี"},{"t":"bad","text":"x"},{"text":"no time"},5]'

  expect(parseTranscriptTimes(out)).toEqual([['สวัสดี', Date.parse('2026-10-18T07:02:52.883Z')]])
  expect(parseTranscriptTimes('not json')).toEqual([])
  expect(parseTranscriptTimes('')).toEqual([])
})

test("a transcript's times fill in old prompts and never move a later send back", () => {
  const kept = rememberSent({}, 'again', 9000)
  const merged = mergeSent(kept, [
    ['old one', 1000],
    ['again', 2000],
  ])

  expect(sentAt(merged, 'old one')).toBe(1000)
  expect(sentAt(merged, 'again')).toBe(9000)
})
