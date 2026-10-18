# Changelog

Newest first. Versions are the plugin's (`.claude-plugin/plugin.json`).

## 0.9.6 (2026-10-18)

- In a narrow desktop window, a table cell with a long Thai sentence or a file name such as `monthly_sales_report_v2.py` wraps inside its cell instead of being cut off at the cell's edge. Thai has no spaces between words and a file name has none at all, so the desktop had nowhere to wrap them: cozy now marks places to break, between Thai words and after `_ . / \ : -`, invisible on screen. Copy, CSV and XLSX keep the text as written. A two-column table has no columns to page through, so wrapping is what keeps it readable.

## 0.9.5 (2026-10-18)

- `/cozy bubble cozy|app`, and a Your bubble switch in the `/cozy` panel: `app` hands your prompt on the desktop back to Claude Code's own bubble, with Rewind, Fork, text selection and its right-click menu, in the app's colours. `cozy` (the default) keeps the bubble on the preset's paper. The terminal's prompt line is cozy's either way.

## 0.9.4 (2026-10-18)

- The time, copy and edit row under your prompt bubble shows while the pointer is on the row again, as Claude Code's own does, instead of always.
- Prompts sent before cozy noted their time show it too: at the start of a session cozy reads the session's transcript in the background for when each of your prompts was sent. A small script (`tools/prompt-times.ps1`) picks those rows out, as a transcript can be larger than a mod may read at once.

## 0.9.3 (2026-10-18)

- Your prompt bubble on the desktop shows a copy icon (⧉) and an edit icon (✎) in a dim row under it, as Claude Code's own bubble does: copy puts the prompt on the clipboard, edit puts it in the prompt box. With `/cozy icons ascii` they read Copy and Edit. Before them, how long ago you sent it ("5 minutes ago"), as the app shows it: cozy notes the time as each prompt is sent (the last 200, kept across sessions), so prompts sent before 0.9.3 show none. Rewind is not there, since a mod has no way to rewind; use `/rewind` or Esc twice. The text in a bubble cozy draws cannot be selected, and right-clicking it gives only Copy and Select All: the desktop allows neither on a prompt row a mod draws.

## 0.9.2 (2026-10-17)

- In a list redrawn for its inline code, each bullet sits on the first line of its item instead of halfway down a wrapped one.

## 0.9.1 (2026-10-17)

- XLSX columns are wide enough for their bold header and its filter button, so a header such as Revenue is no longer cut to "Revenu" in Excel.

## 0.9.0 (2026-10-17)

- A table too wide to show whole is drawn a page of columns at a time: its first column stays pinned and ◀ ▶ under it step through the rest, with "Columns 2–5 of 7" between them. On the desktop that is past five columns, on the terminal when the columns would have to break their words to fit the window. Copy, CSV and XLSX keep every column. Claude Code gives mods no sideways scroll, so this stands in for one.

## 0.8.2 (2026-10-17)

- A wide desktop table keeps every cell inside its column: padding sits inside each column's share, columns of figures get their room first, and what still does not fit is clipped at the cell's edge.
- A prompt sent with an image keeps its picture: the row is drawn again once the image is noted, and a prompt with pasted text matches too.

## 0.8.1 (2026-10-17)

- The panel's preview no longer runs its inline code into the next word.

## 0.8.0 (2026-10-17)

- XLSX exports a sheet ready to hand on: a bold header on a grey band that stays in view and carries filter buttons, and figures such as `$12,400`, `1,200` and `12.5%` stored as numbers with a format that shows the same text.
- The save question offers the last folder used, and the Windows Save dialog opens in it.
- A table over 20 rows starts with its first 10 and a Show all button; Copy and the exports take every row.
- A web link in a line redrawn for inline code is a link you can press again.
- High contrast, a tenth preset with every text colour at 7:1 (WCAG AAA), on its own Accessibility shelf.
- Saved looks: `/cozy save`, `/cozy look` and `/cozy forget`, and a Your looks section in the panel.
- The panel shows a preview of the look in its own colours.
- Table measuring and fitting moved to `hooks/table-layout.ts`.

## 0.7.4

- A table wider than the terminal keeps its box: columns give way and long cells wrap inside them.

## 0.7.3

- The Windows Save dialog opens in front of every window; the table says "Opening the Save dialog…" while it starts.
- A prompt sent with an image keeps Claude Code's own bubble, so the picture shows.

## 0.7.0 to 0.7.2

- A dot in the preset's colour beside each tool call, by kind (reading, writing, running, searching, the web, MCP), red when a call failed. Folded groups get dots in the terminal only. `/cozy tools on|off`.

## 0.5.0 to 0.6.1

- Desktop tables are a framed grid in the preset's colours that always fits the reply: header band, striped rows, figures right-aligned, a row and column count beside Copy, CSV and XLSX.
- CSV and XLSX ask where to save first: the project's `cozy-exports` folder, the Windows Save dialog, or a full path.
- The preset colours your bubble, inline code and tables by default; colours that miss 4.5:1 on a ground are moved until they read.
- A Tables on/off switch in the panel.

## 0.3.0 to 0.4.10

- Nine whole-theme presets: Kindle, Sepia, Paper, Solarized, Gruvbox, Nord, Dracula, Catppuccin and Tokyo Night, each light and dark, with theme files and Windows Terminal schemes. Pixel removed.
- The panel shows each preset as a card in its own colours, two to a row.
- Inline code drawn as a square mono chip on a see-through grey.
- Claude's text colour and the code frame were tried and removed.

## 0.2.x

- `/cozy color you|code` with named colours that change shade with the mode, a `/cozy panel`, and a desktop bubble for your prompts.

## 0.1.x

- First version: the Kindle preset, table Copy, CSV and XLSX buttons, spinner words, `/cozy` and the Windows Terminal fragment.
- Colour codes end with BEL; `/cozy` says when it falls back to a built-in Claude Code theme; CSV keeps leading zeros and exact decimals in Excel.
