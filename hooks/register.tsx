import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import { applyTheme, describe, parseTheme } from './command'
import { readWindowsLight, resolveMode } from './mode'
import { PRESETS } from './presets'
import type { Mode } from './presets'
import { LIVE_INIT, SETTINGS_KEY, sane } from './settings'
import type { Settings } from './settings'
import { drawDone, drawSpinner, trackTurn } from './spinner'
import { drawReply } from './table-render'
import { installFragment, switchHint } from './terminal'
import { PANE, drawPane } from './pane'
import { drawPrompt } from './user-render'
import { drawToolGroup, drawToolUse } from './tool-render'
import { IMAGES_KEY, remember, saneImages } from './prompt-images'
import { SENT_KEY, mergeSent, parseTranscriptTimes, rememberSent, saneSent, transcriptPath } from './prompt-times'

// The live switch is not possible from a mod (see switchHint), so the reply hands over a line to paste.
const hintFor = (settings: Settings, mode: Mode): string => switchHint(settings.preset, mode, settings.enabled)

// The `live` atom (see LIVE_INIT in settings.ts). The validator reads a write
// only where the atom is declared in the same file.
const settingsAtom = atom({ plugin: 'cozy-skin', key: 'live' } as const, LIVE_INIT)

// The prompts sent with an image (see prompt-images.ts), read by the bubble.
const imagesAtom = atom({ plugin: 'cozy-skin', key: 'images' } as const, [] as string[])

// When each prompt was sent (see prompt-times.ts), and the clock's minute,
// both read by the bubble.
const sentAtom = atom({ plugin: 'cozy-skin', key: 'sent' } as const, {} as Record<string, number>)
const minuteAtom = atom({ plugin: 'cozy-skin', key: 'minute' } as const, 0)

// `/cozy`, not `/theme`: Claude Code has a built-in `/theme` and refuses its name.
const COMMAND = 'cozy'

// Claude Code's built-in light and dark themes, as the `theme` row names them.
const BUILT_IN: Record<Mode, string> = { light: 'light', dark: 'dark' }

// One of the plugin's own theme files, by slug or under a prefixed id.
const COZY_THEME = /(^|:)cozy-([a-z]+(?:-[a-z]+)*)-(light|dark)$/

// The send times of the prompts in this session's transcript, merged into the
// kept ones, so a prompt sent before cozy noted it still shows its time. The
// transcript can be past what one read may take, so a script picks the
// prompts out. Any failure leaves the times as they were.
async function fillFromTranscript($: EngineInterface): Promise<void> {
  try {
    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))

    if (home === undefined) {
      return
    }
    const path = transcriptPath(home, await $.session.cwd(), await $.session.id())

    if (!(await $.fs.exists(path))) {
      return
    }
    const out = await $.process.run(
      ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/tools/prompt-times.ps1`, '-Path', path],
      { timeoutMs: 20000 },
    )
    const found = out.exitCode === 0 ? parseTranscriptTimes(out.stdout) : []

    if (found.length === 0) {
      return
    }
    const merged = mergeSent(await read($, sentAtom), found)

    await update($, sentAtom, () => merged)
    await $.store.set(SENT_KEY, merged)
  } catch {
    // Older prompts show no time.
  }
}

// The theme to keep as the person's own. Never one of the plugin's, or
// `/cozy off` would "restore" a cozy theme: a cozy id stands for its base.
function ownTheme(current: string): string {
  const found = COZY_THEME.exec(current)

  return found === null ? current : BUILT_IN[found[3] as Mode]
}

// The plugin's own theme file for a preset and mode, when Claude Code lists it:
// by its slug, or under any id that ends in ":<slug>". Otherwise the built-in.
function pickTheme(options: readonly string[] | undefined, preset: string, mode: Mode): string {
  const slug = `cozy-${preset}-${mode}`

  return options?.find(o => o === slug || o.endsWith(`:${slug}`)) ?? BUILT_IN[mode]
}

// Every theme sync and settings write runs one after another on this chain.
// It orders work only inside one module instance: the engine does not keep
// module state between hook calls. So each task re-reads the store first and
// the store, not this chain, is the source of truth.
let chain: Promise<unknown> = Promise.resolve()

function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task)

  chain = run.catch(() => undefined)
  return run
}

type Synced = { settings: Settings; note: string | null }

// Moves Claude Code's own theme with the skin and puts it back on `off`. A
// `/cozy <preset>` or `/cozy <mode>` takes the theme over. The session-start
// sync (`isFollow`) moves it only once a `/cozy` has taken it over and while it
// is still the one the skin last set. A denied or unavailable change is a
// note, never an error.
async function syncTheme($: EngineInterface, settings: Settings, mode: Mode, isFollow: boolean): Promise<Synced> {
  if (isFollow && (!settings.enabled || settings.savedTheme === null || settings.appliedTheme === null)) {
    return { settings, note: null }
  }

  let row: { value: unknown; options?: readonly string[] } | undefined

  try {
    row = (await $.config.list()).find(r => r.key === 'theme')
  } catch {
    row = undefined
  }
  if (row === undefined) {
    return { settings, note: 'Claude Code theme: the setting could not be read, so it was left alone.' }
  }

  const current = String(row.value)

  if (isFollow && current !== settings.appliedTheme) {
    return { settings, note: null }
  }

  const wanted = settings.enabled ? pickTheme(row.options, settings.preset, mode) : settings.savedTheme
  const after: Settings = settings.enabled
    ? { ...settings, savedTheme: settings.savedTheme ?? ownTheme(current), appliedTheme: wanted }
    : { ...settings, savedTheme: null, appliedTheme: null }
  // A built-in theme picked for an enabled skin means the plugin's own was not listed.
  const fallback =
    settings.enabled && wanted !== null && !COZY_THEME.test(wanted)
      ? `Claude Code theme: cozy-${settings.preset}-${mode} is not in its theme list, so the built-in "${wanted}" theme is used instead.`
      : null

  if (wanted === null || wanted === current) {
    return { settings: after, note: fallback }
  }
  if (row.options !== undefined && !row.options.includes(wanted)) {
    return { settings, note: `Claude Code theme: "${wanted}" is not one of its themes, so it was left alone.` }
  }

  const result = await $.config.set({ key: 'theme', value: wanted }).catch((error: unknown) => ({
    deny: messageOf(error),
  }))

  if (result.deny !== undefined) {
    return { settings, note: `Claude Code theme was not changed: ${result.deny}` }
  }

  return { settings: after, note: fallback }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function keep($: EngineInterface, settings: Settings, mode: Mode): Promise<void> {
  await $.store.set(SETTINGS_KEY, settings)
  await update($, settingsAtom, () => ({ settings, mode }))
  $.ui.invalidate('ui.render')
}

async function runCozy($: EngineInterface, args: string): Promise<{ text: string }> {
  const action = parseTheme(args)

  if (action.kind === 'error') {
    return { text: action.message }
  }
  if (action.kind === 'show') {
    const live = await read($, settingsAtom)

    return { text: [describe(live.settings, live.mode), hintFor(live.settings, live.mode)].filter(Boolean).join('\n') }
  }
  if (action.kind === 'terminal-install') {
    return { text: await installFragment($, PRESETS) }
  }
  if (action.kind === 'panel') {
    const opened = await $.ui.open({ id: PANE, title: 'cozy-skin', focus: true })

    return { text: opened.isPlaced ? 'cozy-skin panel opened.' : `cozy-skin panel is waiting: ${opened.reason}` }
  }

  // A preset or a mode moves Claude Code's theme, `off` puts it back, the rest never touch it.
  const moved = action.kind === 'preset' || action.kind === 'mode' || action.kind === 'off' || action.kind === 'on' || action.kind === 'look'

  return serial(async () => {
    const before = sane(await $.store.get(SETTINGS_KEY))

    if (action.kind === 'look' && before.looks[action.name] === undefined) {
      return { text: `No look named "${action.name}". Saved: ${Object.keys(before.looks).join(', ') || 'none yet'}.` }
    }
    const changed = applyTheme(before, action)
    const mode = resolveMode(changed.mode, changed.mode === 'auto' ? await readWindowsLight($) : null)
    const synced = moved ? await syncTheme($, changed, mode, false) : { settings: changed, note: null }

    await keep($, synced.settings, mode)

    // The paste line follows a change of preset, mode or switch, not a table or icon tweak.
    const hint = moved ? hintFor(synced.settings, mode) : ''

    return { text: [describe(synced.settings, mode), synced.note, hint].filter(Boolean).join('\n') }
  })
}

// The session-start sync, once Windows has answered: the mode follows it, and
// Claude Code's own theme too when the skin has taken it over.
function followWindows($: EngineInterface, light: boolean | null): Promise<void> {
  return serial(async () => {
    const stored = sane(await $.store.get(SETTINGS_KEY))

    if (stored.mode !== 'auto') {
      return
    }
    const mode = resolveMode('auto', light)
    const synced = await syncTheme($, stored, mode, true)

    if (synced.settings.appliedTheme !== stored.appliedTheme) {
      await $.store.set(SETTINGS_KEY, synced.settings)
    }
    await update($, settingsAtom, () => ({ settings: synced.settings, mode }))
    $.ui.invalidate('ui.render')
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // A refused name (a built-in's) must not stop the settings below from loading.
    try {
      await $.command.register({
        name: COMMAND,
        description: 'Switch the cozy-skin preset, mode, text colours and table style (/cozy panel to click)',
        argumentHint:
          '[<preset> | light | dark | auto | on | off | panel | color you|code <name>|#rrggbb|off | save|look|forget <name> | calm on|off | icons unicode|ascii | tables box|text|off | tools on|off | bubble cozy|app | terminal install]',
      })
    } catch {
      // The skin still draws: only the command is missing.
    }

    const settings = sane(await $.store.get(SETTINGS_KEY))
    const images = saneImages(await $.store.get(IMAGES_KEY).catch(() => undefined))

    await update($, imagesAtom, () => images)

    // Send times, and a tick that moves the bubbles' "5 minutes ago" on: only
    // the rows that read the minute redraw. Neither may hold the session up.
    try {
      const sent = saneSent(await $.store.get(SENT_KEY).catch(() => undefined))

      await update($, sentAtom, () => sent)
      await update($, minuteAtom, () => 0)
      $.clock.every(60_000, () => {
        void $.clock.now().then(now => update($, minuteAtom, () => Math.floor(now / 60_000))).catch(() => undefined)
      })
      // Prompts sent before cozy noted them: their times come from the
      // session's transcript, read in the background.
      void fillFromTranscript($)
    } catch {
      // The bubbles show no time; everything else draws.
    }

    // Dark until Windows answers; the answer must not hold the session up.
    await update($, settingsAtom, () => ({ settings, mode: resolveMode(settings.mode, null) }))
    if (settings.mode === 'auto') {
      void readWindowsLight($)
        .then(light => followWindows($, light))
        .catch(() => undefined)
    }

    return next(e)
  })

  // Tables and inline code in a reply, redrawn in the preset's colours. A
  // failure leaves the reply as the next hook draws it, under one dim line
  // that says why, so a silent fallback is never mistaken for a working one.
  on('ui.render', { component: 'AssistantMessage' }, drawReply).catch(async ($, e, next) => {
    const beneath = await next(e)

    try {
      const { Box, Text } = $.ui.resolve(e)

      return (
        <Box flexDirection="column">
          <Text dimColor>cozy-skin could not draw this reply: {next.error.message ?? next.error.kind}</Text>
          {beneath}
        </Box>
      )
    } catch {
      return beneath
    }
  })

  // The /cozy panel: colours, preset and mode as buttons, each press as the typed words.
  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => drawPane($, e, args => runCozy($, args))).catch(($, e, next) => {
    const { Text } = $.ui.resolve(e)

    return <Text dimColor>cozy-skin could not draw this panel: {next.error.message ?? next.error.kind}</Text>
  })

  // Tool rows get a dot in the preset's colour for their kind. A failure leaves
  // the row as the engine draws it (`next` replays the row already drawn).
  on('ui.render', { component: 'ToolUse' }, drawToolUse).catch((_, e, next) => next(e))
  on('ui.render', { component: 'ToolGroup' }, drawToolGroup).catch((_, e, next) => next(e))

  // A prompt sent with an image is remembered, so its row keeps the engine's
  // own bubble, which shows the picture. A failure never holds the prompt up.
  on('prompt.submit', async ($, e, next) => {
    // The send time, for the bubble's "5 minutes ago". The prompt still goes.
    try {
      const kept = rememberSent(await read($, sentAtom), e.text, await $.clock.now())

      await update($, sentAtom, () => kept)
      await $.store.set(SENT_KEY, kept)
    } catch {
      // The row shows no time.
    }
    if (e.attachments?.some(item => item.type === 'image') === true) {
      try {
        const kept = remember(await read($, imagesAtom), e.text)

        await update($, imagesAtom, () => kept)
        await $.store.set(IMAGES_KEY, kept)
        // The row is drawn as the prompt is sent, before this lands: draw it again.
        $.ui.invalidate('ui.render')
      } catch {
        // The row falls back to its text alone; the prompt still goes.
      }
    }
    return next(e)
  }).catch((_, e, next) => next(e))

  // The person's own prompts, in the colour they picked. A failure leaves the row as the engine draws it.
  on('ui.render', { component: 'UserMessage' }, drawPrompt).catch((_, e, next) => next(e))

  // The spinner and the turn footer say the preset's words. A failure leaves the row as the engine draws it.
  on('turn.start', trackTurn).catch(($, e, next) => (next.called ? undefined : next(e)))
  on('ui.render', { component: 'Spinner' }, drawSpinner).catch(($, e, next) => (next.called ? undefined : next(e)))
  on('ui.render', { component: 'TurnDuration' }, drawDone).catch(($, e, next) => (next.called ? undefined : next(e)))

  // A failure is the command's answer, never a thrown error.
  on('command.run', { command: COMMAND }, async ($, e) => {
    try {
      return await runCozy($, e.args)
    } catch (error) {
      return { text: `cozy-skin: ${messageOf(error)}` }
    }
  }).catch((_, e, next) => ({ text: `cozy-skin: ${next.error.message ?? next.error.kind}` }))
}
