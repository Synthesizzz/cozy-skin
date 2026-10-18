import { atom, read } from 'claude-code'
import type { MatchedHook } from 'claude-code'
import { resolveColor } from './colors'
import { presetOf } from './presets'
import { hasImage } from './prompt-images'
import { agoLabel, sentAt } from './prompt-times'
import { LIVE_INIT } from './settings'

// The `live` atom (see LIVE_INIT in settings.ts). The validator reads a read
// only where the atom is declared in the same file.
const settingsAtom = atom({ plugin: 'cozy-skin', key: 'live' } as const, LIVE_INIT)

// The prompts sent with an image (see prompt-images.ts).
const imagesAtom = atom({ plugin: 'cozy-skin', key: 'images' } as const, [] as string[])

// When each prompt was sent, and the minute tick that redraws the time (see
// prompt-times.ts and the tick in register.tsx).
const sentAtom = atom({ plugin: 'cozy-skin', key: 'sent' } as const, {} as Record<string, number>)
const minuteAtom = atom({ plugin: 'cozy-skin', key: 'minute' } as const, 0)

type DrawPromptHook = MatchedHook<'ui.render', { component: 'UserMessage' }>

// The person's own prompt, in the colour they picked or else the preset's
// own ink, on its paper. Notifications and other parties' messages, a compact
// row, and a prompt sent with an image (whose picture only the engine's row
// can show) stay as the engine draws them.
export async function drawPrompt($: Parameters<DrawPromptHook>[0], e: Parameters<DrawPromptHook>[1], next: Parameters<DrawPromptHook>[2]) {
  const live = await read($, settingsAtom)
  const { settings } = live
  const picked = settings.colors.you
  const look = presetOf(settings.preset)?.[live.mode]

  if (!settings.enabled || look === undefined) {
    return next(e)
  }
  if (e.props.task !== undefined || e.props.from !== undefined || !e.props.isExpanded) {
    return next(e)
  }
  // The person asked for the app's own bubble (`/cozy bubble app`), for what
  // only it has. The terminal has no bubble, so its line stays cozy's.
  if (e.surface === 'desktop' && settings.bubble === 'app') {
    return next(e)
  }
  if (hasImage(e.props.text, await read($, imagesAtom))) {
    return next(e)
  }

  const { Box, Button, Text } = $.ui.resolve(e)
  const color = picked === null ? look.palette.fg : resolveColor(picked, live.mode)
  const mark = settings.icons === 'ascii' ? '>' : '›'
  const p = look.palette

  // The desktop draws a prompt as a rounded bubble on the right: keep that
  // shape, on the preset's paper (`bg`), which every named shade reads on.
  // The API has no corner radius: a round border in the fill's own colour
  // gives the corners without a visible line. Spacing is in steps, so it
  // follows the app's scale, tuned against a screenshot of the default: the
  // bubble at most ~80% wide (an empty 20% beside it, as there is no
  // maxWidth), its right edge in line with the reply text, more room below.
  // The terminal keeps its line.
  //
  // Drawing the bubble replaces the app's, and with it the app's actions
  // under it. How long ago it was sent, Copy and Edit come back in a dim row
  // of our own, shown while the pointer is on the row, as the app's are: out
  // of the flow, in the row's own bottom padding (not a margin), so showing
  // it moves nothing and moving the pointer onto it keeps the row hovered.
  // The desktop lets no one select text a mod draws in this row, nor gives it
  // the app's right-click menu (checked 2026-10-18 with a text-only bubble),
  // so the keyed, hovered row costs nothing there.
  // The glyphs are plain Buttons, as a Button holds text alone (no SVG icon).
  // Edit puts the prompt in the prompt box; the app's Rewind has no call a
  // mod can make, so it has no button here.
  if (e.surface === 'desktop') {
    const text = e.props.text
    // Read the tick so the row redraws each minute; the time itself is the clock's.
    await read($, minuteAtom)
    const then = sentAt(await read($, sentAtom), text)
    const ago = then === undefined ? null : agoLabel(await $.clock.now(), then)
    const copy = async (pressed: { surface: string }) => {
      const result = await $.ui.copy({ text, surface: pressed.surface as typeof e.surface })

      $.ui.toast(result.isCopied ? 'Copied' : `Not copied (${result.reason})`)
    }
    const edit = async () => {
      const result = await $.prompt.fill({ text, mode: 'replace' })

      if (!result.isFilled) {
        $.ui.toast(`Not put in the prompt box (${result.refusal ?? 'refused'})`)
      }
    }
    const action = (key: string, glyph: string, name: string, onPress: (pressed: { surface: string }) => Promise<void>) => (
      <Button key={key} label={settings.icons === 'ascii' ? name : glyph} plain dimColor onPress={pressed => void onPress(pressed)} />
    )

    return (
      <Box key={`you-${hashOf(text)}`} flexDirection="row" justifyContent="flex-end" marginRight="lg" paddingBottom="xl">
        <Box width="20%" flexShrink={0} />
        <Box flexShrink={1} borderStyle="round" borderColor={p.bg} backgroundColor={p.bg} paddingX="lg" paddingY="sm">
          <Text color={color} backgroundColor={p.bg} wrap="wrap">
            {text}
          </Text>
        </Box>
        <Box position="absolute" bottom={0} right={0} flexDirection="row" gap="md" display="none" hover={{ display: 'flex' }}>
          {ago === null ? null : (
            <Text key="you-ago" dimColor>
              {ago}
            </Text>
          )}
          {action('you-copy', '⧉', 'Copy', copy)}
          {action('you-edit', '✎', 'Edit', edit)}
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="row" gap={1}>
      <Text color={look.palette.muted}>{mark}</Text>
      <Text color={color} wrap="wrap">
        {e.props.text}
      </Text>
    </Box>
  )
}

// A short, stable name for a prompt's row, so each bubble keys its own hover.
function hashOf(text: string) {
  let h = 5381

  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0
  }

  return (h >>> 0).toString(36)
}
