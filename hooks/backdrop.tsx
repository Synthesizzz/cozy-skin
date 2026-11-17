// The desktop window in the preset's paper: cozy's backdrop, set as the
// session's theme and drawn behind the conversation with the app's own panels
// frosted over it. Only in mode auto: the app's own text follows Windows, so
// a paper picked by hand (light or dark) could sit under text of the other
// mode and not be read.
//
// One theme stands for the session, whichever plugin set it, and a clear
// wipes it whoever set it. So cozy clears only on the person's own /cozy or
// panel press, and only a theme it set itself since it loaded; it never
// clears at session start or on a reload.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Hook, MatchedHook, ThemeSetArgs, Timer } from 'claude-code'
import { fixedLook } from './fixed-look'
import { GLOW_SCENE, SPARKLE_MS, glowSvg, nextPhase, wantsGlow } from './glow'
import type { GlowEvent, GlowPhase } from './glow'
import { PRESETS, presetOf } from './presets'
import type { Mode } from './presets'
import { BACKDROP_NOTE_INIT, LIVE_INIT } from './settings'
import type { BackdropNote, Settings } from './settings'

// The `live` and `backdrop` atoms (see settings.ts). The validator reads a
// read or a write only where the atom is declared in the same file.
const settingsAtom = atom({ plugin: 'cozy-skin', key: 'live' } as const, LIVE_INIT)
const noteAtom = atom({ plugin: 'cozy-skin', key: 'backdrop' } as const, BACKDROP_NOTE_INIT)

// The name cozy gives its backdrop, which its Backdrop hook draws.
export const BACKDROP_ID = 'cozy-paper'

// How opaque the app's panels are over the paper: enough to read them, thin
// enough that the window still reads as one sheet.
const GLASS_OPACITY = 0.7

export const wantsBackdrop = (settings: Settings): boolean =>
  settings.enabled && settings.mode === 'auto' && settings.backdrop === 'paper'

// Mode light or dark: the whole app in the preset's palette of that mode, sent
// as a look that names that mode alone, which the desktop paints whatever its
// own appearance (it ignores `overrideColorScheme`). No paper or glow behind it
// yet: those stay in mode auto until the desktop is seen painting the look.
export const wantsFixedLook = (settings: Settings): boolean => settings.enabled && settings.mode !== 'auto'

// The glow, while it stands, takes the place of the still paper.
const wantsAny = (settings: Settings, mode: Mode): boolean => wantsBackdrop(settings) || wantsGlow(settings) || wantsFixedLook(settings)

// The glow's phase, kept so the drawing follows the turn: the write redraws it.
const glowAtom = atom({ plugin: 'cozy-skin', key: 'glow' } as const, { phase: 'idle' as GlowPhase })

// The one timer that ends a sparkle; a reload drops it and the next turn starts over.
let settleTimer: Timer | undefined

async function moveGlow($: EngineInterface, event: GlowEvent): Promise<void> {
  const { phase } = await read($, glowAtom)
  const next = nextPhase(phase, event)

  if (next !== phase) {
    await update($, glowAtom, () => ({ phase: next }))
  }
}

type GlowEndHook = Hook<'turn.complete'>

// Only the main loop's turn moves the glow, and only while a glow stands. The
// start is called from the one turn.start hook, which an event allows once.
export async function glowStart($: EngineInterface, e: { agentId?: string }): Promise<void> {
  const live = await read($, settingsAtom)

  if (e.agentId === undefined && wantsGlow(live.settings)) {
    settleTimer?.cancel()
    settleTimer = undefined
    await moveGlow($, 'start')
  }
}

export const glowEnd: GlowEndHook = async ($, e, next) => {
  const live = await read($, settingsAtom)

  if (e.agentId === undefined && wantsGlow(live.settings)) {
    await moveGlow($, e.reason === 'answer' ? 'answer' : e.reason)
    if (e.reason === 'answer') {
      settleTimer?.cancel()
      settleTimer = $.clock.after(SPARKLE_MS, () => void moveGlow($, 'settle').catch(() => undefined))
    }
  }
  return next(e)
}

export function paperOf(settings: Settings, mode: Mode): string {
  const preset = presetOf(settings.preset) ?? PRESETS[0]

  return preset === undefined ? '#ffffff' : preset[mode].palette.bg
}

// The panels frost in the paper itself, so the app's sidebar and prompt sit on
// the same tone a little denser; the scheme says which mode the paper is.
export function backdropArgs(settings: Settings, mode: Mode): ThemeSetArgs {
  if (wantsFixedLook(settings)) {
    const look = fixedLook(settings.preset, mode) ?? fixedLook(PRESETS[0]?.name ?? 'kindle', mode)

    return look === undefined ? {} : { colors: look.colors }
  }
  if (wantsGlow(settings)) {
    return { backdrop: { scene: GLOW_SCENE, glass: { tint: paperOf(settings, mode), opacity: GLASS_OPACITY } }, overrideColorScheme: mode }
  }
  return { backdrop: { scene: BACKDROP_ID, glass: { tint: paperOf(settings, mode), opacity: GLASS_OPACITY } }, overrideColorScheme: mode }
}

// The glows take the preset's accent in the mode shown.
function accentOf(settings: Settings, mode: Mode): string {
  const preset = presetOf(settings.preset) ?? PRESETS[0]

  return preset === undefined ? '#e8b98a' : preset[mode].palette.accent
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function note($: EngineInterface, next: BackdropNote): Promise<BackdropNote> {
  try {
    await update($, noteAtom, () => next)
  } catch {
    // /cozy shows the last note it read.
  }
  return next
}

// A module that has just loaded has no theme of its own standing: the one it
// set went with the module before it.
export function forgetBackdrop($: EngineInterface): Promise<BackdropNote> {
  return note($, BACKDROP_NOTE_INIT)
}

// Sets cozy's backdrop when it is wanted. When it is not, it clears the theme
// only where `isAsked` (the person's own command or press) and cozy set the
// one standing. What the app answered is kept for /cozy and the panel; a
// refused call is a note, never an error.
export async function syncBackdrop($: EngineInterface, settings: Settings, mode: Mode, isAsked: boolean): Promise<BackdropNote> {
  const before = await read($, noteAtom).catch(() => BACKDROP_NOTE_INIT)

  if (wantsAny(settings, mode)) {
    try {
      const result = await $.theme.set(backdropArgs(settings, mode))

      return note($, result.isDrawn ? { isDrawn: true, reason: null, isSet: true } : { isDrawn: false, reason: result.reason, isSet: true })
    } catch (error) {
      return note($, { isDrawn: false, reason: messageOf(error), isSet: false })
    }
  }
  if (!before.isSet || !isAsked) {
    return before
  }
  try {
    await $.theme.clear()
  } catch {
    // Cleared or not, cozy no longer asks for its paper.
  }
  return note($, BACKDROP_NOTE_INIT)
}

// What /cozy and the panel say about the backdrop.
export function backdropNote($: EngineInterface): Promise<BackdropNote> {
  return read($, noteAtom)
}

type DrawBackdropHook = MatchedHook<'ui.render', { component: 'Backdrop' }>

// Cozy's backdrop is one sheet of the preset's paper over the whole window;
// another plugin's is left to that plugin.
export const drawBackdrop: DrawBackdropHook = async ($, e, next) => {
  if (e.props.plugin === 'cozy-skin' && e.props.scene === GLOW_SCENE && e.surface === 'desktop') {
    const { Svg } = $.ui.resolve(e)
    const { phase } = await read($, glowAtom)
    const { settings, mode } = await read($, settingsAtom)

    return <Svg alt="Soft glows drifting on the preset paper" isInteractive source={glowSvg(phase, paperOf(settings, mode), accentOf(settings, mode))} />
  }
  if (e.props.plugin !== 'cozy-skin' || e.props.scene !== BACKDROP_ID) {
    return next(e)
  }
  const { Box } = $.ui.resolve(e)
  const { settings, mode } = await read($, settingsAtom)

  return <Box width="100%" height="100%" backgroundColor={paperOf(settings, mode)} />
}
