import type { EngineInterface } from 'claude-code'
import type { Mode } from './presets'

const KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'

// `AppsUseLightTheme    REG_DWORD    0x1`: 1 is light, 0 is dark, else unknown.
export function parseRegLight(stdout: string): boolean | null {
  const found = /AppsUseLightTheme\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(stdout)

  if (found === null) {
    return null
  }
  const value = Number.parseInt(found[1] ?? '', 16)

  return value === 1 ? true : value === 0 ? false : null
}

// Any failure (no registry access, a timeout, a non-zero exit) is null.
export async function readWindowsLight($: EngineInterface): Promise<boolean | null> {
  try {
    const out = await $.process.run(['reg', 'query', KEY, '/v', 'AppsUseLightTheme'], { timeoutMs: 3000 })

    return out.exitCode === 0 ? parseRegLight(out.stdout) : null
  } catch {
    return null
  }
}

export function resolveMode(setting: Mode | 'auto', windowsLight: boolean | null): Mode {
  if (setting !== 'auto') {
    return setting
  }

  return windowsLight === true ? 'light' : 'dark'
}
