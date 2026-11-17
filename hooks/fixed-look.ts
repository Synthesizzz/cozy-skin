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

function build(label: string, id: string, mode: Mode, p: { bg: string; fg: string; accent: string; err: string; ok: string; warn: string; mcp: string }, rung: Rung): FixedLook {
  const ink = mix(p.fg, mode === 'light' ? '#000000' : '#ffffff', rung.ink)
  // Cards, panels and menus over the page (look.md: in light mode each as light
  // or lighter, panels and menus alike; a dark surface-3 drifting light is what
  // most often stops the desktop painting a theme, so dark ones stay close).
  const surfaces =
    mode === 'light'
      ? { 'surface-1': mix(p.bg, '#ffffff', 0.25), 'surface-2': mix(p.bg, '#ffffff', 0.5), 'surface-3': mix(p.bg, '#ffffff', 0.5) }
      : { 'surface-1': mix(p.bg, ink, rung.step), 'surface-2': mix(p.bg, ink, rung.step * 2), 'surface-3': mix(p.bg, ink, rung.step * 3) }
  const { theme, problems } = makeColors({
    label,
    id,
    only: mode,
    roles: { accent: p.accent, danger: p.err, success: p.ok, warning: p.warn, pro: p.mcp },
    [mode]: {
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
    },
  })

  return { colors: theme, problems }
}

const made = new Map<string, FixedLook>()

// The look for a preset in a mode: the first rung the desktop paints, else the
// last rung tried, whose `problems` say why. Kept once worked out.
export function fixedLook(presetName: string, mode: Mode): FixedLook | undefined {
  const preset = presetOf(presetName)

  if (preset === undefined) {
    return undefined
  }
  const key = `${preset.name}-${mode}`
  const kept = made.get(key)

  if (kept !== undefined) {
    return kept
  }
  let last: FixedLook | undefined

  for (const rung of LADDER) {
    try {
      last = build(`cozy ${preset.label} ${mode}`, `cozy-${key}`, mode, preset[mode].palette, rung)
    } catch {
      continue
    }
    if (!last.problems.some(line => line.startsWith(FATAL))) {
      break
    }
  }
  if (last !== undefined) {
    made.set(key, last)
  }
  return last
}
