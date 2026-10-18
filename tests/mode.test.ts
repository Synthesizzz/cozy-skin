import type { EngineInterface } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { parseRegLight, readWindowsLight, resolveMode } from '../hooks/mode'

const REG = (value: string) =>
  `\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize\r\n    AppsUseLightTheme    REG_DWORD    ${value}\r\n\r\n`

test('parseRegLight reads the registry value', () => {
  expect(parseRegLight(REG('0x1'))).toBe(true)
  expect(parseRegLight(REG('0x0'))).toBe(false)
  expect(parseRegLight('')).toBe(null)
  expect(parseRegLight('garbage')).toBe(null)
  expect(parseRegLight(REG('0x7'))).toBe(null)
})

test('resolveMode follows the setting, then Windows, then dark', () => {
  expect(resolveMode('auto', true)).toBe('light')
  expect(resolveMode('auto', false)).toBe('dark')
  expect(resolveMode('auto', null)).toBe('dark')
  expect(resolveMode('dark', true)).toBe('dark')
  expect(resolveMode('light', false)).toBe('light')
})

// A stand-in for the one member readWindowsLight uses.
const running = (run: () => Promise<unknown>) => ({ process: { run } }) as unknown as EngineInterface

test('readWindowsLight reads the value on exit 0', async () => {
  const out = { exitCode: 0, stdout: REG('0x1'), stderr: '' }

  expect(await readWindowsLight(running(async () => out))).toBe(true)
})

test('readWindowsLight gives null on a non-zero exit even when stdout parses', async () => {
  const out = { exitCode: 1, stdout: REG('0x1'), stderr: 'denied' }

  expect(await readWindowsLight(running(async () => out))).toBe(null)
})

test('readWindowsLight gives null when the call throws', async () => {
  expect(
    await readWindowsLight(
      running(async () => {
        throw new Error('timed out')
      }),
    ),
  ).toBe(null)
})
