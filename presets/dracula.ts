import type { Preset } from '../hooks/presets'

// Colours from Dracula and Alucard by Zeno Rocha and the Dracula team (MIT), adjusted where needed to reach 4.5:1.
export const dracula: Preset = {
  name: 'dracula',
  label: 'Dracula',
  light: {
    palette: {
      bg: '#fffbeb',
      fg: '#1f1f1f',
      muted: '#6c664b',
      accent: '#644ac9',
      surface: '#ece8d6',
      zebra: '#f6f2e1',
      hl: '#cfcfde',
      line: '#c0bdb2',
      ok: '#14710a',
      err: '#cb3a2a',
      warn: '#846e15',
      read: '#036a96',
      write: '#a34d14',
      run: '#644ac9',
      search: '#036a96',
      web: '#14710a',
      mcp: '#6c664b'
    },
    terminal: {
      background: '#fffbeb',
      foreground: '#1f1f1f',
      cursorColor: '#644ac9',
      selectionBackground: '#cfcfde',
      black: '#1f1f1f',
      red: '#cb3a2a',
      green: '#14710a',
      yellow: '#846e15',
      blue: '#036a96',
      purple: '#644ac9',
      cyan: '#036a96',
      white: '#6c664b',
      brightBlack: '#6c664b',
      brightRed: '#b33325',
      brightGreen: '#126309',
      brightYellow: '#746112',
      brightBlue: '#035d84',
      brightPurple: '#5841b1',
      brightCyan: '#035d84',
      brightWhite: '#6c664b'
    },
    spinner: [
      'Haunting',
      'Lurking',
      'Flitting',
      'Brooding',
      'Stirring',
      'Waiting for dusk'
    ],
    done: [
      'Risen',
      'Done before dawn',
      'Night is young'
    ],
    boxed: 'soft'
  },
  dark: {
    palette: {
      bg: '#282a36',
      fg: '#f8f8f2',
      muted: '#bfbfb6',
      accent: '#bd93f9',
      surface: '#343746',
      zebra: '#2e313e',
      hl: '#44475a',
      line: '#62646b',
      ok: '#50fa7b',
      err: '#ff5858',
      warn: '#f1fa8c',
      read: '#8be9fd',
      write: '#ffb86c',
      run: '#bd93f9',
      search: '#8be9fd',
      web: '#50fa7b',
      mcp: '#bfbfb6'
    },
    terminal: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursorColor: '#bd93f9',
      selectionBackground: '#44475a',
      black: '#343746',
      red: '#ff5858',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#8be9fd',
      purple: '#bd93f9',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#bfbfb6',
      brightRed: '#ff6969',
      brightGreen: '#65fb8b',
      brightYellow: '#f3fb9a',
      brightBlue: '#99ecfd',
      brightPurple: '#c5a0fa',
      brightCyan: '#99ecfd',
      brightWhite: '#f8f8f2'
    },
    spinner: [
      'Haunting',
      'Lurking',
      'Flitting',
      'Brooding',
      'Stirring',
      'Waiting for dusk'
    ],
    done: [
      'Risen',
      'Done before dawn',
      'Night is young'
    ],
    boxed: 'soft'
  }
}
