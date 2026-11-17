// Small pictures for the panel's Details tab: what each setting does, drawn in
// the look in force and changing with the choice. Pure functions of the
// palette and the choice, so a test can read them without a surface.

import { readable } from './contrast'
import type { Palette } from './presets'

export type Sample = { source: string; width: number; height: number }

const WIDTH = 264
const FONT = 'font-family="Segoe UI, system-ui, sans-serif" font-size="11"'
const MONO = 'font-family="Cascadia Code, Consolas, monospace" font-size="10.5"'

const frame = (p: Palette, height: number, body: string): Sample => ({
  source:
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">` +
    `<rect x="1" y="1" width="${WIDTH - 2}" height="${height - 2}" rx="8" fill="${p.bg}" stroke="${p.fg}" stroke-opacity="0.15"/>` +
    `${body}</svg>`,
  width: WIDTH,
  height,
})

// The marks the skin draws, as unicode shapes or as plain ASCII.
export function iconsLine(isAscii: boolean): string {
  return isAscii ? '*  a call done    o  a call running    >  your prompt' : '●  a call done    ○  a call running    ›  your prompt'
}

// The spinner word: one for the whole turn when calm, else the preset's words cycling.
export function calmLine(words: readonly string[], isCalm: boolean, isAscii: boolean): string {
  const mark = isAscii ? '*' : '✻'
  const [a = 'Thinking', b = 'Mulling', c = 'Brewing'] = words

  return isCalm ? `${mark} ${a}…  (the same word until the turn ends)` : `${mark} ${a}…  →  ${b}…  →  ${c}…`
}

// Three tool calls: a dot in the colour of each kind when the rows are on.
export function toolsSample(p: Palette, isOn: boolean, isAscii: boolean): Sample {
  const rows = [
    ['read', 'Read  notes.md', p.read],
    ['write', 'Write  summary.md', p.write],
    ['run', 'Bash  npm test', p.run],
  ] as const
  const body = rows
    .map(([, text, color], i) => {
      const y = 22 + i * 18
      const dot = isOn
        ? isAscii
          ? `<text x="14" y="${y}" ${MONO} fill="${readable(color, p.bg, 3)}">*</text>`
          : `<circle cx="17" cy="${y - 4}" r="4" fill="${readable(color, p.bg, 3)}"/>`
        : ''

      return `${dot}<text x="30" y="${y}" ${FONT} fill="${readable(p.fg, p.bg)}">${text}</text>`
    })
    .join('')

  return frame(p, 70, body)
}

// A small table in the three styles: a framed grid with a header band and a
// striped row, plain aligned columns, or Claude Code's own (plain, dimmer).
export function tablesSample(p: Palette, style: 'box' | 'text' | 'off'): Sample {
  const ink = readable(p.fg, p.bg)
  const cells = (y: number, a: string, b: string, color: string, weight = '400') =>
    `<text x="22" y="${y}" ${FONT} font-weight="${weight}" fill="${color}">${a}</text>` +
    `<text x="242" y="${y}" ${FONT} font-weight="${weight}" fill="${color}" text-anchor="end">${b}</text>`

  if (style === 'box') {
    const head = readable(p.fg, p.surface)
    const zebra = readable(p.fg, p.zebra)

    return frame(
      p,
      78,
      `<rect x="12" y="10" width="240" height="58" rx="6" fill="${p.bg}" stroke="${p.line}"/>` +
        `<path d="M12 28 v-12 a6 6 0 0 1 6 -6 h228 a6 6 0 0 1 6 6 v12 z" fill="${p.surface}"/>` +
        cells(24, 'Project', 'Budget', head, '600') +
        cells(43, 'Q3 Report', '$12,400', ink) +
        `<rect x="13" y="48" width="238" height="19" fill="${p.zebra}"/>` +
        cells(61, 'Audit', '$3,150', zebra),
    )
  }
  const color = style === 'off' ? readable(p.muted, p.bg) : ink

  return frame(p, 78, cells(26, 'Project', 'Budget', color, '600') + cells(45, 'Q3 Report', '$12,400', color) + cells(62, 'Audit', '$3,150', color))
}

// Your prompt: cozy's bubble on the preset's paper, or the app's own, framed
// with its actions beneath.
export function bubbleSample(p: Palette, style: 'cozy' | 'app'): Sample {
  const ink = readable(p.fg, p.surface)

  if (style === 'cozy') {
    return frame(
      p,
      46,
      `<rect x="106" y="9" width="146" height="26" rx="13" fill="${p.surface}"/>` +
        `<text x="240" y="26" ${FONT} fill="${ink}" text-anchor="end">Show me the budget</text>`,
    )
  }
  return frame(
    p,
    46,
    `<rect x="106" y="9" width="146" height="26" rx="8" fill="none" stroke="${p.line}"/>` +
      `<text x="240" y="26" ${FONT} fill="${readable(p.fg, p.bg)}" text-anchor="end">Show me the budget</text>` +
      `<text x="14" y="26" ${FONT} fill="${readable(p.muted, p.bg)}">Rewind · Fork</text>`,
  )
}

// The window behind the chat: bare, on the preset's paper, or with soft
// glows in its accent drifting at the sides.
export function backdropSample(p: Palette, kind: 'off' | 'paper' | 'glow'): Sample {
  const glow =
    kind === 'glow'
      ? `<defs><radialGradient id="g"><stop offset="0" stop-color="${p.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient></defs>` +
        `<circle cx="18" cy="26" r="34" fill="url(#g)"/><circle cx="246" cy="52" r="38" fill="url(#g)"/><circle cx="238" cy="8" r="26" fill="url(#g)"/>`
      : ''
  const window = kind === 'off' ? '#80808022' : p.bg

  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="70" viewBox="0 0 ${WIDTH} 70">` +
      `<rect x="1" y="1" width="${WIDTH - 2}" height="68" rx="8" fill="${window}" stroke="${p.fg}" stroke-opacity="0.15"/>` +
      glow +
      `<rect x="72" y="12" width="120" height="46" rx="8" fill="${p.surface}" fill-opacity="0.85"/>` +
      `<rect x="82" y="22" width="60" height="4" rx="2" fill="${p.fg}" fill-opacity="0.7"/>` +
      `<rect x="82" y="32" width="90" height="4" rx="2" fill="${p.muted}"/>` +
      `<rect x="82" y="42" width="44" height="4" rx="2" fill="${p.accent}"/>` +
      '</svg>',
    width: WIDTH,
    height: 70,
  }
}
