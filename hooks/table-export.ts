import type { EngineInterface } from 'claude-code'
import type { Table } from './table-parse'
import { isSafeNumber, xlsxParts } from './xlsx'

// The part of the engine the savers use, so tests can hand in a small stand-in.
export type ExportHost = {
  fs: Pick<EngineInterface['fs'], 'write' | 'exists'>
  process: Pick<EngineInterface['process'], 'run'>
  plugin: { root: string }
}

const flat = (cell: string): string => cell.replace(/[\t\r\n]+/g, ' ')

export function toTsv(table: Table): string {
  return [table.header, ...table.rows].map(row => row.map(flat).join('\t')).join('\n')
}

const quoted = (cell: string): string => (/[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)

// Excel turns "007" into 7, "120.50" into 120.5 and a 14-digit ID into
// 1.23457E+13 when it opens a CSV. Such cells are written as ="007", which
// Excel shows as the exact text; the same cells stay text in the XLSX.
const PLAIN_DIGITS = /^-?\d+(\.\d+)?$/

const csvCell = (cell: string): string => quoted(PLAIN_DIGITS.test(cell) && !isSafeNumber(cell) ? `="${cell}"` : cell)

// UTF-8 with a BOM so Excel reads Thai text correctly.
export function toCsv(table: Table): string {
  return '\uFEFF' + [table.header, ...table.rows].map(row => row.map(csvCell).join(',')).join('\r\n')
}

const pad = (n: number): string => String(n).padStart(2, '0')

// `table-YYYYMMDD-HHMMSS` in local time.
function exportStem(now: Date): string {
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

  return `table-${date}-${time}`
}

export function exportName(now: Date, ext: 'csv' | 'xlsx'): string {
  return `${exportStem(now)}.${ext}`
}

export const exportsDir = (cwd: string): string => `${cwd.replace(/[\\/]+$/, '')}/cozy-exports`

// The folder a path sits in.
export const folderOf = (path: string): string => path.replace(/[\\/][^\\/]*$/, '')

// Paths handed out this session, so two saves in one second never share a
// name even before the first file is on disk.
const taken = new Set<string>()
let tempCount = 0

async function isOnDisk($: ExportHost, path: string): Promise<boolean> {
  try {
    return await $.fs.exists(path)
  } catch {
    // Unknown: the session's own list still keeps names apart.
    return false
  }
}

// `table-…`, then `table-…-2`, `-3`, … in `folder`, until a name is neither on disk nor used this session.
export async function freePathIn($: ExportHost, folder: string, now: Date, ext: 'csv' | 'xlsx'): Promise<string> {
  const stem = `${folder.replace(/[\\/]+$/, '')}/${exportStem(now)}`

  for (let n = 1; ; n++) {
    const path = `${stem}${n === 1 ? '' : `-${n}`}.${ext}`

    if (!taken.has(path) && !(await isOnDisk($, path))) {
      taken.add(path)
      return path
    }
  }
}

// The project's own place for exports: `<cwd>/cozy-exports`.
export async function saveCsv($: ExportHost, table: Table, cwd: string, now = new Date()): Promise<string> {
  return saveCsvTo($, table, await freePathIn($, exportsDir(cwd), now, 'csv'))
}

export async function saveCsvTo($: ExportHost, table: Table, path: string): Promise<string> {
  await $.fs.write(path, toCsv(table))

  return path
}

export async function saveXlsx($: ExportHost, table: Table, cwd: string, now = new Date()): Promise<string> {
  return saveXlsxTo($, table, await freePathIn($, exportsDir(cwd), now, 'xlsx'), now)
}

// The mod API can write text but not delete or zip, so the parts go to a temp
// folder beside the target and tools/zip-xlsx.ps1 zips it into the .xlsx and
// removes the folder, also when zipping fails.
export async function saveXlsxTo($: ExportHost, table: Table, path: string, now = new Date()): Promise<string> {
  const tmp = `${folderOf(path)}/.tmp-${exportStem(now).slice('table-'.length)}-${now.getMilliseconds()}-${++tempCount}`

  try {
    for (const [part, xml] of Object.entries(xlsxParts(table))) {
      await $.fs.write(`${tmp}/${part}`, xml)
    }

    const result = await $.process.run(
      ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/tools/zip-xlsx.ps1`, '-Source', tmp, '-Target', path],
      { timeoutMs: 30000 },
    )

    if (result.exitCode !== 0) {
      throw new Error(`XLSX export failed: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`}`)
    }
  } catch (error) {
    await removeFolder($, tmp)

    throw error
  }

  return path
}

// The Windows Save dialog, opened by tools/pick-save-path.ps1 in `folder` with
// the default name filled in: the path chosen, or null when it was cancelled.
// It waits as long as the engine lets a command run, ten minutes.
export async function pickSavePath($: ExportHost, ext: 'csv' | 'xlsx', folder: string, now = new Date()): Promise<string | null> {
  const result = await $.process.run(
    [
      'powershell',
      '-NoProfile',
      '-NonInteractive',
      '-STA',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      `${$.plugin.root}/tools/pick-save-path.ps1`,
      '-Kind',
      ext,
      '-Name',
      exportName(now, ext),
      '-Folder',
      folder,
    ],
    { timeoutMs: 600000 },
  )

  if (result.exitCode !== 0) {
    throw new Error(`The save dialog did not open: ${result.stderr.trim() || `exit ${result.exitCode}`}`)
  }
  const path = result.stdout.trim()

  return path === '' ? null : path
}

// Best effort: the mod API has no delete, so a failed export clears its temp
// folder through PowerShell. A failure here is swallowed so the original
// error is the one that surfaces.
async function removeFolder($: ExportHost, folder: string): Promise<void> {
  const quoted = `'${folder.replace(/\//g, '\\').replace(/'/g, "''")}'`

  try {
    await $.process.run(
      ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `Remove-Item -LiteralPath ${quoted} -Recurse -Force -ErrorAction SilentlyContinue`],
      { timeoutMs: 10000 },
    )
  } catch {
    // ignored on purpose
  }
}
