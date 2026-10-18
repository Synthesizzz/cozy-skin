// Prompts sent with an image. A UserMessage row's props carry its text alone,
// so a bubble cozy draws would drop the picture; the engine's own row shows
// it. `prompt.submit` says which prompts carried images: their text is kept
// here (in the store, so it holds across sessions) and those rows are left to
// the engine.

export const IMAGES_KEY = 'images'

// How many image prompts are remembered; older ones fall back to their text.
export const KEPT_IMAGES = 200

// Pasted text as each side holds it: expanded in what prompt.submit sees,
// a placeholder in the row's own text. Both are left out of the match.
const PASTED = /<pasted_content[^>]*>[\s\S]*?<\/pasted_content[^>]*>|\[Pasted text[^\]]*\]/g

// A prompt as it is matched: its text without pasted parts, runs of space made one.
export function promptKey(text: string): string {
  return text.replace(PASTED, ' ').trim().replace(/\s+/g, ' ').slice(0, 2000)
}

// An image named in the text itself (`[Image #1]`, `[Image: source: …]`), for a
// prompt sent before cozy kept the list.
const NAMED_IMAGE = /\[Image(?: #\d+)?[\]:]/

export function hasImage(text: string, kept: readonly string[]): boolean {
  const key = promptKey(text)

  // Kept keys are matched as they would be keyed now, so older ones still match.
  return NAMED_IMAGE.test(text) || kept.some(k => promptKey(k) === key)
}

// The kept list with `text` added last, without repeats, at most KEPT_IMAGES long.
export function remember(kept: readonly string[], text: string): string[] {
  const key = promptKey(text)

  return [...kept.filter(k => k !== key), key].slice(-KEPT_IMAGES)
}

// Anything stored can be old or hand-edited: only strings are kept.
export function saneImages(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string').slice(-KEPT_IMAGES) : []
}
