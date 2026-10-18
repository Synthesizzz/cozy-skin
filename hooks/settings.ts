import { isColor } from './colors'
import { presetOf } from './presets'
import type { Mode } from './presets'

export type Settings = {
  preset: string
  mode: Mode | 'auto'
  calm: boolean
  icons: 'unicode' | 'ascii'
  tables: 'box' | 'text' | 'off'
  // A dot in the preset's colour for each kind of tool, beside its row.
  tools: 'on' | 'off'
  // Who draws the person's prompt on the desktop: cozy's bubble in the
  // preset's colours, or the app's own, which keeps Rewind, Fork, text
  // selection and the right-click menu that a mod-drawn row cannot have.
  bubble: 'cozy' | 'app'
  enabled: boolean
  // Claude Code's own theme before cozy-skin first changed it; null until the
  // first `/cozy <preset>` or `/cozy <mode>`, and again after `/cozy off`.
  savedTheme: string | null
  // The theme id cozy-skin last set, so a later sync can tell a hand-picked theme from its own.
  appliedTheme: string | null
  // Colours the person picked (`#rrggbb`, or a name from colors.ts): the text
  // of their own messages, and inline code in Claude's replies; null draws
  // that part as Claude Code does.
  colors: { you: string | null; code: string | null }
  // Looks the person saved by name: a preset, a mode and the colours on top.
  looks: Record<string, SavedLook>
}

export type SavedLook = { preset: string; mode: Mode | 'auto'; colors: { you: string | null; code: string | null } }

// How many looks can be kept.
export const MAX_LOOKS = 12


export type Side = keyof Settings['colors']

// What render hooks read: the settings and the mode they resolved to.
export type Live = { settings: Settings; mode: Mode }

// What a table's buttons last said: a copy's answer, a saved path or an error.
export type Note = { text: string; isError: boolean }

export const DEFAULTS: Settings = {
  preset: 'kindle',
  mode: 'auto',
  calm: false,
  icons: 'unicode',
  tables: 'box',
  tools: 'on',
  bubble: 'cozy',
  enabled: true,
  savedTheme: null,
  appliedTheme: null,
  colors: { you: null, code: null },
  looks: {},
}

// The starting value of the `live` atom. Each file that reads or writes it
// declares its own `atom(...)` with this value: the validator reads a read or
// a write only where the atom is declared in the same file.
export const LIVE_INIT: Live = { settings: DEFAULTS, mode: 'dark' }

export const SETTINGS_KEY = 'settings'

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback

// Anything stored can be old, hand-edited or missing: each field stands on its own.
export function sane(raw: unknown): Settings {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const c = typeof o.colors === 'object' && o.colors !== null ? (o.colors as Record<string, unknown>) : {}

  return {
    preset: typeof o.preset === 'string' && presetOf(o.preset) !== undefined ? o.preset : DEFAULTS.preset,
    mode: pick(o.mode, ['light', 'dark', 'auto'], DEFAULTS.mode),
    calm: typeof o.calm === 'boolean' ? o.calm : DEFAULTS.calm,
    icons: pick(o.icons, ['unicode', 'ascii'], DEFAULTS.icons),
    tables: pick(o.tables, ['box', 'text', 'off'], DEFAULTS.tables),
    tools: pick(o.tools, ['on', 'off'], DEFAULTS.tools),
    bubble: pick(o.bubble, ['cozy', 'app'], DEFAULTS.bubble),
    enabled: typeof o.enabled === 'boolean' ? o.enabled : DEFAULTS.enabled,
    savedTheme: typeof o.savedTheme === 'string' ? o.savedTheme : null,
    appliedTheme: typeof o.appliedTheme === 'string' ? o.appliedTheme : null,
    colors: { you: isColor(c.you) ? c.you : null, code: isColor(c.code) ? c.code : null },
    looks: saneLooks(o.looks),
  }
}

// A saved look's name: lowercase letters, digits and dashes, 1 to 24 long.
export const LOOK_NAME = /^[a-z0-9][a-z0-9-]{0,23}$/

// Each stored look stands on its own; a broken one is dropped, not repaired.
function saneLooks(raw: unknown): Record<string, SavedLook> {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const out: Record<string, SavedLook> = {}

  for (const [name, value] of Object.entries(o).slice(0, MAX_LOOKS)) {
    const v = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
    const c = typeof v.colors === 'object' && v.colors !== null ? (v.colors as Record<string, unknown>) : {}

    if (!LOOK_NAME.test(name) || typeof v.preset !== 'string' || presetOf(v.preset) === undefined) {
      continue
    }
    out[name] = {
      preset: v.preset,
      mode: pick(v.mode, ['light', 'dark', 'auto'], 'auto'),
      colors: { you: isColor(c.you) ? c.you : null, code: isColor(c.code) ? c.code : null },
    }
  }
  return out
}
