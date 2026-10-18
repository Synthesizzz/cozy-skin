import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { PRESETS, presetOf } from '../hooks/presets'
import {
  OSC_RESET,
  buildFragment,
  fragmentPath,
  installFragment,
  oscFor,
  powershellLine,
  schemeName,
  switchHint,
} from '../hooks/terminal'
import type { TerminalHost } from '../hooks/terminal'

const ESC = '\x1b'
const ST = '\x07'
const kindleLight = presetOf('kindle')!.light.terminal

test('schemeName joins preset and mode', () => {
  expect(schemeName('kindle', 'light')).toBe('cozy-kindle-light')
  expect(schemeName('tokyo-night', 'dark')).toBe('cozy-tokyo-night-dark')
})

test('buildFragment holds one scheme per preset and mode, and no profiles', () => {
  const fragment = JSON.parse(buildFragment(PRESETS)) as { schemes: Record<string, string>[]; profiles?: unknown }

  expect(fragment.schemes.map(s => s.name)).toEqual(
    PRESETS.flatMap(preset => [`cozy-${preset.name}-light`, `cozy-${preset.name}-dark`]),
  )
  expect(fragment.schemes).toHaveLength(PRESETS.length * 2)
  expect('profiles' in fragment).toBe(false)
  expect(fragment.schemes[0]).toMatchObject({ background: '#e9dcc3', foreground: '#43372a', black: '#43372a' })
  // Windows Terminal needs every colour from black to brightWhite.
  expect(fragment.schemes[0]).toHaveProperty('brightWhite')
})

test('fragmentPath sits in the per-user Fragments folder', () => {
  expect(fragmentPath('C:\\Users\\me\\AppData\\Local')).toBe(
    'C:\\Users\\me\\AppData\\Local\\Microsoft\\Windows Terminal\\Fragments\\cozy-skin\\cozy-skin.json',
  )
  expect(fragmentPath('C:\\Users\\me\\AppData\\Local\\')).toBe(
    'C:\\Users\\me\\AppData\\Local\\Microsoft\\Windows Terminal\\Fragments\\cozy-skin\\cozy-skin.json',
  )
})

test('oscFor sets background, foreground and all 16 palette colours', () => {
  const osc = oscFor(kindleLight)

  expect(osc.startsWith(`${ESC}]11;#e9dcc3${ST}`)).toBe(true)
  expect(osc).toContain(`${ESC}]10;#43372a${ST}`)
  expect(osc.split(`${ESC}]4;`).length - 1).toBe(16)
  expect(osc).toContain(`${ESC}]4;0;#43372a${ST}`)
  expect(osc).toContain(`${ESC}]4;1;${kindleLight.red}${ST}`)
  expect(osc).toContain(`${ESC}]4;15;${kindleLight.brightWhite}${ST}`)
})

test('OSC_RESET resets background, foreground and palette', () => {
  expect(OSC_RESET).toBe(`${ESC}]111${ST}${ESC}]110${ST}${ESC}]104${ST}`)
})

test('powershellLine writes ESC and BEL through [char], with no backslash', () => {
  const line = powershellLine(`${ESC}]11;#e9dcc3${ST}`)

  expect(line).toBe('Write-Host -NoNewline "$([char]27)]11;#e9dcc3$([char]7)"')
  expect(line).not.toContain(ESC)
  expect(line).not.toContain(ST)
  // The desktop chat renders replies as markdown, which drops a `\` before `$`.
  expect(powershellLine(oscFor(kindleLight) + OSC_RESET)).not.toContain('\\')
  expect(powershellLine(oscFor(kindleLight)).split('$([char]27)').length - 1).toBe(
    oscFor(kindleLight).split(ESC).length - 1,
  )
})

test('switchHint gives the paste line for the active scheme and a reset line', () => {
  const hint = switchHint('kindle', 'light', true)

  expect(hint).toContain(powershellLine(oscFor(kindleLight)))
  expect(hint).toContain(powershellLine(OSC_RESET))
  expect(hint).toContain('cozy-kindle-light')
  expect(hint).not.toContain(ESC)
})

test('switchHint offers only the reset line when the skin is off, and nothing for an unknown preset', () => {
  const off = switchHint('kindle', 'light', false)

  expect(off).toContain(powershellLine(OSC_RESET))
  expect(off).not.toContain('#e9dcc3')
  expect(switchHint('nope', 'light', true)).toBe('')
})

function mount(local: string | undefined, writeThrows = false) {
  const writes: Record<string, string> = {}
  const host: TerminalHost = {
    env: { get: async () => local },
    fs: {
      write: async (path, text) => {
        if (writeThrows) {
          throw new Error('disk full')
        }
        writes[path] = text
      },
    },
  }

  return { writes, host }
}

test('installFragment writes the fragment and names the way to pick the scheme', async () => {
  const { writes, host } = mount('C:\\Users\\me\\AppData\\Local')
  const reply = await installFragment(host, PRESETS)
  const path = 'C:\\Users\\me\\AppData\\Local\\Microsoft\\Windows Terminal\\Fragments\\cozy-skin\\cozy-skin.json'

  expect(Object.keys(writes)).toEqual([path])
  expect(writes[path]).toBe(buildFragment(PRESETS))
  expect(reply).toContain(path)
  expect(reply).toContain('Pick the scheme in Windows Terminal: Settings, your profile, Appearance, Color scheme')
})

test('installFragment writes nothing without LOCALAPPDATA', async () => {
  const { writes, host } = mount(undefined)
  const reply = await installFragment(host, PRESETS)

  expect(writes).toEqual({})
  expect(reply).toContain('LOCALAPPDATA')
})

test('installFragment says so when the write fails', async () => {
  const { host } = mount('C:\\L', true)

  expect(await installFragment(host, PRESETS)).toContain('disk full')
})

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

function run(on: On, local: string | undefined) {
  const seen = { writes: {} as Record<string, string> }

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('config.list', () => ({ value: [] }))
  on('env.get', () => ({ value: local }))
  on('fs.write', (_, e) => {
    seen.writes[e.path] = e.text

    return { value: undefined }
  })

  return seen
}

test('/cozy terminal install writes the fragment, and nothing else writes', async ($: Engine, on) => {
  const seen = run(on, 'C:\\Loc')

  await $.session.start(START)
  expect(Object.keys(seen.writes)).toEqual([])

  const said = await $.command.run({ ...TYPED, command: 'cozy', args: 'terminal install' })

  expect(Object.keys(seen.writes)).toEqual([fragmentPath('C:\\Loc')])
  expect(said.text).toContain('Pick the scheme in Windows Terminal')
})

test('/cozy kindle light replies with the paste line, /cozy tables box does not', async ($: Engine, on) => {
  const seen = run(on, 'C:\\Loc')

  await $.session.start(START)
  const moved = await $.command.run({ ...TYPED, command: 'cozy', args: 'light' })

  expect(moved.text).toContain(powershellLine(oscFor(kindleLight)))
  expect((await $.command.run({ ...TYPED, command: 'cozy', args: '' })).text).toContain(powershellLine(OSC_RESET))
  expect((await $.command.run({ ...TYPED, command: 'cozy', args: 'tables box' })).text).not.toContain('Write-Host')
  expect(seen.writes).toEqual({})
})
