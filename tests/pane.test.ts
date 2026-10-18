import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { NAMED, isColor, resolveColor } from '../hooks/colors'
import { contrast } from '../hooks/contrast'
import { parseTheme } from '../hooks/command'
import { lookPreview, presetCard } from '../hooks/pane'
import { PRESETS, presetOf } from '../hooks/presets'
import { SETTINGS_KEY, sane } from '../hooks/settings'

const PLUGIN = 'cozy-skin'
const START = { cwd: '/', surface: 'desktop', isInteractive: true } as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
const SITE = { scroll: { offset: 0, bodyRows: 40 }, view: {} }
const PANE = {
  plugin: PLUGIN,
  surface: 'desktop',
  component: 'Pane',
  requestId: 'cozy-skin',
  props: { title: 'cozy-skin', isFocused: true, bodyColumns: 60, placement: 'dock', ...SITE },
} as const

// Light grounds a reply sits on (a white app, Kindle's paper) and dark ones.
const GROUNDS = {
  light: ['#ffffff', presetOf('kindle')!.light.palette.bg],
  dark: ['#1f1f1f', presetOf('kindle')!.dark.palette.bg],
} as const

function world(on: On) {
  const kept = new Map<string, unknown>([[SETTINGS_KEY, { mode: 'light' }]])
  const opened: string[] = []

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('ui.open', (_, e) => (opened.push(e.id), { value: { isPlaced: true } }))

  return { kept, opened }
}

test('every named colour reads at 4.5:1 on light and dark grounds in its own shade', () => {
  for (const [name, shades] of Object.entries(NAMED)) {
    for (const mode of ['light', 'dark'] as const) {
      for (const ground of GROUNDS[mode]) {
        expect(contrast(shades[mode], ground), `${name} ${mode} on ${ground}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  }
})

test('a name takes the shade of the mode, a hex stays as typed', () => {
  expect(resolveColor('plum', 'light')).toBe('#7a4a63')
  expect(resolveColor('plum', 'dark')).toBe('#c79ab5')
  expect(resolveColor('#123456', 'dark')).toBe('#123456')
  expect(isColor('teal')).toBe(true)
  expect(isColor('toString')).toBe(false)
  expect(sane({ colors: { you: 'teal', claude: 'plum' } }).colors).toEqual({ you: 'teal', code: null })
})

test('/cozy color takes a name, and /cozy panel opens the panel', () => {
  expect(parseTheme('color you Plum')).toEqual({ kind: 'color', side: 'you', color: 'plum' })
  // Claude's replies keep Claude Code's own look: there is no colour for them.
  expect(parseTheme('color claude plum')).toMatchObject({ kind: 'error' })
  expect(parseTheme('color you pink')).toMatchObject({ kind: 'error' })
  expect(parseTheme('panel')).toEqual({ kind: 'panel' })
})

test('/cozy panel opens the panel', async ($, on) => {
  const w = world(on)

  await $.session.start(START)
  const said = await $.command.run({ ...TYPED, command: 'cozy', args: 'panel' })

  expect(w.opened).toEqual(['cozy-skin'])
  expect(said.text).toBe('cozy-skin panel opened.')
})

test('a colour button sets that side and becomes the one in force', async ($, on) => {
  const w = world(on)

  await $.session.start(START)
  const ui = await $.ui.mount(PANE)

  expect((await ui.find({ type: 'Button', key: 'you-default' }))?.props.variant).toBe('primary')

  await ui.press({ key: 'you-plum' })
  expect(sane(w.kept.get(SETTINGS_KEY)).colors).toEqual({ you: 'plum', code: null })
  expect((await ui.find({ type: 'Button', key: 'you-plum' }))?.props.variant).toBe('primary')
  expect((await ui.find({ type: 'Button', key: 'you-default' }))?.props.variant).toBe('secondary')
  expect(await ui.find({ type: 'Button', key: 'claude-plum' })).toBeUndefined()

  await ui.press({ key: 'you-teal' })
  expect(sane(w.kept.get(SETTINGS_KEY)).colors).toEqual({ you: 'teal', code: null })
})

test('a hand-typed hex shows as its own button', async ($, on) => {
  world(on)

  await $.session.start(START)
  await $.command.run({ ...TYPED, command: 'cozy', args: 'color you #123abc' })
  const ui = await $.ui.mount(PANE)

  expect((await ui.find({ type: 'Button', key: 'you-custom' }))?.props.variant).toBe('primary')
})

test('on the desktop a coloured prompt stays a bubble on the right', async ($, on) => {
  const w = world(on)

  w.kept.set(SETTINGS_KEY, { mode: 'light', colors: { you: 'plum' } })
  await $.session.start(START)
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'UserMessage',
    props: { text: 'hello there', origin: { kind: 'composer' }, isExpanded: true },
  })
  const text = await ui.find({ type: 'Text', text: 'hello there' })
  const boxes = await ui.findAll({ type: 'Box' })

  expect(text?.props.color).toBe(resolveColor('plum', 'light'))
  expect(boxes.some(b => b.props.justifyContent === 'flex-end')).toBe(true)
  const bubble = boxes.find(b => b.props.backgroundColor === presetOf('kindle')!.light.palette.bg)

  // Rounded like the default bubble, with the border in the fill's colour.
  expect(bubble?.props.borderStyle).toBe('round')
  expect(bubble?.props.borderColor).toBe(bubble?.props.backgroundColor)
  expect(bubble?.props).toMatchObject({ paddingX: 'lg', paddingY: 'sm', flexShrink: 1 })
  // An empty 20% beside the bubble keeps it to ~80% of the row, as the default does.
  expect(boxes.some(b => b.props.width === '20%')).toBe(true)
})

test("with no colour picked the prompt bubble takes the preset's own ink and paper", async ($, on) => {
  const w = world(on)

  w.kept.set(SETTINGS_KEY, { preset: 'dracula', mode: 'dark' })
  await $.session.start(START)
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'UserMessage',
    props: { text: 'hello there', origin: { kind: 'composer' }, isExpanded: true },
  })
  const dracula = presetOf('dracula')!.dark.palette

  expect((await ui.find({ type: 'Text', text: 'hello there' }))?.props.color).toBe(dracula.fg)
  expect((await ui.findAll({ type: 'Box' })).some(b => b.props.backgroundColor === dracula.bg)).toBe(true)
})

test("every named shade reads at 4.5:1 on each preset's paper, where the bubble sits", () => {
  for (const preset of PRESETS) {
    for (const mode of ['light', 'dark'] as const) {
      for (const [name, shades] of Object.entries(NAMED)) {
        const paper = preset[mode].palette.bg

        expect(contrast(shades[mode], paper), `${name} on ${preset.name} ${mode} ${paper}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  }
})

test('/cozy on turns the skin back on, and the panel has an on button', async ($, on) => {
  const w = world(on)

  w.kept.set(SETTINGS_KEY, { mode: 'dark', enabled: false })
  expect(parseTheme('on')).toEqual({ kind: 'on' })
  await $.session.start(START)
  const ui = await $.ui.mount(PANE)

  expect((await ui.find({ type: 'Button', key: 'skin-off' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'skin-on' })
  expect(sane(w.kept.get(SETTINGS_KEY)).enabled).toBe(true)
  expect((await ui.find({ type: 'Button', key: 'skin-on' }))?.props.variant).toBe('primary')
})

test('the panel turns cozy tables off and on', async ($, on) => {
  const w = world(on)

  await $.session.start(START)
  const ui = await $.ui.mount(PANE)

  expect((await ui.find({ type: 'Button', key: 'tables-on' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'tables-off' })
  expect(sane(w.kept.get(SETTINGS_KEY)).tables).toBe('off')
  expect((await ui.find({ type: 'Button', key: 'tables-off' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'tables-on' })
  expect(sane(w.kept.get(SETTINGS_KEY)).tables).toBe('box')
})

test('the panel runs skin, preset, mode and palette before the colour picks', async ($, on) => {
  world(on)

  await $.session.start(START)
  const ui = await $.ui.mount(PANE)
  // Group headings are the semibold lines.
  const headings = (await ui.findAll({ type: 'Text' })).filter(t => t.props.weight === 'semibold').map(t => t.text)

  expect(headings.map(h => h.split(' ')[0])).toEqual(['Skin', 'Preset', 'Mode', 'Palette', 'Your', 'Inline', 'Tables', 'Tool', 'Your', 'Your'])
  // Who draws your prompt sits with the other switches, before your looks.
  expect(headings.findIndex(h => h.startsWith('Your bubble'))).toBe(headings.findIndex(h => h.startsWith('Tool')) + 1)
  // The presets sit on two shelves under one heading.
  const captions = (await ui.findAll({ type: 'Text' })).filter(t => t.props.size === 'caption').map(t => t.text)

  expect(captions.map(c => c.split(' ')[0])).toEqual(['E-reader', 'VS', 'Accessibility'])
})

test('each preset is a card in its own colours, the one in force ticked', async ($, on) => {
  const w = world(on)

  w.kept.set(SETTINGS_KEY, { preset: 'dracula', mode: 'dark' })
  await $.session.start(START)
  const ui = await $.ui.mount(PANE)
  const cards = (await ui.findAll({ type: 'Svg' })).filter(svg => String(svg.props.source).includes('>Aa</text>'))
  const dracula = presetOf('dracula')!.dark.palette
  const drawn = cards.map(svg => String(svg.props.source))

  expect(cards).toHaveLength(PRESETS.length)
  // One width for all, so the shelves line up.
  expect(new Set(cards.map(svg => svg.props.width)).size).toBe(1)
  // Small enough for two to a row in a narrow panel.
  expect(Number(cards[0]!.props.width)).toBeLessThanOrEqual(128)
  expect(drawn.filter(svg => svg.includes('<path'))).toHaveLength(1)
  expect(drawn.find(svg => svg.includes('<path'))).toContain(`fill="${dracula.bg}"`)
  // A book face for the e-reader looks, a code face for the editor themes.
  expect(presetCard(presetOf('kindle')!.light.palette, true, false).source).toContain('serif')
  expect(presetCard(dracula, false, false).source).toContain('monospace')
})

test("the palette shows the active preset's colours as dots, and the picks", async ($, on) => {
  const w = world(on)

  w.kept.set(SETTINGS_KEY, { preset: 'nord', mode: 'dark', colors: { you: 'teal' } })
  await $.session.start(START)
  const ui = await $.ui.mount(PANE)
  const nord = presetOf('nord')!.dark.palette
  const strips = (await ui.findAll({ type: 'Svg' })).map(svg => String(svg.props.source))

  // One card per preset, one dot strip for the palette and one preview of the look.
  expect(strips).toHaveLength(PRESETS.length + 2)
  expect(strips.some(svg => svg.includes(`fill="${nord.bg}"`) && svg.includes(`fill="${nord.accent}"`))).toBe(true)
  expect((await ui.findAll({ type: 'Text' })).some(t => t.props.color === resolveColor('teal', 'dark'))).toBe(true)
})

test('the terminal gets text dots instead of pictures', async ($, on) => {
  world(on)

  await $.session.start(START)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect((await ui.findAll({ type: 'Text' })).some(t => t.text === '●')).toBe(true)
})

const REPLY_WITH_CODE = [
  'Open the panel with `/cozy panel` first.',
  '',
  'A plain line with a [link](https://example.com).',
  '',
  '```sh',
  'ls -la',
  '```',
].join('\n')

test('an inline code colour redraws only the lines that hold inline code', async ($, on) => {
  const w = world(on)

  w.kept.set(SETTINGS_KEY, { mode: 'light', colors: { you: null, code: 'teal' } })
  await $.session.start(START)
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'AssistantMessage',
    props: { text: REPLY_WITH_CODE, isFirstOfReply: true },
  })
  const teal = resolveColor('teal', 'light')
  const chip = (await ui.findAll({ type: 'Text' })).find(t => t.props.color === teal)

  // Monospace on a see-through grey, a thin space of padding either side, like the app's own chip.
  expect(chip?.text).toBe(' /cozy panel ')
  expect(chip?.props).toMatchObject({ mono: true, backgroundColor: '#8080802e' })
  // The rest goes to the app as written, link and code block included.
  expect((await ui.findAll({ type: 'Markdown' })).map(m => m.props.text)).toEqual([
    'A plain line with a [link](https://example.com).\n\n```sh\nls -la\n```',
  ])
})

test('a reply with no inline code is left to the app even with a colour picked', async ($, on) => {
  const w = world(on)

  w.kept.set(SETTINGS_KEY, { mode: 'light', colors: { you: null, code: 'teal' } })
  on('ui.render', { component: 'AssistantMessage' }, (beneath, e) => beneath.ui.resolve(e).Text({ children: 'beneath' }))
  await $.session.start(START)
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'AssistantMessage',
    props: { text: 'Nothing to colour here.', isFirstOfReply: true },
  })

  expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
})

test('/cozy color code sets the inline code colour', () => {
  expect(parseTheme('color code teal')).toEqual({ kind: 'color', side: 'code', color: 'teal' })
  expect(parseTheme('color code off')).toEqual({ kind: 'color', side: 'code', color: null })
})

test('in dark mode the chip keeps its grey and the code takes the dark shade', async ($, on) => {
  const w = world(on)

  w.kept.set(SETTINGS_KEY, { mode: 'dark', colors: { you: null, code: 'teal' } })
  await $.session.start(START)
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'AssistantMessage',
    props: { text: 'Open the panel with `/cozy panel` first.', isFirstOfReply: true },
  })
  const dark = resolveColor('teal', 'dark')
  const chip = (await ui.findAll({ type: 'Text' })).find(t => t.props.color === dark)

  expect(dark).not.toBe(resolveColor('teal', 'light'))
  expect(chip?.props).toMatchObject({ mono: true, backgroundColor: '#8080802e' })
})

test('the chip grey shows on a white app and on a dark app', () => {
  // A mid grey at 18% opacity, blended over each ground: never equal to the ground itself.
  const over = (ground: number) => Math.round(ground + (0x80 - ground) * (0x2e / 255))

  expect(over(0xff)).toBeLessThan(0xff)
  expect(over(0x1f)).toBeGreaterThan(0x1f)
})

test('a look saved by name comes back as one press, and can be forgotten', async ($, on) => {
  const w = world(on)

  w.kept.set(SETTINGS_KEY, { preset: 'nord', mode: 'dark', colors: { you: 'teal', code: null } })
  await $.session.start(START)
  expect(parseTheme('save night-work')).toEqual({ kind: 'save', name: 'night-work' })
  expect(parseTheme('save nord').kind).toBe('error')
  expect(parseTheme('save Bad Name').kind).toBe('error')

  const ui = await $.ui.mount(PANE)

  await $.command.run({ command: 'cozy', args: 'save night-work' } as never)
  await $.command.run({ command: 'cozy', args: 'paper light' } as never)
  expect(sane(w.kept.get(SETTINGS_KEY)).preset).toBe('paper')

  await ui.press({ key: 'look-night-work' })
  const back = sane(w.kept.get(SETTINGS_KEY))

  expect(back).toMatchObject({ preset: 'nord', mode: 'dark', colors: { you: 'teal', code: null } })
  expect((await ui.find({ type: 'Button', key: 'look-night-work' }))?.props.variant).toBe('primary')

  await $.command.run({ command: 'cozy', args: 'forget night-work' } as never)
  expect(sane(w.kept.get(SETTINGS_KEY)).looks).toEqual({})
})

test('a stored look that is broken or past the limit is dropped, not repaired', () => {
  const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`l${i}`, { preset: 'nord', mode: 'dark', colors: {} }]))

  expect(Object.keys(sane({ looks: many }).looks)).toHaveLength(12)
  expect(sane({ looks: { ok: { preset: 'nord' }, gone: { preset: 'nope' }, 'Bad Name': { preset: 'nord' } } }).looks).toEqual({
    ok: { preset: 'nord', mode: 'auto', colors: { you: null, code: null } },
  })
})

test('the panel previews the look in its own colours, with the picked inks', async ($, on) => {
  const w = world(on)

  w.kept.set(SETTINGS_KEY, { preset: 'gruvbox', mode: 'light', colors: { you: 'plum', code: null } })
  await $.session.start(START)
  const ui = await $.ui.mount(PANE)
  const svg = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.source)).find(s => s.includes('Show me the budget'))
  const g = presetOf('gruvbox')!.light.palette

  expect(svg).toBeDefined()
  expect(svg).toContain(`fill="${g.bg}"`)
  expect(svg).toContain(`fill="${g.zebra}"`)
  expect(svg).toContain('/cozy panel')
  // Every word in the picture reads at 4.5:1 on what it sits on.
  const preview = lookPreview(g, resolveColor('plum', 'light'), g.accent)

  expect(preview.source).toBe(svg)
  expect(await (await $.ui.mount({ ...PANE, surface: 'terminal' })).find({ type: 'Svg' })).toBeUndefined()
})

test('in the preview the inline code stays inside its chip and clear of the next word', () => {
  const svg = lookPreview(presetOf('kindle')!.dark.palette, '#ffffff', '#ffcc66').source
  const chip = /<rect x="(\d+)" y="41" width="(\d+)"/.exec(svg)
  const code = /<text x="(\d+)" y="52"[^>]*textLength="(\d+)"[^>]*>\/cozy panel</.exec(svg)
  const after = /<text x="(\d+)" y="52"[^>]*>then pick a look\.</.exec(svg)

  expect(chip && code && after).toBeTruthy()
  const chipEnd = Number(chip![1]) + Number(chip![2])

  expect(Number(code![1])).toBeGreaterThan(Number(chip![1]))
  expect(Number(code![1]) + Number(code![2])).toBeLessThanOrEqual(chipEnd)
  expect(Number(after![1])).toBeGreaterThan(chipEnd)
})

test('the desktop bubble shows its time, Copy and Edit on hover, as the default bubble does', async ($, on) => {
  world(on)
  const copies: string[] = []
  const fills: string[] = []

  on('ui.copy', (_, e) => (copies.push(e.text), { value: { isCopied: true as const } }))
  on('prompt.fill', (_, e) => (fills.push(e.text), { isFilled: true }))
  await $.session.start(START)
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'UserMessage',
    props: { text: 'line one\nline two', origin: { kind: 'composer' }, isExpanded: true },
  })
  const boxes = await ui.findAll({ type: 'Box' })

  // Hidden until the pointer is on the row, out of the flow so showing it
  // moves nothing. The kit does not report `hover`, so the reveal itself is
  // checked on the desktop.
  expect(boxes.find(b => b.props.display === 'none')?.props).toMatchObject({ position: 'absolute', bottom: 0 })
  expect(boxes.some(b => typeof b.props.key === 'string' && b.props.key.startsWith('you-'))).toBe(true)

  await ui.press({ key: 'you-copy' })
  await ui.press({ key: 'you-edit' })

  expect(copies).toEqual(['line one\nline two'])
  expect(fills).toEqual(['line one\nline two'])
})

test('the hover row says how long ago a prompt was sent', async ($, on) => {
  const w = world(on)
  const clock = { now: 100 * 60_000 }

  on('clock.now', () => ({ value: clock.now }))
  on('prompt.submit', (_, e) => ({ text: e.text }) as never)
  await $.session.start(START)
  await $.prompt.submit({ text: 'sent earlier' } as never)
  expect(w.kept.get('sent')).toEqual({ 'sent earlier': 100 * 60_000 })

  clock.now += 5 * 60_000
  const row = (text: string) =>
    $.ui.mount({
      plugin: PLUGIN,
      surface: 'desktop',
      component: 'UserMessage',
      props: { text, origin: { kind: 'composer' }, isExpanded: true },
    })

  expect(await (await row('sent earlier')).find({ type: 'Text', text: '5 minutes ago' })).toBeDefined()
  // A prompt cozy never saw sent shows no time.
  expect(await (await row('from before')).find({ type: 'Text', text: /ago|just now/ })).toBeUndefined()
})
