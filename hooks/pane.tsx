// The /cozy panel: every choice a button, the one in force primary. A press
// goes the way the typed `/cozy` words do. Top to bottom: the switch, the
// look (preset, mode, its palette), then the colours picked on top of it.

import { atom, read, update } from 'claude-code'
import type { MatchedHook, RenderChildren } from 'claude-code'
import { backdropNote } from './backdrop'
import { NAMED, isHex, resolveColor } from './colors'
import { backdropLine, parseTheme } from './command'
import { readable } from './contrast'
import { PRESETS, presetOf } from './presets'
import { backdropSample, bubbleSample, calmLine, iconsLine, tablesSample, toolsSample } from './samples'
import type { Sample } from './samples'
import type { Mode, Palette } from './presets'
import { LIVE_INIT } from './settings'
import type { Side } from './settings'

// The `live` atom (see LIVE_INIT in settings.ts). The validator reads a read
// only where the atom is declared in the same file.
const settingsAtom = atom({ plugin: 'cozy-skin', key: 'live' } as const, LIVE_INIT)

// What is typed in the panel's two fields and the last thing it had to say
// about it (a refused name or colour). Kept in an atom: a pane has no state of its own.
const draftAtom = atom({ plugin: 'cozy-skin', key: 'draft' } as const, { look: '', you: '', code: '', note: '', tab: 'look' as 'look' | 'colours' | 'details' })

export const PANE = 'cozy-skin'

// The e-reader looks; every other preset follows a VS Code theme.
const E_READER = ['kindle', 'sepia', 'paper']

// The looks built for reading comfort first: every text colour at 7:1.
const ACCESS = ['contrast']

// The palette slots shown as dots, in the order a reader meets them.
const DOTS: readonly (keyof Palette)[] = ['fg', 'muted', 'accent', 'ok', 'warn', 'err']

// A strip of dots on a pill of the preset's paper, as an SVG for the
// surfaces that draw vectors (the terminal gets text dots instead).
export function dotStrip(paper: string, colors: readonly string[]): { source: string; width: number; height: number } {
  const height = 16
  const width = 8 + colors.length * 14
  const dots = colors.map((color, i) => `<circle cx="${11 + i * 14}" cy="8" r="5" fill="${color}"/>`).join('')

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="8" fill="${paper}"/>${dots}</svg>`,
    width,
    height,
  }
}

// A preset's card: a little page in its own colours, with an "Aa" in a book
// face for the e-reader looks and a code face for the editor themes, three
// lines of text and the palette as dots. The one in force gets a tick and an
// accent edge.
export function presetCard(look: Palette, isBook: boolean, isOn: boolean): { source: string; width: number; height: number } {
  const width = 120
  const height = 50
  const face = isBook ? "Georgia, 'Iowan Old Style', serif" : "'Cascadia Code', Consolas, monospace"
  const edge = isOn
    ? `stroke="${look.accent}" stroke-width="2"`
    : `stroke="${look.fg}" stroke-opacity="0.18" stroke-width="1"`
  const lines = (
    [
      [11, 42, look.accent],
      [19, 60, look.fg],
      [27, 34, look.muted],
    ] as const
  )
    .map(([y, w, color]) => `<rect x="44" y="${y}" width="${w}" height="4" rx="2" fill="${color}"/>`)
    .join('')
  const dots = DOTS.map((slot, i) => `<circle cx="${12 + i * 9}" cy="40" r="2.5" fill="${look[slot] ?? look.fg}"/>`).join('')
  const tick = isOn
    ? `<circle cx="${width - 12}" cy="39" r="6" fill="${look.accent}"/><path d="M${width - 15} 39 l2 2.2 l4 -4.4" fill="none" stroke="${look.bg}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
    : ''

  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="8" fill="${look.bg}" ${edge}/>` +
      `<text x="10" y="29" font-family="${face}" font-size="19" fill="${look.fg}">Aa</text>` +
      `${lines}${dots}${tick}</svg>`,
    width,
    height,
  }
}

// A small picture of what the look draws, in its own colours: your prompt in
// its bubble on the right, a reply line with an inline code chip, and a table
// with its header band and a striped row. `you` and `code` are the inks the
// panel resolved (picked, or the preset's own).
export function lookPreview(look: Palette, you: string, code: string): { source: string; width: number; height: number } {
  const width = 264
  const height = 128
  const ink = readable(look.fg, look.bg)
  const chipInk = readable(code, look.bg)
  const youInk = readable(you, look.bg)
  const head = readable(look.fg, look.surface)
  const font = "font-family=\"Segoe UI, system-ui, sans-serif\" font-size=\"11\""
  const mono = "font-family=\"Cascadia Code, Consolas, monospace\" font-size=\"10.5\""
  const table = [
    `<rect x="12" y="66" width="240" height="50" rx="6" fill="${look.bg}" stroke="${look.line}"/>`,
    `<path d="M12 78 v-6 a6 6 0 0 1 6 -6 h228 a6 6 0 0 1 6 6 v6 z" fill="${look.surface}"/>`,
    `<text x="22" y="76" ${font} font-weight="600" fill="${head}">Project</text>`,
    `<text x="242" y="76" ${font} font-weight="600" fill="${head}" text-anchor="end">Budget</text>`,
    `<text x="22" y="92" ${font} fill="${ink}">Q3 Report</text>`,
    `<text x="242" y="92" ${font} fill="${ink}" text-anchor="end">$12,400</text>`,
    `<rect x="13" y="97" width="238" height="16" fill="${look.zebra}"/>`,
    `<text x="22" y="108" ${font} fill="${readable(look.fg, look.zebra)}">Audit</text>`,
    `<text x="242" y="108" ${font} fill="${readable(look.fg, look.zebra)}" text-anchor="end">$3,150</text>`,
  ].join('')

  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="10" fill="${look.bg}" stroke="${look.fg}" stroke-opacity="0.15"/>` +
      // Text widths are pinned with textLength: a face wider than expected
      // squeezes into its place instead of running into the next word.
      `<rect x="122" y="10" width="130" height="22" rx="11" fill="${look.surface}"/>` +
      `<text x="242" y="25" ${font} fill="${readable(you, look.surface)}" text-anchor="end" textLength="104" lengthAdjust="spacingAndGlyphs">Show me the budget</text>` +
      `<text x="12" y="52" ${font} fill="${ink}" textLength="20" lengthAdjust="spacingAndGlyphs">Run</text>` +
      `<rect x="36" y="41" width="42" height="15" rx="2" fill="#80808030"/>` +
      `<text x="40" y="52" ${mono} fill="${chipInk}" textLength="34" lengthAdjust="spacingAndGlyphs">/cozy</text>` +
      `<text x="84" y="52" ${font} fill="${ink}" textLength="88" lengthAdjust="spacingAndGlyphs">then pick a look.</text>` +
      table +
      '</svg>',
    width,
    height,
  }
}

type DrawPaneHook = MatchedHook<'ui.render', { component: 'Pane'; requestId: string }>

// What a press runs: the same as typing `/cozy <args>`.
export type Choose = (args: string) => Promise<unknown>

// The line under the Mode buttons. The desktop window follows the app's own
// light or dark and ignores a scheme a plugin asks for, so a fixed mode there
// colours only what cozy draws and the terminal; the line says so, or light and
// dark would look alike with no word why (Decisions 2026-11-17).
export function modeNote(setting: Mode | 'auto', mode: Mode, surface: string): string | undefined {
  if (setting === 'auto') {
    return `Follows the app's own light or dark theme (now ${mode}).`
  }
  if (surface !== 'desktop') {
    return undefined
  }
  const name = setting === 'light' ? 'Light' : 'Dark'

  return `${name} colours what cozy draws: your bubble, tables and tool rows, and the terminal. The window keeps the app's own light or dark: change it in the app's settings, then pick auto to follow it with cozy's paper.`
}

export async function drawPane($: Parameters<DrawPaneHook>[0], e: Parameters<DrawPaneHook>[1], choose: Choose) {
  const els = $.ui.resolve(e)
  const { Box, Text, Button } = els
  // Only surfaces that take typing have an Input; elsewhere the fields are left out.
  const Input = 'Input' in els ? els.Input : undefined
  const draft = await read($, draftAtom)
  const setDraft = (next: Partial<typeof draft>) => update($, draftAtom, d => ({ ...d, ...next })).then(() => $.ui.invalidate('ui.render'))
  // A press runs the choice, then says under the header what the app answered
  // that the buttons do not show: a refused theme change, a fallback, a failure.
  const press = (args: string) =>
    choose(args)
      .then(result => {
        const notes = typeof result === 'object' && result !== null && 'notes' in result && typeof result.notes === 'string' ? result.notes : ''

        return setDraft({ note: notes })
      })
      .catch((error: unknown) => setDraft({ note: `cozy-skin: ${error instanceof Error ? error.message : String(error)}` }))
  // A typed name or colour goes the way the typed words did; a refusal is said under the header.
  const submit = async (field: 'look' | 'you' | 'code', text: string) => {
    const value = text.trim().toLowerCase()
    const words = field === 'look' ? `save ${value}` : `color ${field} ${value}`
    const parsed = parseTheme(words)

    if (value === '') {
      return
    }
    if (parsed.kind === 'error') {
      await setDraft({ note: parsed.message.replace(/ Use \/cozy to open the panel\.$/, '') })
      return
    }
    await press(words)
    await setDraft({ [field]: '' })
  }
  const isVector = e.surface !== 'terminal'
  const { settings, mode } = await read($, settingsAtom)
  // Only the desktop draws a backdrop, so only its panel offers one.
  const drawn = e.surface === 'desktop' ? await backdropNote($).catch(() => undefined) : undefined
  const dot = settings.icons === 'ascii' ? '#' : '●'
  const preset = PRESETS.find(p => p.name === settings.preset) ?? PRESETS[0]
  const p = preset === undefined ? undefined : preset[mode].palette

  const pick = (key: string, label: string, isOn: boolean, args: string, color?: string) => (
    <Button key={key} label={label} variant={isOn ? 'primary' : 'secondary'} onPress={() => void press(args)}>
      {color === undefined ? (
        <Text>{label}</Text>
      ) : (
        <Text>
          <Text color={color}>{dot}</Text>
          {` ${label}`}
        </Text>
      )}
    </Button>
  )
  // A section: its heading and note close together, then a little room before
  // the buttons, which wrap with room between rows as well as between buttons.
  const group = (heading: string, picks: RenderChildren, note?: string) => (
    <Box flexDirection="column" gap="xs">
      <Box flexDirection="column">
        <Text weight="semibold">{heading}</Text>
        {note === undefined ? null : <Text dimColor>{note}</Text>}
      </Box>
      <Box columnGap="sm" rowGap="sm" flexWrap="wrap" paddingTop="xs">
        {picks}
      </Box>
    </Box>
  )
  // The palette as dots: an SVG strip where vectors draw, coloured text dots in the terminal.
  const strip = (key: string, paper: string, colors: readonly string[]) => {
    if (e.surface === 'terminal') {
      return (
        <Text key={key}>
          {colors.map(color => (
            <Text color={color}>{dot}</Text>
          ))}
        </Text>
      )
    }
    // Svg exists only where vectors draw, so it is resolved past the terminal check.
    const { Svg } = $.ui.resolve(e)
    const drawn = dotStrip(paper, colors)

    return <Svg key={key} source={drawn.source} alt="palette" width={drawn.width} height={drawn.height} />
  }
  // The colour each side shows: the one picked, else the preset's own (its
  // ink for your text, its accent for inline code).
  const picked = (side: Side): string | null => {
    const value = settings.colors[side]

    if (value !== null) {
      return resolveColor(value, mode)
    }
    return p === undefined ? null : side === 'you' ? p.fg : p.accent
  }
  // The look as it draws, where vectors draw; the terminal keeps its dots.
  const previewOf = (look: Palette) => {
    if (e.surface === 'terminal') {
      return null
    }
    // Svg exists only where vectors draw, so it is resolved past the terminal check.
    const { Svg } = $.ui.resolve(e)
    const drawn = lookPreview(look, picked('you') ?? look.fg, picked('code') ?? look.accent)

    return <Svg key="look-preview" source={drawn.source} alt="A preview of the look" width={drawn.width} height={drawn.height} />
  }
  const colours = (side: Side, heading: string, note: string) => {
    const current = settings.colors[side]
    const custom = current !== null && isHex(current) ? current : null

    return group(
      heading,
      [
        pick(`${side}-default`, 'preset', current === null, `color ${side} off`),
        ...Object.keys(NAMED).map(name =>
          pick(`${side}-${name}`, name, current === name, `color ${side} ${name}`, resolveColor(name, mode)),
        ),
        ...(custom === null ? [] : [pick(`${side}-custom`, custom, true, `color ${side} ${custom}`, custom)]),
      ],
      note,
    )
  }
  // Each preset is a card in its own colours with its button beneath; the
  // cards share one width, so the shelf lines up in columns.
  const presetPick = (names: readonly string[]) =>
    PRESETS.filter(x => names.includes(x.name)).map(x => {
      const look = x[mode].palette
      const isOn = settings.enabled && settings.preset === x.name
      const button = pick(`preset-${x.name}`, x.label, isOn, x.name, isVector ? undefined : look.accent)

      if (!isVector) {
        return button
      }
      // Svg exists only where vectors draw, so it is resolved past the terminal check.
      const { Svg } = $.ui.resolve(e)
      const card = presetCard(look, E_READER.includes(x.name), isOn)

      return (
        <Box key={`preset-box-${x.name}`} flexDirection="column" alignItems="center" gap="xs">
          <Svg key={`preset-card-${x.name}`} source={card.source} alt={`${x.label} ${mode}`} width={card.width} height={card.height} />
          {button}
        </Box>
      )
    })
  // One shelf of preset cards under a small caption: two to a row where
  // cards draw, whatever the panel's width; the terminal's buttons just wrap.
  const shelf = (caption: string, names: readonly string[]) => {
    const picks = presetPick(names)
    const rows = isVector
      ? Array.from({ length: Math.ceil(picks.length / 2) }, (_, i) => (
          <Box key={`${caption}-row-${i}`} columnGap="md">
            {picks.slice(i * 2, i * 2 + 2)}
          </Box>
        ))
      : [
          <Box key={`${caption}-row`} columnGap="sm" rowGap="sm" flexWrap="wrap">
            {picks}
          </Box>,
        ]

    return (
      <Box flexDirection="column" gap="sm">
        <Text size="caption" dimColor>
          {caption}
        </Text>
        {rows}
      </Box>
    )
  }

  // One line per small setting: its name, then its buttons. A note shows only
  // when it has something to say about the choice in force.
  const row = (label: string, picks: RenderChildren, note?: string, extra?: RenderChildren) => (
    <Box key={`row-${label}`} flexDirection="column">
      <Box columnGap="md" rowGap="xs" alignItems="center" flexWrap="wrap">
        <Text weight="semibold">{label}</Text>
        <Box columnGap="sm" rowGap="xs" flexWrap="wrap">
          {picks}
        </Box>
      </Box>
      {note === undefined ? null : <Text dimColor>{note}</Text>}
      {extra === undefined ? null : <Box paddingTop="xs">{extra}</Box>}
    </Box>
  )
  // A picture of what a setting does, in the look in force; the terminal draws none.
  const sampleSvg = (alt: string, made: Sample) => {
    if (!isVector) {
      return undefined
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg key={alt} source={made.source} alt={alt} width={made.width} height={made.height} />
  }
  const sampleText = (key: string, text: string) => <Text key={key} dimColor>{text}</Text>
  const tab = (key: 'look' | 'colours' | 'details', label: string) => (
    <Button key={`tab-${key}`} label={label} variant={draft.tab === key ? 'primary' : 'secondary'} onPress={() => void setDraft({ tab: key })}>
      <Text>{label}</Text>
    </Button>
  )

  const lookTab = (
    <Box flexDirection="column" gap="lg">
      {row('Skin', [pick('skin-on', 'on', settings.enabled, 'on'), pick('skin-off', 'off', !settings.enabled, 'off')], settings.enabled ? undefined : 'Off: cozy-skin draws nothing until it is on again.')}
      <Box flexDirection="column" gap="sm">
        <Box flexDirection="column">
          <Text weight="semibold">Preset</Text>
          <Text dimColor>
            {settings.enabled && preset !== undefined ? `In use: ${preset.label}, ${mode}.` : 'Pick one to turn the skin on.'}
          </Text>
        </Box>
        {shelf('E-reader · paper tones for long reading', E_READER)}
        {shelf(
          'VS Code themes · popular editor palettes',
          PRESETS.map(x => x.name).filter(name => !E_READER.includes(name) && !ACCESS.includes(name)),
        )}
        {shelf('Accessibility · every text colour at 7:1 (WCAG AAA)', ACCESS)}
      </Box>
      {row(
        'Mode',
        (['light', 'dark', 'auto'] as const).map(m => pick(`mode-${m}`, m, settings.enabled && settings.mode === m, m)),
        modeNote(settings.mode, mode, e.surface),
      )}
      {p === undefined || preset === undefined ? null : (
        <Box flexDirection="column" gap="xs">
          <Text weight="semibold">{`Palette · ${preset.label} ${mode}`}</Text>
          {isVector ? previewOf(p) : null}
          <Box columnGap="md" alignItems="center" paddingTop="xs">
            {strip('palette-preset', p.bg, DOTS.map(slot => p[slot] ?? p.fg))}
            <Text dimColor>
              {(['you', 'code'] as const).map(side => (
                <Text>
                  <Text color={picked(side) ?? undefined} dimColor={picked(side) === null}>
                    {picked(side) === null ? '○' : dot}
                  </Text>
                  {side === 'you' ? ' your text  ' : ' inline code'}
                </Text>
              ))}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  )

  const coloursTab = (
    <Box flexDirection="column" gap="lg">
      {colours('you', 'Your text', "Your messages, on the preset's paper: its ink, or a colour of your own.")}
      {colours('code', 'Inline code', "Code inside Claude's sentences, like `this`: the preset's accent, or a colour of your own.")}
      {group(
        'Your looks',
        Object.entries(settings.looks).map(([name, look]) =>
          pick(
            `look-${name}`,
            name,
            settings.enabled &&
              look.preset === settings.preset &&
              look.mode === settings.mode &&
              look.colors.you === settings.colors.you &&
              look.colors.code === settings.colors.code,
            `look ${name}`,
            presetOf(look.preset)?.[mode].palette.accent,
          ),
        ),
        Object.keys(settings.looks).length === 0
          ? 'Save the preset, mode and colours you have now under a name.'
          : 'A preset, a mode and your colours, as saved. ✕ drops one.',
      )}
      {Object.keys(settings.looks).length === 0 ? null : row('Forget', Object.keys(settings.looks).map(name => pick(`forget-${name}`, `✕ ${name}`, false, `forget ${name}`)))}
      {Input === undefined ? null : (
        <Box flexDirection="column" gap="sm">
          <Input key="look-name" label="Save as" placeholder="a name: night-work" value={draft.look} onInput={(v: string) => void setDraft({ look: v })} onSubmit={(v: string) => void submit('look', v)} />
          <Input key="color-you" label="Your text" placeholder="any colour: #rrggbb" value={draft.you} onInput={(v: string) => void setDraft({ you: v })} onSubmit={(v: string) => void submit('you', v)} />
          <Input key="color-code" label="Inline code" placeholder="any colour: #rrggbb" value={draft.code} onInput={(v: string) => void setDraft({ code: v })} onSubmit={(v: string) => void submit('code', v)} />
        </Box>
      )}
    </Box>
  )

  const detailsTab = (
    <Box flexDirection="column" gap="md">
      {row('Calm', [pick('calm-on', 'on', settings.calm, 'calm on'), pick('calm-off', 'off', !settings.calm, 'calm off')], undefined, sampleText('calm-sample', calmLine(preset?.[mode].spinner ?? [], settings.calm, settings.icons === 'ascii')))}
      {row('Icons', [
        pick('icons-unicode', 'unicode', settings.icons === 'unicode', 'icons unicode'),
        pick('icons-ascii', 'ascii', settings.icons === 'ascii', 'icons ascii'),
      ], undefined, sampleText('icons-sample', iconsLine(settings.icons === 'ascii')))}
      {row(
        'Tables',
        [
          pick('tables-on', 'grid', settings.tables === 'box', 'tables box'),
          pick('tables-text', 'text', settings.tables === 'text', 'tables text'),
          pick('tables-off', 'off', settings.tables === 'off', 'tables off'),
        ],
        settings.tables === 'off' ? "Claude Code draws tables its own way, with no Copy, CSV or XLSX." : undefined,
        p === undefined ? undefined : sampleSvg('tables sample', tablesSample(p, settings.tables)),
      )}
      {row('Tool rows', [pick('tools-on', 'on', settings.tools === 'on', 'tools on'), pick('tools-off', 'off', settings.tools === 'off', 'tools off')], undefined, p === undefined ? undefined : sampleSvg('tools sample', toolsSample(p, settings.tools === 'on', settings.icons === 'ascii')))}
      {row(
        'Your bubble',
        [
          pick('bubble-cozy', 'cozy', settings.bubble === 'cozy', 'bubble cozy'),
          pick('bubble-app', 'app', settings.bubble === 'app', 'bubble app'),
        ],
        settings.bubble === 'app'
          ? "Claude Code's own bubble: Rewind, Fork, text selection."
          : 'Cozy has no Rewind, Fork or text selection: pick app for those.',
        p === undefined ? undefined : sampleSvg('bubble sample', bubbleSample(p, settings.bubble)),
      )}
      {e.surface !== 'desktop'
        ? null
        : row(
            'Backdrop',
            [
              pick('backdrop-off', 'off', settings.backdrop === 'off', 'backdrop off'),
              pick('backdrop-paper', 'paper', settings.backdrop === 'paper', 'backdrop paper'),
              pick('backdrop-glow', 'glow', settings.backdrop === 'glow', 'backdrop glow'),
            ],
            settings.backdrop === 'off'
              ? "The window on the preset's paper (glow: soft glows that drift and brighten while Claude works). Mode auto only."
              : backdropLine(settings, drawn ?? { isDrawn: false, reason: null, isSet: false }).replace(/^Backdrop: (paper|glow) /, (_, kind: string) => `${kind[0]?.toUpperCase()}${kind.slice(1)} `),
            p === undefined ? undefined : sampleSvg('backdrop sample', backdropSample(p, settings.backdrop)),
          )}
    </Box>
  )

  return (
    <Box flexDirection="column" gap="lg" padding="sm">
      {draft.note === '' ? null : <Text dimColor>{draft.note}</Text>}
      <Box columnGap="sm" rowGap="sm" flexWrap="wrap">
        {tab('look', 'Look')}
        {tab('colours', 'Colours')}
        {tab('details', 'Details')}
      </Box>
      {draft.tab === 'colours' ? coloursTab : draft.tab === 'details' ? detailsTab : lookTab}
    </Box>
  )
}
