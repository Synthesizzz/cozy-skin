import { expect, test } from 'claude-code/testing'

test('the plugin loads and registers /cozy', async ($, on) => {
  const names: string[] = []

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => {
    names.push(e.name)

    return { value: { command: e.name } }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect(names).toContain('cozy')
})
