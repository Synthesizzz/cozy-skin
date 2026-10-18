import type { Preset } from '../hooks/presets'

// cozy-skin's own high-contrast look: every text colour reaches 7:1 (WCAG AAA).
export const contrast: Preset = {
  name: 'contrast',
  label: 'High contrast',
  light: {
    palette: {
      bg: '#ffffff',
      fg: '#000000',
      muted: '#333333',
      accent: '#003d99',
      surface: '#efefef',
      zebra: '#f7f7f7',
      hl: '#d6e4ff',
      line: '#b8b8b8',
      ok: '#004f00',
      err: '#a00000',
      warn: '#5c4300',
      read: '#003d99',
      write: '#7a3300',
      run: '#55188a',
      search: '#00525c',
      web: '#004f00',
      mcp: '#333333'
    },
    terminal: {
      background: '#ffffff',
      foreground: '#000000',
      cursorColor: '#003d99',
      selectionBackground: '#d6e4ff',
      black: '#000000',
      red: '#a00000',
      green: '#004f00',
      yellow: '#5c4300',
      blue: '#003d99',
      purple: '#55188a',
      cyan: '#00525c',
      white: '#333333',
      brightBlack: '#333333',
      brightRed: '#8d0000',
      brightGreen: '#004600',
      brightYellow: '#513b00',
      brightBlue: '#003687',
      brightPurple: '#4b1579',
      brightCyan: '#004851',
      brightWhite: '#333333'
    },
    spinner: [
      'Focusing',
      'Sharpening',
      'Clarifying',
      'Outlining',
      'Tracing the edges',
      'Bringing into focus'
    ],
    done: [
      'In focus',
      'Sharp',
      'Clear'
    ],
    boxed: 'soft'
  },
  dark: {
    palette: {
      bg: '#000000',
      fg: '#ffffff',
      muted: '#d4d4d4',
      accent: '#99ccff',
      surface: '#161616',
      zebra: '#0b0b0b',
      hl: '#1f3352',
      line: '#474747',
      ok: '#8cf58c',
      err: '#ff9999',
      warn: '#ffdd66',
      read: '#99ccff',
      write: '#ffb87a',
      run: '#ddb3ff',
      search: '#70e6e6',
      web: '#8cf58c',
      mcp: '#d4d4d4'
    },
    terminal: {
      background: '#000000',
      foreground: '#ffffff',
      cursorColor: '#99ccff',
      selectionBackground: '#1f3352',
      black: '#161616',
      red: '#ff9999',
      green: '#8cf58c',
      yellow: '#ffdd66',
      blue: '#99ccff',
      purple: '#ddb3ff',
      cyan: '#70e6e6',
      white: '#ffffff',
      brightBlack: '#d4d4d4',
      brightRed: '#ffa5a5',
      brightGreen: '#9af69a',
      brightYellow: '#ffe178',
      brightBlue: '#a5d2ff',
      brightPurple: '#e1bcff',
      brightCyan: '#81e9e9',
      brightWhite: '#ffffff'
    },
    spinner: [
      'Focusing',
      'Sharpening',
      'Clarifying',
      'Outlining',
      'Tracing the edges',
      'Bringing into focus'
    ],
    done: [
      'In focus',
      'Sharp',
      'Clear'
    ],
    boxed: 'soft'
  }
}
