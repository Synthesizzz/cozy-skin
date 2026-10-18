import type { Preset } from '../hooks/presets'

// cozy-skin's own e-reader look.
export const paper: Preset = {
  name: 'paper',
  label: 'Paper',
  light: {
    palette: {
      bg: '#f7f7f2',
      fg: '#111111',
      muted: '#4a4a48',
      accent: '#1f4e8c',
      surface: '#ecece6',
      zebra: '#f2f2ec',
      hl: '#dcdcd2',
      line: '#b7b7b3',
      ok: '#2e6b2e',
      err: '#a3221c',
      warn: '#7a5a00',
      read: '#1f4e8c',
      write: '#9a4a10',
      run: '#6a3d8c',
      search: '#1d6b6b',
      web: '#2e6b2e',
      mcp: '#4a4a48'
    },
    terminal: {
      background: '#f7f7f2',
      foreground: '#111111',
      cursorColor: '#1f4e8c',
      selectionBackground: '#dcdcd2',
      black: '#111111',
      red: '#a3221c',
      green: '#2e6b2e',
      yellow: '#7a5a00',
      blue: '#1f4e8c',
      purple: '#6a3d8c',
      cyan: '#1d6b6b',
      white: '#4a4a48',
      brightBlack: '#4a4a48',
      brightRed: '#8f1e19',
      brightGreen: '#285e28',
      brightYellow: '#6b4f00',
      brightBlue: '#1b457b',
      brightPurple: '#5d367b',
      brightCyan: '#1a5e5e',
      brightWhite: '#4a4a48'
    },
    spinner: [
      'Inking',
      'Typesetting',
      'Refreshing the page',
      'Setting type',
      'Proofreading',
      'Turning the page'
    ],
    done: [
      'Printed',
      'Page set',
      'Proofed'
    ],
    boxed: 'soft'
  },
  dark: {
    palette: {
      bg: '#121212',
      fg: '#e8e8e6',
      muted: '#ababa8',
      accent: '#8ab4f8',
      surface: '#1e1e1e',
      zebra: '#181818',
      hl: '#333333',
      line: '#4e4e4d',
      ok: '#81c995',
      err: '#f28b82',
      warn: '#fdd663',
      read: '#8ab4f8',
      write: '#fcad70',
      run: '#c58af9',
      search: '#78d9ec',
      web: '#81c995',
      mcp: '#ababa8'
    },
    terminal: {
      background: '#121212',
      foreground: '#e8e8e6',
      cursorColor: '#8ab4f8',
      selectionBackground: '#333333',
      black: '#1e1e1e',
      red: '#f28b82',
      green: '#81c995',
      yellow: '#fdd663',
      blue: '#8ab4f8',
      purple: '#c58af9',
      cyan: '#78d9ec',
      white: '#e8e8e6',
      brightBlack: '#ababa8',
      brightRed: '#f49991',
      brightGreen: '#90cfa2',
      brightYellow: '#fddb76',
      brightBlue: '#98bdf9',
      brightPurple: '#cc98fa',
      brightCyan: '#88deee',
      brightWhite: '#e8e8e6'
    },
    spinner: [
      'Inking',
      'Typesetting',
      'Refreshing the page',
      'Setting type',
      'Proofreading',
      'Turning the page'
    ],
    done: [
      'Printed',
      'Page set',
      'Proofed'
    ],
    boxed: 'soft'
  }
}
