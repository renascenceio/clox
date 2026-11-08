/** Electric body colours for the Clay avatars. DiceBear keeps the
 *  accent different from the body, so every avatar gets two of these. */
export const AVATAR_BODIES = [
  '#7B2CFF', // electric violet
  '#2D5BFF', // electric blue
  '#00C2FF', // cyan
  '#00E0A4', // electric mint
  '#B6FF2E', // acid lime
  '#FFD400', // electric yellow
  '#FF7A00', // blaze orange
  '#FF2E63', // hot red
  '#FF3DCB', // hot pink
  '#9D4DFF', // ultraviolet
]

/** Deep night tints and bright pastels, so the bodies always pop. */
export const AVATAR_BACKGROUNDS = [
  '#1A1240',
  '#0F1B3D',
  '#2A0E3A',
  '#3A0F24',
  '#0B2B2E',
  '#EDE7FF',
  '#E0F7FF',
  '#FFF4CC',
  '#FFE3EF',
  '#E6FFE0',
]

/** Zoomed in so the face fills the circle (1 = DiceBear default). */
export const AVATAR_SCALE = 1.35
export const AVATAR_TRANSLATE_Y = 10

export function avatarUrl(seed: string): string {
  return `/avatars/${encodeURIComponent(seed || 'clox')}.svg`
}
