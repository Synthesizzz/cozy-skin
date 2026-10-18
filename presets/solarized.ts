import type { Preset } from '../hooks/presets'

// Colours from Solarized by Ethan Schoonover (MIT), adjusted where needed to reach 4.5:1.
export const solarized: Preset = {
  name: 'solarized',
  label: 'Solarized',
  light: {
    palette: {
      bg: '#fdf6e3',
      fg: '#586e75',
      muted: '#5d7179',
      accent: '#1f72ac',
      surface: '#eee8d5',
      zebra: '#f6efdc',
      hl: '#e4dcc4',
      line: '#cfd0c4',
      ok: '#687700',
      err: '#d3302d',
      warn: '#8a6800',
      read: '#1f72ac',
      write: '#bf4715',
      run: '#6368b4',
      search: '#207a74',
      web: '#687700',
      mcp: '#5d7179'
    },
    terminal: {
      background: '#fdf6e3',
      foreground: '#586e75',
      cursorColor: '#1f72ac',
      selectionBackground: '#e4dcc4',
      black: '#586e75',
      red: '#d3302d',
      green: '#687700',
      yellow: '#8a6800',
      blue: '#1f72ac',
      purple: '#6368b4',
      cyan: '#207a74',
      white: '#5d7179',
      brightBlack: '#5d7179',
      brightRed: '#c22c29',
      brightGreen: '#677700',
      brightYellow: '#8c6a00',
      brightBlue: '#1f73ae',
      brightPurple: '#5f63ac',
      brightCyan: '#207a73',
      brightWhite: '#5d7179'
    },
    spinner: [
      'Warming up',
      'Calibrating',
      'Balancing',
      'Adjusting',
      'Measuring light',
      'Settling'
    ],
    done: [
      'Balanced',
      'Calibrated',
      'Settled'
    ],
    boxed: 'soft'
  },
  dark: {
    palette: {
      bg: '#002b36',
      fg: '#93a1a1',
      muted: '#839496',
      accent: '#3c97d7',
      surface: '#073642',
      zebra: '#04313c',
      hl: '#0e4553',
      line: '#294c54',
      ok: '#859900',
      err: '#e56765',
      warn: '#b58900',
      read: '#3c97d7',
      write: '#d7764e',
      run: '#868bcf',
      search: '#2aa198',
      web: '#859900',
      mcp: '#839496'
    },
    terminal: {
      background: '#002b36',
      foreground: '#93a1a1',
      cursorColor: '#3c97d7',
      selectionBackground: '#0e4553',
      black: '#073642',
      red: '#e56765',
      green: '#859900',
      yellow: '#b58900',
      blue: '#3c97d7',
      purple: '#868bcf',
      cyan: '#2aa198',
      white: '#93a1a1',
      brightBlack: '#839496',
      brightRed: '#e56865',
      brightGreen: '#94a51f',
      brightYellow: '#be971f',
      brightBlue: '#4099d7',
      brightPurple: '#868ace',
      brightCyan: '#44aca4',
      brightWhite: '#93a1a1'
    },
    spinner: [
      'Warming up',
      'Calibrating',
      'Balancing',
      'Adjusting',
      'Measuring light',
      'Settling'
    ],
    done: [
      'Balanced',
      'Calibrated',
      'Settled'
    ],
    boxed: 'soft'
  }
}
