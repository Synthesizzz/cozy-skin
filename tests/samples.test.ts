import { expect, test } from 'claude-code/testing'
import { backdropSample, bubbleSample, calmLine, iconsLine, tablesSample, toolsSample } from '../hooks/samples'
import { presetOf } from '../hooks/presets'

const p = presetOf('kindle')!.light.palette

test('icons and calm lines change with the choice', () => {
  expect(iconsLine(false)).toContain('●')
  expect(iconsLine(true)).not.toContain('●')
  expect(iconsLine(true)).toContain('o  a call running')
  expect(calmLine(['Pondering', 'Mulling', 'Brewing'], false, false)).toContain('Pondering…  →  Mulling…  →  Brewing…')
  const calm = calmLine(['Pondering', 'Mulling', 'Brewing'], true, false)

  expect(calm).toContain('Pondering')
  expect(calm).not.toContain('Mulling')
  expect(calmLine([], true, true)).toContain('Thinking')
})

test('the tool sample draws a dot in each kind colour only when the rows are on', () => {
  const on = toolsSample(p, true, false).source
  const off = toolsSample(p, false, false).source

  expect((on.match(/<circle/g) ?? []).length).toBe(3)
  expect(off).not.toContain('<circle')
  expect(toolsSample(p, true, true).source).toContain('>*<')
  expect(off).toContain('Bash  npm test')
})

test("the table sample is a framed grid, plain columns, or the app's own dimmer ones", () => {
  const box = tablesSample(p, 'box').source
  const text = tablesSample(p, 'text').source
  const off = tablesSample(p, 'off').source

  expect(box).toContain(`fill="${p.zebra}"`)
  expect(box).toContain(`fill="${p.surface}"`)
  expect(text).not.toContain(p.zebra)
  expect(text).not.toContain('<path')
  expect(off).not.toBe(text)
  expect(box).toContain('$12,400')
})

test("the bubble sample is cozy's pill or the app's framed one with its actions", () => {
  expect(bubbleSample(p, 'cozy').source).toContain('rx="13"')
  expect(bubbleSample(p, 'cozy').source).not.toContain('Rewind')
  expect(bubbleSample(p, 'app').source).toContain('Rewind')
})

test('the backdrop sample is bare, paper, or paper with glows in the accent', () => {
  const glow = backdropSample(p, 'glow').source

  expect(glow).toContain('radialGradient')
  expect(glow).toContain(p.accent)
  expect(backdropSample(p, 'paper').source).not.toContain('radialGradient')
  expect(backdropSample(p, 'paper').source).toContain(`fill="${p.bg}"`)
  expect(backdropSample(p, 'off').source).not.toContain(`fill="${p.bg}" stroke`)
})
