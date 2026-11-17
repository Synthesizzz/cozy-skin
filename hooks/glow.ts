// The first moving theme, sepia-glow: sepia paper with soft warm glows that
// drift in the window's sides. It idles slowly, moves about three times faster
// while Claude works, and twinkles for a few seconds when a turn is answered.
// This file holds only what needs no engine: when the theme stands, the phase
// machine and the drawing, which hooks/backdrop.tsx puts in an Svg.

import type { Mode } from './presets'
import type { Settings } from './settings'

export const GLOW_THEME = 'sepia-glow'
export const GLOW_SCENE = 'cozy-glow'

// How long the sparkle stays after an answer.
export const SPARKLE_MS = 3000

export type GlowPhase = 'idle' | 'working' | 'sparkle'
export type GlowEvent = 'start' | 'answer' | 'aborted' | 'refusal' | 'error' | 'settle'

// Light mode only, and only in mode auto, as the still paper: the app's own
// text follows Windows, so a paper of the other mode could sit under text that
// cannot be read.
export const wantsGlow = (settings: Settings, mode: Mode): boolean =>
  settings.enabled && settings.themes === GLOW_THEME && settings.mode === 'auto' && mode === 'light'

// A turn's start is work, an answer is a sparkle, every other end is calm at
// once; `settle` ends a sparkle and never interrupts work.
export function nextPhase(phase: GlowPhase, event: GlowEvent): GlowPhase {
  switch (event) {
    case 'start':
      return 'working'
    case 'answer':
      return 'sparkle'
    case 'settle':
      return phase === 'sparkle' ? 'idle' : phase
    default:
      return 'idle'
  }
}

const PAPER = '#f4ecd8'
const GLOW = '#e8b98a'

// Seconds for one drift: idle is slow, working about three times quicker.
const DRIFT: Record<GlowPhase, number> = { idle: 14, working: 4.7, sparkle: 14 }

// The glows sit in the outer 30% of the window on each side (the drawing is
// 1000 wide), so the chat column in the middle stays clear: each circle's
// reach, centre plus radius, stays inside 300 or 700.
const GLOWS = [
  { cx: 90, cy: 130, r: 200, dx: 40, dy: 50, lag: 0 },
  { cx: 920, cy: 470, r: 200, dx: -40, dy: -50, lag: 1.3 },
  { cx: 110, cy: 540, r: 150, dx: 30, dy: -40, lag: 2.6 },
]

// Small stars near the sides that twinkle for the sparkle's stay.
const STARS = [
  { cx: 70, cy: 70 },
  { cx: 190, cy: 210 },
  { cx: 60, cy: 330 },
  { cx: 940, cy: 120 },
  { cx: 830, cy: 300 },
  { cx: 900, cy: 560 },
]

export function glowSvg(phase: GlowPhase): string {
  const drift = DRIFT[phase]
  const lights = GLOWS.map(g => {
    const move = `<animateTransform attributeName="transform" type="translate" values="0 0;${g.dx} ${g.dy};0 0" dur="${drift}s" begin="-${g.lag}s" repeatCount="indefinite"/>`
    const pulse = `<animate attributeName="opacity" values="0.5;0.9;0.5" dur="${drift / 2}s" begin="-${g.lag}s" repeatCount="indefinite"/>`

    return `<g>${move}<circle cx="${g.cx}" cy="${g.cy}" r="${g.r}" fill="url(#glow)">${pulse}</circle></g>`
  }).join('')
  const stars =
    phase === 'sparkle'
      ? STARS.map(
          (s, i) =>
            `<circle cx="${s.cx}" cy="${s.cy}" r="5" fill="#fff6e0" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="1s" begin="${(i * 0.15).toFixed(2)}s" repeatCount="3"/></circle>`,
        ).join('')
      : ''

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1000 600" preserveAspectRatio="none">` +
    `<defs><radialGradient id="glow"><stop offset="0" stop-color="${GLOW}" stop-opacity="0.85"/><stop offset="1" stop-color="${GLOW}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="1000" height="600" fill="${PAPER}"/>${lights}${stars}</svg>`
  )
}
