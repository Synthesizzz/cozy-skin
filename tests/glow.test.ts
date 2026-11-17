import type { On, ThemeResult, ThemeSetArgs } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { backdropArgs, wantsBackdrop } from '../hooks/backdrop'
import { applyTheme, describe, parseTheme } from '../hooks/command'
import { GLOW_SCENE, GLOW_THEME, SPARKLE_MS, glowSvg, nextPhase, wantsGlow } from '../hooks/glow'
import type { GlowPhase } from '../hooks/glow'
import { SETTINGS_KEY, sane } from '../hooks/settings'

const PLUGIN = 'cozy-skin'
const START = { cwd: '/', surface: 'desktop', isInteractive: true } as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

// Windows answers "apps use the light theme", so mode auto resolves to light.
const LIGHT = 'AppsUseLightTheme    REG_DWORD    0x1'

type Call = ThemeSetArgs | 'clear'

function world(on: On, stored: Record<string, unknown>, light = true) {
  const kept = new Map<string, unknown>([[SETTINGS_KEY, stored]])
  const calls: Call[] = []
  const answer: ThemeResult = { isDrawn: true, requestId: 'backdrop' }

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('process.run', () => ({
    value: { exitCode: light ? 0 : 1, stdout: light ? LIGHT : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('theme.set', (_, e) => (calls.push({ ...e }), { value: answer }))
  on('theme.clear', () => (calls.push('clear'), { value: { isDrawn: false as const, reason: 'cleared' } }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  return { kept, calls, last: () => calls[calls.length - 1] }
}

declare function setTimeout(fn: (value: unknown) => void, ms: number): unknown

// Windows answers after the start, so wait for the glow's first theme call.
async function lit(calls: unknown[]): Promise<void> {
  for (let i = 0; i < 100 && calls.length === 0; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

let mounts = 0

const circles = (svg: string) =>
  [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map(m => ({ cx: Number(m[1]), cy: Number(m[2]), r: Number(m[3]) }))

const durations = (svg: string) => [...svg.matchAll(/dur="([\d.]+)s"/g)].map(m => Number(m[1]))

test('/cozy themes lists, turns sepia-glow on, and turns it off', () => {
  expect(parseTheme('themes')).toEqual({ kind: 'themes' })
  expect(parseTheme('themes sepia-glow')).toEqual({ kind: 'themes', themes: GLOW_THEME })
  expect(parseTheme('themes off')).toEqual({ kind: 'themes', themes: 'off' })
  expect(parseTheme('themes lagoon')).toMatchObject({ kind: 'error' })
  expect(parseTheme('themes sepia-glow now')).toMatchObject({ kind: 'error' })
  expect(applyTheme(sane({}), { kind: 'themes', themes: GLOW_THEME }).themes).toBe(GLOW_THEME)
  expect(sane({}).themes).toBe('off')
  expect(sane({ themes: 'sepia-glow' }).themes).toBe('sepia-glow')
  expect(sane({ themes: 'lagoon' }).themes).toBe('off')
})

test('/cozy lists the themes and which one is on', () => {
  expect(describe(sane({}), 'light')).toContain('Theme: off')
  expect(describe(sane({ themes: 'sepia-glow' }), 'light')).toContain('Theme: sepia-glow')
})

test('the glow stands only for sepia-glow, the skin on, mode auto and a light mode', () => {
  const on = sane({ mode: 'auto', themes: 'sepia-glow' })

  expect(wantsGlow(on, 'light')).toBe(true)
  expect(wantsGlow(on, 'dark')).toBe(false)
  expect(wantsGlow(sane({ mode: 'light', themes: 'sepia-glow' }), 'light')).toBe(false)
  expect(wantsGlow(sane({ mode: 'auto', themes: 'sepia-glow', enabled: false }), 'light')).toBe(false)
  expect(wantsGlow(sane({ mode: 'auto' }), 'light')).toBe(false)
  // The still paper is a separate switch and is not read as the glow.
  expect(wantsBackdrop(on)).toBe(false)
})

test('the glow sets its own scene, and the paper keeps its own', () => {
  const glow = backdropArgs(sane({ mode: 'auto', themes: 'sepia-glow', backdrop: 'paper' }), 'light')
  const paper = backdropArgs(sane({ mode: 'auto', backdrop: 'paper' }), 'light')

  expect((glow.backdrop as { scene?: string }).scene).toBe(GLOW_SCENE)
  expect((paper.backdrop as { scene?: string }).scene).not.toBe(GLOW_SCENE)
})

test('the phases follow the main turn: work, a sparkle on an answer, idle on anything else', () => {
  const step = (from: GlowPhase, event: Parameters<typeof nextPhase>[1]) => nextPhase(from, event)

  expect(step('idle', 'start')).toBe('working')
  expect(step('sparkle', 'start')).toBe('working')
  expect(step('working', 'answer')).toBe('sparkle')
  for (const end of ['aborted', 'refusal', 'error'] as const) {
    expect(step('working', end)).toBe('idle')
  }
  expect(step('sparkle', 'settle')).toBe('idle')
  expect(step('working', 'settle')).toBe('working')
  expect(SPARKLE_MS).toBe(3000)
})

test('each phase draws a safe, side-only drawing in the sepia paper and the warm glow', () => {
  for (const phase of ['idle', 'working', 'sparkle'] as const) {
    const svg = glowSvg(phase)

    expect(svg.length).toBeLessThan(131072)
    expect(svg).toContain('#f4ecd8')
    expect(svg).toContain('#e8b98a')
    expect(svg).not.toMatch(/<script|\son[a-z]+=|href=|<image|<foreignObject/i)
    for (const c of circles(svg)) {
      // The chat column (the middle 40% of the window) stays clear of every glow.
      expect(c.cx + c.r <= 300 || c.cx - c.r >= 700).toBe(true)
    }
    expect(circles(svg).length).toBeGreaterThanOrEqual(2)
  }
})

test('working moves about three times faster than idle, and a sparkle twinkles for the length of its stay', () => {
  const idle = Math.min(...durations(glowSvg('idle')))
  const working = Math.min(...durations(glowSvg('working')))

  expect(idle / working).toBeGreaterThan(2.5)
  expect(idle / working).toBeLessThan(3.5)
  expect(glowSvg('sparkle').length).toBeGreaterThan(glowSvg('idle').length)
  expect(glowSvg('sparkle')).toContain('repeatCount="3"')
})

test('a session that starts with sepia-glow in a light auto mode sets the glow scene', async ($, on) => {
  const w = world(on, { mode: 'auto', themes: 'sepia-glow' })

  await $.session.start(START)
  await lit(w.calls)
  expect(w.last()).toEqual(backdropArgs(sane({ mode: 'auto', themes: 'sepia-glow' }), 'light'))
})

test('a dark Windows makes no theme call', async ($, on) => {
  const dark = world(on, { mode: 'auto', themes: 'sepia-glow' }, false)

  await $.session.start(START)
  expect(dark.calls).toEqual([])
})

test('/cozy themes sepia-glow sets it, and off clears it', async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  expect(w.calls).toEqual([])
  const turnedOn = await $.command.run({ ...TYPED, command: 'cozy', args: 'themes sepia-glow' })

  expect((w.last() as ThemeSetArgs).backdrop).toMatchObject({ scene: GLOW_SCENE })
  expect(JSON.stringify(turnedOn)).toContain('sepia-glow')
  await $.command.run({ ...TYPED, command: 'cozy', args: 'themes off' })
  expect(w.last()).toBe('clear')
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function glowSource($: any): Promise<string> {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'Backdrop',
    requestId: `glow-${(mounts += 1)}`,
    props: { scene: GLOW_SCENE, plugin: PLUGIN, glass: { blur: 16, tint: '#f4ecd8', opacity: 0.7 }, overrideColorScheme: 'light' },
  })
  const svg = (await ui.findAll({ type: 'Svg' }))[0]

  return String(svg?.props.source ?? '')
}

test('the glow is drawn as an Svg that follows the turn: working on a prompt, a sparkle on its answer', async ($, on) => {
  const w = world(on, { mode: 'auto', themes: 'sepia-glow' })

  await $.session.start(START)
  await lit(w.calls)
  expect(await glowSource($)).toBe(glowSvg('idle'))
  await $.turn.start({ text: 'hi', turnId: 'turn-1' })
  expect(await glowSource($)).toBe(glowSvg('working'))
  await $.turn.complete({ turnId: 'turn-1', reason: 'answer' } as never)
  expect(await glowSource($)).toBe(glowSvg('sparkle'))
})

const PANE = {
  plugin: PLUGIN,
  surface: 'desktop',
  component: 'Pane',
  requestId: 'cozy-skin',
  props: { title: 'cozy-skin', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('the desktop panel has Themes buttons, and the terminal panel has none', async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  const ui = await $.ui.mount(PANE)

  expect((await ui.find({ type: 'Button', key: 'themes-off' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'themes-sepia-glow' })
  expect(sane(w.kept.get(SETTINGS_KEY)).themes).toBe('sepia-glow')
  expect((await ui.find({ type: 'Button', key: 'themes-sepia-glow' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'themes-off' })
  expect(sane(w.kept.get(SETTINGS_KEY)).themes).toBe('off')

  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await terminal.find({ type: 'Button', key: 'themes-sepia-glow' })).toBeUndefined()
})

test("a subagent's turn does not move the glow", async ($, on) => {
  const w = world(on, { mode: 'auto', themes: 'sepia-glow' })

  await $.session.start(START)
  await lit(w.calls)
  await $.turn.start({ text: 'sub', turnId: 'turn-2', agentId: 'agent-1' } as never)
  expect(await glowSource($)).toBe(glowSvg('idle'))
})
