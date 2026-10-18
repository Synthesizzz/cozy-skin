// Tool rows marked in the preset's colours: a dot beside each call, in the
// colour the preset gives its kind of tool (reading, writing, running,
// searching, the web, an MCP server). The row itself is the engine's own,
// drawn beneath and kept whole, so nothing of it is redrawn or doubled.
//
// On the desktop only a single call's row gets its dot: a folded group's
// line ("Ran 2 commands") is a block nothing can sit beside, so its dots
// fell onto a line of their own (0.7.0). Groups get dots in the terminal.

import { atom, read } from 'claude-code'
import type { MatchedHook } from 'claude-code'
import { readable } from './contrast'
import { presetOf } from './presets'
import type { Palette } from './presets'
import { LIVE_INIT } from './settings'

// The `live` atom (see LIVE_INIT in settings.ts). The validator reads a read
// only where the atom is declared in the same file.
const settingsAtom = atom({ plugin: 'cozy-skin', key: 'live' } as const, LIVE_INIT)

export type ToolKind = 'read' | 'write' | 'run' | 'search' | 'web' | 'mcp'

const KINDS: Record<string, ToolKind> = {
  Read: 'read',
  NotebookRead: 'read',
  ReadMcpResourceTool: 'mcp',
  ListMcpResourcesTool: 'mcp',
  Write: 'write',
  Edit: 'write',
  MultiEdit: 'write',
  NotebookEdit: 'write',
  Bash: 'run',
  PowerShell: 'run',
  BashOutput: 'run',
  KillShell: 'run',
  KillBash: 'run',
  Monitor: 'run',
  Grep: 'search',
  Glob: 'search',
  LS: 'search',
  ToolSearch: 'search',
  WebFetch: 'web',
  WebSearch: 'web',
}

// The kind of a tool by its name; an MCP server's tools (`mcp__server__tool`)
// are one kind. Null for the rest (agents, skills, the task list, a plugin's
// own tools), which take the preset's muted colour.
export function toolKind(tool: string): ToolKind | null {
  if (tool.startsWith('mcp__')) {
    return 'mcp'
  }
  return KINDS[tool] ?? null
}

// A dot's colour: an error's colour for a call that failed, else its kind's,
// moved just far enough to read at 3:1 on the paper, the WCAG floor for a mark
// that is not text.
export function toolInk(p: Palette, tool: string, isErrored: boolean): string {
  const kind = toolKind(tool)

  return readable(isErrored ? p.err : kind === null ? p.muted : p[kind], p.bg, 3)
}

type ToolUseHook = MatchedHook<'ui.render', { component: 'ToolUse' }>
type ToolGroupHook = MatchedHook<'ui.render', { component: 'ToolGroup' }>

async function lookFor($: Parameters<ToolUseHook>[0] | Parameters<ToolGroupHook>[0]) {
  const { settings, mode } = await read($, settingsAtom)

  return settings.enabled && settings.tools === 'on' ? { p: presetOf(settings.preset)?.[mode].palette, isAscii: settings.icons === 'ascii' } : null
}

// One call: its dot, then the engine's row. A running call's dot is hollow.
export async function drawToolUse($: Parameters<ToolUseHook>[0], e: Parameters<ToolUseHook>[1], next: Parameters<ToolUseHook>[2]) {
  const look = await lookFor($)

  if (look === null || look.p === undefined) {
    return next(e)
  }
  const beneath = await next(e)
  const { Box, Text } = $.ui.resolve(e)
  const dot = look.isAscii ? (e.props.isRunning ? 'o' : '*') : e.props.isRunning ? '○' : '●'

  return (
    <Box flexDirection="row" gap="sm" alignItems="flex-start">
      <Text color={toolInk(look.p, e.props.tool, e.props.isErrored)}>{dot}</Text>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        {beneath}
      </Box>
    </Box>
  )
}

// A folded run of calls: one dot for each kind in it, in the order they first
// ran, then the engine's count line. An expanded group's rows are ToolUse
// rows with dots of their own, so it is left as it is.
export async function drawToolGroup($: Parameters<ToolGroupHook>[0], e: Parameters<ToolGroupHook>[1], next: Parameters<ToolGroupHook>[2]) {
  const look = e.surface === 'terminal' ? await lookFor($) : null

  if (look === null || look.p === undefined || e.props.isExpanded) {
    return next(e)
  }
  const p = look.p
  const beneath = await next(e)
  const { Box, Text } = $.ui.resolve(e)
  const inks = [...new Set(e.props.calls.map(call => toolInk(p, call.tool, call.isErrored)))]
  const dot = look.isAscii ? '*' : '●'

  return (
    <Box flexDirection="row" gap="sm" alignItems="flex-start">
      <Text>
        {inks.map(ink => (
          <Text color={ink}>{dot}</Text>
        ))}
      </Text>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        {beneath}
      </Box>
    </Box>
  )
}
