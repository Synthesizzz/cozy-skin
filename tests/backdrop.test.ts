import type { On, ThemeResult, ThemeSetArgs } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { BACKDROP_ID, backdropArgs, wantsBackdrop } from '../hooks/backdrop'
import { parseTheme } from '../hooks/command'
import { PRESETS, presetOf } from '../hooks/presets'
import { SETTINGS_KEY, sane } from '../hooks/settings'

const PLUGIN = 'cozy-skin'
const START = { cwd: '/', surface: 'desktop', isInteractive: true } as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
const SITE = { scroll: { offset: 0, bodyRows: 40 }, view: {} }
const PANE = {
  plugin: PLUGIN,
  surface: 'desktop',
  component: 'Pane',
  requestId: 'cozy-skin',
  props: { title: 'cozy-skin', isFocused: true, bodyColumns: 60, placement: 'dock', ...SITE },
} as const

// Windows is never read in the kit, so mode auto resolves to dark.
const kindle = presetOf('kindle')!

// Every theme call, in order: a set's argument, or 'clear'.
type Call = ThemeSetArgs | 'clear'

// The engine with a stored settings object, and stand-ins that keep every
// theme call and answer a set with `answer`.
function world(on: On, stored: Record<string, unknown>, answer: ThemeResult = { isDrawn: true, requestId: 'backdrop' }) {
  const kept = new Map<string, unknown>([[SETTINGS_KEY, stored]])
  const calls: Call[] = []

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('theme.set', (_, e) => (calls.push({ ...e }), { value: answer }))
  on('theme.clear', () => (calls.push('clear'), { value: { isDrawn: false as const, reason: 'cleared' } }))

  const sets = () => calls.filter((c): c is ThemeSetArgs => c !== 'clear')

  return { kept, calls, sets, last: () => calls[calls.length - 1] }
}

const tintOf = (call: Call | undefined): string | undefined => {
  const glass = call === undefined || call === 'clear' ? undefined : call.backdrop?.glass

  return glass === undefined || glass === false ? undefined : glass.tint
}

test('/cozy backdrop takes off or paper, and an old or broken setting is off', () => {
  expect(parseTheme('backdrop paper')).toEqual({ kind: 'backdrop', backdrop: 'paper' })
  expect(parseTheme('backdrop off')).toEqual({ kind: 'backdrop', backdrop: 'off' })
  expect(parseTheme('backdrop grain')).toMatchObject({ kind: 'error' })
  expect(parseTheme('backdrop')).toMatchObject({ kind: 'error' })
  expect(sane({}).backdrop).toBe('off')
  expect(sane({ backdrop: 'paper' }).backdrop).toBe('paper')
  expect(sane({ backdrop: 'grain' }).backdrop).toBe('off')
})

test('the backdrop stands only for paper, the skin on and mode auto', () => {
  const on = sane({ mode: 'auto', backdrop: 'paper' })

  expect(wantsBackdrop(on)).toBe(true)
  expect(wantsBackdrop({ ...on, backdrop: 'off' })).toBe(false)
  expect(wantsBackdrop({ ...on, enabled: false })).toBe(false)
  expect(wantsBackdrop({ ...on, mode: 'light' })).toBe(false)
  expect(wantsBackdrop({ ...on, mode: 'dark' })).toBe(false)
})

test("the app's panels frost in the preset's own paper, a raw colour, and the scheme is the mode", () => {
  for (const preset of PRESETS) {
    for (const mode of ['light', 'dark'] as const) {
      const args = backdropArgs(sane({ preset: preset.name, mode: 'auto', backdrop: 'paper' }), mode)

      expect(Object.keys(args)).toEqual(['backdrop'])
      expect(args.backdrop?.id).toBe(BACKDROP_ID)
      expect(args.backdrop?.colorScheme).toBe(mode)
      expect(tintOf(args)).toBe(preset[mode].palette.bg)
      expect(tintOf(args)).toMatch(/^#[0-9a-f]{6}$/i)
      expect(args.backdrop?.glass === false ? undefined : args.backdrop?.glass?.opacity).toBe(0.7)
    }
  }
})

test('a session that starts with paper in mode auto sets the backdrop', async ($, on) => {
  const w = world(on, { mode: 'auto', backdrop: 'paper' })

  await $.session.start(START)
  expect(w.last()).toEqual(backdropArgs(sane({ mode: 'auto', backdrop: 'paper' }), 'dark'))
})

// With no paper wanted, a start makes no theme call, so another plugin's theme stands.
for (const [why, stored] of [
  ['the backdrop off', { mode: 'auto' }],
  ['a fixed mode', { mode: 'light', backdrop: 'paper' }],
  ['the skin off', { mode: 'auto', backdrop: 'paper', enabled: false }],
] as const) {
  test(`a session that starts with ${why} makes no theme call`, async ($, on) => {
    const w = world(on, { ...stored })

    await $.session.start(START)
    expect(w.calls).toEqual([])
  })
}

test('/cozy backdrop paper sets it, says it is drawn, and off clears it', async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  const set = await $.command.run({ ...TYPED, command: 'cozy', args: 'backdrop paper' })

  expect(sane(w.kept.get(SETTINGS_KEY)).backdrop).toBe('paper')
  expect(w.sets()).toHaveLength(1)
  expect(set.text).toContain('Backdrop: paper (drawn behind the window)')

  const cleared = await $.command.run({ ...TYPED, command: 'cozy', args: 'backdrop off' })

  expect(sane(w.kept.get(SETTINGS_KEY)).backdrop).toBe('off')
  expect(w.last()).toBe('clear')
  expect(cleared.text).toContain('Backdrop: off')

  // Nothing of cozy's stands now: a later change clears nothing more.
  await $.command.run({ ...TYPED, command: 'cozy', args: 'calm on' })
  expect(w.calls.filter(c => c === 'clear')).toHaveLength(1)
})

test("a /cozy change with no paper wanted never clears a theme cozy did not set", async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  for (const args of ['calm on', 'nord', 'light', 'off', 'backdrop off']) {
    await $.command.run({ ...TYPED, command: 'cozy', args })
  }
  expect(w.calls).toEqual([])
})

test("/cozy says why the app does not draw the backdrop, in the app's words", async ($, on) => {
  world(on, { mode: 'auto' }, { isDrawn: false, requestId: 'backdrop', reason: 'no desktop surface is attached' })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'backdrop paper' })
  const shown = await $.command.run({ ...TYPED, command: 'cozy', args: '' })

  expect(shown.text).toContain('Backdrop: paper (not drawn: no desktop surface is attached)')
})

test('/cozy backdrop paper in a fixed mode keeps the setting and waits for mode auto', async ($, on) => {
  const w = world(on, { mode: 'light' })

  await $.session.start(START)
  const said = await $.command.run({ ...TYPED, command: 'cozy', args: 'backdrop paper' })

  expect(sane(w.kept.get(SETTINGS_KEY)).backdrop).toBe('paper')
  expect(w.calls).toEqual([])
  expect(said.text).toContain('Backdrop: paper (waiting for mode auto')

  await $.command.run({ ...TYPED, command: 'cozy', args: 'auto' })
  expect(w.sets()).toHaveLength(1)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'off' })
  expect(w.last()).toBe('clear')
})

test("a new preset moves the backdrop's frost to its paper", async ($, on) => {
  const w = world(on, { mode: 'auto', backdrop: 'paper' })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'nord' })

  expect(tintOf(w.last())).toBe(presetOf('nord')!.dark.palette.bg)
})

test("the backdrop is drawn as the preset's paper over the whole window", async ($, on) => {
  world(on, { mode: 'auto', backdrop: 'paper' })

  await $.session.start(START)
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'Backdrop',
    requestId: 'backdrop',
    props: { id: BACKDROP_ID, plugin: PLUGIN, glass: { blur: 16, tint: kindle.dark.palette.bg, opacity: 0.7 }, colorScheme: 'dark' },
  })
  const paper = (await ui.findAll({ type: 'Box' })).find(b => b.props.backgroundColor === kindle.dark.palette.bg)

  expect(paper?.props).toMatchObject({ width: '100%', height: '100%' })
})

test("another plugin's backdrop is left as it draws", async ($, on) => {
  world(on, { mode: 'auto', backdrop: 'paper' })
  on('ui.render', { component: 'Backdrop' }, (beneath, e) => {
    const { Text } = beneath.ui.resolve(e)

    return Text({ children: 'beneath' })
  })

  await $.session.start(START)
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'Backdrop',
    requestId: 'backdrop',
    props: { id: 'lagoon', plugin: 'someone-else', glass: false },
  })

  expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
  expect((await ui.findAll({ type: 'Box' })).some(b => b.props.backgroundColor === kindle.dark.palette.bg)).toBe(false)
})

test('the desktop panel has backdrop buttons, and the terminal panel has none', async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  const ui = await $.ui.mount(PANE)

  expect((await ui.find({ type: 'Button', key: 'backdrop-off' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'backdrop-paper' })
  expect(sane(w.kept.get(SETTINGS_KEY)).backdrop).toBe('paper')
  expect(w.sets()).toHaveLength(1)
  expect((await ui.find({ type: 'Button', key: 'backdrop-paper' }))?.props.variant).toBe('primary')

  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await terminal.find({ type: 'Button', key: 'backdrop-paper' })).toBeUndefined()
})
