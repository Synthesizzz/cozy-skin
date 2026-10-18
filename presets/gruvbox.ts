import type { Preset } from '../hooks/presets'

// Colours from Gruvbox by Pavel Pertsev (MIT), adjusted where needed to reach 4.5:1.
export const gruvbox: Preset = {
  name: 'gruvbox',
  label: 'Gruvbox',
  light: {
    palette: {
      bg: '#fbf1c7',
      fg: '#3c3836',
      muted: '#665c54',
      accent: '#af3a03',
      surface: '#ebdbb2',
      zebra: '#f3e6bd',
      hl: '#d5c4a1',
      line: '#c6bd9e',
      ok: '#69720e',
      err: '#9d0006',
      warn: '#946110',
      read: '#076678',
      write: '#af3a03',
      run: '#8f3f71',
      search: '#3f7654',
      web: '#69720e',
      mcp: '#665c54'
    },
    terminal: {
      background: '#fbf1c7',
      foreground: '#3c3836',
      cursorColor: '#af3a03',
      selectionBackground: '#d5c4a1',
      black: '#3c3836',
      red: '#9d0006',
      green: '#69720e',
      yellow: '#946110',
      blue: '#076678',
      purple: '#8f3f71',
      cyan: '#3f7654',
      white: '#665c54',
      brightBlack: '#665c54',
      brightRed: '#8a0005',
      brightGreen: '#5e660c',
      brightYellow: '#926011',
      brightBlue: '#065a6a',
      brightPurple: '#7e3763',
      brightCyan: '#3a6c4d',
      brightWhite: '#665c54'
    },
    spinner: [
      'Brewing',
      'Roasting',
      'Grinding',
      'Simmering',
      'Stoking',
      'Tinkering'
    ],
    done: [
      'Brewed',
      'Roasted',
      'Done and dusted'
    ],
    boxed: 'soft'
  },
  dark: {
    palette: {
      bg: '#282828',
      fg: '#ebdbb2',
      muted: '#bdae93',
      accent: '#fe8019',
      surface: '#3c3836',
      zebra: '#32302f',
      hl: '#504945',
      line: '#5f5a4f',
      ok: '#b8bb26',
      err: '#fb5844',
      warn: '#fabd2f',
      read: '#83a598',
      write: '#fe8019',
      run: '#d3869b',
      search: '#8ec07c',
      web: '#b8bb26',
      mcp: '#bdae93'
    },
    terminal: {
      background: '#282828',
      foreground: '#ebdbb2',
      cursorColor: '#fe8019',
      selectionBackground: '#504945',
      black: '#3c3836',
      red: '#fb5844',
      green: '#b8bb26',
      yellow: '#fabd2f',
      blue: '#83a598',
      purple: '#d3869b',
      cyan: '#8ec07c',
      white: '#ebdbb2',
      brightBlack: '#bdae93',
      brightRed: '#fb5f4c',
      brightGreen: '#c1c340',
      brightYellow: '#fbc548',
      brightBlue: '#92b0a4',
      brightPurple: '#d895a7',
      brightCyan: '#9cc88c',
      brightWhite: '#ebdbb2'
    },
    spinner: [
      'Brewing',
      'Roasting',
      'Grinding',
      'Simmering',
      'Stoking',
      'Tinkering'
    ],
    done: [
      'Brewed',
      'Roasted',
      'Done and dusted'
    ],
    boxed: 'soft'
  }
}
