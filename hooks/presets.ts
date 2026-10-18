import { catppuccin } from '../presets/catppuccin'
import { contrast } from '../presets/contrast'
import { dracula } from '../presets/dracula'
import { gruvbox } from '../presets/gruvbox'
import { kindle } from '../presets/kindle'
import { nord } from '../presets/nord'
import { paper } from '../presets/paper'
import { sepia } from '../presets/sepia'
import { solarized } from '../presets/solarized'
import { tokyoNight } from '../presets/tokyo-night'

export type Mode = 'light' | 'dark'

export type Palette = {
  bg: string
  fg: string
  muted: string
  accent: string
  surface: string
  zebra: string
  hl: string
  line: string
  ok: string
  err: string
  warn: string
  read: string
  write: string
  run: string
  search: string
  web: string
  mcp: string
  panel?: string
}

export type TerminalScheme = {
  background: string
  foreground: string
  cursorColor: string
  selectionBackground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  purple: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightPurple: string
  brightCyan: string
  brightWhite: string
}

export type Look = {
  palette: Palette
  terminal: TerminalScheme
  spinner: string[]
  done: string[]
  boxed: 'soft'
}

export type Preset = { name: string; label: string; light: Look; dark: Look }

// E-reader looks first, then looks after popular VS Code themes (credited in NOTICE).
export const PRESETS: readonly Preset[] = [kindle, sepia, paper, solarized, gruvbox, nord, dracula, catppuccin, tokyoNight, contrast]

export function presetOf(name: string): Preset | undefined {
  return PRESETS.find(p => p.name === name)
}
