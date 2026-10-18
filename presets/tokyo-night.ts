import type { Preset } from '../hooks/presets'

// Colours from Tokyo Night (Day, Night) by enkia (MIT), adjusted where needed to reach 4.5:1.
export const tokyoNight: Preset = {
  name: 'tokyo-night',
  label: 'Tokyo Night',
  light: {
    palette: {
      bg: '#e1e2e7',
      fg: '#365ebb',
      muted: '#4c5279',
      accent: '#2462b6',
      surface: '#d6d8df',
      zebra: '#dcdde3',
      hl: '#c4c8da',
      line: '#b1bedc',
      ok: '#4f6933',
      err: '#ba204d',
      warn: '#785d35',
      read: '#2462b6',
      write: '#984f00',
      run: '#7a43c1',
      search: '#006a8e',
      web: '#4f6933',
      mcp: '#4c5279'
    },
    terminal: {
      background: '#e1e2e7',
      foreground: '#365ebb',
      cursorColor: '#2462b6',
      selectionBackground: '#c4c8da',
      black: '#365ebb',
      red: '#ba204d',
      green: '#4f6933',
      yellow: '#785d35',
      blue: '#2462b6',
      purple: '#7a43c1',
      cyan: '#006a8e',
      white: '#4c5279',
      brightBlack: '#4c5279',
      brightRed: '#be214e',
      brightGreen: '#4d6732',
      brightYellow: '#795d36',
      brightBlue: '#2361b4',
      brightPurple: '#7b44c3',
      brightCyan: '#006385',
      brightWhite: '#4c5279'
    },
    spinner: [
      'Wandering',
      'Neon-gazing',
      'Riding the last train',
      'Strolling',
      'Drifting downtown',
      'Night walking'
    ],
    done: [
      'Arrived',
      'Last stop',
      'Lights on'
    ],
    boxed: 'soft'
  },
  dark: {
    palette: {
      bg: '#1a1b26',
      fg: '#c0caf5',
      muted: '#a9b1d6',
      accent: '#7aa2f7',
      surface: '#24283b',
      zebra: '#1f2231',
      hl: '#292e42',
      line: '#484c60',
      ok: '#9ece6a',
      err: '#f7768e',
      warn: '#e0af68',
      read: '#7aa2f7',
      write: '#ff9e64',
      run: '#bb9af7',
      search: '#7dcfff',
      web: '#9ece6a',
      mcp: '#a9b1d6'
    },
    terminal: {
      background: '#1a1b26',
      foreground: '#c0caf5',
      cursorColor: '#7aa2f7',
      selectionBackground: '#292e42',
      black: '#24283b',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      purple: '#bb9af7',
      cyan: '#7dcfff',
      white: '#c0caf5',
      brightBlack: '#a9b1d6',
      brightRed: '#f8869c',
      brightGreen: '#aad47c',
      brightYellow: '#e4b97a',
      brightBlue: '#8aadf8',
      brightPurple: '#c3a6f8',
      brightCyan: '#8dd5ff',
      brightWhite: '#c0caf5'
    },
    spinner: [
      'Wandering',
      'Neon-gazing',
      'Riding the last train',
      'Strolling',
      'Drifting downtown',
      'Night walking'
    ],
    done: [
      'Arrived',
      'Last stop',
      'Lights on'
    ],
    boxed: 'soft'
  }
}
