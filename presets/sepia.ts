import type { Preset } from '../hooks/presets'

// cozy-skin's own e-reader look.
export const sepia: Preset = {
  name: 'sepia',
  label: 'Sepia',
  light: {
    palette: {
      bg: '#f4ecd8',
      fg: '#5b4636',
      muted: '#73604b',
      accent: '#99582a',
      surface: '#ebe0c6',
      zebra: '#f0e6cf',
      hl: '#e3d3a8',
      line: '#c9beab',
      ok: '#5b6e2d',
      err: '#a63d2a',
      warn: '#8a6212',
      read: '#3f6178',
      write: '#a0522d',
      run: '#7d4a6a',
      search: '#2f6b62',
      web: '#5b6e2d',
      mcp: '#73604b'
    },
    terminal: {
      background: '#f4ecd8',
      foreground: '#5b4636',
      cursorColor: '#99582a',
      selectionBackground: '#e3d3a8',
      black: '#5b4636',
      red: '#a63d2a',
      green: '#5b6e2d',
      yellow: '#8a6212',
      blue: '#3f6178',
      purple: '#7d4a6a',
      cyan: '#2f6b62',
      white: '#73604b',
      brightBlack: '#73604b',
      brightRed: '#923625',
      brightGreen: '#506128',
      brightYellow: '#795610',
      brightBlue: '#37556a',
      brightPurple: '#6e415d',
      brightCyan: '#295e56',
      brightWhite: '#73604b'
    },
    spinner: [
      'Reading',
      'Turning pages',
      'Underlining',
      'Annotating',
      'Marking the margin',
      'Bookmarking'
    ],
    done: [
      'Page turned',
      'Chapter read',
      'Bookmarked'
    ],
    boxed: 'soft'
  },
  dark: {
    palette: {
      bg: '#1f1a14',
      fg: '#d9c9a8',
      muted: '#a8977a',
      accent: '#d9a066',
      surface: '#2a241c',
      zebra: '#251f18',
      hl: '#3d3326',
      line: '#534b3d',
      ok: '#a8b878',
      err: '#e08a6d',
      warn: '#e0bc6a',
      read: '#8fb0c4',
      write: '#e0a070',
      run: '#c49ab5',
      search: '#8cc2b4',
      web: '#a8b878',
      mcp: '#a8977a'
    },
    terminal: {
      background: '#1f1a14',
      foreground: '#d9c9a8',
      cursorColor: '#d9a066',
      selectionBackground: '#3d3326',
      black: '#2a241c',
      red: '#e08a6d',
      green: '#a8b878',
      yellow: '#e0bc6a',
      blue: '#8fb0c4',
      purple: '#c49ab5',
      cyan: '#8cc2b4',
      white: '#d9c9a8',
      brightBlack: '#a8977a',
      brightRed: '#e4987f',
      brightGreen: '#b2c188',
      brightYellow: '#e4c47c',
      brightBlue: '#9cb9cb',
      brightPurple: '#cba6be',
      brightCyan: '#9ac9bd',
      brightWhite: '#d9c9a8'
    },
    spinner: [
      'Reading',
      'Turning pages',
      'Underlining',
      'Annotating',
      'Marking the margin',
      'Bookmarking'
    ],
    done: [
      'Page turned',
      'Chapter read',
      'Bookmarked'
    ],
    boxed: 'soft'
  }
}
