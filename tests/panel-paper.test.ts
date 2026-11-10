import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { panelPaper } from '../hooks/panel-paper'
import { PRESETS, presetOf } from '../hooks/presets'
import { SETTINGS_KEY, sane } from '../hooks/settings'

const START = { cwd: '/', surface: 'desktop', isInteractive: true } as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

// Windows is never read in the kit, so mode auto resolves to dark.
const kindle = presetOf('kindle')!

type Opened = { id: string; backgroundColor?: string; focus?: boolean }

// The engine with a stored settings object, and a stand-in that keeps every
// pane opened, each listed as shown until `shown` says otherwise.
function world(on: On, stored: Record<string, unknown>) {
  const kept = new Map<string, unknown>([[SETTINGS_KEY, stored]])
  const opened: Opened[] = []
  const shown = { on: true }

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('ui.open', (_, e) => (opened.push({ id: e.id, backgroundColor: e.backgroundColor, focus: e.focus }), { value: { isPlaced: true as const } }))
  on('ui.panes', () => ({
    value: [...new Set(opened.map(o => o.id))].map(id => ({ id, title: 'cozy-skin', isShown: shown.on, isFocused: false, isPlaced: true })),
  }))

  return { kept, opened, shown, last: () => opened[opened.length - 1] }
}

test("in mode auto the panel asks for the preset's paper, a raw colour for every preset", () => {
  for (const preset of PRESETS) {
    for (const mode of ['light', 'dark'] as const) {
      const asked = panelPaper(sane({ preset: preset.name, mode: 'auto' }), mode)

      expect(asked).toEqual({ backgroundColor: preset[mode].palette.bg })
      expect(asked.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i)
    }
  }
})

test("in a fixed mode, or with the skin off, the panel keeps the app's own look", () => {
  expect(panelPaper(sane({ mode: 'light' }), 'light')).toEqual({})
  expect(panelPaper(sane({ mode: 'dark' }), 'dark')).toEqual({})
  expect(panelPaper(sane({ mode: 'auto', enabled: false }), 'dark')).toEqual({})
})

test("/cozy panel in mode auto opens on the preset's paper, in a fixed mode on the app's own", async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'panel' })
  expect(w.opened[0]).toEqual({ id: 'cozy-skin', backgroundColor: kindle.dark.palette.bg, focus: true })

  await $.command.run({ ...TYPED, command: 'cozy', args: 'light' })
  expect(w.last()).toEqual({ id: 'cozy-skin', backgroundColor: undefined, focus: undefined })
})

test('a new preset repaints the shown panel in its paper without taking the keyboard', async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'panel' })
  await $.command.run({ ...TYPED, command: 'cozy', args: 'nord' })

  expect(w.last()).toEqual({ id: 'cozy-skin', backgroundColor: presetOf('nord')!.dark.palette.bg, focus: undefined })
})

test('a change opens no panel that is closed or behind another tab', async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'nord' })
  expect(w.opened).toEqual([])

  await $.command.run({ ...TYPED, command: 'cozy', args: 'panel' })
  w.shown.on = false
  await $.command.run({ ...TYPED, command: 'cozy', args: 'sepia' })
  expect(w.opened).toHaveLength(1)
})

test('a change still lands when the app will not list its panes', async ($, on) => {
  const kept = new Map<string, unknown>([[SETTINGS_KEY, { mode: 'auto' }]])

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('ui.panes', () => ({ deny: 'no panes here' }) as never)

  await $.session.start(START)
  const said = await $.command.run({ ...TYPED, command: 'cozy', args: 'nord' })

  expect(sane(kept.get(SETTINGS_KEY)).preset).toBe('nord')
  expect(said.text).toContain('Preset: nord')
})
