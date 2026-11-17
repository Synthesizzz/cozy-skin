// Mode light or dark paints the whole desktop app in the preset's palette of
// that mode, whatever the app's own appearance is (Film, 2026-11-17).

import { expect, test } from 'claude-code/testing'
import { checkColors } from '../hooks/make-colors.js'
import { fixedLook } from '../hooks/fixed-look'
import { PRESETS } from '../hooks/presets'

test('every preset makes a desktop look in each mode that the desktop will paint', () => {
  const report: string[] = []

  for (const preset of PRESETS) {
    for (const mode of ['light', 'dark'] as const) {
      let made: ReturnType<typeof fixedLook>

      try {
        made = fixedLook(preset.name, mode)
      } catch (error) {
        report.push(`${preset.name} ${mode}: throws ${(error as Error).message}`)
        continue
      }
      expect(made).toBeDefined()
      // Lines under the design system's own bar still paint; only these stop it.
      const fatal = [...made!.problems, ...checkColors(made!.colors)].filter(line => line.startsWith("Desktop won't paint"))

      report.push(`${preset.name} ${mode}: ${fatal.length === 0 ? 'ok' : fatal.join(' | ')}`)
    }
  }
  expect(report.filter(line => !line.endsWith(': ok'))).toEqual([])
})

test('a fixed look names only the mode picked, so the desktop paints it in either app mode', () => {
  for (const mode of ['light', 'dark'] as const) {
    const made = fixedLook('solarized', mode)!

    expect(Object.keys(made.colors.inputs)).toEqual([mode])
    expect(made.colors.label).toContain(mode)
  }
})
