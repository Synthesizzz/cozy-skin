import type { Preset } from '../hooks/presets'

export const kindle: Preset = {
  name: 'kindle',
  label: 'Kindle',
  light: {
    palette: {
      bg: '#e9dcc3',
      fg: '#43372a',
      muted: '#5f4e3b',
      accent: '#9a5b2c',
      surface: '#dfcfb1',
      zebra: '#e3d4b9',
      hl: '#d8c08f',
      line: '#cbb894',
      ok: '#5a7443',
      err: '#a8402f',
      warn: '#8a5f12',
      read: '#4f6f7a',
      write: '#9a5b2c',
      run: '#7a4a63',
      search: '#2f6e6a',
      web: '#5a7443',
      mcp: '#6b5b3e'
    },
    terminal: {
      background: '#e9dcc3',
      foreground: '#43372a',
      cursorColor: '#9a5b2c',
      selectionBackground: '#d8c08f',
      black: '#43372a',
      red: '#a53f2e',
      green: '#50673b',
      yellow: '#7f5811',
      blue: '#47646e',
      purple: '#7a4a63',
      cyan: '#2d6a66',
      white: '#6b5b3e',
      brightBlack: '#5f4e3b',
      brightRed: '#9f4333',
      brightGreen: '#4f663b',
      brightYellow: '#80580d',
      brightBlue: '#496475',
      brightPurple: '#82506e',
      brightCyan: '#2e6a65',
      brightWhite: '#5f4e3b'
    },
    spinner: [
      'Brewing',
      'Reading',
      'Turning pages',
      'Steeping',
      'Dog-earing',
      'Sipping tea'
    ],
    done: [
      'Bookmarked',
      'Chapter closed',
      'Tea is ready'
    ],
    boxed: 'soft'
  },
  dark: {
    palette: {
      bg: '#38332d',
      fg: '#ddd1bc',
      muted: '#b3a690',
      accent: '#d29a62',
      surface: '#433d36',
      zebra: '#3d3731',
      hl: '#5b4d3b',
      line: '#4d463e',
      ok: '#aabd86',
      err: '#e0866f',
      warn: '#e0b866',
      read: '#8fb4c0',
      write: '#d29a62',
      run: '#c79ab5',
      search: '#86c2b5',
      web: '#aabd86',
      mcp: '#b3a690'
    },
    terminal: {
      background: '#38332d',
      foreground: '#ddd1bc',
      cursorColor: '#d29a62',
      selectionBackground: '#5b4d3b',
      black: '#8a7f6e',
      red: '#e0866f',
      green: '#aabd86',
      yellow: '#e0b866',
      blue: '#8fb4c0',
      purple: '#c79ab5',
      cyan: '#86c2b5',
      white: '#ddd1bc',
      brightBlack: '#a89d8f',
      brightRed: '#eb9a85',
      brightGreen: '#bccd9a',
      brightYellow: '#ecc87e',
      brightBlue: '#a4c4cf',
      brightPurple: '#d4aec4',
      brightCyan: '#9ccfc3',
      brightWhite: '#efe6d4'
    },
    spinner: [
      'Brewing',
      'Reading',
      'Turning pages',
      'Steeping',
      'Dog-earing',
      'Sipping tea'
    ],
    done: [
      'Bookmarked',
      'Chapter closed',
      'Tea is ready'
    ],
    boxed: 'soft'
  }
}
