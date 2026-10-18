import type { Mode } from './presets'

// Text colours by name, for `/cozy color`. Each has a shade for a light
// background and one for a dark one, from the Kindle palette, darkened where
// needed so every shade reads at 4.5:1 on a white or dark app and on Kindle's
// own paper. The drawing picks the shade for the current mode.
export const NAMED: Readonly<Record<string, Readonly<Record<Mode, string>>>> = {
  ink: { light: '#43372a', dark: '#ddd1bc' },
  rust: { light: '#8b5228', dark: '#d29a62' },
  plum: { light: '#7a4a63', dark: '#c79ab5' },
  teal: { light: '#2d6a66', dark: '#86c2b5' },
  slate: { light: '#48656f', dark: '#8fb4c0' },
  olive: { light: '#50673c', dark: '#aabd86' },
  brick: { light: '#a53f2e', dark: '#e0866f' },
  ochre: { light: '#805811', dark: '#e0b866' },
}

const HEX = /^#[0-9a-f]{6}$/i

export const isHex = (value: unknown): value is string => typeof value === 'string' && HEX.test(value)

export const isNamed = (value: unknown): value is string =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(NAMED, value)

// A stored colour: `#rrggbb` as typed, or one of the names above.
export const isColor = (value: unknown): value is string => isHex(value) || isNamed(value)

// The colour to draw with: a name becomes its shade for the mode, a hex stays.
export function resolveColor(color: string, mode: Mode): string {
  return NAMED[color]?.[mode] ?? color
}

export const colorNames = (): string => Object.keys(NAMED).join(', ')
