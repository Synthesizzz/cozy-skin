// A choice made the way the person makes it now: a press in the /cozy panel.
// The words are the ones the panel hands its internal command path, so a test
// says `await press($, 'kindle light')` and the helper presses the buttons.
// (Typed `/cozy` only opens the panel, or turns the skin off with `off`.)

import type { Engine } from 'claude-code/testing'

const PANE = {
  plugin: 'cozy-skin',
  surface: 'desktop',
  component: 'Pane',
  requestId: 'cozy-skin',
  props: { title: 'cozy-skin', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

type Step = { press: string } | { input: string; text: string }

function stepsOf(args: string): Step[] {
  const [head = '', arg = '', value = ''] = args.trim().split(/\s+/)

  if (head === '') {
    return []
  }
  if (head === 'on' || head === 'off') {
    return [{ press: `skin-${head}` }]
  }
  if (head === 'light' || head === 'dark' || head === 'auto') {
    return [{ press: `mode-${head}` }]
  }
  if (head === 'tables') {
    return [{ press: arg === 'box' ? 'tables-on' : `tables-${arg}` }]
  }
  if (head === 'themes') {
    return [{ press: `backdrop-${arg}` }]
  }
  if (['calm', 'icons', 'tools', 'bubble', 'backdrop'].includes(head)) {
    return [{ press: `${head}-${arg}` }]
  }
  if (head === 'color') {
    if (value.startsWith('#')) {
      return [{ input: `color-${arg}`, text: value }]
    }
    return [{ press: `${arg}-${value === 'off' ? 'default' : value}` }]
  }
  if (head === 'save') {
    return [{ input: 'look-name', text: arg }]
  }
  if (head === 'forget' || head === 'look') {
    return [{ press: head === 'look' ? `look-${arg}` : `forget-${arg}` }]
  }
  // A preset, with a mode after it when one is given.
  return [{ press: `preset-${head}` }, ...(arg === '' ? [] : stepsOf(arg))]
}

// Returns the panel's text after the press, for a test that reads what the panel says.
export async function press($: Engine, args: string, surface: 'desktop' | 'terminal' = 'desktop'): Promise<string> {
  const ui = await $.ui.mount({ ...PANE, surface } as never)

  for (const step of stepsOf(args)) {
    // The panel is tabs: go to the one that holds the button or field.
    const key = 'press' in step ? step.press : step.input
    const tab = /^(skin|preset|mode)-/.test(key) ? 'look' : /^(you|code|look|forget|color)-/.test(key) ? 'colours' : 'details'

    await ui.press({ key: `tab-${tab}` })
    if ('press' in step) {
      await ui.press({ key: step.press })
    } else {
      await ui.input({ key: step.input, text: step.text })
    }
  }
  const text = (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '').join(' ')

  await ui.unmount()
  return text
}
