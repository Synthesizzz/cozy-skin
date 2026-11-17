// Mode light and mode dark on the desktop: the whole app takes the preset's
// palette of that mode, whatever the app's own appearance (Film, 2026-11-17).
// The desktop ignores `overrideColorScheme`, so cozy sends a look that names
// the picked mode alone (`colors` with `only`), which a surface paints in
// either app mode. Mode auto keeps the paper and glow as before.

import type { On, ThemeSetArgs } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { autoLook, fixedLook } from '../hooks/fixed-look'
import { checkColors } from '../hooks/make-colors.js'
import { panelPaper } from '../hooks/panel-paper'
import { PRESETS, presetOf } from '../hooks/presets'
import { modeNote } from '../hooks/pane'
import { SETTINGS_KEY, sane } from '../hooks/settings'
import { press } from './press'

const START = { cwd: '/', surface: 'desktop', isInteractive: true } as const

type Call = ThemeSetArgs | 'clear'

function world(on: On, stored: Record<string, unknown>) {
  const kept = new Map<string, unknown>([[SETTINGS_KEY, stored]])
  const calls: Call[] = []

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('clock.every', () => ({ value: { cancel: () => undefined } as never }))
  on('theme.set', (_, e) => (calls.push({ ...e }), { value: { isDrawn: true, requestId: 'cozy' } }))
  on('theme.clear', () => (calls.push('clear'), { value: { isDrawn: false as const, reason: 'cleared' } }))

  return { kept, calls, last: () => calls[calls.length - 1] }
}

const modesOf = (call: Call | undefined): string[] =>
  call === undefined || call === 'clear' || call.colors === undefined ? [] : Object.keys(call.colors.inputs)

for (const backdrop of ['paper', 'glow', 'off'] as const) {
  test(`on the desktop, mode light and mode dark give the window two looks (backdrop ${backdrop})`, async ($, on) => {
    const w = world(on, { mode: 'auto', backdrop })

    await $.session.start(START)
    await press($, 'light')
    const light = w.last()

    await press($, 'dark')
    const dark = w.last()

    expect(modesOf(light)).toEqual(['light'])
    expect(modesOf(dark)).toEqual(['dark'])
    expect(light).not.toEqual(dark)
  })
}

test("a fixed mode's look is the preset's palette of that mode, and auto goes back to both", async ($, on) => {
  const w = world(on, { mode: 'auto', backdrop: 'paper', preset: 'solarized' })

  await $.session.start(START)
  await press($, 'light')
  const light = w.last()

  expect(light !== 'clear' && light?.colors).toEqual(fixedLook('solarized', 'light')!.colors)
  expect(light !== 'clear' && light?.backdrop).toBeTruthy()

  await press($, 'auto')
  const back = w.last()

  expect(modesOf(back).sort()).toEqual(['dark', 'light'])
  expect(back !== 'clear' && back?.backdrop).toBeTruthy()
})

test('a session that starts in a fixed mode sets its look, and /cozy off clears it', async ($, on) => {
  const w = world(on, { mode: 'dark', preset: 'nord' })

  await $.session.start(START)
  expect(w.last()).toEqual({ colors: fixedLook('nord', 'dark')!.colors })

  await press($, 'off')
  expect(w.last()).toBe('clear')
  expect(sane(w.kept.get(SETTINGS_KEY)).enabled).toBe(false)
})

test('a new preset in a fixed mode moves the look to its palette', async ($, on) => {
  const w = world(on, { mode: 'light', preset: 'kindle' })

  await $.session.start(START)
  await press($, 'gruvbox')
  expect(w.last()).toEqual({ colors: fixedLook('gruvbox', 'light')!.colors })
})

// Mode auto (Film, 2026-11-17): like the app's own default, it follows the
// app's light or dark, and the whole app takes the preset's palette of the
// mode shown, with the paper or glow behind it when the Backdrop is on.
test('auto sends one look with both modes, and the preset tone in each', async ($, on) => {
  const w = world(on, { mode: 'auto', preset: 'nord' })

  await $.session.start(START)
  const set = w.last()

  expect(modesOf(set).sort()).toEqual(['dark', 'light'])
  expect(set !== 'clear' && set?.colors).toEqual(autoLook('nord')!.colors)
  expect(set !== 'clear' && set?.backdrop).toBeFalsy()
})

for (const backdrop of ['paper', 'glow'] as const) {
  test(`auto with the ${backdrop} keeps it behind the preset tone`, async ($, on) => {
    const w = world(on, { mode: 'auto', preset: 'nord', backdrop })

    await $.session.start(START)
    const set = w.last()

    expect(modesOf(set).sort()).toEqual(['dark', 'light'])
    expect(set !== 'clear' && set?.backdrop).toBeTruthy()
  })
}

// Film saw the fixed look painted (2026-11-17), so the paper and glow that
// waited for mode auto now stand behind light and dark too.
for (const [mode, backdrop, scene] of [
  ['dark', 'glow', 'cozy-glow'],
  ['light', 'glow', 'cozy-glow'],
  ['dark', 'paper', 'cozy-paper'],
  ['light', 'paper', 'cozy-paper'],
] as const) {
  test(`mode ${mode} with the ${backdrop} draws it behind the ${mode} look`, async ($, on) => {
    const w = world(on, { mode, preset: 'nord', backdrop })

    await $.session.start(START)
    const set = w.last()

    expect(modesOf(set)).toEqual([mode])
    expect(set !== 'clear' && (set?.backdrop as { scene?: string } | undefined)?.scene).toBe(scene)
    const glass = set !== 'clear' ? (set?.backdrop as { glass?: { tint?: string } } | undefined)?.glass : undefined

    expect(glass?.tint).toBe(presetOf('nord')![mode].palette.bg)
  })
}

test('a fixed mode panel sits on the paper of that mode', () => {
  expect(panelPaper(sane({ mode: 'dark', preset: 'nord' }), 'dark')).toEqual({ backgroundColor: presetOf('nord')!.dark.palette.bg })
  expect(panelPaper(sane({ mode: 'light', preset: 'nord', enabled: false }), 'light')).toEqual({})
})

test('the auto look for every preset is one the desktop will paint', () => {
  const bad: string[] = []

  for (const preset of PRESETS) {
    const made = autoLook(preset.name)

    if (made === undefined) {
      bad.push(`${preset.name}: none`)
      continue
    }
    const fatal = [...made.problems, ...checkColors(made.colors)].filter(line => line.startsWith("Desktop won't paint"))

    if (fatal.length > 0) {
      bad.push(`${preset.name}: ${fatal[0]}`)
    }
  }
  expect(bad).toEqual([])
})

test('the line under Mode says what each mode does on the desktop; the terminal keeps it short', () => {
  expect(modeNote('light', 'light', 'desktop')).toBe("The whole app in the preset's light palette.")
  expect(modeNote('dark', 'dark', 'desktop')).toBe("The whole app in the preset's dark palette.")
  expect(modeNote('light', 'light', 'terminal')).toBeUndefined()
  expect(modeNote('auto', 'dark', 'desktop')).toBe(
    "Follows Windows' light or dark, in the preset's palette (now dark). Set the app's appearance to follow the system so the two match.",
  )
  expect(modeNote('auto', 'light', 'terminal')).toBe("Follows the app's own light or dark theme (now light).")
})
