import { promptKey } from './prompt-images'

// When each prompt was sent. A UserMessage row's props carry no time and the
// session's messages keep none a mod can read, so `prompt.submit` notes it
// here (in the store, so it holds across sessions), by the prompt's text as
// prompt-images.ts keys it. A prompt sent twice shows its latest send.

export const SENT_KEY = 'sent'

// How many send times are remembered; older prompts show no time.
export const KEPT_SENT = 200

export type Sent = Record<string, number>

// The kept times with `text` sent at `at`, the oldest dropped past KEPT_SENT.
export function rememberSent(kept: Sent, text: string, at: number): Sent {
  const key = promptKey(text)
  const { [key]: _, ...rest } = kept
  const entries = Object.entries({ ...rest, [key]: at }).sort((a, b) => a[1] - b[1])

  return Object.fromEntries(entries.slice(-KEPT_SENT))
}

export function sentAt(kept: Sent, text: string): number | undefined {
  return kept[promptKey(text)]
}

// Anything stored can be old or hand-edited: only finite numbers are kept.
export function saneSent(raw: unknown): Sent {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }
  const entries = Object.entries(raw).filter((entry): entry is [string, number] => Number.isFinite(entry[1]))

  return Object.fromEntries(entries.sort((a, b) => a[1] - b[1]).slice(-KEPT_SENT))
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// How long ago, in the app's own words: "just now", "5 minutes ago",
// "1 hour ago", "yesterday", "3 days ago".
export function agoLabel(now: number, then: number): string {
  const ms = Math.max(0, now - then)
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`

  if (ms < MINUTE) {
    return 'just now'
  }
  if (ms < HOUR) {
    return plural(Math.floor(ms / MINUTE), 'minute')
  }
  if (ms < DAY) {
    return plural(Math.floor(ms / HOUR), 'hour')
  }
  if (ms < 2 * DAY) {
    return 'yesterday'
  }

  return plural(Math.floor(ms / DAY), 'day')
}

// Where Claude Code keeps a session's transcript: under the home folder, in a
// folder named for the working directory with every other character a dash.
export function transcriptPath(home: string, cwd: string, sessionId: string): string {
  const folder = cwd.replace(/[^A-Za-z0-9]/g, '-')

  return `${home.replace(/[\\/]+$/, '')}/.claude/projects/${folder}/${sessionId}.jsonl`
}

// The prompts tools/prompt-times.ps1 found in a transcript, as [text, sent at];
// anything it printed that is not that shape is skipped.
export function parseTranscriptTimes(stdout: string): Array<[string, number]> {
  try {
    const rows: unknown = JSON.parse(stdout.replace(/^\uFEFF/, '').trim() || '[]')

    if (!Array.isArray(rows)) {
      return []
    }

    return rows.flatMap(row => {
      const { t, text } = (row ?? {}) as { t?: unknown; text?: unknown }
      const at = typeof t === 'string' ? Date.parse(t) : NaN

      return typeof text === 'string' && Number.isFinite(at) ? [[text, at] as [string, number]] : []
    })
  } catch {
    return []
  }
}

// The kept times with a transcript's added: a prompt sent more than once keeps
// its latest send, whichever side noted it.
export function mergeSent(kept: Sent, found: ReadonlyArray<readonly [string, number]>): Sent {
  let merged = kept

  for (const [text, at] of found) {
    const was = sentAt(merged, text)

    if (was === undefined || at > was) {
      merged = rememberSent(merged, text, at)
    }
  }

  return merged
}
