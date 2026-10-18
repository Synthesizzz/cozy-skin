import type { Preset } from '../hooks/presets'

// Colours from Catppuccin (Latte, Mocha) by the Catppuccin org (MIT), adjusted where needed to reach 4.5:1.
export const catppuccin: Preset = {
  name: 'catppuccin',
  label: 'Catppuccin',
  light: {
    palette: {
      bg: '#eff1f5',
      fg: '#4c4f69',
      muted: '#686b80',
      accent: '#8839ef',
      surface: '#e6e9ef',
      zebra: '#ebedf2',
      hl: '#ccd0da',
      line: '#c1c4ce',
      ok: '#317a21',
      err: '#d20f39',
      warn: '#935e13',
      read: '#1d62eb',
      write: '#b74808',
      run: '#8839ef',
      search: '#13787d',
      web: '#317a21',
      mcp: '#686b80'
    },
    terminal: {
      background: '#eff1f5',
      foreground: '#4c4f69',
      cursorColor: '#8839ef',
      selectionBackground: '#ccd0da',
      black: '#4c4f69',
      red: '#d20f39',
      green: '#317a21',
      yellow: '#935e13',
      blue: '#1d62eb',
      purple: '#8839ef',
      cyan: '#13787d',
      white: '#686b80',
      brightBlack: '#686b80',
      brightRed: '#b90d32',
      brightGreen: '#317c21',
      brightYellow: '#955f14',
      brightBlue: '#1a5ad8',
      brightPurple: '#7832d2',
      brightCyan: '#13787f',
      brightWhite: '#686b80'
    },
    spinner: [
      'Purring',
      'Napping',
      'Kneading',
      'Stretching',
      'Pouncing',
      'Sipping'
    ],
    done: [
      'Purred',
      'Nap done',
      'Cozy'
    ],
    boxed: 'soft'
  },
  dark: {
    palette: {
      bg: '#1e1e2e',
      fg: '#cdd6f4',
      muted: '#a6adc8',
      accent: '#cba6f7',
      surface: '#313244',
      zebra: '#282839',
      hl: '#45475a',
      line: '#4f5265',
      ok: '#a6e3a1',
      err: '#f38ba8',
      warn: '#f9e2af',
      read: '#89b4fa',
      write: '#fab387',
      run: '#cba6f7',
      search: '#94e2d5',
      web: '#a6e3a1',
      mcp: '#a6adc8'
    },
    terminal: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursorColor: '#cba6f7',
      selectionBackground: '#45475a',
      black: '#313244',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      purple: '#cba6f7',
      cyan: '#94e2d5',
      white: '#cdd6f4',
      brightBlack: '#a6adc8',
      brightRed: '#f499b2',
      brightGreen: '#b1e6ac',
      brightYellow: '#fae5b9',
      brightBlue: '#97bdfb',
      brightPurple: '#d1b1f8',
      brightCyan: '#a1e5da',
      brightWhite: '#cdd6f4'
    },
    spinner: [
      'Purring',
      'Napping',
      'Kneading',
      'Stretching',
      'Pouncing',
      'Sipping'
    ],
    done: [
      'Purred',
      'Nap done',
      'Cozy'
    ],
    boxed: 'soft'
  }
}
