import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { parseTheme } from '../hooks/command'
import { contrast } from '../hooks/contrast'
import { PRESETS, presetOf } from '../hooks/presets'
import { SETTINGS_KEY } from '../hooks/settings'
import type { Settings } from '../hooks/settings'
import { toolInk, toolKind } from '../hooks/tool-render'

const PLUGIN = 'cozy-skin'
const START = { cwd: '/', surface: 'terminal', isInteractive: true } as const

// The engine with the mod loaded, stored settings, and the engine's own rows
// beneath as plain text, so a test can see they are kept whole.
function world(on: On, stored: Partial<Settings> = {}) {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: e.key === SETTINGS_KEY ? { mode: 'dark', preset: 'nord', ...stored } : undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.render', { component: 'ToolUse' }, (beneath, e) => beneath.ui.resolve(e).Text({ children: `row ${e.props.tool}` }))
  on('ui.render', { component: 'ToolGroup' }, (beneath, e) => beneath.ui.resolve(e).Text({ children: 'group line' }))
}

let rows = 0

async function row($: Engine, tool: string, extra: { isRunning?: boolean; isErrored?: boolean } = {}, surface: 'terminal' | 'desktop' = 'terminal') {
  const id = `toolu_${++rows}`

  await $.session.start(START)

  return $.ui.mount({
    plugin: PLUGIN,
    surface,
    component: 'ToolUse',
    requestId: id,
    props: { tool_use_id: id, tool, input: {}, isRunning: false, isErrored: false, isInterrupted: false, ...extra },
  } as never)
}

test('tools sort into the preset palette kinds, MCP tools by their prefix', () => {
  expect(toolKind('Read')).toBe('read')
  expect(toolKind('Edit')).toBe('write')
  expect(toolKind('Bash')).toBe('run')
  expect(toolKind('Grep')).toBe('search')
  expect(toolKind('WebFetch')).toBe('web')
  expect(toolKind('mcp__notion__search')).toBe('mcp')
  expect(toolKind('Agent')).toBeNull()
})

test('a tool row keeps the engine row and puts a dot in its kind colour before it', async ($, on) => {
  world(on)

  const ui = await row($, 'Bash')
  const nord = presetOf('nord')!.dark.palette

  expect(await ui.find({ type: 'Text', text: 'row Bash' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: '●' }))?.props.color).toBe(toolInk(nord, 'Bash', false))
  expect(toolInk(nord, 'Bash', false)).not.toBe(toolInk(nord, 'Read', false))
})

test('a running call is hollow and a failed one is in the error colour', async ($, on) => {
  world(on)

  const nord = presetOf('nord')!.dark.palette

  expect(await (await row($, 'Read', { isRunning: true })).find({ type: 'Text', text: '○' })).toBeDefined()
  expect((await (await row($, 'Read', { isErrored: true })).find({ type: 'Text', text: '●' }))?.props.color).toBe(toolInk(nord, 'Read', true))
})

test('a folded group gets one dot for each kind in it', async ($, on) => {
  world(on)

  await $.session.start(START)
  const call = (tool: string) => ({ tool, input: {}, isRunning: false, isErrored: false, isInterrupted: false })
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolGroup',
    props: { calls: [call('Read'), call('Read'), call('Grep')], isActive: false, isExpanded: false },
  } as never)

  expect(await ui.find({ type: 'Text', text: 'group line' })).toBeDefined()
  expect((await ui.findAll({ type: 'Text' })).filter(t => t.text === '●')).toHaveLength(2)
})

test('tools off leaves the row to the engine', async ($, on) => {
  world(on, { tools: 'off' })

  const ui = await row($, 'Bash')

  expect(await ui.find({ type: 'Text', text: 'row Bash' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '●' })).toBeUndefined()
})

test('the skin off leaves the row to the engine', async ($, on) => {
  world(on, { enabled: false })

  const ui = await row($, 'Bash')

  expect(await ui.find({ type: 'Text', text: 'row Bash' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '●' })).toBeUndefined()
})

test('/cozy tools on|off parses, and every dot shows at 3:1 on its paper', () => {
  expect(parseTheme('tools off')).toEqual({ kind: 'tools', tools: 'off' })
  expect(parseTheme('tools maybe').kind).toBe('error')
  for (const preset of PRESETS) {
    for (const mode of ['light', 'dark'] as const) {
      const p = preset[mode].palette

      for (const tool of ['Read', 'Edit', 'Bash', 'Grep', 'WebFetch', 'mcp__x__y', 'Agent']) {
        expect(contrast(toolInk(p, tool, false), p.bg), `${preset.name} ${mode} ${tool}`).toBeGreaterThanOrEqual(3)
      }
    }
  }
})

test('the desktop dots a single tool row and keeps a folded group as the engine draws it', async ($, on) => {
  world(on)

  const single = await row($, 'Bash', {}, 'desktop')

  expect(await single.find({ type: 'Text', text: 'row Bash' })).toBeDefined()
  expect(await single.find({ type: 'Text', text: '●' })).toBeDefined()

  const call = (tool: string) => ({ tool, input: {}, isRunning: false, isErrored: false, isInterrupted: false })
  const group = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'ToolGroup',
    props: { calls: [call('Bash'), call('Bash')], isActive: false, isExpanded: false },
  } as never)

  expect(await group.find({ type: 'Text', text: 'group line' })).toBeDefined()
  expect(await group.find({ type: 'Text', text: '●' })).toBeUndefined()
  expect(await group.find({ type: 'Box' })).toBeUndefined()
})
