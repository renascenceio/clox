/**
 * Every model Clox offers, derived from the Vercel AI Gateway catalogue
 * (`catalog.generated.ts`, refreshed by `scripts/sync-gateway-models.mjs`).
 *
 * All generation goes through the gateway, so a model is listed here if
 * and only if the gateway serves it. Ids are the gateway's own
 * `creator/model` slugs. Ids saved by older builds (`claude-sonnet-4.6`,
 * `nano-banana`, `kling-2.0`, …) are mapped forward by `resolveModelId`.
 */
import { GATEWAY_CATALOG } from './catalog.generated'
import type { GatewayCatalogEntry } from './types'

export type { GatewayCatalogEntry } from './types'

export type Modality = 'text' | 'image' | 'video' | 'audio' | 'transcription'

export interface ModelEntry {
  id: string
  /** Full gateway name, e.g. "Claude Sonnet 4.6". */
  name: string
  /** Name with the brand prefix removed, e.g. "Sonnet 4.6". */
  version: string
  /** Gateway creator slug (e.g. `anthropic`). Used for grouping and the
   *  per-provider on/off switch in Super Admin. */
  provider: string
  brandName: string
}

export interface AudioModelEntry extends ModelEntry {
  type: 'voice' | 'music' | 'sfx'
}

export interface VideoModelEntry extends ModelEntry {
  maxDuration: number
}

/** Display names for gateway creator slugs. */
const BRAND: Record<string, string> = {
  alibaba: 'Qwen',
  amazon: 'Amazon',
  anthropic: 'Claude',
  bfl: 'FLUX',
  bytedance: 'ByteDance',
  cohere: 'Cohere',
  deepseek: 'DeepSeek',
  elevenlabs: 'ElevenLabs',
  'fish-audio': 'Fish Audio',
  google: 'Gemini',
  heygen: 'HeyGen',
  klingai: 'Kling',
  meta: 'Meta',
  microsoft: 'Microsoft',
  minimax: 'MiniMax',
  mistral: 'Mistral',
  moonshotai: 'Kimi',
  nvidia: 'NVIDIA',
  openai: 'OpenAI',
  perplexity: 'Perplexity',
  prodia: 'Prodia',
  quiverai: 'QuiverAI',
  recraft: 'Recraft',
  spacexai: 'Grok',
  topaz: 'Topaz',
  zai: 'GLM',
}

/** Creator order in pickers. Anything not listed sorts after, A→Z. */
const PROVIDER_ORDER = [
  'anthropic', 'openai', 'google', 'spacexai', 'mistral', 'deepseek', 'moonshotai',
  'alibaba', 'meta', 'zai', 'minimax', 'cohere', 'perplexity', 'amazon', 'nvidia',
  'bfl', 'recraft', 'bytedance', 'klingai', 'microsoft', 'elevenlabs', 'fish-audio',
]

export function brandFor(owner: string): string {
  return BRAND[owner] ?? owner.replace(/(^|[-_])(\w)/g, (_, sep, c) => (sep ? ' ' : '') + c.toUpperCase())
}

function providerRank(owner: string) {
  const i = PROVIDER_ORDER.indexOf(owner)
  return i === -1 ? PROVIDER_ORDER.length : i
}

function byProviderThenNewest(a: GatewayCatalogEntry, b: GatewayCatalogEntry) {
  const r = providerRank(a.owner) - providerRank(b.owner)
  if (r !== 0) return r
  if (a.owner !== b.owner) return a.owner.localeCompare(b.owner)
  return b.released - a.released || a.name.localeCompare(b.name)
}

/** Strip the brand or creator name from the front of a model name. */
function versionOf(entry: GatewayCatalogEntry, brand: string): string {
  const prefixes = [brand, entry.owner, 'Gemini', 'Claude', 'Grok', 'Eleven']
  for (const p of prefixes) {
    const re = new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i')
    if (re.test(entry.name)) return entry.name.replace(re, '')
  }
  return entry.name
}

function toEntry(e: GatewayCatalogEntry): ModelEntry {
  const brandName = brandFor(e.owner)
  return { id: e.id, name: e.name, version: versionOf(e, brandName), provider: e.owner, brandName }
}

const BY_ID = new Map(GATEWAY_CATALOG.map(e => [e.id, e]))

export function catalogEntry(id: string): GatewayCatalogEntry | undefined {
  return BY_ID.get(id)
}

/** Language models whose output includes images (Nano Banana, Arrow). */
export function isImageLanguageModel(e: GatewayCatalogEntry): boolean {
  return e.type === 'language' && Boolean(e.output?.includes('image'))
}

const sorted = [...GATEWAY_CATALOG].sort(byProviderThenNewest)

/**
 * Text models the gateway lists but that failed a live streaming test
 * (unknown to the upstream provider, or streaming not supported). Re-run
 * the sweep after `scripts/sync-gateway-models.mjs` and trim as they recover.
 */
const TEXT_EXCLUDED = new Set([
  'alibaba/qwen-3-235b',
  'alibaba/qwen3-next-80b-a3b-thinking',
  'alibaba/qwen3-max-thinking',
  'alibaba/qwen3-coder',
  'scaledown/scaledown-summarize-1',
  'scaledown/scaledown-extract-1',
  'mistral/mistral-large-4',
])

/**
 * Models that answer fine but reject function tools while streaming. The
 * chat route sends them no tools (web search, skills, documents are off).
 */
const NO_STREAMING_TOOLS = new Set([
  'deepseek/deepseek-r1',
  'elorian/glimpse',
  'inference-net/schematron-v2-small',
  'inference-net/schematron-v2-turbo',
  'meta/llama-3.3-70b',
  'meta/llama-3.1-70b',
  'meta/llama-3.1-8b',
  'meta/llama-4-maverick',
  'google/gemini-omni-flash-preview',
  'spacexai/grok-4.20-multi-agent-beta',
  'spacexai/grok-4.20-multi-agent',
  'tencent/hy-mt2-lite',
  'tencent/hy-mt2-plus',
])

export function takesTools(id: string): boolean {
  if (NO_STREAMING_TOOLS.has(id)) return false
  const tags = BY_ID.get(id)?.tags
  return !tags || tags.includes('tool-use')
}

/** Picks a Claude model per message — see lib/auto-model. */
export const AUTO_MODEL_ENTRY: ModelEntry = {
  id: 'clox/auto',
  name: 'Auto',
  version: 'Auto',
  provider: 'anthropic',
  brandName: 'Claude',
}

export const TEXT_MODELS: ModelEntry[] = [
  AUTO_MODEL_ENTRY,
  ...sorted
    .filter(e => e.type === 'language' && !isImageLanguageModel(e) && !TEXT_EXCLUDED.has(e.id))
    .map(toEntry),
]

/** Image models that need an input image to do anything (upscalers,
 *  inpainting with a mask). Fill needs a mask we can't author, so it's
 *  left out entirely; Topaz upscalers are kept and require a reference. */
const IMAGE_EXCLUDED = new Set([
  'bfl/flux-pro-1.0-fill',
  // Listed by the gateway but retired upstream ("Job type is no longer available").
  'prodia/flux-fast-schnell',
])

export const IMAGE_MODELS: ModelEntry[] = sorted
  .filter(e => (e.type === 'image' && !IMAGE_EXCLUDED.has(e.id)) || isImageLanguageModel(e))
  .map(toEntry)

/** Video jobs the composer can drive: a prompt plus optional images. Models
 *  that only enhance or re-animate an existing video aren't offered. */
const COMPOSER_VIDEO_OPS = ['text-to-video', 'image-to-video', 'first-last-frame', 'reference-to-video']

export const VIDEO_MODELS: VideoModelEntry[] = sorted
  .filter(e => e.type === 'video' && Boolean(e.video?.supported_operations?.some(o => COMPOSER_VIDEO_OPS.includes(o))))
  .map(e => ({
    ...toEntry(e),
    maxDuration: Math.max(...(e.video?.supported_durations_seconds ?? [10])),
  }))

export const AUDIO_MODELS: AudioModelEntry[] = sorted
  .filter(e => e.type === 'speech')
  .map(e => ({
    ...toEntry(e),
    type: e.tags?.includes('music') ? 'music' : e.tags?.includes('sound-effects') ? 'sfx' : 'voice',
  }))

export const TRANSCRIPTION_MODELS: ModelEntry[] = sorted
  .filter(e => e.type === 'transcription')
  .map(toEntry)

export function modelsFor(modality: Modality): ModelEntry[] {
  switch (modality) {
    case 'text': return TEXT_MODELS
    case 'image': return IMAGE_MODELS
    case 'video': return VIDEO_MODELS
    case 'audio': return AUDIO_MODELS
    case 'transcription': return TRANSCRIPTION_MODELS
  }
}

/** Creators the gateway serves, with how many models each brings per
 *  modality. Drives the Super Admin › Models page. */
export function gatewayProviders(): Array<{
  id: string
  brand: string
  counts: Record<Exclude<Modality, 'transcription'>, number>
}> {
  const map = new Map<string, { text: number; image: number; video: number; audio: number }>()
  const bump = (owner: string, k: 'text' | 'image' | 'video' | 'audio') => {
    const c = map.get(owner) ?? { text: 0, image: 0, video: 0, audio: 0 }
    c[k]++
    map.set(owner, c)
  }
  TEXT_MODELS.forEach(m => bump(m.provider, 'text'))
  IMAGE_MODELS.forEach(m => bump(m.provider, 'image'))
  VIDEO_MODELS.forEach(m => bump(m.provider, 'video'))
  AUDIO_MODELS.forEach(m => bump(m.provider, 'audio'))
  return Array.from(map.entries())
    .map(([id, counts]) => ({ id, brand: brandFor(id), counts }))
    .sort((a, b) => providerRank(a.id) - providerRank(b.id) || a.id.localeCompare(b.id))
}

/* ------------------------------------------------------------------ */
/*  Ids saved by builds that called each provider directly.           */
/* ------------------------------------------------------------------ */

const LEGACY_IDS: Record<string, string> = {
  // text
  'gemini-2.5-flash': 'google/gemini-2.5-flash',
  'gemini-2.0-flash': 'google/gemini-2.5-flash-lite',
  'gemini-1.5-pro': 'google/gemini-2.5-pro',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  'claude-opus-4.6': 'anthropic/claude-opus-4.6',
  'claude-opus-4.7': 'anthropic/claude-opus-4.7',
  'claude-sonnet-4.6': 'anthropic/claude-sonnet-4.6',
  'claude-haiku-4.5': 'anthropic/claude-haiku-4.5',
  'mistral-large-latest': 'mistral/mistral-large-3',
  'mistral-small-latest': 'mistral/mistral-small',
  'grok-4': 'spacexai/grok-4.3',
  'grok-3': 'spacexai/grok-4.3',
  'deepseek-chat': 'deepseek/deepseek-v3.2',
  'deepseek-reasoner': 'deepseek/deepseek-v3.2-thinking',
  'kimi-k2': 'moonshotai/kimi-k2',
  'moonshot-v1-128k': 'moonshotai/kimi-k2',
  'qwen-max': 'alibaba/qwen3.8-max',
  'qwen-plus': 'alibaba/qwen3.5-plus',
  'command-r-plus': 'cohere/command-a',
  'command-r': 'cohere/command-a',
  'sonar-large': 'perplexity/sonar',
  'sonar-small': 'perplexity/sonar',
  'glm-4.5': 'zai/glm-4.5',
  // image
  'nano-banana': 'google/gemini-2.5-flash-image',
  'nano-banana-2': 'google/gemini-3.1-flash-image',
  'nano-banana-pro': 'google/gemini-3-pro-image',
  'imagen-3': 'google/gemini-3.1-flash-image',
  'imagen-4': 'google/gemini-3.1-flash-image',
  'dall-e-3': 'openai/gpt-image-2',
  'dall-e-4': 'openai/gpt-image-2',
  'flux-1.1-pro-ultra': 'bfl/flux-pro-1.1-ultra',
  'flux-1-pro': 'bfl/flux-pro-1.1',
  'flux-1-dev': 'bfl/flux-2-klein-9b',
  'recraft-v3': 'recraft/recraft-v3',
  // video
  'kling-2.0': 'klingai/kling-v2.6-t2v',
  'kling-1.5': 'klingai/kling-v2.5-turbo-t2v',
  'heygen-avatar-iv': 'heygen/heygen-video-1',
  'heygen-avatar-iii': 'heygen/heygen-video-1',
  // audio
  'gemini-tts-3.1': 'google/gemini-3.8-flash-tts',
  'gemini-tts': 'google/gemini-3.8-flash-lite-tts',
  'elevenlabs-turbo-v2.5': 'elevenlabs/eleven-flash-v2.5',
  'elevenlabs-multilingual-v2': 'elevenlabs/eleven-multilingual-v2',
  'openai-tts-1-hd': 'openai/tts-1-hd',
  'openai-tts-1': 'openai/tts-1',
  'fish-speech-1.5': 'fish-audio/s1',
}

const DEFAULTS: Record<Modality, string> = {
  text: 'clox/auto',
  image: 'google/gemini-3.1-flash-image',
  video: 'google/veo-3.1-fast-generate-001',
  audio: 'elevenlabs/eleven-multilingual-v2',
  transcription: 'openai/gpt-4o-mini-transcribe',
}

export function defaultModelId(modality: Modality): string {
  const id = DEFAULTS[modality]
  return modelsFor(modality).some(m => m.id === id) ? id : modelsFor(modality)[0]?.id ?? id
}

/**
 * Maps any id the app might receive (current gateway slug, legacy
 * direct-provider id) onto a model the gateway serves for `modality`.
 * Unknown ids fall back to that modality's default so an old saved chat
 * never strands the user on a dead model.
 */
export function resolveModelId(id: string | undefined | null, modality: Modality): string {
  const list = modelsFor(modality)
  if (id && list.some(m => m.id === id)) return id
  const mapped = id ? LEGACY_IDS[id] : undefined
  if (mapped && list.some(m => m.id === mapped)) return mapped
  return defaultModelId(modality)
}
