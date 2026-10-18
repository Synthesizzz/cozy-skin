import { atom, read, update } from 'claude-code'
import type { MatchedHook, RenderChildren } from 'claude-code'
import { resolveColor } from './colors'
import { readable } from './contrast'
import { hasInlineCode, parseBlocks, parseInline, plainText } from './markdown-blocks'
import type { Span } from './markdown-blocks'
import { presetOf } from './presets'
import type { Look } from './presets'
import { LIVE_INIT } from './settings'
import type { Live, Note, Settings } from './settings'
import { exportsDir, folderOf, freePathIn, pickSavePath, saveCsvTo, saveXlsxTo, toTsv } from './table-export'
import { splitTables } from './table-parse'
import { alignments, columnPages, columnShares, columnWidths, displayText, fitWidths, fitsWhole, hasProseCode, longestWords, padCell, pickColumns, shortFolder, softBreaks, wrapCell } from './table-layout'
import type { Align, Table } from './table-parse'

// The `live` atom (see LIVE_INIT in settings.ts). The validator reads a read
// only where the atom is declared in the same file.
const settingsAtom = atom({ plugin: 'cozy-skin', key: 'live' } as const, LIVE_INIT)

// What each table's buttons last said, by `<message id>:<table number>`: a
// copy's answer, the path of a saved file, or why a save failed.
const notesAtom = atom({ plugin: 'cozy-skin', key: 'notes' } as const, {} as Record<string, Note>)

const KEPT_NOTES = 40

// Long tables shown in full, by `<message id>:<table number>`; the rest show
// their first SHORT_ROWS rows and a button for the others.
const openAtom = atom({ plugin: 'cozy-skin', key: 'open' } as const, {} as Record<string, true>)

// Wide tables' column pages, by `<message id>:<table number>`; absent, the first.
const pageAtom = atom({ plugin: 'cozy-skin', key: 'page' } as const, {} as Record<string, number>)

// A desktop table shows at most this many columns at once, its first pinned
// and ◀ ▶ stepping through the rest. The desktop gives no width to measure,
// so it goes by count; the terminal pages by what fits its window.
export const GRID_COLUMNS = 5

// A table with more rows than LONG_ROWS starts folded to SHORT_ROWS.
export const LONG_ROWS = 20
export const SHORT_ROWS = 10

// Where the last CSV or XLSX went, so the next can go there again.
export const FOLDER_KEY = 'saveFolder'

// An inline code chip's background: a mid grey at low opacity, which reads as
// a faint darkening on a light app and a faint lightening on a dark one, so
// it holds whichever theme the app is in, whatever cozy's own mode says.
const CHIP = '#8080802e'
// The padding inside a chip: a thin space either side.
const THIN = ' '

// The two answers to "where should the export go?"; anything else is a path typed under Other.
const PROJECT = 'Project folder'
const CHOOSE = 'Choose a folder…'

// Cells either side of a table the reply's own gutter takes.
const GUTTER = 2
// A terminal that has not measured is taken to be this wide.
const UNMEASURED = 80

type DrawReplyHook = MatchedHook<'ui.render', { component: 'AssistantMessage' }>

// A grid cell's spans with places to break their long runs (see softBreaks),
// so Thai and file names wrap inside the cell instead of being clipped.
function soften(spans: readonly Span[]): Span[] {
  return spans.map(span =>
    span.kind === 'text' || span.kind === 'code' ? { ...span, text: softBreaks(span.text) } : { ...span, spans: soften(span.spans) },
  )
}

function lookOf(live: Live): Look | undefined {
  const preset = presetOf(live.settings.preset)

  return preset === undefined ? undefined : preset[live.mode]
}

export async function drawReply($: Parameters<DrawReplyHook>[0], e: Parameters<DrawReplyHook>[1], next: Parameters<DrawReplyHook>[2]) {
  const live = await read($, settingsAtom)
  const settings: Settings = live.settings
  const look = lookOf(live)
  // Inline code's colour: the one picked, else the preset's accent. Table
  // cells always take it; the prose is redrawn for it (`code`) only when the
  // reply has inline code outside its tables.
  const codeInk =
    look === undefined ? undefined : settings.colors.code !== null ? resolveColor(settings.colors.code, live.mode) : look.palette.accent
  // In the prose it sits on the app's own ground, which Mode auto keeps near the preset paper.
  const code = codeInk !== undefined && look !== undefined && hasProseCode(e.props.text) ? readable(codeInk, look.palette.bg) : null

  if (!settings.enabled || look === undefined || e.props.isSummary === true || (settings.tables === 'off' && code === null)) {
    return next(e)
  }

  // A table with no columns (`|` on a line of its own) is text. With tables
  // off the whole reply is text, for the inline code colour alone.
  const segments =
    settings.tables === 'off'
      ? [{ kind: 'text', text: e.props.text } as const]
      : splitTables(e.props.text).map(seg =>
          seg.kind === 'table' && seg.table.header.length === 0 ? ({ kind: 'text', text: seg.source } as const) : seg,
        )

  if (!segments.some(seg => seg.kind === 'table') && code === null) {
    return next(e)
  }

  const notes = await read($, notesAtom)
  const open = await read($, openAtom)
  const paged = await read($, pageAtom)
  const { Box, Text, Button, Link, Markdown } = $.ui.resolve(e)
  const p = look.palette
  const isAscii = settings.icons === 'ascii'
  const room = (e.viewport?.columns ?? (e.surface === 'desktop' ? Number.POSITIVE_INFINITY : UNMEASURED)) - GUTTER

  const say = (id: string, text: string, isError: boolean) =>
    update($, notesAtom, now => {
      const kept = Object.entries(now).filter(([key]) => key !== id).slice(-(KEPT_NOTES - 1))

      return { ...Object.fromEntries(kept), [id]: { text, isError } }
    }).then(() => $.ui.invalidate('ui.render'))

  // Where a CSV or XLSX goes, asked first in the app's own question dialog:
  // the project's cozy-exports folder, a folder picked in the Windows Save
  // dialog, or a folder or file path typed under Other. Null: not saved
  // (the question dismissed, or the dialog cancelled).
  // `opening` is said while the Save dialog starts, which takes PowerShell a few seconds.
  const whereTo = async (ext: 'csv' | 'xlsx', opening: () => Promise<unknown>): Promise<string | null> => {
    const cwd = await $.session.cwd()
    const project = exportsDir(cwd)
    const stored = await $.store.get(FOLDER_KEY).catch(() => undefined)
    // The last folder is offered when it is somewhere other than the project's.
    const last = typeof stored === 'string' && stored !== project ? stored : null
    const lastLabel = last === null ? null : `Last folder (${shortFolder(last)})`
    let answer: string

    try {
      answer = (
        await $.ui.ask(`Save the table as ${ext.toUpperCase()} in the project's cozy-exports folder, or somewhere you choose?`, {
          header: `Save ${ext.toUpperCase()}`,
          options: lastLabel === null ? [PROJECT, CHOOSE] : [PROJECT, lastLabel, CHOOSE],
        })
      ).trim()
    } catch {
      return null
    }
    if (answer === PROJECT) {
      return freePathIn($, project, new Date(), ext)
    }
    if (last !== null && answer === lastLabel) {
      return freePathIn($, last, new Date(), ext)
    }
    if (answer === CHOOSE) {
      await opening()
      const start = last ?? ((await $.fs.exists(project).catch(() => false)) ? project : cwd)

      return pickSavePath($, ext, start)
    }
    // Typed under Other: a file path keeps its name, a folder gets the usual
    // one. Only a full path counts; the dialog's own "[No preference]" and an
    // empty answer save nothing, and a relative path is refused rather than
    // made into a folder inside the project.
    const typed = answer.replace(/^["']|["']$/g, '')

    if (typed === '' || /^\[.*\]$/.test(typed)) {
      return null
    }
    if (!/^([A-Za-z]:[\\/]|[\\/])/.test(typed)) {
      throw new Error(`Not saved: "${typed}" is not a full path (like D:\\Reports)`)
    }
    if (new RegExp(`\\.${ext}$`, 'i').test(typed)) {
      if (await $.fs.exists(typed).catch(() => false)) {
        throw new Error(`Not saved: ${typed} is already there`)
      }
      return typed
    }
    return freePathIn($, typed, new Date(), ext)
  }

  const press = (id: string, table: Table, kind: 'copy' | 'csv' | 'xlsx') => async (pressed: { surface: string }) => {
    try {
      if (kind === 'copy') {
        const result = await $.ui.copy({ text: toTsv(table), surface: pressed.surface as typeof e.surface })

        await say(id, result.isCopied ? 'Copied' : `Not copied (${result.reason})`, !result.isCopied)
        return
      }
      const path = await whereTo(kind, () => say(id, 'Opening the Save dialog…', false))

      if (path === null) {
        await say(id, 'Not saved', false)
        return
      }
      await (kind === 'csv' ? saveCsvTo($, table, path) : saveXlsxTo($, table, path))
      await $.store.set(FOLDER_KEY, folderOf(path)).catch(() => undefined)
      await say(id, `Saved ${path}`, false)
    } catch (error) {
      try {
        await say(id, error instanceof Error ? error.message : String(error), true)
      } catch {
        // Nothing more can be shown; the press must not throw.
      }
    }
  }

  // A bordered table at `widths`; a cell longer than its column wraps inside
  // it and its row grows a line, so a narrow terminal keeps the box.
  const drawBox = (table: Table, widths: number[]) => {
    const rule = isAscii ? '|' : '│'
    const line = (row: readonly string[], bg: string, isHeader: boolean) => (
      <Box flexDirection="row" backgroundColor={bg}>
        {row.flatMap((cell, c) => {
          const text = (
            <Text color={p.fg} backgroundColor={bg} {...(isHeader ? { weight: 'bold' as const } : {})}>
              {` ${padCell(cell, widths[c] ?? 1, table.align[c] ?? null)} `}
            </Text>
          )

          return c === 0 ? [text] : [<Text color={p.line} backgroundColor={bg}>{rule}</Text>, text]
        })}
      </Box>
    )
    const cells = (row: readonly string[], bg: string, isHeader: boolean) => {
      const wrapped = row.map((cell, c) => wrapCell(cell, widths[c] ?? 1))
      const height = Math.max(1, ...wrapped.map(lines => lines.length))

      return Array.from({ length: height }, (_, i) =>
        line(
          wrapped.map(lines => lines[i] ?? ''),
          bg,
          isHeader,
        ),
      )
    }

    return (
      <Box
        flexDirection="column"
        alignSelf="flex-start"
        borderStyle={isAscii ? 'classic' : 'round'}
        borderColor={p.line}
      >
        {cells(table.header, p.surface, true)}
        {table.rows.map((row, r) => cells(row, r % 2 === 0 ? p.bg : p.zebra, false))}
      </Box>
    )
  }

  // The desktop table, from the app's own: a framed grid as wide as the reply,
  // a header band, a stripe on every other row and room in each cell, all in
  // the preset's colours on its paper, as the prompt bubble is. Columns share
  // the width by percent, never under their longest word, and a long cell
  // wraps inside its column: the grid always fits the reply, so no column is
  // ever cut off. A wider table is drawn a page of columns at a time (see
  // drawPager), as the API has no sideways scroll. Cells keep their bold,
  // italics, links and code.
  const drawGrid = (table: Table, shown: Table, widths: number[]) => {
    const align = alignments(table)
    const justify = (c: number) => (align[c] === 'right' ? 'flex-end' : align[c] === 'center' ? 'center' : 'flex-start')
    const shares = columnShares(widths, longestWords(shown))
    const bands = [p.surface, ...table.rows.map((_, r) => (r % 2 === 1 ? p.zebra : undefined))]
    // Four or five columns share the reply's width with less room in each cell.
    const room = table.header.length >= 4 ? ('sm' as const) : ('md' as const)

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={p.line} backgroundColor={p.bg} overflow="hidden" padding={0}>
        {[table.header, ...table.rows].map((cells, r) => (
          <Box key={`row-${r}`} flexDirection="row" backgroundColor={bands[r]} paddingY="sm">
            {table.header.map((_, c) => (
              // The share is the cell's whole width, its padding inside it, so
              // a row never runs past the frame; what still does not fit is
              // clipped at the cell's edge rather than drawn over the next.
              <Box key={`cell-${r}-${c}`} width={`${shares[c] ?? 0}%`} flexShrink={1} overflow="hidden" flexDirection="row" justifyContent={justify(c)}>
                <Box paddingX={room} flexShrink={1}>
                  <Text color={readable(p.fg, bands[r] ?? p.bg)} wrap="wrap" {...(r === 0 ? { weight: 'semibold' as const } : {})}>
                    {drawSpans(soften(parseInline(cells[c] ?? '')), codeInk === undefined ? undefined : readable(codeInk, bands[r] ?? p.bg))}
                  </Text>
                </Box>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  }

  const drawText = (table: Table, widths: number[]) => {
    const line = (row: readonly string[]) =>
      row.map((cell, c) => padCell(cell, widths[c] ?? 1, table.align[c] ?? null)).join('  ').trimEnd()
    const rule = (isAscii ? '-' : '─').repeat(Math.max(1, widths.reduce((sum, w) => sum + w, 0) + 2 * (widths.length - 1)))

    return (
      <Box flexDirection="column">
        <Text color={p.fg} weight="bold" wrap="wrap">{line(table.header)}</Text>
        <Text color={p.line}>{rule}</Text>
        {table.rows.map(row => <Text color={p.fg} wrap="wrap">{line(row)}</Text>)}
      </Box>
    )
  }

  // The buttons under a table. On the desktop they sit right, with the
  // table's size on the left, as a dashboard's footer reads.
  const drawButtons = (id: string, table: Table, n: number, isGrid: boolean) => {
    const note = notes[id]
    const button = (kind: 'copy' | 'csv' | 'xlsx', label: string) =>
      isGrid ? (
        <Button key={`${kind}-${n}`} label={label} variant="secondary" onPress={press(id, table, kind)} />
      ) : (
        <Button key={`${kind}-${n}`} label={label} hover={{ color: p.accent }} onPress={press(id, table, kind)}>
          <Text color={p.muted}>{label}</Text>
        </Button>
      )
    const buttons = (
      <Box flexDirection="row" gap={1}>
        {button('copy', 'Copy')}
        {button('csv', 'CSV')}
        {button('xlsx', 'XLSX')}
      </Box>
    )
    const count = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`

    return (
      <Box key={`tools-${n}`} flexDirection="column" {...(isGrid ? { gap: 'xs' as const, paddingTop: 'xs' as const } : {})}>
        {isGrid ? (
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text size="caption" dimColor>
              {`${count(table.rows.length, 'row')} · ${count(table.header.length, 'column')}`}
            </Text>
            {buttons}
          </Box>
        ) : (
          buttons
        )}
        {note === undefined ? null : (
          <Text color={note.isError ? p.err : p.ok} wrap="wrap" {...(isGrid ? { size: 'caption' as const } : {})}>
            {note.text}
          </Text>
        )}
      </Box>
    )
  }

  // ◀ Columns 2–5 of 7 ▶: steps a wide table's pages. An arrow with nowhere
  // to go is drawn dim, not as a button, so the row keeps its place.
  const drawPager = (id: string, n: number, page: number, pages: number[][], count: number, isGrid: boolean) => {
    const shown = pages[page] ?? []
    const first = (shown[0] ?? 1) + 1
    const last = (shown[shown.length - 1] ?? 1) + 1
    const go = (to: number) => () =>
      void update($, pageAtom, now => {
        const { [id]: _, ...rest } = now

        return to === 0 ? rest : { ...rest, [id]: to }
      }).then(() => $.ui.invalidate('ui.render'))
    const arrow = (side: 'left' | 'right', to: number) => {
      const glyph = side === 'left' ? (isAscii ? '<' : '◀') : isAscii ? '>' : '▶'

      if (to < 0 || to >= pages.length) {
        return <Text key={`${side}-${n}`} dimColor>{glyph}</Text>
      }
      return isGrid ? (
        <Button key={`${side}-${n}`} label={glyph} variant="secondary" onPress={go(to)} />
      ) : (
        <Button key={`${side}-${n}`} label={glyph} hover={{ color: p.accent }} onPress={go(to)}>
          <Text color={p.fg}>{glyph}</Text>
        </Button>
      )
    }

    return (
      <Box key={`pager-${n}`} flexDirection="row" alignItems="center" gap={1}>
        {arrow('left', page - 1)}
        <Text dimColor {...(isGrid ? { size: 'caption' as const } : {})}>
          {`${first === last ? `Column ${first}` : `Columns ${first}–${last}`} of ${count}`}
        </Text>
        {arrow('right', page + 1)}
      </Box>
    )
  }

  // Inline code in the picked colour on a soft wash of it (the terminal takes
  // no alpha, so it gets the colour alone). The words around it keep the app's
  // own text colour: no colour is set on them.
  const drawSpans = (spans: readonly Span[], wash: string | undefined): RenderChildren[] =>
    spans.map(span => {
      switch (span.kind) {
        case 'text':
          return span.text
        case 'code': {
          if (e.surface === 'terminal') {
            return <Text color={wash}>{span.text}</Text>
          }
          // As close to the app's own chip as a Text gets: monospace on a
          // see-through mid grey that shows on a light and a dark app alike,
          // a thin space either side inside it. Square corners: inline Text
          // has no radius (half-circle ends were tried in 0.4.4 and dropped).
          return (
            <Text color={wash} mono backgroundColor={CHIP}>
              {`${THIN}${span.text}${THIN}`}
            </Text>
          )
        }
        case 'strong':
          return <Text weight="bold">{drawSpans(span.spans, wash)}</Text>
        case 'em':
          return <Text italic>{drawSpans(span.spans, wash)}</Text>
        case 'strike':
          return <Text strikethrough>{drawSpans(span.spans, wash)}</Text>
        case 'link': {
          const shown = plainText(span.spans)

          // A web address is a real link, pressed as the app's own are; any
          // other target (a path, a bare anchor) keeps its address beside it.
          if (/^https?:\/\//i.test(span.url)) {
            return <Link href={span.url} label={shown} />
          }
          return (
            <Text>
              <Text underline>{drawSpans(span.spans, wash)}</Text>
              {shown === span.url ? '' : <Text dimColor>{` (${span.url})`}</Text>}
            </Text>
          )
        }
      }
    })

  // Only the blocks that hold inline code are redrawn; every other run of
  // blocks goes to the engine's Markdown exactly as written.
  const drawWithCode = (text: string, wash: string) => {
    const out: RenderChildren[] = []
    let plain: string[] = []
    const flush = () => {
      if (plain.length > 0) {
        out.push(<Markdown text={plain.join('\n\n')} />)
        plain = []
      }
    }

    for (const block of parseBlocks(text)) {
      if (block.kind === 'para' && hasInlineCode(block.text)) {
        flush()
        out.push(<Text wrap="wrap">{drawSpans(parseInline(block.text), wash)}</Text>)
      } else if (block.kind === 'heading' && hasInlineCode(block.text)) {
        flush()
        out.push(
          <Text weight="bold" size={block.level <= 2 ? 'heading' : 'body'} wrap="wrap">
            {drawSpans(parseInline(block.text), wash)}
          </Text>,
        )
      } else if (block.kind === 'list' && block.items.some(item => hasInlineCode(item.text))) {
        flush()
        out.push(
          <Box flexDirection="column">
            {block.items.map(item => (
              // The marker stays on the item's first line when its text wraps.
              <Box flexDirection="row" alignItems="flex-start">
                <Text dimColor>{`${' '.repeat(item.indent)}${/^\d/.test(item.marker) ? item.marker : isAscii ? '-' : '•'} `}</Text>
                <Text wrap="wrap">{drawSpans(parseInline(item.text), wash)}</Text>
              </Box>
            ))}
          </Box>,
        )
      } else {
        plain.push(block.source)
      }
    }
    flush()

    return (
      <Box flexDirection="column" gap={1}>
        {out}
      </Box>
    )
  }

  let n = 0
  const parts = segments.map(seg => {
    if (seg.kind === 'text') {
      return code === null ? <Markdown text={seg.text} /> : drawWithCode(seg.text, code)
    }
    const index = n++
    const id = `${e.requestId}:${index}`
    // Drawn and measured without markdown marks; the buttons get the cells as written.
    const shown: Table = { ...seg.table, header: seg.table.header.map(displayText), rows: seg.table.rows.map(row => row.map(displayText)) }
    const widths = columnWidths(shown)
    const words = longestWords(shown)
    // The desktop gets the grid, which wraps its cells; the terminal a box
    // when it fits, else the text level.
    const isGrid = settings.tables === 'box' && e.surface !== 'terminal'
    const count = seg.table.header.length
    // Too wide to show whole, a table goes in pages of columns behind its
    // pinned first one: on the desktop past GRID_COLUMNS, on the terminal
    // when its columns would have to break words to fit the window. A window
    // too narrow for even one column beside the pinned one gets no pages.
    const of = (cols: number[], at: readonly number[]) => cols.map(c => at[c] ?? 1)
    const boxPages = () => {
      const all = columnPages(count, cols => fitsWhole(of(cols, widths), of(cols, words), room))

      return all.every(page => fitWidths(of([0, ...page], widths), of([0, ...page], words), room) !== null) ? all : []
    }
    const pages = isGrid ? columnPages(count, cols => cols.length <= GRID_COLUMNS) : settings.tables === 'box' ? boxPages() : []
    const page = pages.length === 0 ? null : Math.min(paged[id] ?? 0, pages.length - 1)
    const cols = page === null ? null : [0, ...(pages[page] ?? [])]
    const pick = <T extends Table>(t: T): T => (cols === null ? t : pickColumns(t, cols))
    const pickWidths = (at: number[]) => (cols === null ? at : of(cols, at))
    // The terminal's box fits the window: columns give way and wrap; only a
    // window too narrow for even that gets the text level.
    const fitted = settings.tables === 'box' ? fitWidths(pickWidths(widths), pickWidths(words), room) : null
    const isBoxed = fitted !== null
    const aligned: Table = { ...shown, align: alignments(shown) }
    // A long table starts folded to its first rows; the columns keep the
    // widths of the whole table, so unfolding moves nothing. Copy and the
    // exports always take every row.
    const isLong = seg.table.rows.length > LONG_ROWS
    const isFolded = isLong && open[id] !== true
    const head = <T extends Table>(t: T): T => (isFolded ? { ...t, rows: t.rows.slice(0, SHORT_ROWS) } : t)
    const toggle = isLong ? (
      <Button
        key={`more-${index}`}
        label={isFolded ? `Show all ${seg.table.rows.length} rows` : 'Show fewer rows'}
        {...(isGrid ? { variant: 'secondary' as const } : { dimColor: true })}
        onPress={() =>
          void update($, openAtom, now => {
            const { [id]: _, ...rest } = now

            return isFolded ? { ...rest, [id]: true as const } : rest
          }).then(() => $.ui.invalidate('ui.render'))
        }
      />
    ) : null
    const pager = page === null ? null : drawPager(id, index, page, pages, count, isGrid)

    return (
      <Box flexDirection="column" {...(isGrid ? { marginY: 'xs' as const } : {})}>
        {isGrid
          ? drawGrid(head(pick({ ...seg.table, align: aligned.align })), head(pick(shown)), pickWidths(widths))
          : isBoxed
            ? drawBox(head(pick(aligned)), fitted)
            : drawText(head(aligned), widths)}
        {toggle === null && pager === null ? null : (
          <Box flexDirection="row" alignItems="center" gap={isGrid ? ('md' as const) : 2} {...(isGrid ? { paddingTop: 'xs' as const } : {})}>
            {pager}
            {toggle}
          </Box>
        )}
        {drawButtons(id, seg.table, index, isGrid)}
      </Box>
    )
  })

  return <Box flexDirection="column">{parts}</Box>
}
