import { PRESETS, presetOf } from './presets'
import type { Mode } from './presets'
import { colorNames, isHex, isNamed } from './colors'
import { LOOK_NAME, MAX_LOOKS } from './settings'
import type { Settings, Side } from './settings'

export type ThemeAction =
  | { kind: 'show' }
  | { kind: 'preset'; name: string; mode?: Mode | 'auto' }
  | { kind: 'mode'; mode: Mode | 'auto' }
  | { kind: 'off' }
  | { kind: 'on' }
  | { kind: 'calm'; on: boolean }
  | { kind: 'icons'; icons: 'unicode' | 'ascii' }
  | { kind: 'tables'; tables: 'box' | 'text' | 'off' }
  | { kind: 'tools'; tools: 'on' | 'off' }
  | { kind: 'bubble'; bubble: 'cozy' | 'app' }
  | { kind: 'terminal-install' }
  | { kind: 'panel' }
  | { kind: 'color'; side: Side; color: string | null }
  | { kind: 'save'; name: string }
  | { kind: 'look'; name: string }
  | { kind: 'forget'; name: string }
  | { kind: 'error'; message: string }

const names = () => PRESETS.map(preset => preset.name).join(', ')

const USAGE =
  'Use: /cozy [<preset> [light|dark|auto] | light | dark | auto | on | off | calm on|off | icons unicode|ascii | tables box|text|off | tools on|off | bubble cozy|app | color you|code <name>|#rrggbb|off | save|look|forget <name> | panel | terminal install]'

const SIDES: Record<string, Side> = { you: 'you', me: 'you', code: 'code' }

const fail = (message: string): ThemeAction => ({ kind: 'error', message: `${message} ${USAGE}` })

export function parseTheme(args: string): ThemeAction {
  const [head, arg, ...rest] = args.trim().toLowerCase().split(/\s+/).filter(Boolean)

  if (head === undefined) {
    return { kind: 'show' }
  }
  if (head === 'light' || head === 'dark' || head === 'auto') {
    return { kind: 'mode', mode: head }
  }
  if (head === 'off' && arg === undefined) {
    return { kind: 'off' }
  }
  if (head === 'on' && arg === undefined) {
    return { kind: 'on' }
  }
  if (head === 'calm' && (arg === 'on' || arg === 'off') && rest.length === 0) {
    return { kind: 'calm', on: arg === 'on' }
  }
  if (head === 'icons' && (arg === 'unicode' || arg === 'ascii') && rest.length === 0) {
    return { kind: 'icons', icons: arg }
  }
  if (head === 'tables' && (arg === 'box' || arg === 'text' || arg === 'off') && rest.length === 0) {
    return { kind: 'tables', tables: arg }
  }
  if (head === 'tools' && (arg === 'on' || arg === 'off') && rest.length === 0) {
    return { kind: 'tools', tools: arg }
  }
  if (head === 'bubble' && (arg === 'cozy' || arg === 'app') && rest.length === 0) {
    return { kind: 'bubble', bubble: arg }
  }
  if ((head === 'save' || head === 'look' || head === 'forget') && arg !== undefined && rest.length === 0) {
    if (!LOOK_NAME.test(arg)) {
      return fail(`"${arg}" is not a look name: use lowercase letters, digits and dashes, up to 24.`)
    }
    if (head === 'save' && presetOf(arg) !== undefined) {
      return fail(`"${arg}" is a preset's name; pick another for your look.`)
    }
    return { kind: head, name: arg }
  }
  if (head === 'panel' && arg === undefined) {
    return { kind: 'panel' }
  }
  if (head === 'terminal' && arg === 'install' && rest.length === 0) {
    return { kind: 'terminal-install' }
  }
  if ((head === 'color' || head === 'colour') && arg !== undefined && SIDES[arg] !== undefined && rest.length === 1) {
    const value = rest[0] ?? ''
    const side = SIDES[arg] as Side

    if (value === 'off') {
      return { kind: 'color', side, color: null }
    }
    if (isHex(value) || isNamed(value)) {
      return { kind: 'color', side, color: value }
    }
    return fail(`"${value}" is not a colour: use a name (${colorNames()}) or #rrggbb.`)
  }
  if (arg === undefined && presetOf(head) !== undefined) {
    return { kind: 'preset', name: head }
  }
  if ((arg === 'light' || arg === 'dark' || arg === 'auto') && rest.length === 0 && presetOf(head) !== undefined) {
    return { kind: 'preset', name: head, mode: arg }
  }
  if (['calm', 'icons', 'tables', 'tools', 'bubble', 'terminal', 'color', 'colour', 'save', 'look', 'forget'].includes(head)) {
    return fail(`Bad value for "${head}".`)
  }

  return fail(`Unknown option "${head}". Presets: ${names()}.`)
}

// Choosing a preset or a mode also turns the skin back on after `off`.
export function applyTheme(settings: Settings, action: ThemeAction): Settings {
  switch (action.kind) {
    case 'preset':
      return { ...settings, preset: action.name, mode: action.mode ?? settings.mode, enabled: true }
    case 'mode':
      return { ...settings, mode: action.mode, enabled: true }
    case 'off':
      return { ...settings, enabled: false }
    case 'on':
      return { ...settings, enabled: true }
    case 'calm':
      return { ...settings, calm: action.on }
    case 'icons':
      return { ...settings, icons: action.icons }
    case 'tables':
      return { ...settings, tables: action.tables }
    case 'tools':
      return { ...settings, tools: action.tools }
    case 'bubble':
      return { ...settings, bubble: action.bubble }
    case 'color':
      return { ...settings, colors: { ...settings.colors, [action.side]: action.color } }
    case 'save': {
      // A new name past MAX_LOOKS pushes out the oldest; saving a name again replaces it.
      const { [action.name]: _, ...others } = settings.looks
      const kept = Object.entries(others).slice(-(MAX_LOOKS - 1))

      return {
        ...settings,
        looks: { ...Object.fromEntries(kept), [action.name]: { preset: settings.preset, mode: settings.mode, colors: { ...settings.colors } } },
      }
    }
    case 'look': {
      const look = settings.looks[action.name]

      return look === undefined ? settings : { ...settings, preset: look.preset, mode: look.mode, colors: { ...look.colors }, enabled: true }
    }
    case 'forget': {
      const { [action.name]: _, ...rest } = settings.looks

      return { ...settings, looks: rest }
    }
    default:
      return settings
  }
}

export function describe(settings: Settings, mode: Mode): string {
  const lines = [
    settings.enabled ? 'cozy-skin is on.' : 'cozy-skin is off. /cozy on, or pick a preset or a mode, turns it on.',
    `Preset: ${settings.preset} (${names()})`,
    `Mode: ${settings.mode}${settings.mode === 'auto' ? ` (now ${mode})` : ''}`,
    `Calm: ${settings.calm ? 'on' : 'off'}`,
    `Icons: ${settings.icons}`,
    `Tables: ${settings.tables}`,
    `Tool rows: ${settings.tools}`,
    `Your bubble: ${settings.bubble}${settings.bubble === 'app' ? " (Claude Code's own, with Rewind and selection)" : ''}`,
    `Your text: ${settings.colors.you ?? 'preset'}, inline code: ${settings.colors.code ?? 'preset'}`,
    `Your looks: ${Object.keys(settings.looks).join(', ') || 'none (/cozy save <name>)'}`,
  ]

  return lines.join('\n')
}
