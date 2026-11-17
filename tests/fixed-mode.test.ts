// Mode light and mode dark on the desktop: the whole app takes the preset's
// palette of that mode, whatever the app's own appearance (Film, 2026-11-17).
// The desktop ignores `overrideColorScheme`, so cozy sends a look that names
// the picked mode alone (`colors` with `only`), which a surface paints in
// either app mode. Mode auto keeps the paper and glow as before.

import type { On, ThemeSetArgs } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { fixedLook } from '../hooks/fixed-look'
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

test("a fixed mode's look is the preset's palette of that mode, and auto goes back to the paper", async ($, on) => {
  const w = world(on, { mode: 'auto', backdrop: 'paper', preset: 'solarized' })

  await $.session.start(START)
  await press($, 'light')
  expect(w.last()).toEqual({ colors: fixedLook('solarized', 'light')!.colors })

  await press($, 'auto')
  const back = w.last()

  expect(back !== 'clear' && back?.colors).toBeFalsy()
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

test('the line under Mode says what each mode does on the desktop; the terminal keeps it short', () => {
  expect(modeNote('light', 'light', 'desktop')).toBe("The whole app in the preset's light palette.")
  expect(modeNote('dark', 'dark', 'desktop')).toBe("The whole app in the preset's dark palette.")
  expect(modeNote('light', 'light', 'terminal')).toBeUndefined()
  expect(modeNote('auto', 'dark', 'desktop')).toBe("Follows the app's own light or dark theme (now dark).")
})
