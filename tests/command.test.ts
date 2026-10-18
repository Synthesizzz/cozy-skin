import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { applyTheme, describe, parseTheme } from '../hooks/command'
import { DEFAULTS, SETTINGS_KEY, sane } from '../hooks/settings'

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

test('parseTheme reads each form, in any case', () => {
  expect(parseTheme('')).toEqual({ kind: 'show' })
  expect(parseTheme('nord')).toEqual({ kind: 'preset', name: 'nord' })
  expect(parseTheme('  NORD ')).toEqual({ kind: 'preset', name: 'nord' })
  expect(parseTheme('Dark')).toEqual({ kind: 'mode', mode: 'dark' })
  expect(parseTheme('auto')).toEqual({ kind: 'mode', mode: 'auto' })
  expect(parseTheme('off')).toEqual({ kind: 'off' })
  expect(parseTheme('tables text')).toEqual({ kind: 'tables', tables: 'text' })
  expect(parseTheme('calm on')).toEqual({ kind: 'calm', on: true })
  expect(parseTheme('CALM OFF')).toEqual({ kind: 'calm', on: false })
  expect(parseTheme('icons ascii')).toEqual({ kind: 'icons', icons: 'ascii' })
  expect(parseTheme('terminal install')).toEqual({ kind: 'terminal-install' })
})

test('parseTheme names the presets in an error', () => {
  const nope = parseTheme('nope')

  expect(nope.kind).toBe('error')
  expect(nope.kind === 'error' && nope.message).toContain('kindle, sepia, paper')
  expect(parseTheme('tables weird').kind).toBe('error')
  expect(parseTheme('calm').kind).toBe('error')
  expect(parseTheme('kindle sepia').kind).toBe('error')
  expect(parseTheme('kindle light extra').kind).toBe('error')
  expect(parseTheme('nope light').kind).toBe('error')
})

test('parseTheme takes a preset and a mode together', () => {
  expect(parseTheme('kindle light')).toEqual({ kind: 'preset', name: 'kindle', mode: 'light' })
  expect(parseTheme('Nord AUTO')).toEqual({ kind: 'preset', name: 'nord', mode: 'auto' })
  expect(applyTheme({ ...DEFAULTS, mode: 'dark', enabled: false }, { kind: 'preset', name: 'nord', mode: 'light' })).toMatchObject({
    preset: 'nord',
    mode: 'light',
    enabled: true,
  })
  expect(applyTheme({ ...DEFAULTS, mode: 'dark' }, { kind: 'preset', name: 'nord' }).mode).toBe('dark')
})

test('sane keeps good fields and resets bad ones', () => {
  expect(sane({ preset: 'nord', tables: 'weird' })).toEqual({ ...DEFAULTS, preset: 'nord' })
  expect(sane(undefined)).toEqual(DEFAULTS)
  expect(sane('x')).toEqual(DEFAULTS)
  expect(sane({ preset: 'ghost', mode: 'light', calm: 'yes', savedTheme: 'dark-daltonized' })).toEqual({
    ...DEFAULTS,
    mode: 'light',
    savedTheme: 'dark-daltonized',
  })
})

test('applyTheme changes one thing and describe tells the state', () => {
  expect(applyTheme(DEFAULTS, { kind: 'preset', name: 'nord' }).preset).toBe('nord')
  expect(applyTheme(DEFAULTS, { kind: 'mode', mode: 'light' }).mode).toBe('light')
  expect(applyTheme(DEFAULTS, { kind: 'off' }).enabled).toBe(false)
  expect(applyTheme({ ...DEFAULTS, enabled: false }, { kind: 'preset', name: 'nord' }).enabled).toBe(true)
  expect(applyTheme(DEFAULTS, { kind: 'calm', on: true }).calm).toBe(true)
  expect(applyTheme(DEFAULTS, { kind: 'tables', tables: 'off' }).tables).toBe('off')
  expect(applyTheme(DEFAULTS, { kind: 'show' })).toEqual(DEFAULTS)
  expect(describe(DEFAULTS, 'dark')).toContain('kindle')
})

type Opts = {
  theme?: string
  deny?: string
  light?: string
  reg?: 'fail' | 'throw'
  stored?: unknown
  extra?: string[]
  // `command.register` refuses the name, as Claude Code does for a built-in.
  refuse?: string
  // Each theme change and registry read waits this long, so concurrent work interleaves.
  delayMs?: number
}

// The test runtime has timers; the mod's type set (no DOM, no Node) does not name them.
declare const setTimeout: (callback: () => void, ms: number) => unknown

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms))

function mount(on: On, opts: Opts = {}) {
  const store: Record<string, unknown> = opts.stored === undefined ? {} : { [SETTINGS_KEY]: opts.stored }
  const state = { theme: opts.theme ?? 'dark-daltonized', sets: 0, storeFails: false }

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => (opts.refuse === undefined ? { value: { command: e.name } } : { deny: opts.refuse }))
  on('store.get', (_, e) => ({ value: store[e.key] }))
  on('store.set', (_, e) => {
    if (state.storeFails) {
      return { deny: 'store is read-only' }
    }
    store[e.key] = e.value

    return { value: undefined }
  })
  on('config.list', () => ({
    value: [
      {
        key: 'theme',
        label: 'Theme',
        kind: 'choice' as const,
        value: state.theme,
        options: ['auto', 'dark', 'light', 'dark-daltonized', 'light-daltonized', 'dark-ansi', 'light-ansi', ...(opts.extra ?? [])],
        provider: { plugin: 'engine' as const, tier: 'core' as const },
        isLocked: false,
      },
    ],
  }))
  on('config.set', async (_, e) => {
    if (opts.delayMs !== undefined) {
      await wait(opts.delayMs)
    }
    if (opts.deny !== undefined) {
      return { deny: opts.deny }
    }
    state.sets++
    state.theme = String(e.value)

    return { value: e.value }
  })
  on('process.run', async () => {
    if (opts.delayMs !== undefined) {
      await wait(opts.delayMs)
    }
    if (opts.reg === 'throw') {
      throw new Error('timed out')
    }

    // A failing reg query still prints the light value: only the exit code says it failed.
    return {
      value: {
        exitCode: opts.reg === 'fail' ? 1 : 0,
        stdout: `    AppsUseLightTheme    REG_DWORD    ${opts.light ?? '0x0'}
`,
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })

  return { store, state }
}

test('/cozy nord is kept for the next session', async ($: Engine, on) => {
  const m = mount(on)

  await $.session.start(START)
  const said = await $.command.run({ ...TYPED, command: 'cozy', args: 'nord' })

  expect(said.text).toContain('nord')
  expect((m.store[SETTINGS_KEY] as { preset: string }).preset).toBe('nord')

  // A new session starts from what was stored, not from the live value.
  await $.session.start(START)
  const again = await $.command.run({ ...TYPED, command: 'cozy', args: '' })

  expect(again.text).toContain('Preset: nord')
})

test('a stored preset is read when a session starts', async ($: Engine, on) => {
  mount(on, { stored: { preset: 'nord', mode: 'light', tables: 'text' } })

  await $.session.start(START)
  const said = await $.command.run({ ...TYPED, command: 'cozy', args: '' })

  expect(said.text).toContain('Preset: nord')
  expect(said.text).toContain('Mode: light')
  expect(said.text).toContain('Tables: text')
})

test('the first switch saves the Claude Code theme and /cozy off puts it back', async ($: Engine, on) => {
  const m = mount(on, { theme: 'dark-daltonized' })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'kindle' })
  expect(m.state.theme).toBe('dark')
  expect((m.store[SETTINGS_KEY] as { savedTheme: string }).savedTheme).toBe('dark-daltonized')

  await $.command.run({ ...TYPED, command: 'cozy', args: 'light' })
  expect(m.state.theme).toBe('light')
  expect((m.store[SETTINGS_KEY] as { savedTheme: string }).savedTheme).toBe('dark-daltonized')

  await $.command.run({ ...TYPED, command: 'cozy', args: 'off' })
  expect(m.state.theme).toBe('dark-daltonized')
  expect(m.store[SETTINGS_KEY]).toMatchObject({ enabled: false, savedTheme: null })
})

test('a denied theme change is reported, not thrown', async ($: Engine, on) => {
  const m = mount(on, { deny: 'locked by policy' })

  await $.session.start(START)
  const said = await $.command.run({ ...TYPED, command: 'cozy', args: 'dark' })

  expect(said.text).toContain('locked by policy')
  expect(m.state.theme).toBe('dark-daltonized')
  expect((m.store[SETTINGS_KEY] as { savedTheme: unknown }).savedTheme).toBe(null)
})

test('/cozy auto follows the Windows mode', async ($: Engine, on) => {
  const m = mount(on, { light: '0x1' })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'auto' })
  expect(m.state.theme).toBe('light')
})

test('/cozy auto falls back to dark when reg query fails', async ($: Engine, on) => {
  const m = mount(on, { reg: 'fail', light: '0x1', theme: 'light' })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'auto' })
  expect(m.state.theme).toBe('dark')
})

test('/cozy auto falls back to dark when reg query times out', async ($: Engine, on) => {
  const m = mount(on, { reg: 'throw', light: '0x1', theme: 'light' })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'auto' })
  expect(m.state.theme).toBe('dark')
})

// The session-start read is detached: let it settle by running cheap commands.
async function settle($: Engine, until: () => boolean) {
  for (let i = 0; i < 50 && !until(); i++) {
    await $.command.run({ ...TYPED, command: 'cozy', args: '' })
  }
}

// After a first explicit `/cozy` the store holds the saved theme and the one the mod set.
const TOOK_OVER = { savedTheme: 'dark-daltonized', appliedTheme: 'dark' }

test('in auto mode Claude Code follows Windows at session start', async ($: Engine, on) => {
  const m = mount(on, { stored: { mode: 'auto', ...TOOK_OVER }, light: '0x1', theme: 'dark' })

  await $.session.start(START)
  await settle($, () => (m.store[SETTINGS_KEY] as { appliedTheme: unknown }).appliedTheme === 'light')

  expect(m.state.theme).toBe('light')
  expect(m.store[SETTINGS_KEY]).toMatchObject({ savedTheme: 'dark-daltonized', appliedTheme: 'light' })
})

test('at session start a failed registry read leaves auto on dark', async ($: Engine, on) => {
  const m = mount(on, {
    stored: { mode: 'auto', savedTheme: 'dark-daltonized', appliedTheme: 'light' },
    reg: 'fail',
    light: '0x1',
    theme: 'light',
  })

  await $.session.start(START)
  await settle($, () => m.state.theme === 'dark')

  expect(m.state.theme).toBe('dark')
})

test('before the first explicit /cozy, session start never changes the Claude Code theme', async ($: Engine, on) => {
  const m = mount(on, { stored: { mode: 'auto' }, light: '0x1', theme: 'dark-daltonized' })

  await $.session.start(START)
  await settle($, () => false)

  expect(m.state.sets).toBe(0)
  expect(m.state.theme).toBe('dark-daltonized')
  expect(sane(m.store[SETTINGS_KEY]).savedTheme).toBe(null)
})

test('a theme picked by hand after /cozy is left alone at session start', async ($: Engine, on) => {
  const m = mount(on, { stored: { mode: 'auto', ...TOOK_OVER }, light: '0x1', theme: 'light-ansi' })

  await $.session.start(START)
  await settle($, () => false)

  expect(m.state.sets).toBe(0)
  expect(m.state.theme).toBe('light-ansi')
})

test('calm, icons, tables and terminal install never touch the Claude Code theme', async ($: Engine, on) => {
  // The mode is fixed so session start leaves the theme alone, and the theme
  // is not the one the preset would pick, so any sync would show as a change.
  const m = mount(on, { stored: { mode: 'dark', ...TOOK_OVER }, theme: 'dark' })

  await $.session.start(START)
  m.state.theme = 'light-ansi'
  for (const args of ['calm on', 'icons ascii', 'tables text', 'terminal install']) {
    await $.command.run({ ...TYPED, command: 'cozy', args })
  }

  expect(m.state.sets).toBe(0)
  expect(m.state.theme).toBe('light-ansi')
  expect(m.store[SETTINGS_KEY]).toMatchObject({ calm: true, icons: 'ascii', tables: 'text', ...TOOK_OVER })
})

test('an explicit /cozy that needs no change still takes the theme over', async ($: Engine, on) => {
  const m = mount(on, { theme: 'dark' })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'dark' })

  expect(m.state.sets).toBe(0)
  expect(m.store[SETTINGS_KEY]).toMatchObject({ savedTheme: 'dark', appliedTheme: 'dark' })
})

test('a cozy theme is never kept as the saved theme', async ($: Engine, on) => {
  const m = mount(on, { theme: 'cozy-skin:cozy-kindle-light', extra: ['cozy-skin:cozy-kindle-light', 'cozy-skin:cozy-nord-dark'] })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'nord' })
  await $.command.run({ ...TYPED, command: 'cozy', args: 'dark' })
  expect(m.state.theme).toBe('cozy-skin:cozy-nord-dark')
  expect((m.store[SETTINGS_KEY] as { savedTheme: unknown }).savedTheme).toBe('light')

  await $.command.run({ ...TYPED, command: 'cozy', args: 'off' })
  expect(m.state.theme).toBe('light')
})

test('a session-start sync and /cozy nord at once keep the saved theme', async ($: Engine, on) => {
  const m = mount(on, {
    stored: { mode: 'auto', ...TOOK_OVER },
    light: '0x1',
    theme: 'dark',
    delayMs: 5,
    extra: ['cozy-kindle-light', 'cozy-kindle-dark', 'cozy-nord-light', 'cozy-nord-dark'],
  })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'nord' })
  await settle($, () => false)

  expect(m.state.theme).toBe('cozy-nord-light')
  expect(m.store[SETTINGS_KEY]).toMatchObject({ preset: 'nord', savedTheme: 'dark-daltonized', appliedTheme: 'cozy-nord-light' })

  await $.command.run({ ...TYPED, command: 'cozy', args: 'off' })
  expect(m.state.theme).toBe('dark-daltonized')
})

test('a first /cozy nord racing session start keeps the original theme', async ($: Engine, on) => {
  const m = mount(on, { stored: { mode: 'auto' }, light: '0x1', delayMs: 5, extra: ['cozy-nord-light', 'cozy-nord-dark'] })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'nord' })
  await settle($, () => false)

  expect(m.store[SETTINGS_KEY]).toMatchObject({ savedTheme: 'dark-daltonized' })

  await $.command.run({ ...TYPED, command: 'cozy', args: 'off' })
  expect(m.state.theme).toBe('dark-daltonized')
})

test('a refused command name does not stop the settings from loading', async ($: Engine, on) => {
  mount(on, { refuse: 'a built-in command has this name', stored: { preset: 'nord', mode: 'light' } })

  await $.session.start(START)
  const said = await $.command.run({ ...TYPED, command: 'cozy', args: '' })

  expect(said.text).toContain('Preset: nord')
  expect(said.text).toContain('Mode: light')
})

test('a failing /cozy answers with the error instead of throwing', async ($: Engine, on) => {
  const m = mount(on)

  await $.session.start(START)
  m.state.storeFails = true
  const said = await $.command.run({ ...TYPED, command: 'cozy', args: 'calm on' })

  expect(said.text).toStartWith('cozy-skin: ')
  expect(said.text).toContain('store is read-only')
})

test('at session start a fixed mode or a disabled skin leaves the theme alone', async ($: Engine, on) => {
  const m = mount(on, { stored: { mode: 'dark', enabled: true }, light: '0x1', theme: 'dark-daltonized' })

  await $.session.start(START)
  await settle($, () => false)

  expect(m.state.theme).toBe('dark-daltonized')
})

test('a switch picks the plugin theme when Claude Code lists it', async ($: Engine, on) => {
  const m = mount(on, { theme: 'dark-daltonized', extra: ['cozy-kindle-dark', 'cozy-kindle-light', 'cozy-nord-dark'] })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'kindle' })
  expect(m.state.theme).toBe('cozy-kindle-dark')

  await $.command.run({ ...TYPED, command: 'cozy', args: 'light' })
  expect(m.state.theme).toBe('cozy-kindle-light')

  // No cozy-nord-light is listed: the built-in light theme is the fallback.
  await $.command.run({ ...TYPED, command: 'cozy', args: 'nord' })
  expect(m.state.theme).toBe('light')

  await $.command.run({ ...TYPED, command: 'cozy', args: 'off' })
  expect(m.state.theme).toBe('dark-daltonized')
})

test('/cozy says so when its theme is not listed and the built-in one is used', async ($: Engine, on) => {
  const m = mount(on, { theme: 'dark-daltonized' })

  await $.session.start(START)
  const said = await $.command.run({ ...TYPED, command: 'cozy', args: 'kindle light' })

  expect(m.state.theme).toBe('light')
  expect(said.text).toContain('cozy-kindle-light is not in its theme list, so the built-in "light" theme is used instead.')

  // Already on the fallback: nothing to change, the note still comes.
  const again = await $.command.run({ ...TYPED, command: 'cozy', args: 'light' })
  expect(again.text).toContain('cozy-kindle-light is not in its theme list')

  const off = await $.command.run({ ...TYPED, command: 'cozy', args: 'off' })
  expect(off.text).not.toContain('theme list')
})

test('/cozy adds no fallback note when its theme is listed', async ($: Engine, on) => {
  mount(on, { theme: 'dark-daltonized', extra: ['cozy-kindle-light'] })

  await $.session.start(START)
  const said = await $.command.run({ ...TYPED, command: 'cozy', args: 'kindle light' })

  expect(said.text).not.toContain('theme list')
})

test('/cozy kindle light switches preset and mode in one go', async ($: Engine, on) => {
  const m = mount(on, { theme: 'dark-daltonized', extra: ['cozy-kindle-dark', 'cozy-kindle-light'] })

  await $.session.start(START)
  const said = await $.command.run({ ...TYPED, command: 'cozy', args: 'kindle light' })

  expect(said.text).toContain('Mode: light')
  expect(m.state.theme).toBe('cozy-kindle-light')
  expect(m.store[SETTINGS_KEY]).toMatchObject({ preset: 'kindle', mode: 'light', savedTheme: 'dark-daltonized' })
})

test('a plugin theme listed under a prefixed id is found by its slug', async ($: Engine, on) => {
  const m = mount(on, { theme: 'dark-daltonized', extra: ['cozy-skin:cozy-kindle-dark'] })

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'kindle' })
  expect(m.state.theme).toBe('cozy-skin:cozy-kindle-dark')
})
