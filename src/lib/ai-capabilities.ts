/**
 * Per-model capability registry.
 *
 * Drives the configuration pane (`ConfigDrawer` in `ChatWorkspace`). Every
 * model comes from the Vercel AI Gateway catalogue (`lib/gateway/catalog`),
 * and the knobs shown for it are the ones the gateway accepts for that
 * model:
 *
 *   - text   — read from the gateway's own metadata (`supported_parameters`,
 *              `temperature`, `reasoning_options`, `max_tokens`, input
 *              modalities), so a slider only appears when the wire honours it.
 *   - image  — per model family (OpenAI, FLUX, Recraft, Nano Banana, …),
 *              matching the options each family takes through the gateway.
 *   - video  — read from the gateway's `video_capabilities` (resolutions,
 *              aspect ratios, durations, audio, input images).
 *   - audio  — per voice provider (voice lists, speed, format, voice
 *              settings, music length, sound-effect duration).
 *
 * The API routes read the same field keys, so a value set here is what
 * gets sent.
 */
import {
  catalogEntry,
  isImageLanguageModel,
  brandFor,
  type GatewayCatalogEntry,
} from '@/lib/gateway/catalog'

// ---------------------------------------------------------------------------
// Field types — one per primitive UI control.
// ---------------------------------------------------------------------------

export type ModalityKind = 'text' | 'image' | 'video' | 'audio'

export interface RangeField {
  type: 'range'
  label: string
  min: number
  max: number
  step: number
  default: number
  suffix?: string
  hint?: string
}

export interface IntegerField {
  type: 'integer'
  label: string
  min: number
  max: number
  step?: number
  default: number
  suffix?: string
  hint?: string
}

export interface SelectField {
  type: 'select'
  label: string
  options: Array<{ value: string; label: string }>
  default: string
  hint?: string
}

export interface ToggleField {
  type: 'toggle'
  label: string
  default: boolean
  hint?: string
}

export interface TextField {
  type: 'text'
  label: string
  default?: string
  placeholder?: string
  hint?: string
}

export type Field = RangeField | IntegerField | SelectField | ToggleField | TextField

export interface AcceptedFiles {
  /** MIME types and extensions, used as the file picker `accept` attribute. */
  mimeTypes: string[]
  /** Plain-English summary shown under the upload button. */
  humanLabel: string
  maxFiles?: number
  maxBytesEach?: number
}

export interface Capability {
  id: string
  kind: ModalityKind
  provider: string
  label: string
  description?: string
  contextWindow?: number
  attachments?: AcceptedFiles
  /** Image/video models that can't run without an input file. */
  requiresAttachment?: string
  fields: Record<string, Field>
}

export type TextCapability  = Capability & { kind: 'text' }
export type ImageCapability = Capability & { kind: 'image' }
export type VideoCapability = Capability & { kind: 'video' }
export type AudioCapability = Capability & { kind: 'audio' }

export function buildAcceptAttribute(f: AcceptedFiles): string {
  return f.mimeTypes.join(',')
}

export function summarizeAcceptedFiles(f: AcceptedFiles): string {
  return f.humanLabel
}

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

const opts = (...values: Array<string | [string, string]>) =>
  values.map(v => (Array.isArray(v) ? { value: v[0], label: v[1] } : { value: v, label: v }))

const IMG_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

const DOC_MIMES = [
  'text/plain', '.txt', 'text/markdown', '.md', '.markdown', 'text/csv', '.csv',
  'text/tab-separated-values', '.tsv',
  'application/json', '.json', 'application/x-yaml', 'text/yaml', '.yaml', '.yml',
  'application/toml', '.toml', '.ini', '.cfg', '.env', '.properties',
  'application/x-ndjson', '.ndjson', '.jsonl',
  'text/html', '.html', '.htm', 'application/xml', 'text/xml', '.xml',
  'image/svg+xml', '.svg', 'text/css', '.css',
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.swift', '.c', '.h', '.cpp', '.hpp', '.cc', '.cs', '.php', '.lua', '.pl', '.r',
  '.sh', '.bash', '.zsh', '.ps1', '.sql', '.graphql', '.gql', '.proto',
  // Office files are extracted to text server-side before they reach the model.
  '.docx', '.xlsx', '.pptx',
]

const MB = 1024 * 1024

function textAttachments(e: GatewayCatalogEntry): AcceptedFiles {
  // PDFs and Office files are converted to text before they reach the
  // model, so every model takes them; images only go to vision models.
  const input = e.input ?? ['text']
  const mimes = ['application/pdf', ...DOC_MIMES]
  const parts = ['PDF', 'documents (TXT/MD/CSV/JSON/YAML/HTML/code, Word/Excel/PowerPoint)']
  if (input.includes('image')) { mimes.unshift(...IMG_MIMES); parts.unshift('images') }
  return {
    mimeTypes: mimes,
    humanLabel: `${parts.join(', ')} — up to 20 MB each`,
    maxFiles: 10,
    maxBytesEach: 20 * MB,
  }
}

function imageInputs(label: string, max: number, mb = 10): AcceptedFiles {
  return {
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    humanLabel: `${label} (PNG/JPEG/WebP) — up to ${max} file${max === 1 ? '' : 's'}, ${mb} MB each`,
    maxFiles: max,
    maxBytesEach: mb * MB,
  }
}

const COUNT: IntegerField = { type: 'integer', label: 'Number of images', min: 1, max: 4, step: 1, default: 1 }
const SEED: TextField = { type: 'text', label: 'Seed', placeholder: 'integer, blank for random', default: '' }
const NEGATIVE: TextField = {
  type: 'text', label: 'Avoid', placeholder: 'things to leave out', default: '',
  hint: 'Added to the prompt as an “avoid” instruction',
}

const ASPECTS_WIDE = opts(
  ['1:1', '1:1 square'], ['16:9', '16:9 widescreen'], ['9:16', '9:16 vertical'],
  ['4:3', '4:3 landscape'], ['3:4', '3:4 portrait'], ['3:2', '3:2 photo'], ['2:3', '2:3 photo'],
  ['21:9', '21:9 ultrawide'],
)
const ASPECT: SelectField = { type: 'select', label: 'Aspect ratio', default: '1:1', options: ASPECTS_WIDE }

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function textCapability(e: GatewayCatalogEntry): Capability {
  const params = new Set(e.params ?? [])
  const fields: Record<string, Field> = {}
  const isAnthropic = e.owner === 'anthropic'

  if (e.temperature !== false && params.has('temperature')) {
    fields.temperature = {
      type: 'range', label: 'Temperature', min: 0, max: isAnthropic ? 1 : 2, step: 0.05, default: 0.7,
      hint: 'Higher = more creative, lower = more deterministic',
    }
  }
  const maxOut = e.maxOutput && e.maxOutput > 0 ? e.maxOutput : 8192
  fields.maxTokens = {
    type: 'integer', label: 'Max output tokens', min: 256, max: maxOut,
    step: maxOut > 32_000 ? 1024 : 256, default: Math.min(8192, maxOut),
  }

  const effort = e.reasoning?.find(r => r.type === 'effort') as { type: 'effort'; values: string[] } | undefined
  const toggle = e.reasoning?.some(r => r.type === 'toggle')
  const budget = e.reasoning?.some(r => r.type === 'budget_tokens')
  if (effort) {
    fields.reasoningEffort = {
      type: 'select', label: 'Reasoning effort', default: 'default',
      options: [{ value: 'default', label: 'Model default' }, ...effort.values.map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))],
      hint: 'How long the model thinks before answering',
    }
  } else if (budget) {
    fields.reasoningBudget = {
      type: 'integer', label: 'Thinking budget', min: 0, max: Math.min(64_000, maxOut), step: 1024, default: 0,
      suffix: ' tok', hint: '0 = model default',
    }
  } else if (toggle) {
    fields.reasoning = { type: 'toggle', label: 'Extended reasoning', default: false }
  }

  if (params.has('stop')) {
    fields.stopSequences = { type: 'text', label: 'Stop sequences', placeholder: 'comma separated, e.g. ###, END', default: '' }
  }
  if (params.has('response_format')) {
    fields.jsonMode = { type: 'toggle', label: 'JSON output', default: false, hint: 'Ask the model to reply with a single JSON object' }
  }

  const tags = e.tags ?? []
  const traits = [
    tags.includes('reasoning') && 'reasoning',
    tags.includes('tool-use') && 'tools',
    tags.includes('vision') && 'vision',
    tags.includes('file-input') && 'files',
    tags.includes('web-search') && 'web search',
  ].filter(Boolean)

  return {
    id: e.id, kind: 'text', provider: e.owner, label: e.name,
    description: [e.description, traits.length ? `Supports ${traits.join(', ')}.` : ''].filter(Boolean).join(' '),
    contextWindow: e.context,
    attachments: textAttachments(e),
    fields,
  }
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

const GEMINI_ASPECTS = opts('1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9')
const GEMINI_SIZED = new Set(['google/gemini-3-pro-image', 'google/gemini-3.1-flash-image', 'google/gemini-nano-banana-2.1'])

function imageCapability(e: GatewayCatalogEntry): Capability {
  const base = { id: e.id, kind: 'image' as const, provider: e.owner, label: e.name, description: e.description }
  const fam = e.owner

  if (isImageLanguageModel(e)) {
    const fields: Record<string, Field> = {
      aspectRatio: { type: 'select', label: 'Aspect ratio', default: '1:1', options: GEMINI_ASPECTS },
      count: COUNT,
      negativePrompt: NEGATIVE,
    }
    if (GEMINI_SIZED.has(e.id)) {
      fields.imageSize = { type: 'select', label: 'Resolution', default: '1K', options: opts(['1K', '1K'], ['2K', '2K'], ['4K', '4K']) }
    }
    if (fam !== 'google') delete fields.aspectRatio
    return { ...base, attachments: imageInputs('Reference or source images to edit', 4, 7), fields }
  }

  if (fam === 'openai' || fam === 'meta') {
    const fields: Record<string, Field> = {
      size: {
        type: 'select', label: 'Size', default: 'auto',
        options: opts(['auto', 'Auto'], ['1024x1024', '1024 × 1024 square'], ['1536x1024', '1536 × 1024 landscape'], ['1024x1536', '1024 × 1536 portrait']),
      },
      count: COUNT,
      negativePrompt: NEGATIVE,
    }
    if (fam === 'openai') {
      fields.quality = { type: 'select', label: 'Quality', default: 'auto', options: opts(['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']) }
      fields.background = { type: 'select', label: 'Background', default: 'auto', options: opts(['auto', 'Auto'], ['opaque', 'Opaque'], ['transparent', 'Transparent']) }
      fields.outputFormat = { type: 'select', label: 'Format', default: 'png', options: opts(['png', 'PNG'], ['jpeg', 'JPEG'], ['webp', 'WebP']) }
    }
    return { ...base, attachments: imageInputs('Images to edit or use as reference', 4), fields }
  }

  if (fam === 'bytedance') {
    return {
      ...base,
      attachments: imageInputs('Reference images', 4),
      fields: {
        size: {
          type: 'select', label: 'Size', default: '2048x2048',
          options: opts(['2048x2048', '2048 × 2048 square'], ['2560x1440', '2560 × 1440 landscape'], ['1440x2560', '1440 × 2560 portrait'], ['2304x1728', '2304 × 1728 4:3'], ['1728x2304', '1728 × 2304 3:4']),
        },
        count: COUNT, seed: SEED, negativePrompt: NEGATIVE,
      },
    }
  }

  if (fam === 'recraft') {
    return {
      ...base,
      fields: {
        size: {
          type: 'select', label: 'Size', default: '1024x1024',
          options: opts(['1024x1024', '1024 × 1024'], ['1365x1024', '1365 × 1024'], ['1024x1365', '1024 × 1365'], ['1536x1024', '1536 × 1024'], ['1024x1536', '1024 × 1536'], ['1820x1024', '1820 × 1024'], ['1024x1820', '1024 × 1820']),
        },
        style: {
          type: 'select', label: 'Style', default: 'any',
          options: opts(['any', 'Any'], ['realistic_image', 'Realistic image'], ['digital_illustration', 'Digital illustration'], ['vector_illustration', 'Vector illustration'], ['icon', 'Icon']),
        },
        count: COUNT, negativePrompt: NEGATIVE,
      },
    }
  }

  if (fam === 'bfl') {
    const fields: Record<string, Field> = {
      aspectRatio: ASPECT, count: COUNT, seed: SEED, negativePrompt: NEGATIVE,
      outputFormat: { type: 'select', label: 'Format', default: 'jpeg', options: opts(['jpeg', 'JPEG'], ['png', 'PNG']) },
      safetyTolerance: { type: 'integer', label: 'Safety tolerance', min: 0, max: 6, step: 1, default: 2, hint: '0 = strictest, 6 = most permissive' },
      promptUpsampling: { type: 'toggle', label: 'Prompt upsampling', default: false, hint: 'Let FLUX expand short prompts' },
    }
    if (/flex/.test(e.id)) {
      fields.steps = { type: 'integer', label: 'Steps', min: 1, max: 50, step: 1, default: 28 }
      fields.guidance = { type: 'range', label: 'Guidance', min: 1.5, max: 10, step: 0.1, default: 3.5 }
    }
    const editable = /kontext|flux-2|flux-3/.test(e.id)
    return { ...base, ...(editable ? { attachments: imageInputs('Reference images', /kontext/.test(e.id) ? 1 : 4) } : {}), fields }
  }

  if (fam === 'topaz') {
    return {
      ...base,
      attachments: imageInputs('The image to enhance', 1, 20),
      requiresAttachment: 'Attach the image you want enhanced.',
      fields: {},
    }
  }

  // Grok Imagine, Microsoft MAI, Prodia and anything new: aspect-ratio models.
  return {
    ...base,
    ...(fam === 'spacexai' ? { attachments: imageInputs('Image to edit', 1) } : {}),
    fields: { aspectRatio: ASPECT, count: COUNT, ...(fam === 'prodia' ? { seed: SEED } : {}), negativePrompt: NEGATIVE },
  }
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

const OPERATION_LABEL: Record<string, string> = {
  'text-to-video': 'Text to video',
  'image-to-video': 'Animate an image',
  'first-last-frame': 'First + last frame',
  'reference-to-video': 'From reference images',
}

function videoCapability(e: GatewayCatalogEntry): Capability {
  const v = e.video ?? {}
  const fields: Record<string, Field> = {}
  const ops = (v.supported_operations ?? ['text-to-video']).filter(o => OPERATION_LABEL[o])
  if (ops.length > 1) {
    fields.mode = {
      type: 'select', label: 'Mode', default: 'auto',
      options: [
        { value: 'auto', label: 'Automatic (from attachments)' },
        ...ops.map(o => ({ value: o, label: OPERATION_LABEL[o] })),
      ],
      hint: 'How attached images are used',
    }
  }
  if (v.supported_aspect_ratios?.length) {
    fields.aspectRatio = {
      type: 'select', label: 'Aspect ratio',
      default: v.supported_aspect_ratios.includes('16:9') ? '16:9' : v.supported_aspect_ratios[0],
      options: opts(...v.supported_aspect_ratios),
    }
  }
  if (v.supported_resolutions?.length) {
    fields.resolution = {
      type: 'select', label: 'Resolution',
      default: v.supported_resolutions.includes('720p') ? '720p' : v.supported_resolutions[0],
      options: opts(...v.supported_resolutions),
    }
  }
  const durations = v.supported_durations_seconds ?? []
  if (durations.length) {
    const preferred = durations.includes(5) ? 5 : durations.includes(6) ? 6 : durations[0]
    fields.duration = {
      type: 'select', label: 'Duration', default: String(preferred),
      options: durations.map(d => ({ value: String(d), label: `${d} seconds` })),
    }
  }
  if (v.generate_audio) fields.generateAudio = { type: 'toggle', label: 'Generate audio', default: true }
  if ((v.max_sample_count ?? 1) > 1) {
    fields.count = { type: 'integer', label: 'Number of videos', min: 1, max: Math.min(4, v.max_sample_count ?? 1), step: 1, default: 1 }
  }
  fields.seed = SEED

  const imgLimit = v.input_limits?.image
  const needsImage = !ops.includes('text-to-video')
  return {
    id: e.id, kind: 'video', provider: e.owner, label: e.name, description: e.description,
    ...(imgLimit || ops.some(o => o !== 'text-to-video')
      ? { attachments: imageInputs('Start/end frames or reference images', Math.max(1, imgLimit?.max_count ?? 2), imgLimit?.max_file_size_mb ?? 10) }
      : {}),
    ...(needsImage ? { requiresAttachment: 'Attach an image — this model animates images rather than starting from text.' } : {}),
    fields,
  }
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

const OPENAI_VOICES = opts('alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer')
  .map(o => ({ ...o, label: o.label[0].toUpperCase() + o.label.slice(1) }))

const GEMINI_VOICES = opts(
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe',
  'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi',
  'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird',
  'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
)

const ELEVEN_VOICES = opts(
  ['21m00Tcm4TlvDq8ikWAM', 'Rachel — calm, female'],
  ['EXAVITQu4vr4xnJGV5ZH', 'Bella — soft, female'],
  ['MF3mGyEYCl7XYWbV9V6O', 'Elli — young, female'],
  ['AZnzlk1XvdvUeBnXmlld', 'Domi — strong, female'],
  ['pNInz6obpgDQGcFmaJgB', 'Adam — deep, male'],
  ['ErXwobaYiN019PkySvjV', 'Antoni — warm, male'],
  ['TxGEqnHWrfWFTfGW9XjX', 'Josh — young, male'],
  ['VR6AewLTigWG4xSOukaG', 'Arnold — crisp, male'],
  ['yoZ06aMxZJJ28mfd3POQ', 'Sam — raspy, male'],
)

const VOXTRAL_VOICES = opts(
  ['voice_478', 'Sheila'], ['voice_447', 'Margaret'], ['voice_485', 'Rob'],
  ['en_paul_neutral', 'Paul (neutral)'], ['gb_jane_happy', 'Jane (happy, UK)'],
)

const SPEED = (min: number, max: number): RangeField => ({ type: 'range', label: 'Speed', min, max, step: 0.05, default: 1, suffix: 'x' })
const CUSTOM_VOICE: TextField = { type: 'text', label: 'Custom voice id', placeholder: 'overrides the voice above', default: '' }

function audioCapability(e: GatewayCatalogEntry): Capability {
  const base = { id: e.id, kind: 'audio' as const, provider: e.owner, label: e.name, description: e.description }
  const tags = e.tags ?? []

  if (tags.includes('music')) {
    return {
      ...base,
      fields: {
        duration: { type: 'integer', label: 'Length', min: 10, max: 300, step: 5, default: 30, suffix: 's' },
        instrumental: { type: 'toggle', label: 'Instrumental only', default: false },
      },
    }
  }
  if (tags.includes('sound-effects')) {
    return {
      ...base,
      fields: {
        duration: { type: 'range', label: 'Length', min: 0.5, max: 30, step: 0.5, default: 5, suffix: 's' },
        promptInfluence: { type: 'range', label: 'Prompt influence', min: 0, max: 1, step: 0.05, default: 0.3 },
        loop: { type: 'toggle', label: 'Seamless loop', default: false },
      },
    }
  }

  switch (e.owner) {
    case 'openai':
      return {
        ...base,
        fields: {
          voice: { type: 'select', label: 'Voice', default: 'alloy', options: OPENAI_VOICES },
          speed: SPEED(0.25, 4),
          outputFormat: { type: 'select', label: 'Format', default: 'mp3', options: opts(['mp3', 'MP3'], ['opus', 'Opus'], ['aac', 'AAC'], ['flac', 'FLAC'], ['wav', 'WAV'], ['pcm', 'PCM']) },
        },
      }
    case 'google':
      return {
        ...base,
        fields: {
          voice: { type: 'select', label: 'Voice', default: 'Kore', options: GEMINI_VOICES },
          instructions: { type: 'text', label: 'Delivery', placeholder: 'e.g. warm and slow, like a bedtime story', default: '' },
        },
      }
    case 'elevenlabs':
      return {
        ...base,
        fields: {
          voice: { type: 'select', label: 'Voice', default: '21m00Tcm4TlvDq8ikWAM', options: ELEVEN_VOICES },
          customVoice: CUSTOM_VOICE,
          speed: SPEED(0.7, 1.2),
          stability: { type: 'range', label: 'Stability', min: 0, max: 1, step: 0.05, default: 0.5 },
          similarity: { type: 'range', label: 'Similarity boost', min: 0, max: 1, step: 0.05, default: 0.75 },
          style: { type: 'range', label: 'Style exaggeration', min: 0, max: 1, step: 0.05, default: 0 },
          speakerBoost: { type: 'toggle', label: 'Speaker boost', default: true },
          language: { type: 'text', label: 'Language', placeholder: 'ISO code, e.g. en, fr — blank to detect', default: '' },
          outputFormat: { type: 'select', label: 'Format', default: 'mp3_44100_128', options: opts(['mp3_44100_128', 'MP3 44.1 kHz / 128 kbps'], ['mp3_44100_192', 'MP3 44.1 kHz / 192 kbps'], ['pcm_24000', 'PCM 24 kHz']) },
          seed: SEED,
        },
      }
    case 'mistral':
      return { ...base, fields: { voice: { type: 'select', label: 'Voice', default: 'voice_478', options: VOXTRAL_VOICES }, customVoice: CUSTOM_VOICE } }
    default:
      // Fish Audio, Microsoft MAI Voice, Grok TTS: default voice unless a
      // provider voice id is given.
      return {
        ...base,
        fields: {
          customVoice: { type: 'text', label: 'Voice id', placeholder: 'blank for the default voice', default: '' },
          speed: SPEED(0.5, 2),
        },
      }
  }
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const cache = new Map<string, Capability | null>()

/** Capability for a gateway model id in the given modality. */
export function getCapability(id: string, kind: ModalityKind): Capability | undefined {
  const key = `${kind}:${id}`
  if (cache.has(key)) return cache.get(key) ?? undefined
  const e = catalogEntry(id)
  let cap: Capability | null = null
  if (e) {
    if (kind === 'text' && e.type === 'language' && !isImageLanguageModel(e)) cap = textCapability(e)
    else if (kind === 'image' && (e.type === 'image' || isImageLanguageModel(e))) cap = imageCapability(e)
    else if (kind === 'video' && e.type === 'video') cap = videoCapability(e)
    else if (kind === 'audio' && e.type === 'speech') cap = audioCapability(e)
  }
  if (cap) cap.provider = brandFor(cap.provider)
  cache.set(key, cap)
  return cap ?? undefined
}
