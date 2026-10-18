import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { presetOf } from '../hooks/presets'
import { SETTINGS_KEY } from '../hooks/settings'
import type { Settings } from '../hooks/settings'
import { pickWord } from '../hooks/spinner'

const PLUGIN = 'cozy-skin'
const START = { cwd: 'C:/proj', surface: 'terminal', isInteractive: true } as const

// The engine with the mod loaded and a stored settings object; what is
// beneath echoes the props it was given as text.
function world(on: On, stored: Partial<Settings> = {}) {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: e.key === SETTINGS_KEY ? { mode: 'dark', ...stored } : undefined }))
  on('store.set', () => ({ value: undefined }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('ui.render', { component: 'Spinner' }, (beneath, e) => {
    const { Text } = beneath.ui.resolve(e)

    return Text({ children: `${e.props.message ?? e.props.word}${e.props.suffix}` })
  })
  on('ui.render', { component: 'TurnDuration' }, (beneath, e) => {
    const { Text } = beneath.ui.resolve(e)

    return Text({ children: `${e.props.word} for ${e.props.durationMs}ms` })
  })
}

const SPINNER = { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' } as const

async function spinner($: Engine, props: Record<string, unknown> = {}, requestId = 'main') {
  await $.session.start(START)

  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'Spinner',
    requestId,
    props: { ...SPINNER, ...props },
    viewport: { columns: 100, rows: 40 },
  })

  return (await ui.find({ type: 'Text' }))?.text ?? ''
}

const nord = presetOf('nord')?.dark

test('pickWord is stable for a seed and always one of the words', () => {
  const words = ['A', 'B', 'C']

  for (const seed of ['x', 'y', 'turn-1', '']) {
    expect(words).toContain(pickWord(words, seed))
    expect(pickWord(words, seed)).toBe(pickWord(words, seed))
  }
})

test('the spinner says one of the preset words and keeps the suffix', async ($, on) => {
  world(on, { preset: 'nord' })

  const text = await spinner($)

  expect(nord?.spinner.some(w => text === `${w}…`)).toBe(true)
})

test('a state message is kept as given', async ($, on) => {
  world(on, { preset: 'nord' })

  expect(await spinner($, { message: 'Compacting' })).toBe('Compacting…')
})

test('the turn footer says one of the preset done words and keeps the duration', async ($, on) => {
  world(on, { preset: 'nord' })
  await $.session.start(START)

  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'TurnDuration',
    requestId: 'm1',
    props: { word: 'Baked', durationMs: 3000 },
    viewport: { columns: 100, rows: 40 },
  })
  const text = (await ui.find({ type: 'Text' }))?.text ?? ''

  expect(nord?.done.some(w => text === `${w} for 3000ms`)).toBe(true)
})

test('calm keeps one word for the whole turn', async ($, on) => {
  world(on, { preset: 'nord', calm: true })
  await $.session.start(START)
  await $.turn.start({ text: 'hi', turnId: 'turn-1' })

  const seen = new Set<string>()

  for (const [i, word] of ['Sauteing', 'Baking', 'Stewing', 'Whisking', 'Simmering', 'Roasting'].entries()) {
    seen.add(await spinner($, { word }, `row-${i}`))
  }
  expect(seen.size).toBe(1)
})

test('the skin switched off leaves both rows to the next hook', async ($, on) => {
  world(on, { enabled: false })

  expect(await spinner($)).toBe('Sauteing…')
})
