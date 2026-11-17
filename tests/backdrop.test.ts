import type { On, ThemeResult, ThemeSetArgs } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { BACKDROP_ID, backdropArgs, wantsBackdrop } from '../hooks/backdrop'
import { parseTheme } from '../hooks/command'
import { PRESETS, presetOf } from '../hooks/presets'
import { SETTINGS_KEY, sane } from '../hooks/settings'
import { press } from './press'

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

test("the app's panels frost in the preset's own paper, a raw colour, over the preset's look in both modes", () => {
  for (const preset of PRESETS) {
    for (const mode of ['light', 'dark'] as const) {
      const args = backdropArgs(sane({ preset: preset.name, mode: 'auto', backdrop: 'paper' }), mode)
      // A look for both modes names no scheme: the app's own light or dark picks.
      expect(Object.keys(args).sort()).toEqual(['backdrop', 'colors'])
      expect(Object.keys(args.colors?.inputs ?? {}).sort()).toEqual(['dark', 'light'])

      expect((args.backdrop as { scene?: string } | undefined)?.scene).toBe(BACKDROP_ID)
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

// With the skin off, a start makes no theme call, so another plugin's theme
// stands. (With it on, every mode sets the preset's look: tests/fixed-mode.test.ts.)
for (const [why, stored] of [
  ['the skin off', { mode: 'auto', backdrop: 'paper', enabled: false }],
] as const) {
  test(`a session that starts with ${why} makes no theme call`, async ($, on) => {
    const w = world(on, { ...stored })

    await $.session.start(START)
    expect(w.calls).toEqual([])
  })
}

test('/cozy backdrop paper sets it, says it is drawn, and off leaves the look without it', async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  const set = { text: await press($, 'backdrop paper') }

  expect(sane(w.kept.get(SETTINGS_KEY)).backdrop).toBe('paper')
  expect(tintOf(w.last())).toBeDefined()
  expect(set.text).toContain('Paper (drawn behind the window)')

  const off = { text: await press($, 'backdrop off') }
  const last = w.last()

  expect(sane(w.kept.get(SETTINGS_KEY)).backdrop).toBe('off')
  expect(last !== 'clear' && last?.backdrop).toBeFalsy()
  expect(last !== 'clear' && last?.colors).toBeTruthy()
  expect(off.text).not.toContain('Paper (')
})

test('with the skin on no /cozy change clears the theme; turning the skin off clears the one cozy set', async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  for (const args of ['calm on', 'nord', 'backdrop off', 'light', 'auto']) {
    await press($, args)
  }
  expect(w.calls.filter(c => c === 'clear')).toEqual([])
  await press($, 'off')
  expect(w.last()).toBe('clear')
  await press($, 'calm off')
  expect(w.calls.filter(c => c === 'clear')).toHaveLength(1)
})

test("/cozy says why the app does not draw the backdrop, in the app's words", async ($, on) => {
  world(on, { mode: 'auto' }, { isDrawn: false, requestId: 'backdrop', reason: 'no desktop surface is attached' })

  await $.session.start(START)
  await press($, 'backdrop paper')
  const shown = { text: await press($, '') }

  expect(shown.text).toContain('Paper (not drawn: no desktop surface is attached)')
})

test('/cozy backdrop paper in a fixed mode keeps the setting and waits for mode auto', async ($, on) => {
  const w = world(on, { mode: 'light' })

  await $.session.start(START)
  const said = { text: await press($, 'backdrop paper') }

  expect(sane(w.kept.get(SETTINGS_KEY)).backdrop).toBe('paper')
  // Only the fixed mode's look stands, never the paper behind it.
  expect(w.sets().every(call => call.backdrop === undefined && call.colors !== undefined)).toBe(true)
  expect(said.text).toContain('Paper (waiting for mode auto')

  await press($, 'auto')
  expect(tintOf(w.last())).toBeDefined()
  await press($, 'off')
  expect(w.last()).toBe('clear')
})

test("a new preset moves the backdrop's frost to its paper", async ($, on) => {
  const w = world(on, { mode: 'auto', backdrop: 'paper' })

  await $.session.start(START)
  await press($, 'nord')

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
    props: { scene: BACKDROP_ID, plugin: PLUGIN, glass: { blur: 16, tint: kindle.dark.palette.bg, opacity: 0.7 }, overrideColorScheme: 'dark' },
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
    props: { scene: 'lagoon', plugin: 'someone-else', glass: false },
  })

  expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
  expect((await ui.findAll({ type: 'Box' })).some(b => b.props.backgroundColor === kindle.dark.palette.bg)).toBe(false)
})

test('the desktop panel has backdrop buttons, and the terminal panel has none', async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'tab-details' })
  expect((await ui.find({ type: 'Button', key: 'backdrop-off' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'backdrop-paper' })
  expect(sane(w.kept.get(SETTINGS_KEY)).backdrop).toBe('paper')
  expect(tintOf(w.last())).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'backdrop-paper' }))?.props.variant).toBe('primary')

  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await terminal.find({ type: 'Button', key: 'backdrop-paper' })).toBeUndefined()
})
