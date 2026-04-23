import { TEXT_MODELS } from '@/domains/text-generation/services/model-router'
import { IMAGE_MODELS } from '@/domains/image-generation/services/image-models'
import { VIDEO_MODELS } from '@/domains/video-generation/services/video-models'
import { AUDIO_MODELS } from '@/domains/audio-generation/services/audio-models'
import type { ProviderCategory } from '@/lib/providers'

/**
 * Single source of truth for "which front-end models does this provider/API
 * key actually power?". Used by the Admin API Keys page to render parity
 * between the back-end keys and the front-end model dropdowns — if Google is
 * connected, the Image section lists "Imagen 3, Nano Banana" right on the
 * Google card so the admin can see exactly what that key unlocks.
 */

export interface ProviderModelRef {
  id: string
  displayName: string
  brandName?: string
}

// Each model shape is slightly different between modalities, but they all
// expose `id`, `name` and `provider` (+ optional `brandName`). Normalise.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalise = (m: any): ProviderModelRef => ({
  id: m.id,
  displayName: m.brandName ? `${m.brandName} ${m.name}` : m.name,
  brandName: m.brandName,
})

export function getModelsForProviderInCategory(
  providerId: string,
  category: ProviderCategory,
): ProviderModelRef[] {
  const source =
    category === 'text'
      ? TEXT_MODELS
      : category === 'image'
        ? IMAGE_MODELS
        : category === 'video'
          ? VIDEO_MODELS
          : AUDIO_MODELS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (source as any[]).filter(m => m.provider === providerId).map(normalise)
}
