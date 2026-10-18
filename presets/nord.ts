import type { Preset } from '../hooks/presets'

// Colours from Nord by Arctic Ice Studio and Sven Greb (MIT), adjusted where needed to reach 4.5:1.
export const nord: Preset = {
  name: 'nord',
  label: 'Nord',
  light: {
    palette: {
      bg: '#eceff4',
      fg: '#2e3440',
      muted: '#4c566a',
      accent: '#4f6c90',
      surface: '#e5e9f0',
      zebra: '#e9ecf2',
      hl: '#d8dee9',
      line: '#b7bbc2',
      ok: '#5f6e51',
      err: '#a05159',
      warn: '#756545',
      read: '#4f6c90',
      write: '#8d5c4c',
      run: '#7e6379',
      search: '#4f6f79',
      web: '#5f6e51',
      mcp: '#4c566a'
    },
    terminal: {
      background: '#eceff4',
      foreground: '#2e3440',
      cursorColor: '#4f6c90',
      selectionBackground: '#d8dee9',
      black: '#2e3440',
      red: '#a05159',
      green: '#5f6e51',
      yellow: '#756545',
      blue: '#4f6c90',
      purple: '#7e6379',
      cyan: '#4f6f79',
      white: '#4c566a',
      brightBlack: '#4c566a',
      brightRed: '#a15259',
      brightGreen: '#5e6e51',
      brightYellow: '#786847',
      brightBlue: '#506d91',
      brightPurple: '#7b6277',
      brightCyan: '#4f7079',
      brightWhite: '#4c566a'
    },
    spinner: [
      'Drifting',
      'Skating',
      'Gliding',
      'Snowing',
      'Frosting',
      'Cooling down'
    ],
    done: [
      'Frozen',
      'Settled',
      'Clear skies'
    ],
    boxed: 'soft'
  },
  dark: {
    palette: {
      bg: '#2e3440',
      fg: '#e5e9f0',
      muted: '#d8dee9',
      accent: '#88c0d0',
      surface: '#3b4252',
      zebra: '#353b49',
      hl: '#434c5e',
      line: '#616771',
      ok: '#a3be8c',
      err: '#d18d94',
      warn: '#ebcb8b',
      read: '#81a1c1',
      write: '#d28c76',
      run: '#b793b0',
      search: '#8fbcbb',
      web: '#a3be8c',
      mcp: '#d8dee9'
    },
    terminal: {
      background: '#2e3440',
      foreground: '#e5e9f0',
      cursorColor: '#88c0d0',
      selectionBackground: '#434c5e',
      black: '#3b4252',
      red: '#d18d94',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      purple: '#b793b0',
      cyan: '#8fbcbb',
      white: '#e5e9f0',
      brightBlack: '#d8dee9',
      brightRed: '#d18d94',
      brightGreen: '#aec69a',
      brightYellow: '#edd199',
      brightBlue: '#90acc8',
      brightPurple: '#bd9cb7',
      brightCyan: '#9cc4c3',
      brightWhite: '#e5e9f0'
    },
    spinner: [
      'Drifting',
      'Skating',
      'Gliding',
      'Snowing',
      'Frosting',
      'Cooling down'
    ],
    done: [
      'Frozen',
      'Settled',
      'Clear skies'
    ],
    boxed: 'soft'
  }
}
