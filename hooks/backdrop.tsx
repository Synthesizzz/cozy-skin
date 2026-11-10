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
import type { EngineInterface, MatchedHook, ThemeSetArgs } from 'claude-code'
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

export function paperOf(settings: Settings, mode: Mode): string {
  const preset = presetOf(settings.preset) ?? PRESETS[0]

  return preset === undefined ? '#ffffff' : preset[mode].palette.bg
}

// The panels frost in the paper itself, so the app's sidebar and prompt sit on
// the same tone a little denser; the scheme says which mode the paper is.
export function backdropArgs(settings: Settings, mode: Mode): ThemeSetArgs {
  return { backdrop: { id: BACKDROP_ID, glass: { tint: paperOf(settings, mode), opacity: GLASS_OPACITY }, colorScheme: mode } }
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

  if (wantsBackdrop(settings)) {
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
  if (e.props.plugin !== 'cozy-skin' || e.props.id !== BACKDROP_ID) {
    return next(e)
  }
  const { Box } = $.ui.resolve(e)
  const { settings, mode } = await read($, settingsAtom)

  return <Box width="100%" height="100%" backgroundColor={paperOf(settings, mode)} />
}
