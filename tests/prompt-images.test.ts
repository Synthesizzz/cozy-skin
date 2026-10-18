import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { IMAGES_KEY, KEPT_IMAGES, hasImage, promptKey, remember, saneImages } from '../hooks/prompt-images'
import { SETTINGS_KEY } from '../hooks/settings'

const PLUGIN = 'cozy-skin'
const START = { cwd: '/', surface: 'desktop', isInteractive: true } as const

// The engine with the mod loaded, a store, and the engine's own prompt row
// beneath as plain text, so a test can see when cozy leaves the row alone.
function world(on: On) {
  const kept = new Map<string, unknown>([[SETTINGS_KEY, { mode: 'dark', preset: 'nord' }]])

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('prompt.submit', (_, e) => ({ text: e.text }) as never)
  on('ui.render', { component: 'UserMessage' }, (beneath, e) => beneath.ui.resolve(e).Text({ children: `engine: ${e.props.text}` }))

  return kept
}

let rows = 0

const bubble = ($: Engine, text: string) =>
  $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'UserMessage',
    requestId: `msg_${++rows}`,
    props: { text, origin: { kind: 'composer' }, isExpanded: true },
  } as never)

test('a prompt sent with an image keeps the engine row, which shows the picture', async ($, on) => {
  const kept = world(on)

  await $.session.start(START)
  await $.prompt.submit({ text: 'look at this  table', attachments: [{ type: 'image', mediaType: 'image/png' }] } as never)

  expect(kept.get(IMAGES_KEY)).toEqual(['look at this table'])
  const ui = await bubble($, 'look at this table')

  expect(await ui.find({ type: 'Text', text: 'engine: look at this table' })).toBeDefined()
})

test('a prompt without an image still gets the preset bubble', async ($, on) => {
  world(on)

  await $.session.start(START)
  await $.prompt.submit({ text: 'just words' } as never)
  const ui = await bubble($, 'just words')

  expect(await ui.find({ type: 'Text', text: /^engine:/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'just words' })).toBeDefined()
})

test('the image list holds across sessions, and an image named in the text counts', async ($, on) => {
  const kept = world(on)

  kept.set(IMAGES_KEY, ['from yesterday'])
  await $.session.start(START)

  expect(await (await bubble($, 'from yesterday')).find({ type: 'Text', text: 'engine: from yesterday' })).toBeDefined()
  expect(hasImage('see [Image #1] here', [])).toBe(true)
  expect(hasImage('see [Image: source: C:/x.png]', [])).toBe(true)
  expect(hasImage('an [Imagery] word', [])).toBe(false)
})

test('the kept list has no repeats, keeps the newest last and stays bounded', () => {
  expect(remember(['a', 'b'], ' a ')).toEqual(['b', 'a'])
  expect(remember(Array.from({ length: KEPT_IMAGES }, (_, i) => `p${i}`), 'new')).toHaveLength(KEPT_IMAGES)
  expect(promptKey('  two\n\nlines ')).toBe('two lines')
  expect(saneImages(['ok', 3, null])).toEqual(['ok'])
  expect(saneImages('nope')).toEqual([])
})

test('a prompt with pasted text matches its row, which shows the paste as a placeholder', () => {
  const sent = 'Worked <pasted_content id="8649">\nFeature | What it does\n</pasted_content id="8649"> but when narrow it breaks'
  const kept = remember([], sent)

  expect(hasImage('Worked [Pasted text #1 +3 lines] but when narrow it breaks', kept)).toBe(true)
  // A key kept before pasted parts were left out still matches.
  expect(hasImage('Worked [Pasted text #1] but when narrow it breaks', ['Worked <pasted_content id="1"> x </pasted_content id="1"> but when narrow it breaks'])).toBe(true)
  expect(hasImage('something else', kept)).toBe(false)
})
