// Mode light and mode dark on the desktop. The desktop window follows the
// app's own light or dark and ignores a scheme a plugin asks for, so a fixed
// mode cannot paint the window: it colours only what cozy draws itself and the
// terminal. The panel says so where the choice is made, so light and dark
// looking alike on the desktop is never a silent surprise (Decisions 2026-11-17).

import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { modeNote } from '../hooks/pane'
import { SETTINGS_KEY } from '../hooks/settings'
import { press } from './press'

const START = { cwd: '/', surface: 'desktop', isInteractive: true } as const

function world(on: On, stored: Record<string, unknown>) {
  const kept = new Map<string, unknown>([[SETTINGS_KEY, stored]])

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('clock.every', () => ({ value: { cancel: () => undefined } as never }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'cozy' } }))
  on('theme.clear', () => ({ value: { isDrawn: false as const, reason: 'cleared' } }))
}

test('a fixed mode on the desktop says the window keeps the app look; auto and the terminal say nothing of it', () => {
  for (const m of ['light', 'dark'] as const) {
    const said = modeNote(m, m, 'desktop') ?? ''

    expect(said).toContain(`${m[0]!.toUpperCase()}${m.slice(1)} colours what cozy draws`)
    expect(said).toContain("the app's settings")
    expect(said).toContain('auto')
    expect(modeNote(m, m, 'terminal')).toBeUndefined()
  }
  expect(modeNote('auto', 'dark', 'desktop')).toBe("Follows the app's own light or dark theme (now dark).")
  expect(modeNote('auto', 'light', 'terminal')).toBe("Follows the app's own light or dark theme (now light).")
})

for (const m of ['light', 'dark'] as const) {
  test(`pressing ${m} in the desktop panel shows why the window does not change`, async ($, on) => {
    world(on, { mode: 'auto', backdrop: 'paper' })

    await $.session.start(START)
    const said = await press($, m)

    expect(said).toContain('The window keeps the app')
    expect(said).not.toContain("Follows the app's own")
  })
}

test('pressing light in the terminal panel adds no desktop note', async ($, on) => {
  world(on, { mode: 'auto' })

  await $.session.start({ ...START, surface: 'terminal' })
  const said = await press($, 'light', 'terminal')

  expect(said).not.toContain('The window keeps the app')
})
