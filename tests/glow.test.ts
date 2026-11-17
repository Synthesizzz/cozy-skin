import type { On, ThemeResult, ThemeSetArgs } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { backdropArgs, wantsBackdrop } from '../hooks/backdrop'
import { applyTheme, describe, parseTheme } from '../hooks/command'
import { fixedLook } from '../hooks/fixed-look'
import { GLOW_SCENE, SPARKLE_MS, glowSvg, nextPhase, wantsGlow } from '../hooks/glow'
import type { GlowPhase } from '../hooks/glow'
import { presetOf } from '../hooks/presets'
import { SETTINGS_KEY, sane } from '../hooks/settings'
import { press } from './press'

const PLUGIN = 'cozy-skin'
const START = { cwd: '/', surface: 'desktop', isInteractive: true } as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

// Windows answers "apps use the light theme", so mode auto resolves to light.
const LIGHT = 'AppsUseLightTheme    REG_DWORD    0x1'

// The default preset's colours in light mode: what the glow draws with.
const kindle = presetOf('kindle')!.light.palette

type Call = ThemeSetArgs | 'clear'

function world(on: On, stored: Record<string, unknown>) {
  const kept = new Map<string, unknown>([[SETTINGS_KEY, stored]])
  const calls: Call[] = []
  const answer: ThemeResult = { isDrawn: true, requestId: 'backdrop' }

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('process.run', () => ({
    value: { exitCode: 0, stdout: LIGHT, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('theme.set', (_, e) => (calls.push({ ...e }), { value: answer }))
  on('theme.clear', () => (calls.push('clear'), { value: { isDrawn: false as const, reason: 'cleared' } }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  return { kept, calls, last: () => calls[calls.length - 1] }
}

declare function setTimeout(fn: (value: unknown) => void, ms: number): unknown

// Windows answers after the start, so wait for the dark first call and the light one that follows.
async function lit(calls: unknown[]): Promise<void> {
  for (let i = 0; i < 100 && calls.length < 2; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

let mounts = 0

const circles = (svg: string) =>
  [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map(m => ({ cx: Number(m[1]), cy: Number(m[2]), r: Number(m[3]) }))

const durations = (svg: string) => [...svg.matchAll(/dur="([\d.]+)s"/g)].map(m => Number(m[1]))

const draw = (phase: GlowPhase) => glowSvg(phase, kindle.bg, kindle.accent)

test('/cozy themes lists, turns glow on, and turns it off, the same as /cozy backdrop glow', () => {
  expect(parseTheme('themes')).toEqual({ kind: 'themes' })
  expect(parseTheme('themes glow')).toEqual({ kind: 'themes', themes: 'glow' })
  expect(parseTheme('themes off')).toEqual({ kind: 'themes', themes: 'off' })
  expect(parseTheme('themes lagoon')).toMatchObject({ kind: 'error' })
  expect(parseTheme('themes glow now')).toMatchObject({ kind: 'error' })
  expect(parseTheme('backdrop glow')).toEqual({ kind: 'backdrop', backdrop: 'glow' })
  expect(applyTheme(sane({}), { kind: 'themes', themes: 'glow' }).backdrop).toBe('glow')
  expect(applyTheme(sane({ backdrop: 'glow' }), { kind: 'themes', themes: 'off' }).backdrop).toBe('off')
  expect(applyTheme(sane({ backdrop: 'paper' }), { kind: 'themes' }).backdrop).toBe('paper')
})

test('the glow is a backdrop setting, and a 0.11.0 themes field is read as one', () => {
  expect(sane({}).backdrop).toBe('off')
  expect(sane({ backdrop: 'glow' }).backdrop).toBe('glow')
  expect(sane({ themes: 'sepia-glow' }).backdrop).toBe('glow')
  expect(sane({ backdrop: 'paper', themes: 'sepia-glow' }).backdrop).toBe('paper')
  expect(sane({ backdrop: 'grain' }).backdrop).toBe('off')
  expect(describe(sane({ backdrop: 'glow', mode: 'auto' }), 'light')).toContain('Backdrop: glow')
})

test('the glow stands for backdrop glow, the skin on and mode auto, in either mode', () => {
  const on = sane({ mode: 'auto', backdrop: 'glow' })

  expect(wantsGlow(on)).toBe(true)
  expect(wantsGlow(sane({ mode: 'light', backdrop: 'glow' }))).toBe(false)
  expect(wantsGlow(sane({ mode: 'auto', backdrop: 'glow', enabled: false }))).toBe(false)
  expect(wantsGlow(sane({ mode: 'auto', backdrop: 'paper' }))).toBe(false)
  // The still paper is a separate choice and is not read as the glow.
  expect(wantsBackdrop(on)).toBe(false)
})

test("the glow sets its own scene on the preset's paper, and the paper keeps its own", () => {
  for (const mode of ['light', 'dark'] as const) {
    const glow = backdropArgs(sane({ mode: 'auto', backdrop: 'glow', preset: 'nord' }), mode)
    const paper = backdropArgs(sane({ mode: 'auto', backdrop: 'paper', preset: 'nord' }), mode)
    const tint = (a: ThemeSetArgs) => (a.backdrop && 'glass' in a.backdrop && a.backdrop.glass ? a.backdrop.glass.tint : undefined)

    expect((glow.backdrop as { scene?: string }).scene).toBe(GLOW_SCENE)
    expect((paper.backdrop as { scene?: string }).scene).not.toBe(GLOW_SCENE)
    expect(tint(glow)).toBe(tint(paper))
  }
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

test("each phase draws a safe, side-only drawing in the preset's paper and accent", () => {
  for (const phase of ['idle', 'working', 'sparkle'] as const) {
    const svg = glowSvg(phase, '#123456', '#abcdef')

    expect(svg.length).toBeLessThan(131072)
    expect(svg).toContain('#123456')
    expect(svg).toContain('#abcdef')
    expect(svg).not.toMatch(/<script|\son[a-z]+=|href=|<image|<foreignObject/i)
    for (const c of circles(svg)) {
      // The chat column (the middle 40% of the window) stays clear of every glow.
      expect(c.cx + c.r <= 300 || c.cx - c.r >= 700).toBe(true)
    }
    expect(circles(svg).length).toBeGreaterThanOrEqual(2)
  }
})

test('working moves about three times faster than idle, and a sparkle twinkles for the length of its stay', () => {
  const idle = Math.min(...durations(draw('idle')))
  const working = Math.min(...durations(draw('working')))

  expect(idle / working).toBeGreaterThan(2.5)
  expect(idle / working).toBeLessThan(3.5)
  expect(draw('sparkle').length).toBeGreaterThan(draw('idle').length)
  expect(draw('sparkle')).toContain('repeatCount="3"')
})

test('a session that starts with the glow in mode auto sets the glow scene', async ($, on) => {
  const w = world(on, { mode: 'auto', backdrop: 'glow' })

  await $.session.start(START)
  await lit(w.calls)
  expect(w.last()).toEqual(backdropArgs(sane({ mode: 'auto', backdrop: 'glow' }), 'light'))
})

test('a session that starts with the glow in a fixed mode sets the look with no glow', async ($, on) => {
  const w = world(on, { mode: 'dark', backdrop: 'glow' })

  await $.session.start(START)
  expect(w.calls).toHaveLength(1)
  expect(w.last()).toEqual({ colors: fixedLook('kindle', 'dark')!.colors })
})

test('/cozy themes glow sets it, and off leaves the look without it', async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  expect((w.last() as ThemeSetArgs).backdrop).toBeUndefined()
  const turnedOn = { text: await press($, 'themes glow') }

  expect((w.last() as ThemeSetArgs).backdrop).toMatchObject({ scene: GLOW_SCENE })
  expect(JSON.stringify(turnedOn)).toContain('Glow (')
  await press($, 'themes off')
  expect((w.last() as ThemeSetArgs).backdrop).toBeUndefined()
  expect((w.last() as ThemeSetArgs).colors).toBeDefined()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function glowSource($: any): Promise<string> {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'Backdrop',
    requestId: `glow-${(mounts += 1)}`,
    props: { scene: GLOW_SCENE, plugin: PLUGIN, glass: { blur: 16, tint: kindle.bg, opacity: 0.7 }, overrideColorScheme: 'light' },
  })
  const svg = (await ui.findAll({ type: 'Svg' }))[0]

  return String(svg?.props.source ?? '')
}

test('the glow is drawn as an Svg in the preset colours that follows the turn: working on a prompt, a sparkle on its answer', async ($, on) => {
  const w = world(on, { mode: 'auto', backdrop: 'glow' })

  await $.session.start(START)
  await lit(w.calls)
  expect(await glowSource($)).toBe(draw('idle'))
  await $.turn.start({ text: 'hi', turnId: 'turn-1' })
  expect(await glowSource($)).toBe(draw('working'))
  await $.turn.complete({ turnId: 'turn-1', reason: 'answer' } as never)
  expect(await glowSource($)).toBe(draw('sparkle'))
})

const PANE = {
  plugin: PLUGIN,
  surface: 'desktop',
  component: 'Pane',
  requestId: 'cozy-skin',
  props: { title: 'cozy-skin', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('the desktop panel has a glow button beside the paper, and the terminal panel has none', async ($, on) => {
  const w = world(on, { mode: 'auto' })

  await $.session.start(START)
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'tab-details' })
  expect((await ui.find({ type: 'Button', key: 'backdrop-off' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'backdrop-glow' })
  expect(sane(w.kept.get(SETTINGS_KEY)).backdrop).toBe('glow')
  expect((await ui.find({ type: 'Button', key: 'backdrop-glow' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'backdrop-off' })
  expect(sane(w.kept.get(SETTINGS_KEY)).backdrop).toBe('off')

  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await terminal.find({ type: 'Button', key: 'backdrop-glow' })).toBeUndefined()
})

test("a subagent's turn does not move the glow", async ($, on) => {
  const w = world(on, { mode: 'auto', backdrop: 'glow' })

  await $.session.start(START)
  await lit(w.calls)
  await $.turn.start({ text: 'sub', turnId: 'turn-2', agentId: 'agent-1' } as never)
  expect(await glowSource($)).toBe(draw('idle'))
})
