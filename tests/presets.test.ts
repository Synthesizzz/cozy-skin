import { expect, test } from 'claude-code/testing'

import { contrast, readable } from '../hooks/contrast'
import { PRESETS, presetOf, type Mode } from '../hooks/presets'
const MODES: Mode[] = ['light', 'dark']

import { THEME_FILES } from './theme-files'

test('contrast matches the WCAG reference values', () => {
  expect(contrast('#000000', '#ffffff')).toBe(21)
  expect(contrast('#777777', '#777777')).toBe(1)
})

test('fg and muted reach 4.5:1 on bg and panel in every preset and mode', () => {
  for (const preset of PRESETS) {
    for (const mode of MODES) {
      const p = preset[mode].palette
      const grounds = p.panel ? [p.bg, p.panel] : [p.bg]

      for (const ground of grounds) {
        expect(contrast(p.fg, ground), `${preset.name} ${mode} fg on ${ground}`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(p.muted, ground), `${preset.name} ${mode} muted on ${ground}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  }
})

test('every theme file keeps text and subtle readable on the look background', () => {
  for (const preset of PRESETS) {
    for (const mode of MODES) {
      const look = preset[mode].palette
      const file = THEME_FILES[`cozy-${preset.name}-${mode}`]

      expect(file, `cozy-${preset.name}-${mode}.json`).toBeDefined()
      if (file === undefined) continue
      expect(contrast(file.overrides.text, look.bg), `${preset.name} ${mode} text`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(file.overrides.subtle, look.bg), `${preset.name} ${mode} subtle`).toBeGreaterThanOrEqual(4.5)
      expect(file.overrides.subtle, `${preset.name} ${mode} subtle is the look's muted`).toBe(look.muted)
    }
  }
})

test('terminal schemes keep text and syntax colours readable', () => {
  for (const preset of PRESETS) {
    for (const mode of MODES) {
      const t = preset[mode].terminal
      // Slots meant to sit close to the background: shells use them for fills, not text.
      const skip = mode === 'light' ? ['black', 'brightBlack'] : ['black', 'white', 'brightWhite']

      expect(contrast(t.foreground, t.background), `${preset.name} ${mode} foreground`).toBeGreaterThanOrEqual(4.5)

      for (const [key, value] of Object.entries(t)) {
        if (['background', 'foreground', 'cursorColor', 'selectionBackground'].includes(key)) continue
        if (skip.includes(key)) continue
        // Syntax colours are body text in a shell, so they get the same 4.5:1 as text.
        expect(contrast(value, t.background), `${preset.name} ${mode} ${key}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  }
})

test('status colours are green-ish for ok and red-ish for err', () => {
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
    return { r: r!, g: g!, b: b! }
  }

  for (const preset of PRESETS) {
    for (const mode of MODES) {
      const { ok, err } = preset[mode].palette
      const o = hue(ok)
      const e = hue(err)

      expect(o.g, `${preset.name} ${mode} ok`).toBeGreaterThan(o.r)
      expect(o.g, `${preset.name} ${mode} ok`).toBeGreaterThan(o.b)
      expect(e.r, `${preset.name} ${mode} err`).toBeGreaterThan(e.g)
      expect(e.r, `${preset.name} ${mode} err`).toBeGreaterThan(e.b)
    }
  }
})

test('fixed background hexes come from the design and the themes', () => {
  expect(presetOf('kindle')?.light.palette.bg).toBe('#e9dcc3')
  expect(presetOf('kindle')?.dark.palette.bg).toBe('#38332d')
  // The VS Code looks keep their themes' own backgrounds.
  expect(presetOf('solarized')?.light.palette.bg).toBe('#fdf6e3')
  expect(presetOf('nord')?.dark.palette.bg).toBe('#2e3440')
  expect(presetOf('dracula')?.dark.palette.bg).toBe('#282a36')
  expect(presetOf('nope')).toBeUndefined()
})

test('every look has spinner and done words and a box style', () => {
  for (const preset of PRESETS) {
    for (const mode of MODES) {
      expect(preset[mode].spinner.length).toBeGreaterThan(0)
      expect(preset[mode].done.length).toBeGreaterThan(0)
    }
  }
  expect(presetOf('kindle')?.light.boxed).toBe('soft')
})

test('the desktop table and inline code read at 4.5:1 in every preset and mode', () => {
  for (const preset of PRESETS) {
    for (const mode of MODES) {
      const p = preset[mode].palette

      // The table's words and inline code, as drawn: each colour moved just far
      // enough to read on the paper, the header band and the stripe.
      for (const ground of [p.bg, p.surface, p.zebra]) {
        expect(contrast(readable(p.fg, ground), ground), `${preset.name} ${mode} fg on ${ground}`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(readable(p.accent, ground), ground), `${preset.name} ${mode} accent on ${ground}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  }
})

test('readable leaves a colour that reads alone and moves one that does not only a little', () => {
  expect(readable('#000000', '#ffffff')).toBe('#000000')
  // Kindle light's accent on its header band: darker, but still the same brown.
  const moved = readable('#9a5b2c', '#dfcfb1')

  expect(moved).not.toBe('#9a5b2c')
  expect(contrast(moved, '#dfcfb1')).toBeGreaterThanOrEqual(4.5)
  expect(contrast(moved, '#9a5b2c')).toBeLessThan(2)
  // On a dark ground it moves toward white.
  expect(parseInt(readable('#3c97d7', '#073642').slice(1, 3), 16)).toBeGreaterThan(0x3c)
})

test('High contrast reaches 7:1 (WCAG AAA) for every text colour, on its paper and its bands', () => {
  const preset = presetOf('contrast')

  expect(preset?.label).toBe('High contrast')
  for (const mode of MODES) {
    const p = preset![mode].palette

    for (const ink of [p.fg, p.muted, p.accent, p.ok, p.err, p.warn, p.read, p.write, p.run, p.search, p.web]) {
      expect(contrast(ink, p.bg), `${mode} ${ink} on ${p.bg}`).toBeGreaterThanOrEqual(7)
    }
    for (const band of [p.surface, p.zebra]) {
      expect(contrast(p.fg, band), `${mode} fg on ${band}`).toBeGreaterThanOrEqual(7)
    }
  }
})
