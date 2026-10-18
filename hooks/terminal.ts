import type { EngineInterface } from 'claude-code'
import { presetOf } from './presets'
import type { Mode, Preset, TerminalScheme } from './presets'

// The part of the engine the install uses, so tests can hand in a small stand-in.
export type TerminalHost = {
  env: Pick<EngineInterface['env'], 'get'>
  fs: Pick<EngineInterface['fs'], 'write'>
}

const ESC = '\x1b'
// BEL ends each OSC instead of `ESC \`: the paste line then holds no backslash,
// which the desktop chat's markdown would drop before a `$`.
const ST = '\x07'

const MODES: readonly Mode[] = ['light', 'dark']

export const schemeName = (preset: string, mode: Mode): string => `cozy-${preset}-${mode}`

// Schemes only: the owner's profiles are never touched, so no `profiles` key.
export function buildFragment(presets: readonly Preset[]): string {
  const schemes = presets.flatMap(preset =>
    MODES.map(mode => ({ name: schemeName(preset.name, mode), ...preset[mode].terminal })),
  )

  return `${JSON.stringify({ schemes }, null, 2)}\n`
}

// Microsoft's per-user location for fragments of an app installed from the web.
export function fragmentPath(localAppData: string): string {
  const root = localAppData.replace(/[\\/]+$/, '')

  return `${root}\\Microsoft\\Windows Terminal\\Fragments\\cozy-skin\\cozy-skin.json`
}

// The ANSI palette in the order the terminal numbers it: 0 to 7, then 8 to 15.
const PALETTE: readonly (keyof TerminalScheme)[] = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'purple',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightPurple',
  'brightCyan',
  'brightWhite',
]

// Background (OSC 11), foreground (OSC 10) and all 16 palette colours (OSC 4).
// The palette matters: syntax colours stay faded on a light background without it.
export function oscFor(scheme: TerminalScheme): string {
  const palette = PALETTE.map((key, index) => `${ESC}]4;${index};${scheme[key]}${ST}`)

  return [`${ESC}]11;${scheme.background}${ST}`, `${ESC}]10;${scheme.foreground}${ST}`, ...palette].join('')
}

// Puts background, foreground and palette back to the profile's own.
export const OSC_RESET = `${ESC}]111${ST}${ESC}]110${ST}${ESC}]104${ST}`

// One line to paste into PowerShell. The mod cannot write to the terminal itself,
// so the owner's own shell does it; ESC is spelled `$([char]27)` and BEL `$([char]7)`.
export function powershellLine(osc: string): string {
  return `Write-Host -NoNewline "${osc.replaceAll(ESC, '$([char]27)').replaceAll(ST, '$([char]7)')}"`
}

// The note a `/cozy` reply carries: how to match this window to the active scheme.
export function switchHint(preset: string, mode: Mode, enabled: boolean): string {
  const reset = ['To put this window back, paste:', powershellLine(OSC_RESET)]

  if (!enabled) {
    return reset.join('\n')
  }
  const look = presetOf(preset)?.[mode]

  if (look === undefined) {
    return ''
  }

  return [
    `To match this Windows Terminal window to ${schemeName(preset, mode)} now, paste in PowerShell:`,
    powershellLine(oscFor(look.terminal)),
    ...reset,
  ].join('\n')
}

// `/cozy terminal install`: the only place anything is written, and only on that command.
export async function installFragment($: TerminalHost, presets: readonly Preset[]): Promise<string> {
  const local = await $.env.get('LOCALAPPDATA')

  if (local === undefined || local === '') {
    return 'Terminal schemes were not installed: LOCALAPPDATA is not set.'
  }
  const path = fragmentPath(local)

  try {
    await $.fs.write(path, buildFragment(presets))
  } catch (error) {
    return `Terminal schemes were not installed: ${error instanceof Error ? error.message : String(error)}`
  }

  return [
    `Terminal schemes written to ${path}`,
    'Restart Windows Terminal, then:',
    'Pick the scheme in Windows Terminal: Settings, your profile, Appearance, Color scheme',
  ].join('\n')
}
