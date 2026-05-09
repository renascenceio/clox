/**
 * Per-model capability registry.
 *
 * The configuration pane (`ConfigDrawer` in `ChatWorkspace`) is driven by this
 * file. For every model we ship in the four `*_MODELS` registries we publish
 * the knobs that model's API actually exposes — temperature range, top-p
 * range, max tokens cap, structured-output flag, vision/document support,
 * accepted MIME types and so on.
 *
 * The goal is for the config pane to *only* expose controls that are real on
 * the wire. No more "temperature: 0–2" slider for a Gemini Image model that
 * doesn't take a temperature, no more attaching a PDF to a text-only model.
 *
 * Add a model? Add a capability entry with the same `id` you used in the
 * matching `*_MODELS` table. Missing entries fall back to a conservative
 * default that hides everything risky.
 *
 * NOTE: numbers are pulled from each provider's public API documentation as
 * of 2026-Q2. Where a provider supports more than one ceiling (e.g. Claude
 * Sonnet's 200k context vs 8k completion), we encode the *output* cap that
 * actually controls the slider — context is shown as a read-only display.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ModalityKind = 'text' | 'image' | 'video' | 'audio'

/** A single tunable parameter (slider / dropdown / numeric input). */
export interface ParamSpec<T = number> {
  /** Inclusive minimum. */
  min: number
  /** Inclusive maximum. */
  max: number
  /** Snap step for sliders / numeric inputs. */
  step: number
  /** Default value when nothing is persisted. */
  default: T
  /** Optional human-readable label override. */
  label?: string
  /** Optional short tooltip. */
  hint?: string
}

/** A categorical choice (dropdown). */
export interface ChoiceSpec {
  default: string
  options: { value: string; label: string }[]
  label?: string
  hint?: string
}

/** A toggle (checkbox-style). */
export interface FlagSpec {
  default: boolean
  label?: string
  hint?: string
}

/**
 * Text-completion knobs. Anything left undefined is hidden in the UI — that's
 * the whole point: "don't show controls the API doesn't honour".
 */
export interface TextCapability {
  kind: 'text'
  /** Provider id (e.g. `openai`) — used for badging in the pane. */
  provider: string
  /** Display brand (e.g. `ChatGPT`). */
  brandName: string
  /** Sliders / numeric controls. */
  temperature?: ParamSpec
  topP?: ParamSpec
  topK?: ParamSpec
  maxTokens?: ParamSpec
  presencePenalty?: ParamSpec
  frequencyPenalty?: ParamSpec
  /** Reasoning effort (Anthropic extended thinking, OpenAI reasoning_effort). */
  reasoningEffort?: ChoiceSpec
  /** JSON / structured output mode. */
  jsonMode?: FlagSpec
  /** Tool calling / function calling. */
  toolUse?: FlagSpec
  /** Stop sequences (free text, comma-separated). */
  stopSequences?: { default: string; label?: string; hint?: string }
  /** Safety / moderation modes the API exposes. */
  safety?: ChoiceSpec
  /** Read-only context window display, in tokens. */
  contextWindow?: number
  /** Vision (image input) accepted? */
  vision?: boolean
  /** Document input accepted (PDFs, text)? */
  documents?: boolean
  /** Audio input accepted? */
  audioInput?: boolean
  /** Video input accepted? */
  videoInput?: boolean
  /** Built-in web browsing (Perplexity, Sonar, Grok web). */
  webBrowsing?: boolean
  /** Built-in code execution sandbox (Claude code-execution skill, etc.). */
  codeExecution?: boolean
  /** Friendly summary of accepted MIME types, shown in the docs strip. */
  acceptedFiles: string[]
  /** Free-text mention of any quirks worth surfacing in the pane. */
  notes?: string
}

/** Image-generation knobs. */
export interface ImageCapability {
  kind: 'image'
  provider: string
  brandName: string
  aspectRatios?: { default: string; options: string[] }
  resolutions?: { default: string; options: string[] }
  qualityLevels?: { default: string; options: string[] }
  styles?: { default: string; options: { value: string; label: string }[] }
  /** Number of images per request. */
  count?: ParamSpec
  seed?: { default?: number; allowRandom: boolean }
  negativePrompt?: FlagSpec
  /** Stable-Diffusion / FLUX style guidance scale. */
  guidanceScale?: ParamSpec
  /** Steps (Stability / FLUX dev). */
  steps?: ParamSpec
  /** Reference / source image (image-to-image). */
  referenceImage?: FlagSpec
  /** Mask / inpainting. */
  inpainting?: FlagSpec
  /** Generates legible text inside the image (Ideogram, Imagen, FLUX). */
  textInImage?: boolean
  /** Multi-image composition / character consistency. */
  characterConsistency?: boolean
  acceptedFiles: string[]
  notes?: string
}

/** Video-generation knobs. */
export interface VideoCapability {
  kind: 'video'
  provider: string
  brandName: string
  durations?: { default: number; options: number[] }
  /** seconds, soft-max for the slider when there's no fixed list. */
  maxDurationSec?: number
  resolutions?: { default: string; options: string[] }
  aspectRatios?: { default: string; options: string[] }
  fps?: { default: number; options: number[] }
  styles?: { default: string; options: { value: string; label: string }[] }
  /** Image-to-video (start frame). */
  imageToVideo?: FlagSpec
  /** Last-frame conditioning. */
  endFrame?: FlagSpec
  /** Audio track included in the output. */
  builtInAudio?: boolean
  /** Camera motion controls (Runway, Pika). */
  motionControl?: FlagSpec
  /** Avatar / lipsync (HeyGen, Synthesia, D-ID). */
  avatar?: boolean
  acceptedFiles: string[]
  notes?: string
}

/** Audio-generation knobs (TTS + music). */
export interface AudioCapability {
  kind: 'audio'
  provider: string
  brandName: string
  /** TTS / music switch — shapes the rest of the pane. */
  audioKind: 'voice' | 'music' | 'sfx'
  voices?: { default: string; options: { value: string; label: string }[] }
  /** Speaker style (`natural`, `professional`, etc.). */
  styles?: { default: string; options: { value: string; label: string }[] }
  /** Music genres (Suno / Udio). */
  genres?: { default: string; options: { value: string; label: string }[] }
  /** Voice stability / similarity (ElevenLabs). */
  stability?: ParamSpec
  similarity?: ParamSpec
  speakerBoost?: FlagSpec
  /** Speed multiplier (OpenAI TTS, Gemini TTS). */
  speed?: ParamSpec
  /** Pitch (Azure, Play.ht). */
  pitch?: ParamSpec
  /** Output sample rate / format. */
  format?: { default: string; options: string[] }
  /** Music duration. */
  durations?: { default: number; options: number[] }
  /** Lyrics input (Suno / Udio). */
  lyrics?: FlagSpec
  /** Reference audio (voice cloning). */
  voiceCloning?: FlagSpec
  acceptedFiles: string[]
  notes?: string
}

export type Capability =
  | TextCapability
  | ImageCapability
  | VideoCapability
  | AudioCapability

// ---------------------------------------------------------------------------
// Text models
// ---------------------------------------------------------------------------

const T_VISION_FILES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const T_DOC_FILES = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json']
const T_AUDIO_FILES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
const T_VIDEO_FILES = ['video/mp4', 'video/webm', 'video/quicktime']

const TEXT_CAPS: Record<string, TextCapability> = {
  // ---------------- OpenAI ----------------
  'gpt-4o': {
    kind: 'text',
    provider: 'openai',
    brandName: 'ChatGPT',
    temperature: { min: 0, max: 2, step: 0.05, default: 0.7 },
    topP: { min: 0, max: 1, step: 0.01, default: 1 },
    maxTokens: { min: 256, max: 16_384, step: 256, default: 4_096 },
    presencePenalty: { min: -2, max: 2, step: 0.1, default: 0 },
    frequencyPenalty: { min: -2, max: 2, step: 0.1, default: 0 },
    jsonMode: { default: false, hint: 'Force valid JSON output.' },
    toolUse: { default: true },
    contextWindow: 128_000,
    vision: true,
    documents: true,
    audioInput: true,
    acceptedFiles: [...T_VISION_FILES, ...T_DOC_FILES, ...T_AUDIO_FILES],
    notes: 'Multimodal: text, vision, and audio in. PDFs are uploaded via the Files API.',
  },
  'gpt-4o-mini': {
    kind: 'text',
    provider: 'openai',
    brandName: 'ChatGPT',
    temperature: { min: 0, max: 2, step: 0.05, default: 0.7 },
    topP: { min: 0, max: 1, step: 0.01, default: 1 },
    maxTokens: { min: 256, max: 16_384, step: 256, default: 4_096 },
    presencePenalty: { min: -2, max: 2, step: 0.1, default: 0 },
    frequencyPenalty: { min: -2, max: 2, step: 0.1, default: 0 },
    jsonMode: { default: false },
    toolUse: { default: true },
    contextWindow: 128_000,
    vision: true,
    documents: true,
    acceptedFiles: [...T_VISION_FILES, ...T_DOC_FILES],
  },

  // ---------------- Anthropic ----------------
  'claude-opus-4.6': {
    kind: 'text',
    provider: 'anthropic',
    brandName: 'Claude',
    temperature: { min: 0, max: 1, step: 0.05, default: 1 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.999 },
    topK: { min: 0, max: 500, step: 1, default: 0, hint: '0 disables top-k.' },
    maxTokens: { min: 1_024, max: 32_000, step: 1_024, default: 8_192 },
    reasoningEffort: {
      default: 'standard',
      label: 'Extended thinking',
      hint: 'Anthropic extended thinking budget.',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'standard', label: 'Standard' },
        { value: 'extended', label: 'Extended' },
        { value: 'maximum', label: 'Maximum' },
      ],
    },
    toolUse: { default: true },
    codeExecution: true,
    contextWindow: 200_000,
    vision: true,
    documents: true,
    acceptedFiles: [...T_VISION_FILES, ...T_DOC_FILES],
    notes: 'Best for reasoning. Anthropic does not expose presence/frequency penalty.',
  },
  'claude-sonnet-4.6': {
    kind: 'text',
    provider: 'anthropic',
    brandName: 'Claude',
    temperature: { min: 0, max: 1, step: 0.05, default: 1 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.999 },
    topK: { min: 0, max: 500, step: 1, default: 0 },
    maxTokens: { min: 1_024, max: 16_384, step: 1_024, default: 8_192 },
    reasoningEffort: {
      default: 'standard',
      label: 'Extended thinking',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'standard', label: 'Standard' },
        { value: 'extended', label: 'Extended' },
      ],
    },
    toolUse: { default: true },
    codeExecution: true,
    contextWindow: 200_000,
    vision: true,
    documents: true,
    acceptedFiles: [...T_VISION_FILES, ...T_DOC_FILES],
  },
  'claude-haiku-4.5': {
    kind: 'text',
    provider: 'anthropic',
    brandName: 'Claude',
    temperature: { min: 0, max: 1, step: 0.05, default: 1 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.999 },
    maxTokens: { min: 1_024, max: 8_192, step: 512, default: 4_096 },
    toolUse: { default: true },
    contextWindow: 200_000,
    vision: true,
    documents: true,
    acceptedFiles: [...T_VISION_FILES, ...T_DOC_FILES],
  },

  // ---------------- Google ----------------
  'gemini-2.5-flash': {
    kind: 'text',
    provider: 'google',
    brandName: 'Gemini',
    temperature: { min: 0, max: 2, step: 0.05, default: 1 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.95 },
    topK: { min: 1, max: 100, step: 1, default: 40 },
    maxTokens: { min: 256, max: 65_536, step: 256, default: 8_192 },
    jsonMode: { default: false, hint: 'Use response_mime_type: application/json.' },
    toolUse: { default: true },
    safety: {
      default: 'standard',
      options: [
        { value: 'standard', label: 'Standard' },
        { value: 'low', label: 'Low' },
        { value: 'block_none', label: 'Block none' },
      ],
    },
    contextWindow: 1_000_000,
    vision: true,
    documents: true,
    audioInput: true,
    videoInput: true,
    acceptedFiles: [...T_VISION_FILES, ...T_DOC_FILES, ...T_AUDIO_FILES, ...T_VIDEO_FILES],
    notes: '1M context window. Native multimodal: text, vision, audio, and video frames in.',
  },
  'gemini-2.0-flash': {
    kind: 'text',
    provider: 'google',
    brandName: 'Gemini',
    temperature: { min: 0, max: 2, step: 0.05, default: 1 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.95 },
    topK: { min: 1, max: 100, step: 1, default: 40 },
    maxTokens: { min: 256, max: 8_192, step: 256, default: 8_192 },
    jsonMode: { default: false },
    toolUse: { default: true },
    contextWindow: 1_000_000,
    vision: true,
    documents: true,
    audioInput: true,
    videoInput: true,
    acceptedFiles: [...T_VISION_FILES, ...T_DOC_FILES, ...T_AUDIO_FILES, ...T_VIDEO_FILES],
  },
  'gemini-1.5-pro': {
    kind: 'text',
    provider: 'google',
    brandName: 'Gemini',
    temperature: { min: 0, max: 2, step: 0.05, default: 1 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.95 },
    topK: { min: 1, max: 100, step: 1, default: 40 },
    maxTokens: { min: 256, max: 8_192, step: 256, default: 8_192 },
    jsonMode: { default: false },
    toolUse: { default: true },
    contextWindow: 2_000_000,
    vision: true,
    documents: true,
    audioInput: true,
    videoInput: true,
    acceptedFiles: [...T_VISION_FILES, ...T_DOC_FILES, ...T_AUDIO_FILES, ...T_VIDEO_FILES],
  },

  // ---------------- Mistral ----------------
  'mistral-large-latest': {
    kind: 'text',
    provider: 'mistral',
    brandName: 'Mistral AI',
    temperature: { min: 0, max: 1, step: 0.05, default: 0.7 },
    topP: { min: 0, max: 1, step: 0.01, default: 1 },
    maxTokens: { min: 256, max: 32_000, step: 256, default: 4_096 },
    jsonMode: { default: false },
    toolUse: { default: true },
    contextWindow: 128_000,
    documents: true,
    acceptedFiles: T_DOC_FILES,
    notes: 'Mistral exposes temperature, top_p and tool calling but not vision.',
  },
  'mistral-small-latest': {
    kind: 'text',
    provider: 'mistral',
    brandName: 'Mistral AI',
    temperature: { min: 0, max: 1, step: 0.05, default: 0.7 },
    topP: { min: 0, max: 1, step: 0.01, default: 1 },
    maxTokens: { min: 256, max: 32_000, step: 256, default: 4_096 },
    toolUse: { default: true },
    contextWindow: 128_000,
    documents: true,
    acceptedFiles: T_DOC_FILES,
  },

  // ---------------- xAI ----------------
  'grok-4': {
    kind: 'text',
    provider: 'xai',
    brandName: 'Grok',
    temperature: { min: 0, max: 2, step: 0.05, default: 1 },
    topP: { min: 0, max: 1, step: 0.01, default: 1 },
    maxTokens: { min: 256, max: 32_768, step: 256, default: 8_192 },
    presencePenalty: { min: -2, max: 2, step: 0.1, default: 0 },
    frequencyPenalty: { min: -2, max: 2, step: 0.1, default: 0 },
    reasoningEffort: {
      default: 'medium',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
      ],
    },
    jsonMode: { default: false },
    toolUse: { default: true },
    webBrowsing: true,
    contextWindow: 256_000,
    vision: true,
    documents: true,
    acceptedFiles: [...T_VISION_FILES, ...T_DOC_FILES],
  },
  'grok-3': {
    kind: 'text',
    provider: 'xai',
    brandName: 'Grok',
    temperature: { min: 0, max: 2, step: 0.05, default: 1 },
    topP: { min: 0, max: 1, step: 0.01, default: 1 },
    maxTokens: { min: 256, max: 16_384, step: 256, default: 4_096 },
    presencePenalty: { min: -2, max: 2, step: 0.1, default: 0 },
    frequencyPenalty: { min: -2, max: 2, step: 0.1, default: 0 },
    toolUse: { default: true },
    webBrowsing: true,
    contextWindow: 128_000,
    vision: true,
    acceptedFiles: T_VISION_FILES,
  },

  // ---------------- DeepSeek ----------------
  'deepseek-chat': {
    kind: 'text',
    provider: 'deepseek',
    brandName: 'DeepSeek',
    temperature: { min: 0, max: 2, step: 0.05, default: 1 },
    topP: { min: 0, max: 1, step: 0.01, default: 1 },
    maxTokens: { min: 256, max: 8_192, step: 256, default: 4_096 },
    presencePenalty: { min: -2, max: 2, step: 0.1, default: 0 },
    frequencyPenalty: { min: -2, max: 2, step: 0.1, default: 0 },
    jsonMode: { default: false },
    toolUse: { default: true },
    contextWindow: 64_000,
    documents: true,
    acceptedFiles: T_DOC_FILES,
  },
  'deepseek-reasoner': {
    kind: 'text',
    provider: 'deepseek',
    brandName: 'DeepSeek',
    // DeepSeek's reasoner ignores temperature / top_p — explicitly omitted so
    // the pane doesn't render dead controls.
    maxTokens: { min: 256, max: 8_192, step: 256, default: 4_096 },
    contextWindow: 64_000,
    documents: true,
    acceptedFiles: T_DOC_FILES,
    notes: 'R1 ignores temperature, top-p, and penalty knobs by design.',
  },

  // ---------------- Moonshot Kimi ----------------
  'kimi-k2': {
    kind: 'text',
    provider: 'moonshot',
    brandName: 'Kimi',
    temperature: { min: 0, max: 1, step: 0.05, default: 0.6 },
    topP: { min: 0, max: 1, step: 0.01, default: 1 },
    maxTokens: { min: 256, max: 8_192, step: 256, default: 4_096 },
    contextWindow: 200_000,
    vision: true,
    documents: true,
    acceptedFiles: [...T_VISION_FILES, ...T_DOC_FILES],
  },
  'moonshot-v1-128k': {
    kind: 'text',
    provider: 'moonshot',
    brandName: 'Kimi',
    temperature: { min: 0, max: 1, step: 0.05, default: 0.6 },
    topP: { min: 0, max: 1, step: 0.01, default: 1 },
    maxTokens: { min: 256, max: 8_192, step: 256, default: 4_096 },
    contextWindow: 128_000,
    documents: true,
    acceptedFiles: T_DOC_FILES,
  },

  // ---------------- Alibaba Qwen ----------------
  'qwen-max': {
    kind: 'text',
    provider: 'alibaba',
    brandName: 'Qwen',
    temperature: { min: 0, max: 2, step: 0.05, default: 0.85 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.8 },
    topK: { min: 0, max: 100, step: 1, default: 0 },
    maxTokens: { min: 256, max: 8_192, step: 256, default: 4_096 },
    toolUse: { default: true },
    contextWindow: 32_000,
    vision: true,
    documents: true,
    acceptedFiles: [...T_VISION_FILES, ...T_DOC_FILES],
  },
  'qwen-plus': {
    kind: 'text',
    provider: 'alibaba',
    brandName: 'Qwen',
    temperature: { min: 0, max: 2, step: 0.05, default: 0.85 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.8 },
    maxTokens: { min: 256, max: 8_192, step: 256, default: 4_096 },
    contextWindow: 131_072,
    documents: true,
    acceptedFiles: T_DOC_FILES,
  },

  // ---------------- Cohere ----------------
  'command-r-plus': {
    kind: 'text',
    provider: 'cohere',
    brandName: 'Cohere',
    temperature: { min: 0, max: 1, step: 0.05, default: 0.3 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.75 },
    topK: { min: 0, max: 500, step: 1, default: 0 },
    maxTokens: { min: 256, max: 4_000, step: 256, default: 4_000 },
    presencePenalty: { min: 0, max: 1, step: 0.05, default: 0 },
    frequencyPenalty: { min: 0, max: 1, step: 0.05, default: 0 },
    toolUse: { default: true },
    webBrowsing: true,
    contextWindow: 128_000,
    documents: true,
    acceptedFiles: T_DOC_FILES,
    notes: 'Cohere clamps temperature at 1.0 and uses positive-only penalties.',
  },
  'command-r': {
    kind: 'text',
    provider: 'cohere',
    brandName: 'Cohere',
    temperature: { min: 0, max: 1, step: 0.05, default: 0.3 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.75 },
    maxTokens: { min: 256, max: 4_000, step: 256, default: 4_000 },
    toolUse: { default: true },
    contextWindow: 128_000,
    acceptedFiles: [],
  },

  // ---------------- Perplexity ----------------
  'sonar-large': {
    kind: 'text',
    provider: 'perplexity',
    brandName: 'Perplexity',
    temperature: { min: 0, max: 2, step: 0.05, default: 0.2 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.9 },
    maxTokens: { min: 256, max: 4_096, step: 256, default: 1_024 },
    presencePenalty: { min: -2, max: 2, step: 0.1, default: 0 },
    frequencyPenalty: { min: -2, max: 2, step: 0.1, default: 1 },
    webBrowsing: true,
    contextWindow: 128_000,
    acceptedFiles: [],
    notes: 'Online: every reply is grounded with live web citations.',
  },
  'sonar-small': {
    kind: 'text',
    provider: 'perplexity',
    brandName: 'Perplexity',
    temperature: { min: 0, max: 2, step: 0.05, default: 0.2 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.9 },
    maxTokens: { min: 256, max: 4_096, step: 256, default: 1_024 },
    webBrowsing: true,
    contextWindow: 128_000,
    acceptedFiles: [],
  },

  // ---------------- Zhipu ChatGLM ----------------
  'glm-4.5': {
    kind: 'text',
    provider: 'zhipu',
    brandName: 'ChatGLM',
    temperature: { min: 0, max: 1, step: 0.05, default: 0.95 },
    topP: { min: 0, max: 1, step: 0.01, default: 0.7 },
    maxTokens: { min: 256, max: 8_192, step: 256, default: 4_096 },
    toolUse: { default: true },
    contextWindow: 128_000,
    vision: true,
    documents: true,
    acceptedFiles: [...T_VISION_FILES, ...T_DOC_FILES],
  },
}

// ---------------------------------------------------------------------------
// Image models
// ---------------------------------------------------------------------------

const IMG_REF_FILES = ['image/png', 'image/jpeg', 'image/webp']

const IMAGE_CAPS: Record<string, ImageCapability> = {
  // ---- Google Nano Banana / Imagen ----
  'nano-banana-2': {
    kind: 'image',
    provider: 'google',
    brandName: 'Nano Banana',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'] },
    qualityLevels: { default: 'hd', options: ['standard', 'hd', 'ultra'] },
    referenceImage: { default: false, hint: 'Edit or remix an existing image.' },
    textInImage: true,
    characterConsistency: true,
    acceptedFiles: IMG_REF_FILES,
    notes: 'Excellent text rendering and multi-image character consistency.',
  },
  'nano-banana-pro': {
    kind: 'image',
    provider: 'google',
    brandName: 'Nano Banana',
    aspectRatios: { default: '16:9', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    resolutions: { default: '2k', options: ['1k', '2k', '4k'] },
    referenceImage: { default: false },
    textInImage: true,
    characterConsistency: true,
    acceptedFiles: IMG_REF_FILES,
  },
  'nano-banana': {
    kind: 'image',
    provider: 'google',
    brandName: 'Nano Banana',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    referenceImage: { default: false },
    textInImage: true,
    acceptedFiles: IMG_REF_FILES,
  },
  'imagen-4': {
    kind: 'image',
    provider: 'google',
    brandName: 'Imagen',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    count: { min: 1, max: 4, step: 1, default: 1 },
    seed: { allowRandom: true },
    textInImage: true,
    acceptedFiles: [],
    notes: 'Photorealism focus. No reference image input on the public API yet.',
  },
  'imagen-3': {
    kind: 'image',
    provider: 'google',
    brandName: 'Imagen',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    count: { min: 1, max: 4, step: 1, default: 1 },
    seed: { allowRandom: true },
    acceptedFiles: [],
  },

  // ---- OpenAI DALL-E ----
  'dall-e-4': {
    kind: 'image',
    provider: 'openai',
    brandName: 'DALL-E',
    resolutions: { default: '1024x1024', options: ['1024x1024', '1024x1792', '1792x1024'] },
    qualityLevels: { default: 'hd', options: ['standard', 'hd'] },
    styles: {
      default: 'vivid',
      options: [
        { value: 'vivid', label: 'Vivid' },
        { value: 'natural', label: 'Natural' },
      ],
    },
    count: { min: 1, max: 1, step: 1, default: 1 },
    acceptedFiles: [],
    notes: 'DALL-E does not accept seed, negative prompt, or reference images.',
  },
  'dall-e-3': {
    kind: 'image',
    provider: 'openai',
    brandName: 'DALL-E',
    resolutions: { default: '1024x1024', options: ['1024x1024', '1024x1792', '1792x1024'] },
    qualityLevels: { default: 'hd', options: ['standard', 'hd'] },
    styles: {
      default: 'vivid',
      options: [
        { value: 'vivid', label: 'Vivid' },
        { value: 'natural', label: 'Natural' },
      ],
    },
    count: { min: 1, max: 1, step: 1, default: 1 },
    acceptedFiles: [],
  },

  // ---- Midjourney ----
  'midjourney-v7': {
    kind: 'image',
    provider: 'midjourney',
    brandName: 'Midjourney',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'] },
    qualityLevels: { default: 'standard', options: ['draft', 'standard', 'hd'] },
    styles: {
      default: 'default',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'raw', label: 'Raw (--style raw)' },
      ],
    },
    count: { min: 1, max: 4, step: 1, default: 4, label: 'Variations' },
    seed: { allowRandom: true },
    referenceImage: { default: false, hint: 'Used as --cref or --sref.' },
    characterConsistency: true,
    acceptedFiles: IMG_REF_FILES,
    notes: 'Numeric controls map to --stylize, --chaos, and --weird in the prompt.',
  },
  'midjourney-v6.1': {
    kind: 'image',
    provider: 'midjourney',
    brandName: 'Midjourney',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    count: { min: 1, max: 4, step: 1, default: 4 },
    seed: { allowRandom: true },
    referenceImage: { default: false },
    acceptedFiles: IMG_REF_FILES,
  },

  // ---- Stable Diffusion ----
  'stable-diffusion-3.5': {
    kind: 'image',
    provider: 'stability',
    brandName: 'Stable Diffusion',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'] },
    count: { min: 1, max: 4, step: 1, default: 1 },
    seed: { allowRandom: true },
    negativePrompt: { default: false },
    guidanceScale: { min: 1, max: 30, step: 0.5, default: 7, hint: 'CFG scale.' },
    steps: { min: 10, max: 100, step: 1, default: 30 },
    referenceImage: { default: false },
    inpainting: { default: false },
    acceptedFiles: IMG_REF_FILES,
  },
  'stable-diffusion-xl': {
    kind: 'image',
    provider: 'stability',
    brandName: 'Stable Diffusion',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    count: { min: 1, max: 4, step: 1, default: 1 },
    seed: { allowRandom: true },
    negativePrompt: { default: false },
    guidanceScale: { min: 1, max: 30, step: 0.5, default: 7 },
    steps: { min: 10, max: 80, step: 1, default: 30 },
    referenceImage: { default: false },
    acceptedFiles: IMG_REF_FILES,
  },

  // ---- FLUX ----
  'flux-1.1-pro-ultra': {
    kind: 'image',
    provider: 'black-forest-labs',
    brandName: 'FLUX',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'] },
    qualityLevels: { default: 'ultra', options: ['raw', 'ultra'] },
    seed: { allowRandom: true },
    textInImage: true,
    acceptedFiles: [],
  },
  'flux-1-pro': {
    kind: 'image',
    provider: 'black-forest-labs',
    brandName: 'FLUX',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    seed: { allowRandom: true },
    textInImage: true,
    acceptedFiles: [],
  },
  'flux-1-dev': {
    kind: 'image',
    provider: 'black-forest-labs',
    brandName: 'FLUX',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    guidanceScale: { min: 1, max: 10, step: 0.5, default: 3.5 },
    steps: { min: 10, max: 50, step: 1, default: 28 },
    seed: { allowRandom: true },
    textInImage: true,
    acceptedFiles: [],
  },

  // ---- Ideogram ----
  'ideogram-3.0': {
    kind: 'image',
    provider: 'ideogram',
    brandName: 'Ideogram',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    qualityLevels: { default: 'high', options: ['standard', 'high', 'turbo'] },
    styles: {
      default: 'general',
      options: [
        { value: 'general', label: 'General' },
        { value: 'realistic', label: 'Realistic' },
        { value: 'design', label: 'Design' },
        { value: 'render-3d', label: '3D render' },
        { value: 'anime', label: 'Anime' },
      ],
    },
    seed: { allowRandom: true },
    negativePrompt: { default: false },
    textInImage: true,
    acceptedFiles: [],
    notes: 'Best-in-class text rendering inside images.',
  },
  'ideogram-2.0-turbo': {
    kind: 'image',
    provider: 'ideogram',
    brandName: 'Ideogram',
    aspectRatios: { default: '1:1', options: ['1:1', '16:9', '9:16'] },
    seed: { allowRandom: true },
    textInImage: true,
    acceptedFiles: [],
  },

  // ---- Recraft ----
  'recraft-v3': {
    kind: 'image',
    provider: 'recraft',
    brandName: 'Recraft',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    styles: {
      default: 'realistic_image',
      options: [
        { value: 'realistic_image', label: 'Photo' },
        { value: 'digital_illustration', label: 'Illustration' },
        { value: 'vector_illustration', label: 'Vector' },
        { value: 'icon', label: 'Icon' },
      ],
    },
    textInImage: true,
    acceptedFiles: [],
  },

  // ---- Playground ----
  'playground-v3': {
    kind: 'image',
    provider: 'playground',
    brandName: 'Playground',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    seed: { allowRandom: true },
    guidanceScale: { min: 1, max: 30, step: 0.5, default: 7 },
    acceptedFiles: [],
  },

  // ---- CogView (Zhipu) ----
  'cogview-3-plus': {
    kind: 'image',
    provider: 'zhipu',
    brandName: 'CogView',
    aspectRatios: { default: '1:1', options: ['1:1', '16:9', '9:16'] },
    acceptedFiles: [],
  },

  // ---- Wanxiang (Alibaba) ----
  'wanxiang-2.1': {
    kind: 'image',
    provider: 'alibaba',
    brandName: 'Wanxiang',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    referenceImage: { default: false },
    acceptedFiles: IMG_REF_FILES,
  },
  'tongyi-wanxiang': {
    kind: 'image',
    provider: 'alibaba',
    brandName: 'Wanxiang',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    acceptedFiles: [],
  },

  // ---- Baidu ERNIE-ViLG ----
  'ernie-vilg-2.0': {
    kind: 'image',
    provider: 'baidu',
    brandName: 'ERNIE-ViLG',
    aspectRatios: { default: '1:1', options: ['1:1', '16:9', '9:16'] },
    acceptedFiles: [],
  },
  'wenxin-yige': {
    kind: 'image',
    provider: 'baidu',
    brandName: 'Wenxin',
    aspectRatios: { default: '1:1', options: ['1:1', '4:3', '3:4'] },
    acceptedFiles: [],
  },

  // ---- Kolors (Kuaishou) ----
  'kolors': {
    kind: 'image',
    provider: 'kuaishou',
    brandName: 'Kolors',
    aspectRatios: { default: '1:1', options: ['1:1', '16:9', '9:16'] },
    referenceImage: { default: false },
    acceptedFiles: IMG_REF_FILES,
  },
}

// ---------------------------------------------------------------------------
// Video models
// ---------------------------------------------------------------------------

const VID_REF_FILES = ['image/png', 'image/jpeg', 'image/webp']

const VIDEO_CAPS: Record<string, VideoCapability> = {
  // ---- Sora ----
  'sora-turbo': {
    kind: 'video',
    provider: 'openai',
    brandName: 'Sora',
    durations: { default: 10, options: [5, 10, 20, 30, 60] },
    maxDurationSec: 60,
    resolutions: { default: '1080p', options: ['480p', '720p', '1080p'] },
    aspectRatios: { default: '16:9', options: ['16:9', '9:16', '1:1'] },
    imageToVideo: { default: false },
    builtInAudio: false,
    acceptedFiles: VID_REF_FILES,
  },
  'sora': {
    kind: 'video',
    provider: 'openai',
    brandName: 'Sora',
    durations: { default: 5, options: [5, 10, 20] },
    maxDurationSec: 20,
    resolutions: { default: '1080p', options: ['720p', '1080p'] },
    aspectRatios: { default: '16:9', options: ['16:9', '9:16', '1:1'] },
    imageToVideo: { default: false },
    acceptedFiles: VID_REF_FILES,
  },

  // ---- Runway ----
  'runway-gen-4-turbo': {
    kind: 'video',
    provider: 'runway',
    brandName: 'Runway',
    durations: { default: 5, options: [5, 10] },
    maxDurationSec: 10,
    resolutions: { default: '1080p', options: ['720p', '1080p'] },
    aspectRatios: { default: '16:9', options: ['16:9', '9:16', '1:1'] },
    imageToVideo: { default: true, hint: 'Required for camera control.' },
    motionControl: { default: false },
    acceptedFiles: VID_REF_FILES,
  },
  'runway-gen-3-alpha': {
    kind: 'video',
    provider: 'runway',
    brandName: 'Runway',
    durations: { default: 5, options: [5, 10] },
    maxDurationSec: 10,
    resolutions: { default: '720p', options: ['720p', '1080p'] },
    aspectRatios: { default: '16:9', options: ['16:9', '9:16'] },
    imageToVideo: { default: false },
    motionControl: { default: false },
    acceptedFiles: VID_REF_FILES,
  },

  // ---- Luma ----
  'luma-dream-machine-2': {
    kind: 'video',
    provider: 'luma',
    brandName: 'Luma AI',
    durations: { default: 5, options: [5] },
    maxDurationSec: 5,
    resolutions: { default: '1080p', options: ['720p', '1080p'] },
    aspectRatios: { default: '16:9', options: ['16:9', '9:16', '1:1', '4:3', '3:4'] },
    imageToVideo: { default: false, hint: 'Use as keyframe.' },
    endFrame: { default: false },
    acceptedFiles: VID_REF_FILES,
    notes: 'Supports start- and end-frame keyframes for camera planning.',
  },
  'luma-dream-machine': {
    kind: 'video',
    provider: 'luma',
    brandName: 'Luma AI',
    durations: { default: 5, options: [5] },
    maxDurationSec: 5,
    aspectRatios: { default: '16:9', options: ['16:9', '9:16'] },
    imageToVideo: { default: false },
    acceptedFiles: VID_REF_FILES,
  },

  // ---- Pika ----
  'pika-2.0': {
    kind: 'video',
    provider: 'pika',
    brandName: 'Pika',
    durations: { default: 4, options: [3, 4, 6] },
    maxDurationSec: 6,
    resolutions: { default: '1080p', options: ['720p', '1080p'] },
    aspectRatios: { default: '16:9', options: ['16:9', '9:16', '1:1'] },
    builtInAudio: true,
    motionControl: { default: false },
    imageToVideo: { default: false },
    acceptedFiles: VID_REF_FILES,
  },
  'pika-1.5': {
    kind: 'video',
    provider: 'pika',
    brandName: 'Pika',
    durations: { default: 3, options: [3] },
    maxDurationSec: 3,
    aspectRatios: { default: '16:9', options: ['16:9', '9:16', '1:1'] },
    imageToVideo: { default: false },
    acceptedFiles: VID_REF_FILES,
  },

  // ---- Haiper ----
  'haiper-2.0': {
    kind: 'video',
    provider: 'haiper',
    brandName: 'Haiper',
    durations: { default: 4, options: [2, 4, 6] },
    maxDurationSec: 6,
    aspectRatios: { default: '16:9', options: ['16:9', '9:16'] },
    imageToVideo: { default: false },
    acceptedFiles: VID_REF_FILES,
  },

  // ---- Stable Video ----
  'stability-video': {
    kind: 'video',
    provider: 'stability',
    brandName: 'Stable Video',
    durations: { default: 4, options: [2, 4] },
    maxDurationSec: 4,
    aspectRatios: { default: '16:9', options: ['16:9'] },
    imageToVideo: { default: true, hint: 'Required — Stable Video is image-to-video only.' },
    acceptedFiles: VID_REF_FILES,
    notes: 'Requires a starting image.',
  },

  // ---- Kling ----
  'kling-2.0': {
    kind: 'video',
    provider: 'kuaishou',
    brandName: 'Kling',
    durations: { default: 5, options: [5, 10] },
    maxDurationSec: 10,
    aspectRatios: { default: '16:9', options: ['16:9', '9:16', '1:1'] },
    imageToVideo: { default: false },
    builtInAudio: false,
    acceptedFiles: VID_REF_FILES,
  },
  'kling-1.5': {
    kind: 'video',
    provider: 'kuaishou',
    brandName: 'Kling',
    durations: { default: 5, options: [5] },
    maxDurationSec: 5,
    aspectRatios: { default: '16:9', options: ['16:9', '9:16'] },
    acceptedFiles: VID_REF_FILES,
  },

  // ---- CogVideoX (Zhipu) ----
  'cogvideo-x': {
    kind: 'video',
    provider: 'zhipu',
    brandName: 'CogVideo',
    durations: { default: 6, options: [6] },
    maxDurationSec: 6,
    aspectRatios: { default: '16:9', options: ['16:9'] },
    imageToVideo: { default: false },
    acceptedFiles: VID_REF_FILES,
  },

  // ---- PixVerse ----
  'pixverse-v3': {
    kind: 'video',
    provider: 'pixverse',
    brandName: 'PixVerse',
    durations: { default: 4, options: [4] },
    maxDurationSec: 4,
    aspectRatios: { default: '16:9', options: ['16:9', '9:16', '1:1'] },
    imageToVideo: { default: false },
    acceptedFiles: VID_REF_FILES,
  },

  // ---- Vidu ----
  'vidu-1.5': {
    kind: 'video',
    provider: 'shengshu',
    brandName: 'Vidu',
    durations: { default: 4, options: [4, 8] },
    maxDurationSec: 8,
    aspectRatios: { default: '16:9', options: ['16:9', '9:16'] },
    imageToVideo: { default: false },
    acceptedFiles: VID_REF_FILES,
  },

  // ---- Avatar/lipsync (HeyGen, Synthesia, D-ID) ----
  'heygen-avatar-iv': {
    kind: 'video',
    provider: 'heygen',
    brandName: 'HeyGen',
    durations: { default: 60, options: [30, 60, 120, 300] },
    maxDurationSec: 300,
    resolutions: { default: '1080p', options: ['720p', '1080p'] },
    aspectRatios: { default: '16:9', options: ['16:9', '9:16'] },
    avatar: true,
    builtInAudio: true,
    acceptedFiles: VID_REF_FILES,
    notes: 'Avatar + voiceover. Choose an avatar and voice in the panel.',
  },
  'heygen-avatar-iii': {
    kind: 'video',
    provider: 'heygen',
    brandName: 'HeyGen',
    durations: { default: 60, options: [30, 60, 120, 300] },
    maxDurationSec: 300,
    aspectRatios: { default: '16:9', options: ['16:9', '9:16'] },
    avatar: true,
    builtInAudio: true,
    acceptedFiles: VID_REF_FILES,
  },
  'synthesia-standard': {
    kind: 'video',
    provider: 'synthesia',
    brandName: 'Synthesia',
    durations: { default: 60, options: [30, 60, 120, 300] },
    maxDurationSec: 300,
    aspectRatios: { default: '16:9', options: ['16:9', '9:16'] },
    avatar: true,
    builtInAudio: true,
    acceptedFiles: VID_REF_FILES,
  },
  'did-studio': {
    kind: 'video',
    provider: 'did',
    brandName: 'D-ID',
    durations: { default: 60, options: [30, 60, 120, 300] },
    maxDurationSec: 300,
    aspectRatios: { default: '16:9', options: ['16:9', '9:16', '1:1'] },
    avatar: true,
    builtInAudio: true,
    acceptedFiles: VID_REF_FILES,
    notes: 'Provide a still photo + a script and D-ID animates the speech.',
  },
}

// ---------------------------------------------------------------------------
// Audio models
// ---------------------------------------------------------------------------

const AUD_REF_FILES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm']

const AUDIO_CAPS: Record<string, AudioCapability> = {
  // ---- Gemini TTS ----
  'gemini-tts-3.1': {
    kind: 'audio',
    provider: 'google',
    brandName: 'Gemini TTS',
    audioKind: 'voice',
    voices: {
      default: 'Aoede',
      options: [
        { value: 'Aoede', label: 'Aoede — bright' },
        { value: 'Charon', label: 'Charon — informative' },
        { value: 'Fenrir', label: 'Fenrir — energetic' },
        { value: 'Kore', label: 'Kore — soft' },
        { value: 'Puck', label: 'Puck — upbeat' },
      ],
    },
    speed: { min: 0.5, max: 2, step: 0.05, default: 1 },
    format: { default: 'mp3', options: ['mp3', 'wav'] },
    acceptedFiles: [],
    notes: 'Direction-by-prose: tell the model "say this slower, sad" in the prompt.',
  },
  'gemini-tts': {
    kind: 'audio',
    provider: 'google',
    brandName: 'Gemini TTS',
    audioKind: 'voice',
    voices: {
      default: 'Aoede',
      options: [
        { value: 'Aoede', label: 'Aoede' },
        { value: 'Charon', label: 'Charon' },
        { value: 'Kore', label: 'Kore' },
        { value: 'Puck', label: 'Puck' },
      ],
    },
    speed: { min: 0.5, max: 2, step: 0.05, default: 1 },
    format: { default: 'mp3', options: ['mp3', 'wav'] },
    acceptedFiles: [],
  },

  // ---- ElevenLabs ----
  'elevenlabs-turbo-v2.5': {
    kind: 'audio',
    provider: 'elevenlabs',
    brandName: 'ElevenLabs',
    audioKind: 'voice',
    voices: {
      default: 'Rachel',
      options: [
        { value: 'Rachel', label: 'Rachel — calm' },
        { value: 'Adam', label: 'Adam — deep' },
        { value: 'Antoni', label: 'Antoni — neutral' },
        { value: 'Bella', label: 'Bella — soft' },
        { value: 'Josh', label: 'Josh — narration' },
        { value: 'Custom', label: 'Custom voice ID' },
      ],
    },
    stability: { min: 0, max: 1, step: 0.01, default: 0.5 },
    similarity: { min: 0, max: 1, step: 0.01, default: 0.75 },
    speakerBoost: { default: true, label: 'Speaker boost' },
    speed: { min: 0.7, max: 1.2, step: 0.05, default: 1 },
    format: { default: 'mp3_44100_128', options: ['mp3_44100_128', 'mp3_44100_192', 'pcm_24000', 'pcm_44100'] },
    voiceCloning: { default: false, hint: 'Reference audio clones a custom voice.' },
    acceptedFiles: AUD_REF_FILES,
  },
  'elevenlabs-multilingual-v2': {
    kind: 'audio',
    provider: 'elevenlabs',
    brandName: 'ElevenLabs',
    audioKind: 'voice',
    voices: {
      default: 'Rachel',
      options: [
        { value: 'Rachel', label: 'Rachel' },
        { value: 'Adam', label: 'Adam' },
        { value: 'Custom', label: 'Custom voice ID' },
      ],
    },
    stability: { min: 0, max: 1, step: 0.01, default: 0.5 },
    similarity: { min: 0, max: 1, step: 0.01, default: 0.75 },
    speakerBoost: { default: true },
    voiceCloning: { default: false },
    format: { default: 'mp3_44100_128', options: ['mp3_44100_128', 'mp3_44100_192'] },
    acceptedFiles: AUD_REF_FILES,
  },

  // ---- OpenAI TTS ----
  'openai-tts-1-hd': {
    kind: 'audio',
    provider: 'openai',
    brandName: 'OpenAI TTS',
    audioKind: 'voice',
    voices: {
      default: 'alloy',
      options: [
        { value: 'alloy', label: 'Alloy' },
        { value: 'echo', label: 'Echo' },
        { value: 'fable', label: 'Fable' },
        { value: 'onyx', label: 'Onyx' },
        { value: 'nova', label: 'Nova' },
        { value: 'shimmer', label: 'Shimmer' },
      ],
    },
    speed: { min: 0.25, max: 4, step: 0.05, default: 1 },
    format: { default: 'mp3', options: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] },
    acceptedFiles: [],
  },
  'openai-tts-1': {
    kind: 'audio',
    provider: 'openai',
    brandName: 'OpenAI TTS',
    audioKind: 'voice',
    voices: {
      default: 'alloy',
      options: [
        { value: 'alloy', label: 'Alloy' },
        { value: 'echo', label: 'Echo' },
        { value: 'fable', label: 'Fable' },
        { value: 'onyx', label: 'Onyx' },
        { value: 'nova', label: 'Nova' },
        { value: 'shimmer', label: 'Shimmer' },
      ],
    },
    speed: { min: 0.25, max: 4, step: 0.05, default: 1 },
    format: { default: 'mp3', options: ['mp3', 'opus', 'aac', 'flac', 'wav'] },
    acceptedFiles: [],
  },

  // ---- Azure ----
  'azure-neural-tts': {
    kind: 'audio',
    provider: 'microsoft',
    brandName: 'Azure TTS',
    audioKind: 'voice',
    voices: {
      default: 'en-US-JennyNeural',
      options: [
        { value: 'en-US-JennyNeural', label: 'Jenny (US)' },
        { value: 'en-US-GuyNeural', label: 'Guy (US)' },
        { value: 'en-GB-SoniaNeural', label: 'Sonia (UK)' },
        { value: 'en-AU-NatashaNeural', label: 'Natasha (AU)' },
      ],
    },
    styles: {
      default: 'general',
      options: [
        { value: 'general', label: 'General' },
        { value: 'cheerful', label: 'Cheerful' },
        { value: 'sad', label: 'Sad' },
        { value: 'angry', label: 'Angry' },
        { value: 'excited', label: 'Excited' },
        { value: 'newscast', label: 'Newscast' },
      ],
    },
    speed: { min: 0.5, max: 2, step: 0.05, default: 1 },
    pitch: { min: -50, max: 50, step: 1, default: 0 },
    format: { default: 'audio-24khz-160kbitrate-mono-mp3', options: [
      'audio-24khz-160kbitrate-mono-mp3',
      'audio-48khz-192kbitrate-mono-mp3',
      'riff-24khz-16bit-mono-pcm',
    ] },
    acceptedFiles: [],
  },

  // ---- Play.ht ----
  'play.ht-3.0': {
    kind: 'audio',
    provider: 'playht',
    brandName: 'Play.ht',
    audioKind: 'voice',
    voices: {
      default: 'jennifer',
      options: [
        { value: 'jennifer', label: 'Jennifer' },
        { value: 'matthew', label: 'Matthew' },
        { value: 'nathan', label: 'Nathan' },
        { value: 'olivia', label: 'Olivia' },
      ],
    },
    speed: { min: 0.5, max: 2, step: 0.05, default: 1 },
    pitch: { min: -10, max: 10, step: 0.5, default: 0 },
    format: { default: 'mp3', options: ['mp3', 'wav', 'ogg'] },
    voiceCloning: { default: false },
    acceptedFiles: AUD_REF_FILES,
  },

  // ---- Suno (music) ----
  'suno-v4': {
    kind: 'audio',
    provider: 'suno',
    brandName: 'Suno',
    audioKind: 'music',
    genres: {
      default: 'pop',
      options: [
        { value: 'pop', label: 'Pop' },
        { value: 'rock', label: 'Rock' },
        { value: 'electronic', label: 'Electronic' },
        { value: 'classical', label: 'Classical' },
        { value: 'hip-hop', label: 'Hip Hop' },
        { value: 'jazz', label: 'Jazz' },
        { value: 'ambient', label: 'Ambient' },
        { value: 'cinematic', label: 'Cinematic' },
      ],
    },
    durations: { default: 60, options: [30, 60, 120, 240] },
    lyrics: { default: true, label: 'Custom lyrics', hint: 'Provide lyrics in the prompt body.' },
    format: { default: 'mp3', options: ['mp3'] },
    acceptedFiles: [],
  },
  'suno-v3.5': {
    kind: 'audio',
    provider: 'suno',
    brandName: 'Suno',
    audioKind: 'music',
    genres: {
      default: 'pop',
      options: [
        { value: 'pop', label: 'Pop' },
        { value: 'rock', label: 'Rock' },
        { value: 'electronic', label: 'Electronic' },
        { value: 'jazz', label: 'Jazz' },
        { value: 'ambient', label: 'Ambient' },
      ],
    },
    durations: { default: 60, options: [30, 60, 120] },
    lyrics: { default: true },
    format: { default: 'mp3', options: ['mp3'] },
    acceptedFiles: [],
  },

  // ---- Udio ----
  'udio-v2': {
    kind: 'audio',
    provider: 'udio',
    brandName: 'Udio',
    audioKind: 'music',
    genres: {
      default: 'pop',
      options: [
        { value: 'pop', label: 'Pop' },
        { value: 'electronic', label: 'Electronic' },
        { value: 'cinematic', label: 'Cinematic' },
        { value: 'ambient', label: 'Ambient' },
      ],
    },
    durations: { default: 60, options: [30, 60, 120, 240, 360] },
    lyrics: { default: true },
    format: { default: 'mp3', options: ['mp3', 'wav'] },
    acceptedFiles: [],
  },
  'udio-v1.5': {
    kind: 'audio',
    provider: 'udio',
    brandName: 'Udio',
    audioKind: 'music',
    durations: { default: 60, options: [30, 60, 120] },
    lyrics: { default: true },
    format: { default: 'mp3', options: ['mp3'] },
    acceptedFiles: [],
  },

  // ---- Stable Audio ----
  'stable-audio-2': {
    kind: 'audio',
    provider: 'stability',
    brandName: 'Stable Audio',
    audioKind: 'music',
    durations: { default: 30, options: [15, 30, 60, 90, 180] },
    format: { default: 'wav', options: ['mp3', 'wav'] },
    acceptedFiles: AUD_REF_FILES,
    notes: 'Reference audio works as a style condition.',
  },

  // ---- Fish Speech ----
  'fish-speech-1.5': {
    kind: 'audio',
    provider: 'fishaudio',
    brandName: 'Fish Speech',
    audioKind: 'voice',
    voices: {
      default: 'default',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'custom', label: 'Custom (clone)' },
      ],
    },
    voiceCloning: { default: false, hint: 'Provide ~10s of reference audio to clone.' },
    speed: { min: 0.5, max: 2, step: 0.05, default: 1 },
    format: { default: 'mp3', options: ['mp3', 'wav'] },
    acceptedFiles: AUD_REF_FILES,
  },

  // ---- ChatGLM Audio ----
  'chatglm-audio': {
    kind: 'audio',
    provider: 'zhipu',
    brandName: 'ChatGLM Audio',
    audioKind: 'voice',
    voices: {
      default: 'tongtong',
      options: [
        { value: 'tongtong', label: 'Tongtong' },
        { value: 'xiaomei', label: 'Xiaomei' },
      ],
    },
    speed: { min: 0.5, max: 2, step: 0.05, default: 1 },
    format: { default: 'mp3', options: ['mp3', 'wav'] },
    acceptedFiles: [],
  },
}

// ---------------------------------------------------------------------------
// Public lookups
// ---------------------------------------------------------------------------

const FALLBACK_TEXT: TextCapability = {
  kind: 'text',
  provider: 'unknown',
  brandName: 'Model',
  temperature: { min: 0, max: 1, step: 0.05, default: 0.7 },
  maxTokens: { min: 256, max: 4_096, step: 256, default: 2_048 },
  acceptedFiles: [],
  notes: 'Capabilities not registered — generic defaults shown.',
}

export function getTextCapability(modelId: string): TextCapability {
  return TEXT_CAPS[modelId] ?? FALLBACK_TEXT
}

export function getImageCapability(modelId: string): ImageCapability | undefined {
  return IMAGE_CAPS[modelId]
}

export function getVideoCapability(modelId: string): VideoCapability | undefined {
  return VIDEO_CAPS[modelId]
}

export function getAudioCapability(modelId: string): AudioCapability | undefined {
  return AUDIO_CAPS[modelId]
}

/**
 * Plain-language summary of a MIME-type list. The drawer uses this to render
 * a single line under the upload zone ("Accepts: PNG · JPEG · PDF · WAV").
 */
export function summarizeAcceptedFiles(mimeList: string[]): string {
  if (!mimeList || mimeList.length === 0) return 'No file uploads supported on this model.'
  const seen = new Set<string>()
  const out: string[] = []
  for (const mime of mimeList) {
    const tag = friendlyMimeTag(mime)
    if (!seen.has(tag)) {
      seen.add(tag)
      out.push(tag)
    }
  }
  return `Accepts: ${out.join(' · ')}`
}

/** Map a MIME type to a short label users recognise. */
function friendlyMimeTag(mime: string): string {
  if (mime === 'image/png') return 'PNG'
  if (mime === 'image/jpeg') return 'JPEG'
  if (mime === 'image/webp') return 'WebP'
  if (mime === 'image/gif') return 'GIF'
  if (mime === 'application/pdf') return 'PDF'
  if (mime === 'text/plain') return 'TXT'
  if (mime === 'text/markdown') return 'MD'
  if (mime === 'text/csv') return 'CSV'
  if (mime === 'application/json') return 'JSON'
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return 'MP3'
  if (mime === 'audio/wav') return 'WAV'
  if (mime === 'audio/ogg') return 'OGG'
  if (mime === 'audio/webm') return 'WebM audio'
  if (mime === 'video/mp4') return 'MP4'
  if (mime === 'video/webm') return 'WebM video'
  if (mime === 'video/quicktime') return 'MOV'
  return mime
}

/** Build the `accept=` attribute for an `<input type=file>` element. */
export function buildAcceptAttribute(mimeList: string[]): string {
  return Array.from(new Set(mimeList)).join(',')
}
