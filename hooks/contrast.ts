// WCAG 2.x contrast ratio between two `#rrggbb` colours.

function channel(value: number): number {
  const s = value / 255

  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)

  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)

  return (hi + 0.05) / (lo + 0.05)
}

const hex2 = (n: number): string => Math.round(n).toString(16).padStart(2, '0')

// `ink` moved toward black on a light ground, or white on a dark one, in small
// steps until it reads at `ratio` on `ground`: the same hue, only as far as it
// must go. Colours that already read are returned as they are.
export function readable(ink: string, ground: string, ratio = 4.5): string {
  if (contrast(ink, ground) >= ratio) {
    return ink
  }
  const toward = luminance(ground) > 0.18 ? 0 : 255
  const n = parseInt(ink.slice(1), 16)
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]

  for (let step = 1; step <= 20; step++) {
    const t = step / 20
    const mixed = `#${rgb.map(c => hex2(c + (toward - c) * t)).join('')}`

    if (contrast(mixed, ground) >= ratio) {
      return mixed
    }
  }
  return toward === 0 ? '#000000' : '#ffffff'
}
