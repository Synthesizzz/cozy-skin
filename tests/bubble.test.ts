import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { applyTheme, describe, parseTheme } from '../hooks/command'
import { DEFAULTS, SETTINGS_KEY, sane } from '../hooks/settings'

const PLUGIN = 'cozy-skin'
const START = { cwd: '/', surface: 'desktop', isInteractive: true } as const

// The engine with the mod loaded, a store holding the given settings, and the
// engine's own prompt row beneath as plain text.
function world(on: On, stored: Record<string, unknown>) {
  const kept = new Map<string, unknown>([[SETTINGS_KEY, { mode: 'light', ...stored }]])

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('ui.render', { component: 'UserMessage' }, (beneath, e) => beneath.ui.resolve(e).Text({ children: `engine: ${e.props.text}` }))

  return kept
}

const row = ($: Engine, surface: 'desktop' | 'terminal') =>
  $.ui.mount({
    plugin: PLUGIN,
    surface,
    component: 'UserMessage',
    props: { text: 'hello there', origin: { kind: 'composer' }, isExpanded: true },
  } as never)

test('/cozy bubble cozy|app parses, sets, shows, and defaults to cozy', () => {
  expect(parseTheme('bubble app')).toEqual({ kind: 'bubble', bubble: 'app' })
  expect(parseTheme('bubble cozy')).toEqual({ kind: 'bubble', bubble: 'cozy' })
  expect(parseTheme('bubble pink')).toMatchObject({ kind: 'error' })
  expect(applyTheme(DEFAULTS, { kind: 'bubble', bubble: 'app' }).bubble).toBe('app')
  expect(DEFAULTS.bubble).toBe('cozy')
  expect(sane({ bubble: 'nonsense' }).bubble).toBe('cozy')
  expect(sane({ bubble: 'app' }).bubble).toBe('app')
  expect(describe({ ...DEFAULTS, bubble: 'app' }, 'light')).toContain('Your bubble: app')
})

test("with the app's bubble the desktop row is the engine's own, for Rewind and selection", async ($, on) => {
  world(on, { bubble: 'app' })
  await $.session.start(START)

  expect(await (await row($, 'desktop')).find({ type: 'Text', text: 'engine: hello there' })).toBeDefined()
})

test("the app's bubble leaves the terminal's coloured line as it was", async ($, on) => {
  world(on, { bubble: 'app' })
  await $.session.start({ ...START, surface: 'terminal' })
  const ui = await row($, 'terminal')

  expect(await ui.find({ type: 'Text', text: 'engine: hello there' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'hello there' })).toBeDefined()
})

test('the cozy bubble stays the default on the desktop', async ($, on) => {
  world(on, {})
  await $.session.start(START)

  expect(await (await row($, 'desktop')).find({ type: 'Text', text: 'engine: hello there' })).toBeUndefined()
})

test('the panel switches between the cozy bubble and the app bubble', async ($, on) => {
  const kept = world(on, {})

  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.session.start(START)
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'Pane',
    requestId: 'cozy-skin',
    props: { title: 'cozy-skin', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  } as never)

  await ui.press({ key: 'bubble-app' })
  expect(sane(kept.get(SETTINGS_KEY)).bubble).toBe('app')
  await ui.press({ key: 'bubble-cozy' })
  expect(sane(kept.get(SETTINGS_KEY)).bubble).toBe('cozy')
})
