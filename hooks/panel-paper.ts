// The /cozy panel on the preset's paper. Only in mode auto: the panel's own
// text is drawn in the app's colours, which follow Windows, so a paper picked
// by hand (light or dark) could sit under text of the other mode and not be read.

import type { EngineInterface } from 'claude-code'
import { PRESETS, presetOf } from './presets'
import type { Mode } from './presets'
import type { Settings } from './settings'

const PANE = 'cozy-skin'

// What the panel asks to be painted under its body: the paper with the skin on
// in mode auto, else nothing, and the app's own look stands.
export function panelPaper(settings: Settings, mode: Mode): { backgroundColor?: string } {
  const preset = presetOf(settings.preset) ?? PRESETS[0]

  return settings.enabled && settings.mode === 'auto' && preset !== undefined ? { backgroundColor: preset[mode].palette.bg } : {}
}

// The panel shown now is opened again so it takes the new paper: an open of
// the same id keeps its place and only changes what it asked for. One that is
// closed or behind another tab is left alone, and so is a failure: the panel
// keeps the paper it opened on until it opens again.
export async function repaintPanel($: EngineInterface, settings: Settings, mode: Mode): Promise<void> {
  try {
    if ((await $.ui.panes()).some(pane => pane.id === PANE && pane.isShown)) {
      await $.ui.open({ id: PANE, title: 'cozy-skin', ...panelPaper(settings, mode) })
    }
  } catch {
    // As above: the paper waits for the next open.
  }
}
