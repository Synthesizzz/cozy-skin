import { atom, read, update } from 'claude-code'
import type { Hook, MatchedHook } from 'claude-code'
import { presetOf } from './presets'
import type { Look } from './presets'
import { LIVE_INIT } from './settings'
import type { Live } from './settings'

// The `live` atom (see LIVE_INIT in settings.ts). The validator reads a read
// only where the atom is declared in the same file.
const settingsAtom = atom({ plugin: 'cozy-skin', key: 'live' } as const, LIVE_INIT)

// The id of the main loop's running turn, so a calm spinner keeps one word
// for the whole turn. Empty before the first turn.
const turnAtom = atom({ plugin: 'cozy-skin', key: 'turn' } as const, { id: '' })

// A stable pick: the same words and seed always give the same word.
export function pickWord(words: readonly string[], seed: string): string {
  if (words.length === 0) {
    return ''
  }

  let hash = 2166136261

  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0
  }
  return words[hash % words.length] ?? ''
}

type TurnStartHook = Hook<'turn.start'>
type SpinnerHook = MatchedHook<'ui.render', { component: 'Spinner' }>
type DoneHook = MatchedHook<'ui.render', { component: 'TurnDuration' }>

function lookOf(live: Live): Look | undefined {
  return presetOf(live.settings.preset)?.[live.mode]
}

// Remembers the turn the main loop is in; a subagent's turn is not the one the spinner shows.
export async function trackTurn($: Parameters<TurnStartHook>[0], e: Parameters<TurnStartHook>[1], next: Parameters<TurnStartHook>[2]) {
  if (e.agentId === undefined) {
    await update($, turnAtom, () => ({ id: e.turnId }))
  }
  return next(e)
}

// The preset's words in place of the engine's. A state's `message` is kept as given.
// The engine draws the row's colour: no prop carries one, so the accent is not applied here.
export async function drawSpinner($: Parameters<SpinnerHook>[0], e: Parameters<SpinnerHook>[1], next: Parameters<SpinnerHook>[2]) {
  const live = await read($, settingsAtom)
  const look = lookOf(live)

  if (!live.settings.enabled || look === undefined || look.spinner.length === 0) {
    return next(e)
  }

  // Calm: one word for the turn. Otherwise the engine's word is the seed, so the
  // preset's words cycle as often as the engine's own do.
  const seed = live.settings.calm ? ((await read($, turnAtom)).id || e.requestId) : e.props.word

  return next({ ...e, props: { ...e.props, word: pickWord(look.spinner, seed) } })
}

// The preset's past-tense word in the footer; the duration is left alone.
export async function drawDone($: Parameters<DoneHook>[0], e: Parameters<DoneHook>[1], next: Parameters<DoneHook>[2]) {
  const live = await read($, settingsAtom)
  const look = lookOf(live)

  if (!live.settings.enabled || look === undefined || look.done.length === 0) {
    return next(e)
  }
  return next({ ...e, props: { ...e.props, word: pickWord(look.done, `${e.requestId}:${e.props.durationMs}`) } })
}
