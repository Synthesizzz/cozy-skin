// Mode light or dark on the desktop: the whole app in the preset's palette of
// that mode. The desktop ignores `overrideColorScheme`, so the look names one
// mode alone (`only`), which a surface paints whichever mode the app is in.
// The palette's paper is the page, its ink the text, its accent and its
// ok/err/warn colours the roles, so code and buttons follow the preset too.

import type { ThemeColors } from 'claude-code'
import { makeColors } from './make-colors.js'
import { presetOf } from './presets'
import type { Mode } from './presets'

// `a` moved `t` of the way to `b`, as #rrggbb.
function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => Number.parseInt(hex.slice(i, i + 2), 16)

  return `#${[1, 3, 5]
    .map(i => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t).toString(16).padStart(2, '0'))
    .join('')}`
}

// One rung of the ladder: how far the secondary and muted ink sit from the ink
// toward the paper, how far dark surfaces step from the paper, and how far the
// ink itself is pushed to black (light) or white (dark).
type Rung = { secondary: number; muted: number; step: number; ink: number }

// Tried in order; the first the desktop will paint is kept. The first rung is
// the preset as it is; the later ones trade a little of its softness for the
// contrast the desktop asks before it paints a theme at all.
const LADDER: readonly Rung[] = [
  { secondary: 0.15, muted: 0.35, step: 0.025, ink: 0 },
  { secondary: 0.12, muted: 0.28, step: 0.015, ink: 0.15 },
  { secondary: 0.1, muted: 0.22, step: 0.01, ink: 0.3 },
  { secondary: 0.08, muted: 0.18, step: 0.005, ink: 0.5 },
]

const FATAL = "Desktop won't paint"

export type FixedLook = { colors: ThemeColors; problems: string[] }

type Paper = { bg: string; fg: string; accent: string; err: string; ok: string; warn: string; mcp: string }

// One mode's half of a look, as `makeColors` takes it.
function half(mode: Mode, p: Paper, rung: Rung) {
  const ink = mix(p.fg, mode === 'light' ? '#000000' : '#ffffff', rung.ink)
  // Cards, panels and menus over the page (look.md: in light mode each as light
  // or lighter, panels and menus alike; a dark surface-3 drifting light is what
  // most often stops the desktop painting a theme, so dark ones stay close).
  const surfaces =
    mode === 'light'
      ? { 'surface-1': mix(p.bg, '#ffffff', 0.25), 'surface-2': mix(p.bg, '#ffffff', 0.5), 'surface-3': mix(p.bg, '#ffffff', 0.5) }
      : { 'surface-1': mix(p.bg, ink, rung.step), 'surface-2': mix(p.bg, ink, rung.step * 2), 'surface-3': mix(p.bg, ink, rung.step * 3) }

  return {
    roles: { accent: p.accent, danger: p.err, success: p.ok, warning: p.warn, pro: p.mcp },
    gray: {
      anchors: {
        'surface-0': p.bg,
        ...surfaces,
        'text-primary': ink,
        // From the ink toward the paper, so they keep the ramp's order: several
        // presets' own muted ink sits right beside their ink.
        'text-secondary': mix(ink, p.bg, rung.secondary),
        'text-muted': mix(ink, p.bg, rung.muted),
      },
    },
  }
}

const paints = (look: FixedLook): boolean => !look.problems.some(line => line.startsWith(FATAL))

// The first rung whose one-mode look the desktop paints, with that look; else
// the last rung that built, whose `problems` say why.
function climb(label: string, id: string, mode: Mode, p: Paper): { rung: Rung; look: FixedLook } | undefined {
  let last: { rung: Rung; look: FixedLook } | undefined

  for (const rung of LADDER) {
    try {
      const { theme, problems } = makeColors({ label, id, only: mode, [mode]: half(mode, p, rung) })

      last = { rung, look: { colors: theme, problems } }
    } catch {
      continue
    }
    if (paints(last.look)) {
      break
    }
  }
  return last
}

const made = new Map<string, FixedLook>()

// The look for a preset in mode light or dark: that mode alone (`only`), which
// a surface paints whichever mode the app is in. Kept once worked out.
export function fixedLook(presetName: string, mode: Mode): FixedLook | undefined {
  const preset = presetOf(presetName)

  if (preset === undefined) {
    return undefined
  }
  const key = `${preset.name}-${mode}`
  const kept = made.get(key) ?? climb(`cozy ${preset.label} ${mode}`, `cozy-${key}`, mode, preset[mode].palette)?.look

  if (kept !== undefined) {
    made.set(key, kept)
  }
  return kept
}

// The look for a preset in mode auto: both halves, each on the rung its own
// mode needed, so the app's own light or dark picks which one shows, as the
// app's default appearance does (Film, 2026-11-17).
export function autoLook(presetName: string): FixedLook | undefined {
  const preset = presetOf(presetName)

  if (preset === undefined) {
    return undefined
  }
  const key = `${preset.name}-auto`
  const kept = made.get(key)

  if (kept !== undefined) {
    return kept
  }
  const light = climb(`cozy ${preset.label} light`, `cozy-${preset.name}-light`, 'light', preset.light.palette)
  const dark = climb(`cozy ${preset.label} dark`, `cozy-${preset.name}-dark`, 'dark', preset.dark.palette)

  if (light === undefined || dark === undefined) {
    return undefined
  }
  const { theme, problems } = makeColors({
    label: `cozy ${preset.label}`,
    id: `cozy-${preset.name}`,
    light: half('light', preset.light.palette, light.rung),
    dark: half('dark', preset.dark.palette, dark.rung),
  })
  const look = { colors: theme, problems }

  made.set(key, look)
  return look
}
