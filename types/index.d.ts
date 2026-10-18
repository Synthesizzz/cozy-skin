// What the mod keeps in the engine's state: the settings and the mode they
// resolved to, read by every render hook. Self-contained: the validator
// reads this file alone, so it repeats the shapes of `Live` and `Note` in
// hooks/settings.ts.
declare module 'claude-code' {
  interface PluginState {
    'cozy-skin': {
      live: {
        settings: {
          preset: string
          mode: 'light' | 'dark' | 'auto'
          calm: boolean
          icons: 'unicode' | 'ascii'
          tables: 'box' | 'text' | 'off'
          tools: 'on' | 'off'
          bubble: 'cozy' | 'app'
          enabled: boolean
          savedTheme: string | null
          appliedTheme: string | null
          colors: { you: string | null; code: string | null }
          looks: Record<string, { preset: string; mode: 'light' | 'dark' | 'auto'; colors: { you: string | null; code: string | null } }>
        }
        mode: 'light' | 'dark'
      }
      // What each table's buttons last said, by `<message id>:<table number>`.
      notes: Record<string, { text: string; isError: boolean }>
      // Long tables shown in full, by `<message id>:<table number>`.
      open: Record<string, true>
      // Wide tables' column pages, by `<message id>:<table number>`.
      page: Record<string, number>
      // The prompts sent with an image, by their text (see hooks/prompt-images.ts).
      images: string[]
      // When each prompt was sent, by its text (see hooks/prompt-times.ts).
      sent: Record<string, number>
      // The minute the prompt rows last read the clock, so their "5 minutes
      // ago" redraws once a minute without redrawing anything else.
      minute: number
      // The id of the main loop's running turn, for a calm spinner's one word.
      turn: { id: string }
    }
  }
}
