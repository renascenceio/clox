/**
 * Editorial × Productivity workspace palettes.
 *
 * Ported verbatim from the chat-workspace reference (`chat-workspace-G2M12.jsx`).
 * Each palette is a self-contained colour set used as inline styles, NOT CSS
 * variables — that lets us swap palettes at runtime without a rebuild and
 * guarantees pixel-parity with the reference.
 */

export type PaletteKey =
  | 'light'        // current — cool bone, the warmest of the light options
  | 'pearl'        // pearl — lighter, near-neutral with the faintest warmth
  | 'pearlLight'   // pearl-light — even paler, almost off-white
  | 'pearlNeutral' // pearl-neutral — true neutral, no warm cast
  | 'linen'        // linen — paler, less brown, cooler
  | 'mist'         // mist — cool gray-green paper
  | 'slate'        // slate — cool neutral gray
  | 'frost'        // frost — cool blue undertone, most "modern app" feeling
  | 'dark'

export interface Palette {
  bg: string
  surface: string
  surfaceAlt: string
  rail: string
  railSoft: string
  ink: string
  inkSoft: string
  inkMuted: string
  hairline: string
  hairlineSoft: string
  accent: string
  youInk: string
  youBg: string
  youFg: string
  aiBg: string
}

export const PALETTES: Record<PaletteKey, Palette> = {
  light: {
    bg: '#E8E2D2',
    surface: '#F6F1E3',
    surfaceAlt: '#DCD4BF',
    rail: '#DBD3BD',
    railSoft: '#E2DAC4',
    ink: '#161410',
    inkSoft: '#4F4840',
    inkMuted: '#8A8270',
    hairline: 'rgba(22,20,16,0.18)',
    hairlineSoft: 'rgba(22,20,16,0.09)',
    accent: '#A8472A',
    youInk: '#161410',
    youBg: '#161410',
    youFg: '#F6F1E3',
    aiBg: '#F6F1E3',
  },
  pearl: {
    bg: '#F1EFE9',
    surface: '#FAF9F4',
    surfaceAlt: '#E4E2DB',
    rail: '#E6E4DC',
    railSoft: '#ECEAE2',
    ink: '#18181A',
    inkSoft: '#52524F',
    inkMuted: '#8E8C86',
    hairline: 'rgba(24,24,26,0.14)',
    hairlineSoft: 'rgba(24,24,26,0.07)',
    accent: '#A8472A',
    youInk: '#18181A',
    youBg: '#18181A',
    youFg: '#FAF9F4',
    aiBg: '#FAF9F4',
  },
  pearlLight: {
    bg: '#F4F3EE',
    surface: '#FCFBF7',
    surfaceAlt: '#E8E6DF',
    rail: '#EAE9E1',
    railSoft: '#F0EFE7',
    ink: '#1A1A1B',
    inkSoft: '#56564F',
    inkMuted: '#94928A',
    hairline: 'rgba(26,26,27,0.12)',
    hairlineSoft: 'rgba(26,26,27,0.05)',
    accent: '#A8472A',
    youInk: '#1A1A1B',
    youBg: '#1A1A1B',
    youFg: '#FCFBF7',
    aiBg: '#FCFBF7',
  },
  pearlNeutral: {
    bg: '#EFEFEC',
    surface: '#F9F9F6',
    surfaceAlt: '#E2E2DE',
    rail: '#E5E5E1',
    railSoft: '#EBEBE7',
    ink: '#171819',
    inkSoft: '#51524F',
    inkMuted: '#8B8C86',
    hairline: 'rgba(23,24,25,0.13)',
    hairlineSoft: 'rgba(23,24,25,0.06)',
    accent: '#A04428',
    youInk: '#171819',
    youBg: '#171819',
    youFg: '#F9F9F6',
    aiBg: '#F9F9F6',
  },
  linen: {
    bg: '#EDECE5',
    surface: '#F7F6F0',
    surfaceAlt: '#DEDDD4',
    rail: '#E0DFD6',
    railSoft: '#E6E5DC',
    ink: '#16171A',
    inkSoft: '#4D4F52',
    inkMuted: '#8A8C8D',
    hairline: 'rgba(22,23,26,0.16)',
    hairlineSoft: 'rgba(22,23,26,0.08)',
    accent: '#9A4F32',
    youInk: '#16171A',
    youBg: '#16171A',
    youFg: '#F7F6F0',
    aiBg: '#F7F6F0',
  },
  mist: {
    bg: '#E4E7E2',
    surface: '#F0F2EE',
    surfaceAlt: '#D5D9D3',
    rail: '#D8DBD5',
    railSoft: '#DEE1DB',
    ink: '#15181A',
    inkSoft: '#475154',
    inkMuted: '#80898B',
    hairline: 'rgba(21,24,26,0.16)',
    hairlineSoft: 'rgba(21,24,26,0.07)',
    accent: '#8A4A2C',
    youInk: '#15181A',
    youBg: '#15181A',
    youFg: '#F0F2EE',
    aiBg: '#F0F2EE',
  },
  slate: {
    bg: '#E1E3E4',
    surface: '#EEEFF0',
    surfaceAlt: '#D2D5D7',
    rail: '#D5D8DA',
    railSoft: '#DCDEDF',
    ink: '#13161A',
    inkSoft: '#444A50',
    inkMuted: '#7C8186',
    hairline: 'rgba(19,22,26,0.16)',
    hairlineSoft: 'rgba(19,22,26,0.07)',
    accent: '#955036',
    youInk: '#13161A',
    youBg: '#13161A',
    youFg: '#EEEFF0',
    aiBg: '#EEEFF0',
  },
  frost: {
    bg: '#E6E9EC',
    surface: '#F1F3F5',
    surfaceAlt: '#D3D8DD',
    rail: '#D7DCE0',
    railSoft: '#DEE2E6',
    ink: '#11161B',
    inkSoft: '#404A53',
    inkMuted: '#79828B',
    hairline: 'rgba(17,22,27,0.16)',
    hairlineSoft: 'rgba(17,22,27,0.07)',
    accent: '#8A4A36',
    youInk: '#11161B',
    youBg: '#11161B',
    youFg: '#F1F3F5',
    aiBg: '#F1F3F5',
  },
  dark: {
    bg: '#14130E',
    surface: '#1C1A14',
    surfaceAlt: '#26241C',
    rail: '#100F0B',
    railSoft: '#16140F',
    ink: '#ECE5D3',
    inkSoft: '#9C9484',
    inkMuted: '#6E675A',
    hairline: 'rgba(236,229,211,0.14)',
    hairlineSoft: 'rgba(236,229,211,0.06)',
    accent: '#D27452',
    youInk: '#ECE5D3',
    youBg: '#ECE5D3',
    youFg: '#14130E',
    aiBg: '#1C1A14',
  },
}

export const MONO_STACK = "'Geist Mono', ui-monospace, Menlo, monospace"
export const SERIF_STACK = "Newsreader, ui-serif, Georgia, serif"
export const SANS_STACK = "Geist, ui-sans-serif, system-ui, sans-serif"

/** Read the active palette key from localStorage. SSR-safe. */
export function getStoredPalette(fallback: PaletteKey = 'pearl'): PaletteKey {
  if (typeof window === 'undefined') return fallback
  const raw = localStorage.getItem('clox-palette')
  if (raw && raw in PALETTES) return raw as PaletteKey
  // Honour pre-existing 'theme' key from the legacy ThemeToggle.
  const legacy = localStorage.getItem('theme')
  if (legacy === 'dark') return 'dark'
  return fallback
}

/**
 * Map a palette key to the `data-theme` value `globals.css` actually
 * reacts to. The CSS uses kebab-case for the alternates (`pearl-light`)
 * and the special name `onyx` for the dark palette.
 */
const THEME_ATTR_MAP: Record<PaletteKey, string> = {
  light:        'light',
  pearl:        'pearl',
  pearlLight:   'pearl-light',
  pearlNeutral: 'pearl-neutral',
  linen:        'linen',
  mist:         'mist',
  slate:        'slate',
  frost:        'frost',
  dark:         'onyx',
}

export function setStoredPalette(key: PaletteKey): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('clox-palette', key)
  // Mirror to legacy `theme` for any stragglers still reading it.
  localStorage.setItem('theme', key === 'dark' ? 'dark' : 'light')
  const html = document.documentElement
  // We set BOTH attributes so:
  //  • the SSR / pre-paint script in layout.tsx and this runtime call
  //    end up with identical state (no churn after hydration);
  //  • CSS rules keyed on `data-theme` (the alternates + onyx) AND the
  //    `.dark` class (the legacy ThemeToggle hook) all update at once;
  //  • our inline-styled palette-aware regions (which read the
  //    `clox-palette` localStorage key) stay in sync via `data-palette`.
  // Without setting `data-theme` here, Tailwind `text-ink` / `bg-bg`
  // tokens stayed locked to the SSR-default light palette while the
  // rest of the UI flipped to dark — that's the "dark text on dark
  // background after reload" bug.
  html.dataset.palette = key
  html.setAttribute('data-theme', THEME_ATTR_MAP[key])
  html.classList.toggle('dark', key === 'dark')
}
