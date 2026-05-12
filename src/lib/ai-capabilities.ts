/**
 * Per-model capability registry.
 *
 * Drives the configuration pane (`ConfigDrawer` in `ChatWorkspace`). For
 * every model we ship in the four `*_MODELS` registries we publish the knobs
 * that model's API actually exposes — temperature range, max tokens cap,
 * accepted file types, voice list, etc. The pane *only* renders fields that
 * the underlying API will honour, so users can never set a knob the wire
 * doesn't accept.
 *
 * The shape is intentionally generic (a flat `fields` map keyed by name)
 * rather than a typed sub-interface per modality. The drawer iterates the
 * map, so adding a new knob is one edit here — no UI changes required.
 *
 * Numbers are pulled from each provider's public API documentation as of
 * 2026-Q2. Where a provider supports more than one ceiling, we encode the
 * one that controls the slider; context window is shown as a read-only
 * display in the pane header.
 */

// ---------------------------------------------------------------------------
// Field types — one per primitive UI control. Adding a new control type
// means: extend this union, render it in the drawer.
// ---------------------------------------------------------------------------

export type ModalityKind = 'text' | 'image' | 'video' | 'audio'

export interface RangeField {
  type: 'range'
  label: string
  min: number
  max: number
  step: number
  default: number
  /** e.g. "s", "x", "%". Rendered after the numeric readout. */
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

// ---------------------------------------------------------------------------
// Accepted-files descriptor — drives both the document upload section's
// `accept=` attribute and the human-readable "Accepts: …" line.
// ---------------------------------------------------------------------------

export interface AcceptedFiles {
  /** Concrete MIME types and extensions, used as-is in the file picker
   *  `accept` attribute (e.g. `image/png,image/jpeg,.pdf`). */
  mimeTypes: string[]
  /** Plain-English summary shown under the upload button. */
  humanLabel: string
  /** Optional cap; absent means "as many as fit in the request body". */
  maxFiles?: number
  /** Optional per-file byte cap; the page enforces this on upload. */
  maxBytesEach?: number
}

// ---------------------------------------------------------------------------
// Capability — one per model. The drawer reads the `fields` map and renders
// each entry with the matching field-type renderer.
// ---------------------------------------------------------------------------

export interface Capability {
  /** Matches the `id` in the corresponding `*_MODELS` registry. */
  id: string
  kind: ModalityKind
  /** Provider id (e.g. `openai`, `google`) — used for badging. */
  provider: string
  /** Display string shown in the pane header (e.g. "ChatGPT GPT-4o"). */
  label: string
  /** One-liner summary of what this model is good at. */
  description?: string
  /** Read-only context window display, in tokens (text models). */
  contextWindow?: number
  /** Files this model accepts. Omit for models that take prompts only. */
  attachments?: AcceptedFiles
  /** Tunable parameters the API exposes. Empty map ⇒ no user-tunable knobs. */
  fields: Record<string, Field>
}

// ---------------------------------------------------------------------------
// Reusable building blocks. Most providers cluster around the same numeric
// ranges so we share definitions where it's accurate.
// ---------------------------------------------------------------------------

const TEMPERATURE_0_2: RangeField = {
  type: 'range', label: 'Temperature', min: 0, max: 2, step: 0.05, default: 0.7,
  hint: 'Higher = more creative, lower = more deterministic',
}
// Anthropic caps temperature at 1.0.
const TEMPERATURE_0_1: RangeField = { ...TEMPERATURE_0_2, max: 1, default: 0.7 }

const TOP_P: RangeField = {
  type: 'range', label: 'Top-p', min: 0.01, max: 1, step: 0.01, default: 0.95,
  hint: 'Nucleus sampling cutoff',
}

const TOP_K: IntegerField = {
  type: 'integer', label: 'Top-k', min: 1, max: 100, step: 1, default: 40,
  hint: 'Limit candidate tokens at each step',
}

const PRESENCE_PENALTY: RangeField = {
  type: 'range', label: 'Presence penalty', min: -2, max: 2, step: 0.1, default: 0,
}
const FREQUENCY_PENALTY: RangeField = {
  type: 'range', label: 'Frequency penalty', min: -2, max: 2, step: 0.1, default: 0,
}

const REASONING_EFFORT: SelectField = {
  type: 'select', label: 'Reasoning effort', default: 'medium',
  options: [
    { value: 'low',    label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high',   label: 'High' },
  ],
}

const JSON_MODE: ToggleField = { type: 'toggle', label: 'JSON output mode', default: false }
const TOOL_USE: ToggleField  = { type: 'toggle', label: 'Tool / function calling', default: true }

const STOP_SEQUENCES: TextField = {
  type: 'text', label: 'Stop sequences', placeholder: 'e.g. "###, END"', default: '',
}

// File-type bundles ---------------------------------------------------------
//
// Each bundle is composed from smaller named groups (images / docs / data /
// markup / code) so the Gemini multimodal superset and the per-modality
// reference-image presets stay DRY and the human labels stay readable.
//
// On `mimeTypes`: the field doubles as the file picker's `accept` attribute,
// which accepts both real MIME types and bare extensions ("application/json",
// ".ts"). For formats where browsers don't reliably set a MIME type — which
// is the rule rather than the exception for code files — we list the
// extension instead so the picker actually shows the file.

const IMG_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

// Plain prose / tabular text. Rendered as the "Text" group in the label.
const DOC_TEXT_MIMES = [
  'application/pdf',
  'text/plain', '.txt',
  'text/markdown', '.md', '.markdown',
  'text/csv', '.csv',
  'text/tab-separated-values', '.tsv',
]

// Structured data formats — JSON, YAML, TOML, INI, env files. Universally
// consumed by frontier text models because they're just text under the hood.
const DOC_DATA_MIMES = [
  'application/json', '.json',
  'application/x-yaml', 'text/yaml', '.yaml', '.yml',
  'application/toml', '.toml',
  '.ini', '.cfg', '.env', '.properties',
  'application/x-ndjson', '.ndjson', '.jsonl',
]

// Markup. HTML, XML, and SVG (which is XML) are ingested as text by every
// modern model; CSS is included for design / theming work.
const DOC_MARKUP_MIMES = [
  'text/html', '.html', '.htm',
  'application/xml', 'text/xml', '.xml',
  'image/svg+xml', '.svg',
  'text/css', '.css',
]

// Code. Source files are routinely consumed for review, refactoring, and
// debugging. Listed as extensions because browser MIME detection here is
// notoriously unreliable (e.g. .ts is often reported as `video/mp2t`).
const DOC_CODE_MIMES = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.h', '.cpp', '.hpp', '.cc', '.cs',
  '.php', '.lua', '.pl', '.r',
  '.sh', '.bash', '.zsh', '.ps1',
  '.sql', '.graphql', '.gql', '.proto',
]

// `ACCEPT_IMAGES` was previously a standalone preset, but every text model
// that takes images already takes documents too (`ACCEPT_IMAGES_AND_DOCS`),
// and every reference-only image surface uses the dedicated
// `ACCEPT_REFERENCE_IMAGE` / `ACCEPT_VIDEO_START_FRAME` presets defined
// further down. `IMG_MIMES` remains as the single source of truth — it's
// composed into the multimodal supersets above. Removing the standalone
// preset clears the no-unused-vars lint failure on the production build.

// Default document bundle for chat models. Covers everything a text model
// can consume without server-side extraction: PDFs, plain prose, structured
// data (JSON / YAML / TOML / INI), markup (HTML / XML / SVG / CSS), and
// source code in the languages users most commonly drop in.
const ACCEPT_DOCUMENTS: AcceptedFiles = {
  mimeTypes: [
    ...DOC_TEXT_MIMES,
    ...DOC_DATA_MIMES,
    ...DOC_MARKUP_MIMES,
    ...DOC_CODE_MIMES,
  ],
  humanLabel:
    'Text (PDF, TXT, MD, CSV, TSV) · Data (JSON, YAML, TOML, INI) · Markup (HTML, XML, SVG, CSS) · Code (TS, JS, Python, Go, Rust, Java, C/C++, SQL, GraphQL, shell, …) — up to 8 MB each',
  maxFiles: 8,
  maxBytesEach: 8 * 1024 * 1024,
}

const ACCEPT_IMAGES_AND_DOCS: AcceptedFiles = {
  mimeTypes: [...IMG_MIMES, ...ACCEPT_DOCUMENTS.mimeTypes],
  humanLabel:
    'Images (PNG/JPEG/WebP/GIF) plus documents — text (PDF/TXT/MD/CSV), data (JSON/YAML/TOML), markup (HTML/XML/SVG/CSS), and code (TS/JS/Python/Go/Rust/Java/C/SQL/…) — up to 8 MB each',
  maxFiles: 10,
  maxBytesEach: 8 * 1024 * 1024,
}

const ACCEPT_GEMINI_MULTIMODAL: AcceptedFiles = {
  // Gemini's content API natively accepts images, PDFs, audio (mp3/wav/
  // aiff/aac/ogg/flac), video (mp4/mpeg/mov/avi/x-flv/mpg/webm/wmv/3gp),
  // plus the full document spectrum above. We pass everything through as
  // typed parts and Gemini routes by MIME.
  mimeTypes: [
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
    ...DOC_TEXT_MIMES,
    ...DOC_DATA_MIMES,
    ...DOC_MARKUP_MIMES,
    ...DOC_CODE_MIMES,
    'audio/mpeg', 'audio/wav', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac',
    'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
  ],
  humanLabel:
    'Images, audio (MP3/WAV/OGG/FLAC), video (MP4/WebM/MOV), plus documents (PDF/TXT/MD/CSV), data (JSON/YAML/TOML), markup (HTML/XML/SVG/CSS) and code (TS/JS/Python/Go/Rust/Java/C/SQL/…) — up to 20 MB each',
  maxFiles: 16,
  maxBytesEach: 20 * 1024 * 1024,
}

const ACCEPT_REFERENCE_IMAGE: AcceptedFiles = {
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  humanLabel: 'A reference image (PNG/JPEG/WebP) — up to 8 MB',
  maxFiles: 1,
  maxBytesEach: 8 * 1024 * 1024,
}

const ACCEPT_VIDEO_START_FRAME: AcceptedFiles = {
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  humanLabel: 'A start-frame image (PNG/JPEG/WebP) — up to 8 MB',
  maxFiles: 1,
  maxBytesEach: 8 * 1024 * 1024,
}

const ACCEPT_VOICE_CLONE_AUDIO: AcceptedFiles = {
  mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/flac'],
  humanLabel: 'A short voice sample (MP3/WAV/M4A/FLAC) — up to 25 MB',
  maxFiles: 1,
  maxBytesEach: 25 * 1024 * 1024,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the `accept` attribute string for a file input. */
export function buildAcceptAttribute(f: AcceptedFiles): string {
  return f.mimeTypes.join(',')
}

/** Human summary, e.g. "Images (PNG/JPEG/WebP) — up to 8 MB". */
export function summarizeAcceptedFiles(f: AcceptedFiles): string {
  return f.humanLabel
}

// ---------------------------------------------------------------------------
// Text — text-completion models
// ---------------------------------------------------------------------------

function gptText(id: string, label: string, ctx: number, maxOut: number, opts: Partial<{ reasoning: boolean; vision: boolean }> = {}): Capability {
  return {
    id, kind: 'text', provider: 'openai', label,
    description: 'OpenAI text + vision model. Supports structured output (JSON), function calling, and parallel tools.',
    contextWindow: ctx,
    attachments: opts.vision ? ACCEPT_IMAGES_AND_DOCS : ACCEPT_DOCUMENTS,
    fields: {
      temperature: TEMPERATURE_0_2,
      topP: TOP_P,
      maxTokens: { type: 'integer', label: 'Max output tokens', min: 256, max: maxOut, step: 256, default: Math.min(4096, maxOut) },
      presencePenalty: PRESENCE_PENALTY,
      frequencyPenalty: FREQUENCY_PENALTY,
      ...(opts.reasoning ? { reasoningEffort: REASONING_EFFORT } : {}),
      jsonMode: JSON_MODE,
      toolUse: TOOL_USE,
      stopSequences: STOP_SEQUENCES,
    },
  }
}

function geminiText(id: string, label: string, ctx: number, maxOut: number): Capability {
  return {
    id, kind: 'text', provider: 'google', label,
    description: 'Google Gemini multimodal model. Accepts images, PDFs, audio, video, and text in a single request.',
    contextWindow: ctx,
    attachments: ACCEPT_GEMINI_MULTIMODAL,
    fields: {
      temperature: TEMPERATURE_0_2,
      topP: TOP_P,
      topK: TOP_K,
      maxTokens: { type: 'integer', label: 'Max output tokens', min: 256, max: maxOut, step: 256, default: Math.min(8192, maxOut) },
      jsonMode: JSON_MODE,
      toolUse: TOOL_USE,
      stopSequences: STOP_SEQUENCES,
    },
  }
}

function claudeText(id: string, label: string, ctx: number, maxOut: number, opts: { extendedThinking?: boolean } = {}): Capability {
  return {
    id, kind: 'text', provider: 'anthropic', label,
    description: 'Anthropic Claude. Strong at long-context reasoning, tool use, and document analysis.',
    contextWindow: ctx,
    attachments: ACCEPT_IMAGES_AND_DOCS,
    fields: {
      temperature: TEMPERATURE_0_1,
      topP: TOP_P,
      topK: TOP_K,
      maxTokens: { type: 'integer', label: 'Max output tokens', min: 1024, max: maxOut, step: 512, default: Math.min(8192, maxOut) },
      ...(opts.extendedThinking ? { reasoningEffort: REASONING_EFFORT } : {}),
      toolUse: TOOL_USE,
      stopSequences: STOP_SEQUENCES,
    },
  }
}

function mistralText(id: string, label: string, ctx: number, maxOut: number): Capability {
  return {
    id, kind: 'text', provider: 'mistral', label,
    description: 'Mistral text model. Supports JSON output and tool calling.',
    contextWindow: ctx,
    attachments: ACCEPT_DOCUMENTS,
    fields: {
      temperature: TEMPERATURE_0_2,
      topP: TOP_P,
      maxTokens: { type: 'integer', label: 'Max output tokens', min: 256, max: maxOut, step: 256, default: Math.min(4096, maxOut) },
      presencePenalty: PRESENCE_PENALTY,
      frequencyPenalty: FREQUENCY_PENALTY,
      jsonMode: JSON_MODE,
      toolUse: TOOL_USE,
      stopSequences: STOP_SEQUENCES,
    },
  }
}

function grokText(id: string, label: string, ctx: number, maxOut: number, opts: { reasoning?: boolean; web?: boolean } = {}): Capability {
  return {
    id, kind: 'text', provider: 'xai', label,
    description: 'xAI Grok. Strong at real-time web context and chain-of-thought reasoning.',
    contextWindow: ctx,
    attachments: ACCEPT_IMAGES_AND_DOCS,
    fields: {
      temperature: TEMPERATURE_0_2,
      topP: TOP_P,
      maxTokens: { type: 'integer', label: 'Max output tokens', min: 256, max: maxOut, step: 256, default: Math.min(8192, maxOut) },
      ...(opts.reasoning ? { reasoningEffort: REASONING_EFFORT } : {}),
      ...(opts.web ? { webBrowsing: { type: 'toggle', label: 'Web browsing', default: false } as ToggleField } : {}),
      toolUse: TOOL_USE,
      stopSequences: STOP_SEQUENCES,
    },
  }
}

function deepseekText(id: string, label: string, ctx: number, maxOut: number, reasoning: boolean): Capability {
  return {
    id, kind: 'text', provider: 'deepseek', label,
    description: reasoning
      ? 'DeepSeek reasoning model — exposes a separate "reasoning" channel before the answer.'
      : 'DeepSeek chat model. OpenAI-compatible API.',
    contextWindow: ctx,
    attachments: ACCEPT_DOCUMENTS,
    fields: {
      temperature: TEMPERATURE_0_2,
      topP: TOP_P,
      maxTokens: { type: 'integer', label: 'Max output tokens', min: 256, max: maxOut, step: 256, default: Math.min(4096, maxOut) },
      ...(reasoning ? { reasoningEffort: REASONING_EFFORT } : {}),
      jsonMode: JSON_MODE,
      toolUse: TOOL_USE,
    },
  }
}

function moonshotText(id: string, label: string, ctx: number, maxOut: number): Capability {
  return {
    id, kind: 'text', provider: 'moonshot', label,
    description: 'Moonshot Kimi. Long-context Chinese-first model with English support.',
    contextWindow: ctx,
    attachments: ACCEPT_DOCUMENTS,
    fields: {
      temperature: TEMPERATURE_0_2,
      topP: TOP_P,
      maxTokens: { type: 'integer', label: 'Max output tokens', min: 256, max: maxOut, step: 256, default: Math.min(4096, maxOut) },
      jsonMode: JSON_MODE,
      toolUse: TOOL_USE,
    },
  }
}

function qwenText(id: string, label: string, ctx: number, maxOut: number): Capability {
  return {
    id, kind: 'text', provider: 'alibaba', label,
    description: 'Alibaba Qwen. Strong at multilingual tasks, code, and tool use.',
    contextWindow: ctx,
    attachments: ACCEPT_DOCUMENTS,
    fields: {
      temperature: TEMPERATURE_0_2,
      topP: TOP_P,
      maxTokens: { type: 'integer', label: 'Max output tokens', min: 256, max: maxOut, step: 256, default: Math.min(4096, maxOut) },
      jsonMode: JSON_MODE,
      toolUse: TOOL_USE,
    },
  }
}

function cohereText(id: string, label: string, ctx: number, maxOut: number): Capability {
  return {
    id, kind: 'text', provider: 'cohere', label,
    description: 'Cohere Command. Tuned for retrieval-augmented generation and tool calling.',
    contextWindow: ctx,
    attachments: ACCEPT_DOCUMENTS,
    fields: {
      temperature: { ...TEMPERATURE_0_2, max: 5, default: 0.3 },
      topP: TOP_P,
      topK: TOP_K,
      maxTokens: { type: 'integer', label: 'Max output tokens', min: 256, max: maxOut, step: 256, default: Math.min(4096, maxOut) },
      presencePenalty: PRESENCE_PENALTY,
      frequencyPenalty: FREQUENCY_PENALTY,
      toolUse: TOOL_USE,
      stopSequences: STOP_SEQUENCES,
    },
  }
}

function perplexityText(id: string, label: string, ctx: number, maxOut: number): Capability {
  return {
    id, kind: 'text', provider: 'perplexity', label,
    description: 'Perplexity Sonar — answers grounded in live web search results with inline citations.',
    contextWindow: ctx,
    attachments: ACCEPT_DOCUMENTS,
    fields: {
      temperature: { ...TEMPERATURE_0_2, max: 2, default: 0.2 },
      topP: TOP_P,
      maxTokens: { type: 'integer', label: 'Max output tokens', min: 256, max: maxOut, step: 256, default: Math.min(4096, maxOut) },
      searchRecency: {
        type: 'select', label: 'Search recency', default: 'month',
        options: [
          { value: 'day',   label: 'Past day' },
          { value: 'week',  label: 'Past week' },
          { value: 'month', label: 'Past month' },
          { value: 'year',  label: 'Past year' },
        ],
      },
      returnImages: { type: 'toggle', label: 'Return images', default: false },
      returnRelated: { type: 'toggle', label: 'Suggest follow-up questions', default: true },
    },
  }
}

function zhipuText(id: string, label: string, ctx: number, maxOut: number): Capability {
  return {
    id, kind: 'text', provider: 'zhipu', label,
    description: 'Zhipu GLM. Strong at Chinese, code, and tool use.',
    contextWindow: ctx,
    attachments: ACCEPT_DOCUMENTS,
    fields: {
      temperature: TEMPERATURE_0_1,
      topP: TOP_P,
      maxTokens: { type: 'integer', label: 'Max output tokens', min: 256, max: maxOut, step: 256, default: Math.min(4096, maxOut) },
      toolUse: TOOL_USE,
    },
  }
}

const TEXT_CAPABILITIES: Capability[] = [
  // Google Gemini
  // Gemini output ceilings per Google's API docs (verified Nov 2026):
  //   - 2.5 Flash : 65,536 output tokens (8x the prior 2.0 Flash limit)
  //   - 2.0 Flash :  8,192 output tokens
  //   - 1.5 Pro   :  8,192 output tokens
  // The 2.5 Flash row was previously stuck at the 2.0 Flash value,
  // which is what was clipping document builds when users switched
  // away from Sonnet to dodge its (also-misconfigured) 16k limit.
  geminiText('gemini-2.5-flash', 'Gemini 2.5 Flash', 1_000_000, 65_536),
  geminiText('gemini-2.0-flash', 'Gemini 2.0 Flash', 1_000_000, 8_192),
  geminiText('gemini-1.5-pro',   'Gemini 1.5 Pro',     2_000_000, 8_192),

  // OpenAI — ceilings set to each model's documented maximum:
  //   - GPT-5 / 5.5  : 128,000 output tokens
  //   - GPT-4o       :  16,384 output tokens (no higher tier)
  //   - GPT-4o mini  :  16,384 output tokens (no higher tier)
  gptText('gpt-5',       'GPT-5',       400_000, 128_000, { vision: true }),
  gptText('gpt-5-mini',  'GPT-5 mini',  400_000, 128_000, { vision: true }),
  gptText('gpt-4o',      'GPT-4o',      128_000,  16_384, { vision: true }),
  gptText('gpt-4o-mini', 'GPT-4o mini', 128_000,  16_384, { vision: true }),

  // Anthropic Claude.
  //
  // Input ceiling — Sonnet 4.6 and Opus 4.6 went GA with a 1M token
  // context window in April 2026; the prior `context-1m-2025-08-07`
  // beta header was retired on the same date because 1M became the
  // default. So no header is needed, just the larger ceiling.
  // Haiku 4.5 stays at its native 200K (no 1M tier).
  //
  // Output ceiling — set to the documented per-model maximum when
  // the request includes
  //   anthropic-beta: output-128k-2025-02-19
  // (forwarded by the AI Gateway via providerOptions.anthropic.
  // headers in api/chat/route.ts). The full ladder per Anthropic:
  //   - default                            : 32k (Sonnet/Opus), 64k (Haiku 4.5)
  //   - "output-64k" beta                  : 64k
  //   - "output-128k-2025-02-19" beta      : 128k (active)
  claudeText('claude-opus-4.6',   'Claude Opus 4.6',   1_000_000, 128_000, { extendedThinking: true }),
  claudeText('claude-sonnet-4.6', 'Claude Sonnet 4.6', 1_000_000, 128_000, { extendedThinking: true }),
  claudeText('claude-haiku-4.5',  'Claude Haiku 4.5',    200_000,  64_000),

  // Mistral — current Large 2 and Small both ship with a 128K
  // context window per Mistral's API docs. Output cap is 8K which
  // matches what the model will actually emit before degradation.
  mistralText('mistral-large-latest', 'Mistral Large', 128_000, 8_000),
  mistralText('mistral-small-latest', 'Mistral Small', 128_000, 8_000),

  // xAI Grok 4 — API max is 256K per request (the Web/App UI is
  // capped at 128K but our requests go through the API). We had
  // this at 1M which was wrong and would have caused 400s once a
  // chat's transcript drifted past ~256K of accumulated input.
  grokText('grok-4', 'Grok 4', 256_000, 8_192, { reasoning: true, web: true }),
  grokText('grok-3', 'Grok 3',   131_072, 8_192, { web: true }),

  // DeepSeek
  deepseekText('deepseek-chat',     'DeepSeek Chat',      128_000, 8_000, false),
  deepseekText('deepseek-reasoner', 'DeepSeek Reasoner', 128_000, 8_000, true),

  // Moonshot Kimi
  moonshotText('kimi-k2',         'Kimi K2',         200_000, 8_000),
  moonshotText('moonshot-v1-128k', 'Moonshot V1 128k', 128_000, 4_000),

  // Alibaba Qwen
  qwenText('qwen-max',  'Qwen Max',  32_000, 8_000),
  qwenText('qwen-plus', 'Qwen Plus', 131_072, 8_000),

  // Cohere
  cohereText('command-r-plus', 'Command R+', 128_000, 4_000),
  cohereText('command-r',      'Command R',  128_000, 4_000),

  // Perplexity Sonar
  perplexityText('sonar-large', 'Sonar Large', 127_072, 4_000),
  perplexityText('sonar-small', 'Sonar Small', 127_072, 4_000),

  // Zhipu
  zhipuText('glm-4.5', 'GLM 4.5', 128_000, 8_000),
]

// ---------------------------------------------------------------------------
// Image — t2i + i2i
// ---------------------------------------------------------------------------

const ASPECT_COMMON: SelectField = {
  type: 'select', label: 'Aspect ratio', default: '1:1',
  options: [
    { value: '1:1',  label: '1:1 (square)' },
    { value: '16:9', label: '16:9 (wide)' },
    { value: '9:16', label: '9:16 (tall)' },
    { value: '4:3',  label: '4:3' },
    { value: '3:4',  label: '3:4' },
  ],
}
const ASPECT_MJ: SelectField = {
  ...ASPECT_COMMON, default: '1:1',
  options: [
    { value: '1:1',  label: '1:1' },
    { value: '16:9', label: '16:9' },
    { value: '9:16', label: '9:16' },
    { value: '3:2',  label: '3:2' },
    { value: '2:3',  label: '2:3' },
    { value: '7:4',  label: '7:4' },
  ],
}

const COUNT_FIELD: IntegerField = { type: 'integer', label: 'Number of images', min: 1, max: 4, step: 1, default: 1 }
const SEED_FIELD: TextField = { type: 'text', label: 'Seed', placeholder: 'integer or blank for random', default: '' }
const NEGATIVE_PROMPT_FIELD: TextField = { type: 'text', label: 'Negative prompt', placeholder: 'avoid these…', default: '' }

const IMAGE_CAPABILITIES: Capability[] = [
  // Google Imagen / Nano-Banana (Gemini Flash Image)
  {
    id: 'nano-banana-2', kind: 'image', provider: 'google', label: 'Nano Banana 2',
    description: 'Gemini-3 Flash Image. Multimodal text+image generation with strong text-in-image and editing.',
    attachments: { ...ACCEPT_REFERENCE_IMAGE, maxFiles: 4, humanLabel: 'Up to 4 reference images (PNG/JPEG/WebP) — up to 8 MB each' },
    fields: { aspectRatio: ASPECT_COMMON, count: COUNT_FIELD, seed: SEED_FIELD, negativePrompt: NEGATIVE_PROMPT_FIELD },
  },
  {
    id: 'nano-banana-pro', kind: 'image', provider: 'google', label: 'Nano Banana Pro',
    description: 'Higher-fidelity Nano Banana variant.',
    attachments: { ...ACCEPT_REFERENCE_IMAGE, maxFiles: 4, humanLabel: 'Up to 4 reference images (PNG/JPEG/WebP) — up to 8 MB each' },
    fields: { aspectRatio: ASPECT_COMMON, count: COUNT_FIELD, seed: SEED_FIELD, negativePrompt: NEGATIVE_PROMPT_FIELD },
  },
  {
    id: 'nano-banana', kind: 'image', provider: 'google', label: 'Nano Banana',
    description: 'Original Gemini 2.5 Flash Image.',
    attachments: ACCEPT_REFERENCE_IMAGE,
    fields: { aspectRatio: ASPECT_COMMON, count: COUNT_FIELD, seed: SEED_FIELD },
  },
  {
    id: 'imagen-4', kind: 'image', provider: 'google', label: 'Imagen 4',
    description: 'Google Imagen 4. Photoreal output and clean text rendering.',
    attachments: ACCEPT_REFERENCE_IMAGE,
    fields: {
      aspectRatio: ASPECT_COMMON, count: COUNT_FIELD,
      personGeneration: { type: 'select', label: 'Person generation', default: 'allow_adult',
        options: [
          { value: 'dont_allow',  label: 'Disallow' },
          { value: 'allow_adult', label: 'Allow adult' },
          { value: 'allow_all',   label: 'Allow all' },
        ],
      },
      seed: SEED_FIELD,
      negativePrompt: NEGATIVE_PROMPT_FIELD,
    },
  },
  {
    id: 'imagen-3', kind: 'image', provider: 'google', label: 'Imagen 3',
    attachments: ACCEPT_REFERENCE_IMAGE,
    fields: { aspectRatio: ASPECT_COMMON, count: COUNT_FIELD, seed: SEED_FIELD, negativePrompt: NEGATIVE_PROMPT_FIELD },
  },

  // OpenAI DALL-E
  {
    id: 'dall-e-4', kind: 'image', provider: 'openai', label: 'DALL-E 4',
    description: 'Latest OpenAI image model. Higher fidelity and better prompt adherence.',
    attachments: ACCEPT_REFERENCE_IMAGE,
    fields: {
      size: { type: 'select', label: 'Size', default: '1024x1024',
        options: [
          { value: '1024x1024', label: '1024 x 1024 (square)' },
          { value: '1792x1024', label: '1792 x 1024 (landscape)' },
          { value: '1024x1792', label: '1024 x 1792 (portrait)' },
        ],
      },
      quality: { type: 'select', label: 'Quality', default: 'hd',
        options: [{ value: 'standard', label: 'Standard' }, { value: 'hd', label: 'HD' }],
      },
      style: { type: 'select', label: 'Style', default: 'vivid',
        options: [{ value: 'vivid', label: 'Vivid' }, { value: 'natural', label: 'Natural' }],
      },
      // OpenAI's DALL-E 3 endpoint only accepts `n: 1` per request
      // (DALL-E 4 / gpt-image-1 supports `n` up to 10). The route runs
      // N parallel calls server-side so the picker can offer 1-4 here
      // and stay consistent with Nano Banana / Imagen / SD / FLUX.
      count: COUNT_FIELD,
    },
  },
  {
    id: 'dall-e-3', kind: 'image', provider: 'openai', label: 'DALL-E 3',
    fields: {
      size: { type: 'select', label: 'Size', default: '1024x1024',
        options: [
          { value: '1024x1024', label: '1024 x 1024' },
          { value: '1792x1024', label: '1792 x 1024' },
          { value: '1024x1792', label: '1024 x 1792' },
        ],
      },
      quality: { type: 'select', label: 'Quality', default: 'standard',
        options: [{ value: 'standard', label: 'Standard' }, { value: 'hd', label: 'HD' }],
      },
      style: { type: 'select', label: 'Style', default: 'vivid',
        options: [{ value: 'vivid', label: 'Vivid' }, { value: 'natural', label: 'Natural' }],
      },
      // Same loop-N-times treatment as DALL-E 4 above. Each parallel
      // call costs one credit, so the picker tops out at 4 to keep the
      // surprise factor low; raise the cap here if billing UX changes.
      count: COUNT_FIELD,
    },
  },

  // Midjourney
  {
    id: 'midjourney-v7', kind: 'image', provider: 'midjourney', label: 'Midjourney v7',
    description: 'Midjourney v7 via API. Distinctive aesthetic, strong stylisation.',
    attachments: { ...ACCEPT_REFERENCE_IMAGE, maxFiles: 4, humanLabel: 'Up to 4 reference images for character / style' },
    fields: {
      aspectRatio: ASPECT_MJ,
      stylize: { type: 'integer', label: 'Stylize', min: 0, max: 1000, step: 50, default: 100 },
      chaos:   { type: 'integer', label: 'Chaos',   min: 0, max: 100,  step: 5,  default: 0 },
      weird:   { type: 'integer', label: 'Weird',   min: 0, max: 3000, step: 100, default: 0 },
      version: { type: 'select', label: 'Mode', default: 'standard',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'raw',      label: 'Raw' },
          { value: 'turbo',    label: 'Turbo' },
        ],
      },
      seed: SEED_FIELD,
    },
  },
  {
    id: 'midjourney-v6.1', kind: 'image', provider: 'midjourney', label: 'Midjourney v6.1',
    fields: {
      aspectRatio: ASPECT_MJ,
      stylize: { type: 'integer', label: 'Stylize', min: 0, max: 1000, step: 50, default: 100 },
      chaos:   { type: 'integer', label: 'Chaos',   min: 0, max: 100,  step: 5,  default: 0 },
      seed: SEED_FIELD,
    },
  },

  // Stability
  {
    id: 'stable-diffusion-3.5', kind: 'image', provider: 'stability', label: 'Stable Diffusion 3.5',
    description: 'Stability AI SD 3.5. Open weights, supports negative prompts and steps.',
    attachments: ACCEPT_REFERENCE_IMAGE,
    fields: {
      aspectRatio: ASPECT_COMMON,
      cfgScale: { type: 'range', label: 'CFG scale', min: 1, max: 20, step: 0.5, default: 7 },
      steps:    { type: 'integer', label: 'Steps',   min: 10, max: 50, step: 1, default: 30 },
      seed: SEED_FIELD,
      negativePrompt: NEGATIVE_PROMPT_FIELD,
    },
  },
  {
    id: 'stable-diffusion-xl', kind: 'image', provider: 'stability', label: 'Stable Diffusion XL',
    attachments: ACCEPT_REFERENCE_IMAGE,
    fields: {
      aspectRatio: ASPECT_COMMON,
      cfgScale: { type: 'range', label: 'CFG scale', min: 1, max: 20, step: 0.5, default: 7 },
      steps:    { type: 'integer', label: 'Steps',   min: 10, max: 50, step: 1, default: 25 },
      seed: SEED_FIELD,
      negativePrompt: NEGATIVE_PROMPT_FIELD,
    },
  },

  // FLUX (Black Forest Labs)
  {
    id: 'flux-1.1-pro-ultra', kind: 'image', provider: 'bfl', label: 'FLUX 1.1 Pro Ultra',
    description: 'Black Forest Labs FLUX. Strong text rendering and prompt adherence.',
    attachments: ACCEPT_REFERENCE_IMAGE,
    fields: {
      aspectRatio: ASPECT_COMMON,
      raw: { type: 'toggle', label: 'Raw mode (less stylised)', default: false },
      seed: SEED_FIELD,
    },
  },
  {
    id: 'flux-1-pro', kind: 'image', provider: 'bfl', label: 'FLUX 1 Pro',
    attachments: ACCEPT_REFERENCE_IMAGE,
    fields: { aspectRatio: ASPECT_COMMON, seed: SEED_FIELD },
  },
  {
    id: 'flux-1-dev', kind: 'image', provider: 'bfl', label: 'FLUX 1 Dev',
    attachments: ACCEPT_REFERENCE_IMAGE,
    fields: {
      aspectRatio: ASPECT_COMMON,
      guidanceScale: { type: 'range', label: 'Guidance scale', min: 1, max: 10, step: 0.5, default: 3.5 },
      steps: { type: 'integer', label: 'Steps', min: 1, max: 50, step: 1, default: 28 },
      seed: SEED_FIELD,
    },
  },

  // Ideogram
  {
    id: 'ideogram-3.0', kind: 'image', provider: 'ideogram', label: 'Ideogram 3.0',
    description: 'Best-in-class for text-in-image and graphic design.',
    attachments: ACCEPT_REFERENCE_IMAGE,
    fields: {
      aspectRatio: ASPECT_COMMON,
      magicPrompt: { type: 'toggle', label: 'Magic prompt enhancement', default: true },
      styleType: { type: 'select', label: 'Style', default: 'general',
        options: [
          { value: 'general',  label: 'General' },
          { value: 'realistic', label: 'Realistic' },
          { value: 'design',   label: 'Design' },
          { value: 'anime',    label: 'Anime' },
        ],
      },
      seed: SEED_FIELD,
      negativePrompt: NEGATIVE_PROMPT_FIELD,
    },
  },
  {
    id: 'ideogram-2.0-turbo', kind: 'image', provider: 'ideogram', label: 'Ideogram 2.0 Turbo',
    fields: {
      aspectRatio: ASPECT_COMMON,
      magicPrompt: { type: 'toggle', label: 'Magic prompt', default: true },
      seed: SEED_FIELD,
    },
  },

  // Recraft / Playground
  {
    id: 'recraft-v3', kind: 'image', provider: 'recraft', label: 'Recraft v3',
    description: 'Recraft. Vector + raster output, brand-style consistency.',
    fields: {
      style: { type: 'select', label: 'Style', default: 'realistic_image',
        options: [
          { value: 'realistic_image', label: 'Realistic' },
          { value: 'digital_illustration', label: 'Digital illustration' },
          { value: 'vector_illustration',  label: 'Vector illustration' },
          { value: 'icon',                  label: 'Icon' },
        ],
      },
      size: { type: 'select', label: 'Size', default: '1024x1024',
        options: [
          { value: '1024x1024', label: '1024 x 1024' },
          { value: '1365x1024', label: '1365 x 1024' },
          { value: '1024x1365', label: '1024 x 1365' },
        ],
      },
    },
  },
  {
    id: 'playground-v3', kind: 'image', provider: 'playground', label: 'Playground v3',
    fields: { aspectRatio: ASPECT_COMMON, count: COUNT_FIELD, seed: SEED_FIELD, negativePrompt: NEGATIVE_PROMPT_FIELD },
  },

  // Chinese providers
  {
    id: 'cogview-3-plus', kind: 'image', provider: 'zhipu', label: 'CogView 3 Plus',
    fields: { aspectRatio: ASPECT_COMMON, seed: SEED_FIELD },
  },
  {
    id: 'wanxiang-2.1', kind: 'image', provider: 'alibaba', label: 'Wanxiang 2.1',
    fields: { aspectRatio: ASPECT_COMMON, seed: SEED_FIELD, negativePrompt: NEGATIVE_PROMPT_FIELD },
  },
  {
    id: 'tongyi-wanxiang', kind: 'image', provider: 'alibaba', label: 'Tongyi Wanxiang',
    fields: { aspectRatio: ASPECT_COMMON, seed: SEED_FIELD },
  },
  {
    id: 'ernie-vilg-2.0', kind: 'image', provider: 'baidu', label: 'Ernie ViLG 2.0',
    fields: { aspectRatio: ASPECT_COMMON, seed: SEED_FIELD, negativePrompt: NEGATIVE_PROMPT_FIELD },
  },
  {
    id: 'wenxin-yige', kind: 'image', provider: 'baidu', label: 'Wenxin Yige',
    fields: { aspectRatio: ASPECT_COMMON, seed: SEED_FIELD },
  },
  {
    id: 'kolors', kind: 'image', provider: 'kuaishou', label: 'Kolors',
    fields: { aspectRatio: ASPECT_COMMON, seed: SEED_FIELD },
  },
]

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

const VIDEO_ASPECT: SelectField = {
  type: 'select', label: 'Aspect ratio', default: '16:9',
  options: [
    { value: '16:9', label: '16:9 (landscape)' },
    { value: '9:16', label: '9:16 (vertical)' },
    { value: '1:1',  label: '1:1 (square)' },
  ],
}

const VIDEO_DURATION_5_10: SelectField = {
  type: 'select', label: 'Duration', default: '5',
  options: [{ value: '5', label: '5 sec' }, { value: '10', label: '10 sec' }],
}

const VIDEO_RESOLUTION: SelectField = {
  type: 'select', label: 'Resolution', default: '1080p',
  options: [
    { value: '720p',  label: '720p' },
    { value: '1080p', label: '1080p' },
    { value: '4k',    label: '4K' },
  ],
}

const VIDEO_CAPABILITIES: Capability[] = [
  // OpenAI Sora
  {
    id: 'sora-turbo', kind: 'video', provider: 'openai', label: 'Sora Turbo',
    description: 'OpenAI Sora text-to-video. Strong physics and complex camera motion.',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: {
      aspectRatio: VIDEO_ASPECT,
      duration: { type: 'integer', label: 'Duration', min: 5, max: 20, step: 5, default: 10, suffix: 's' },
      resolution: VIDEO_RESOLUTION,
    },
  },
  {
    id: 'sora', kind: 'video', provider: 'openai', label: 'Sora',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: {
      aspectRatio: VIDEO_ASPECT,
      duration: { type: 'integer', label: 'Duration', min: 10, max: 60, step: 10, default: 20, suffix: 's' },
      resolution: VIDEO_RESOLUTION,
    },
  },

  // Runway Gen-4 / Gen-3
  {
    id: 'runway-gen-4-turbo', kind: 'video', provider: 'runway', label: 'Runway Gen-4 Turbo',
    description: 'Image-to-video and text-to-video. Industry-standard camera motion controls.',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: {
      aspectRatio: VIDEO_ASPECT,
      duration: VIDEO_DURATION_5_10,
      resolution: { type: 'select', label: 'Resolution', default: '720p',
        options: [{ value: '720p', label: '720p' }, { value: '1080p', label: '1080p' }] },
      cameraMotion: { type: 'select', label: 'Camera motion', default: 'static',
        options: [
          { value: 'static',     label: 'Static' },
          { value: 'pan-left',   label: 'Pan left' },
          { value: 'pan-right',  label: 'Pan right' },
          { value: 'zoom-in',    label: 'Zoom in' },
          { value: 'zoom-out',   label: 'Zoom out' },
          { value: 'orbit',      label: 'Orbit' },
        ],
      },
      seed: SEED_FIELD,
    },
  },
  {
    id: 'runway-gen-3-alpha', kind: 'video', provider: 'runway', label: 'Runway Gen-3 Alpha',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: {
      aspectRatio: VIDEO_ASPECT,
      duration: VIDEO_DURATION_5_10,
      seed: SEED_FIELD,
    },
  },

  // Luma Dream Machine
  {
    id: 'luma-dream-machine-2', kind: 'video', provider: 'luma', label: 'Luma Dream Machine 2',
    description: 'Smooth motion, supports start- and end-frame conditioning.',
    attachments: { ...ACCEPT_VIDEO_START_FRAME, maxFiles: 2, humanLabel: 'Up to 2 frame images (start + end) — PNG/JPEG/WebP, 8 MB each' },
    fields: {
      aspectRatio: VIDEO_ASPECT,
      duration: { type: 'select', label: 'Duration', default: '5',
        options: [{ value: '5', label: '5 sec' }, { value: '9', label: '9 sec' }] },
      loop: { type: 'toggle', label: 'Loop', default: false },
    },
  },
  {
    id: 'luma-dream-machine', kind: 'video', provider: 'luma', label: 'Luma Dream Machine',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: { aspectRatio: VIDEO_ASPECT, duration: VIDEO_DURATION_5_10, loop: { type: 'toggle', label: 'Loop', default: false } },
  },

  // Pika
  {
    id: 'pika-2.0', kind: 'video', provider: 'pika', label: 'Pika 2.0',
    description: 'Pika 2.0 — strong text-to-video with Pikaffects (effects) and ingredients (consistent characters).',
    attachments: { ...ACCEPT_VIDEO_START_FRAME, maxFiles: 4, humanLabel: 'Up to 4 ingredient images (PNG/JPEG/WebP) — 8 MB each' },
    fields: {
      aspectRatio: VIDEO_ASPECT,
      duration: { type: 'select', label: 'Duration', default: '5', options: [{ value: '5', label: '5 sec' }, { value: '10', label: '10 sec' }] },
      style: { type: 'select', label: 'Style', default: 'natural',
        options: [
          { value: 'natural',   label: 'Natural' },
          { value: 'cinematic', label: 'Cinematic' },
          { value: 'animation', label: 'Animation' },
          { value: '3d',        label: '3D' },
        ],
      },
      negativePrompt: NEGATIVE_PROMPT_FIELD,
    },
  },
  {
    id: 'pika-1.5', kind: 'video', provider: 'pika', label: 'Pika 1.5',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: { aspectRatio: VIDEO_ASPECT, duration: VIDEO_DURATION_5_10 },
  },

  // Haiper / Stability / Kling / CogVideo / Pixverse / Vidu
  {
    id: 'haiper-2.0', kind: 'video', provider: 'haiper', label: 'Haiper 2.0',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: {
      aspectRatio: VIDEO_ASPECT,
      duration: { type: 'select', label: 'Duration', default: '4',
        options: [{ value: '4', label: '4 sec' }, { value: '6', label: '6 sec' }, { value: '8', label: '8 sec' }] },
      seed: SEED_FIELD,
    },
  },
  {
    id: 'stability-video', kind: 'video', provider: 'stability', label: 'Stable Video',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: {
      aspectRatio: VIDEO_ASPECT,
      duration: { type: 'select', label: 'Duration', default: '4', options: [{ value: '4', label: '4 sec' }] },
      cfgScale: { type: 'range', label: 'CFG scale', min: 1, max: 10, step: 0.5, default: 1.8 },
      seed: SEED_FIELD,
    },
  },
  {
    id: 'kling-2.0', kind: 'video', provider: 'kuaishou', label: 'Kling 2.0',
    description: 'Kuaishou Kling. Strong physics + camera control.',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: {
      aspectRatio: VIDEO_ASPECT,
      duration: { type: 'select', label: 'Duration', default: '5', options: [{ value: '5', label: '5 sec' }, { value: '10', label: '10 sec' }] },
      mode: { type: 'select', label: 'Mode', default: 'standard',
        options: [{ value: 'standard', label: 'Standard' }, { value: 'pro', label: 'Pro' }] },
      negativePrompt: NEGATIVE_PROMPT_FIELD,
    },
  },
  {
    id: 'kling-1.5', kind: 'video', provider: 'kuaishou', label: 'Kling 1.5',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: { aspectRatio: VIDEO_ASPECT, duration: VIDEO_DURATION_5_10 },
  },
  {
    id: 'cogvideo-x', kind: 'video', provider: 'zhipu', label: 'CogVideoX',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: { aspectRatio: VIDEO_ASPECT, duration: { type: 'select', label: 'Duration', default: '6', options: [{ value: '6', label: '6 sec' }] } },
  },
  {
    id: 'pixverse-v3', kind: 'video', provider: 'pixverse', label: 'Pixverse V3',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: {
      aspectRatio: VIDEO_ASPECT,
      duration: { type: 'select', label: 'Duration', default: '5', options: [{ value: '5', label: '5 sec' }, { value: '8', label: '8 sec' }] },
      style: { type: 'select', label: 'Style', default: 'realistic',
        options: [
          { value: 'realistic',  label: 'Realistic' },
          { value: 'anime',      label: 'Anime' },
          { value: '3d',         label: '3D' },
          { value: 'clay',       label: 'Clay' },
          { value: 'comic',      label: 'Comic' },
        ],
      },
    },
  },
  {
    id: 'vidu-1.5', kind: 'video', provider: 'shengshu', label: 'Vidu 1.5',
    attachments: ACCEPT_VIDEO_START_FRAME,
    fields: {
      aspectRatio: VIDEO_ASPECT,
      duration: { type: 'select', label: 'Duration', default: '4', options: [{ value: '4', label: '4 sec' }, { value: '8', label: '8 sec' }] },
    },
  },

  // Avatar / lipsync
  {
    id: 'heygen-avatar-iv', kind: 'video', provider: 'heygen', label: 'HeyGen Avatar IV',
    description: 'AI avatar with lip-sync. Reads either typed text or an audio track.',
    attachments: { mimeTypes: ['audio/mpeg','audio/wav'], humanLabel: 'Optional audio track (MP3/WAV) — 50 MB max', maxFiles: 1, maxBytesEach: 50 * 1024 * 1024 },
    fields: {
      avatar: { type: 'text', label: 'Avatar id', placeholder: 'e.g. Anna_public', default: '' },
      voice:  { type: 'text', label: 'Voice id',  placeholder: 'e.g. en-US-JennyNeural', default: '' },
      aspectRatio: VIDEO_ASPECT,
      background: { type: 'select', label: 'Background', default: 'office',
        options: [
          { value: 'office',  label: 'Office' },
          { value: 'studio',  label: 'Studio' },
          { value: 'plain',   label: 'Plain' },
          { value: 'custom',  label: 'Custom (upload)' },
        ],
      },
    },
  },
  {
    id: 'heygen-avatar-iii', kind: 'video', provider: 'heygen', label: 'HeyGen Avatar III',
    fields: {
      avatar: { type: 'text', label: 'Avatar id', placeholder: 'avatar id', default: '' },
      voice:  { type: 'text', label: 'Voice id',  placeholder: 'voice id', default: '' },
      aspectRatio: VIDEO_ASPECT,
    },
  },
  {
    id: 'synthesia-standard', kind: 'video', provider: 'synthesia', label: 'Synthesia Standard',
    fields: {
      avatar: { type: 'text', label: 'Avatar', placeholder: 'e.g. anna_costume1_cameraA', default: '' },
      voice:  { type: 'text', label: 'Voice',  placeholder: 'e.g. Jenny', default: '' },
      aspectRatio: VIDEO_ASPECT,
    },
  },
  {
    id: 'did-studio', kind: 'video', provider: 'd-id', label: 'D-ID Studio',
    description: 'Image-driven talking-head video. Provide a portrait + a script.',
    attachments: { mimeTypes: ['image/png','image/jpeg'], humanLabel: 'A portrait photo (PNG/JPEG)', maxFiles: 1, maxBytesEach: 10 * 1024 * 1024 },
    fields: {
      voice: { type: 'text', label: 'Voice', placeholder: 'e.g. en-US-JennyNeural', default: '' },
      style: { type: 'select', label: 'Style', default: 'natural',
        options: [{ value: 'natural', label: 'Natural' }, { value: 'animated', label: 'Animated' }] },
    },
  },
]

// ---------------------------------------------------------------------------
// Audio — TTS + music + SFX
// ---------------------------------------------------------------------------

function geminiTts(id: string, label: string): Capability {
  return {
    id, kind: 'audio', provider: 'google', label,
    description: 'Google TTS via Gemini. Multilingual, expressive prosody.',
    fields: {
      voice: { type: 'select', label: 'Voice', default: 'Aoede',
        options: [
          { value: 'Aoede',     label: 'Aoede (warm, female)' },
          { value: 'Puck',      label: 'Puck (playful, male)' },
          { value: 'Charon',    label: 'Charon (deep, male)' },
          { value: 'Kore',      label: 'Kore (firm, female)' },
          { value: 'Fenrir',    label: 'Fenrir (energetic, male)' },
        ],
      },
      speed: { type: 'range', label: 'Speed', min: 0.5, max: 2, step: 0.05, default: 1, suffix: 'x' },
      format: { type: 'select', label: 'Format', default: 'wav',
        options: [{ value: 'wav', label: 'WAV' }, { value: 'mp3', label: 'MP3' }] },
    },
  }
}

const AUDIO_CAPABILITIES: Capability[] = [
  // Google Gemini TTS
  geminiTts('gemini-tts-3.1', 'Gemini TTS 3.1'),
  geminiTts('gemini-tts',     'Gemini TTS'),

  // ElevenLabs
  {
    id: 'elevenlabs-turbo-v2.5', kind: 'audio', provider: 'elevenlabs', label: 'ElevenLabs Turbo v2.5',
    description: 'Low-latency multilingual TTS with voice cloning.',
    attachments: ACCEPT_VOICE_CLONE_AUDIO,
    fields: {
      voice:       { type: 'text', label: 'Voice id', placeholder: 'voice id', default: '21m00Tcm4TlvDq8ikWAM' },
      stability:   { type: 'range', label: 'Stability',   min: 0, max: 1, step: 0.05, default: 0.5 },
      similarity:  { type: 'range', label: 'Similarity boost', min: 0, max: 1, step: 0.05, default: 0.75 },
      style:       { type: 'range', label: 'Style exaggeration', min: 0, max: 1, step: 0.05, default: 0 },
      speakerBoost: { type: 'toggle', label: 'Speaker boost', default: true },
      format: { type: 'select', label: 'Format', default: 'mp3_44100_128',
        options: [
          { value: 'mp3_44100_128', label: 'MP3 44.1 kHz / 128 kbps' },
          { value: 'mp3_44100_192', label: 'MP3 44.1 kHz / 192 kbps' },
          { value: 'pcm_24000',     label: 'PCM 24 kHz' },
        ],
      },
    },
  },
  {
    id: 'elevenlabs-multilingual-v2', kind: 'audio', provider: 'elevenlabs', label: 'ElevenLabs Multilingual v2',
    description: '29-language TTS with emotional range.',
    attachments: ACCEPT_VOICE_CLONE_AUDIO,
    fields: {
      voice:       { type: 'text', label: 'Voice id', placeholder: 'voice id', default: '21m00Tcm4TlvDq8ikWAM' },
      stability:   { type: 'range', label: 'Stability',   min: 0, max: 1, step: 0.05, default: 0.5 },
      similarity:  { type: 'range', label: 'Similarity boost', min: 0, max: 1, step: 0.05, default: 0.75 },
      speakerBoost: { type: 'toggle', label: 'Speaker boost', default: true },
    },
  },

  // OpenAI TTS
  {
    id: 'openai-tts-1-hd', kind: 'audio', provider: 'openai', label: 'OpenAI TTS-1 HD',
    description: 'Higher-fidelity OpenAI TTS. 6 voices, 24 kHz.',
    fields: {
      voice: { type: 'select', label: 'Voice', default: 'alloy',
        options: [
          { value: 'alloy',   label: 'Alloy' },
          { value: 'echo',    label: 'Echo' },
          { value: 'fable',   label: 'Fable' },
          { value: 'onyx',    label: 'Onyx' },
          { value: 'nova',    label: 'Nova' },
          { value: 'shimmer', label: 'Shimmer' },
        ],
      },
      speed: { type: 'range', label: 'Speed', min: 0.25, max: 4, step: 0.05, default: 1, suffix: 'x' },
      format: { type: 'select', label: 'Format', default: 'mp3',
        options: [
          { value: 'mp3',  label: 'MP3' },
          { value: 'opus', label: 'Opus' },
          { value: 'aac',  label: 'AAC' },
          { value: 'flac', label: 'FLAC' },
          { value: 'wav',  label: 'WAV' },
          { value: 'pcm',  label: 'PCM' },
        ],
      },
    },
  },
  {
    id: 'openai-tts-1', kind: 'audio', provider: 'openai', label: 'OpenAI TTS-1',
    description: 'Standard OpenAI TTS. Faster than HD.',
    fields: {
      voice: { type: 'select', label: 'Voice', default: 'alloy',
        options: [
          { value: 'alloy', label: 'Alloy' },{ value: 'echo', label: 'Echo' },{ value: 'fable', label: 'Fable' },
          { value: 'onyx', label: 'Onyx' },{ value: 'nova', label: 'Nova' },{ value: 'shimmer', label: 'Shimmer' },
        ],
      },
      speed: { type: 'range', label: 'Speed', min: 0.25, max: 4, step: 0.05, default: 1, suffix: 'x' },
      format: { type: 'select', label: 'Format', default: 'mp3',
        options: [
          { value: 'mp3', label: 'MP3' }, { value: 'opus', label: 'Opus' }, { value: 'aac', label: 'AAC' }, { value: 'flac', label: 'FLAC' },
        ],
      },
    },
  },

  // Azure / Play.ht
  {
    id: 'azure-neural-tts', kind: 'audio', provider: 'azure', label: 'Azure Neural TTS',
    description: '500+ voices in 140 languages. Uses SSML for prosody control.',
    fields: {
      voice: { type: 'text', label: 'Voice', placeholder: 'e.g. en-US-JennyNeural', default: 'en-US-JennyNeural' },
      style: { type: 'text', label: 'Style', placeholder: 'e.g. cheerful, sad, excited', default: '' },
      speed: { type: 'range', label: 'Rate', min: 0.5, max: 2, step: 0.05, default: 1, suffix: 'x' },
      pitch: { type: 'range', label: 'Pitch', min: -50, max: 50, step: 1, default: 0, suffix: '%' },
      format: { type: 'select', label: 'Format', default: 'audio-24khz-96kbitrate-mono-mp3',
        options: [
          { value: 'audio-24khz-96kbitrate-mono-mp3',  label: 'MP3 24 kHz / 96 kbps' },
          { value: 'audio-48khz-192kbitrate-mono-mp3', label: 'MP3 48 kHz / 192 kbps' },
          { value: 'riff-24khz-16bit-mono-pcm',        label: 'PCM 24 kHz' },
        ],
      },
    },
  },
  {
    id: 'play.ht-3.0', kind: 'audio', provider: 'playht', label: 'Play.ht 3.0',
    description: 'Real-time TTS with voice cloning.',
    attachments: ACCEPT_VOICE_CLONE_AUDIO,
    fields: {
      voice: { type: 'text', label: 'Voice id', placeholder: 'voice id', default: '' },
      speed: { type: 'range', label: 'Speed', min: 0.5, max: 2, step: 0.05, default: 1, suffix: 'x' },
      style: { type: 'text', label: 'Style', placeholder: 'e.g. friendly, narration', default: '' },
      format: { type: 'select', label: 'Format', default: 'mp3',
        options: [{ value: 'mp3', label: 'MP3' }, { value: 'wav', label: 'WAV' }, { value: 'ogg', label: 'OGG' }] },
    },
  },

  // Music
  {
    id: 'suno-v4', kind: 'audio', provider: 'suno', label: 'Suno v4',
    description: 'Suno music generation. Lyrics + melody.',
    fields: {
      mode: { type: 'select', label: 'Mode', default: 'song',
        options: [{ value: 'song', label: 'Song (with vocals)' }, { value: 'instrumental', label: 'Instrumental' }] },
      style: { type: 'text', label: 'Style', placeholder: 'e.g. lo-fi hip hop, jazz piano', default: '' },
      lyrics: { type: 'text', label: 'Lyrics', placeholder: 'optional lyrics or [verse 1] markers', default: '' },
      duration: { type: 'integer', label: 'Duration', min: 30, max: 240, step: 30, default: 90, suffix: 's' },
    },
  },
  {
    id: 'suno-v3.5', kind: 'audio', provider: 'suno', label: 'Suno v3.5',
    fields: {
      mode: { type: 'select', label: 'Mode', default: 'song',
        options: [{ value: 'song', label: 'Song' }, { value: 'instrumental', label: 'Instrumental' }] },
      style: { type: 'text', label: 'Style', placeholder: 'e.g. lo-fi, jazz', default: '' },
      lyrics: { type: 'text', label: 'Lyrics', placeholder: 'optional', default: '' },
      duration: { type: 'integer', label: 'Duration', min: 30, max: 180, step: 30, default: 60, suffix: 's' },
    },
  },
  {
    id: 'udio-v2', kind: 'audio', provider: 'udio', label: 'Udio v2',
    description: 'Udio music generation. Strong vocal synthesis.',
    fields: {
      style: { type: 'text', label: 'Style tags', placeholder: 'e.g. indie pop, female vocals', default: '' },
      lyrics: { type: 'text', label: 'Lyrics', placeholder: 'optional', default: '' },
      duration: { type: 'integer', label: 'Duration', min: 30, max: 180, step: 30, default: 60, suffix: 's' },
    },
  },
  {
    id: 'udio-v1.5', kind: 'audio', provider: 'udio', label: 'Udio v1.5',
    fields: {
      style: { type: 'text', label: 'Style tags', placeholder: 'e.g. acoustic, mellow', default: '' },
      duration: { type: 'integer', label: 'Duration', min: 30, max: 120, step: 30, default: 60, suffix: 's' },
    },
  },
  {
    id: 'stable-audio-2', kind: 'audio', provider: 'stability', label: 'Stable Audio 2',
    description: 'Stability AI music + sound effects. Up to 3 minutes per track.',
    fields: {
      style: { type: 'text', label: 'Style', placeholder: 'e.g. ambient electronic', default: '' },
      duration: { type: 'integer', label: 'Duration', min: 1, max: 180, step: 1, default: 30, suffix: 's' },
      cfgScale: { type: 'range', label: 'CFG scale', min: 1, max: 15, step: 0.5, default: 6 },
      seed: SEED_FIELD,
    },
  },

  // Open / Chinese voice
  {
    id: 'fish-speech-1.5', kind: 'audio', provider: 'fish', label: 'Fish Speech 1.5',
    description: 'Open-source multilingual TTS with voice cloning.',
    attachments: ACCEPT_VOICE_CLONE_AUDIO,
    fields: {
      voice: { type: 'text', label: 'Voice id', placeholder: 'voice id', default: '' },
      speed: { type: 'range', label: 'Speed', min: 0.5, max: 2, step: 0.05, default: 1, suffix: 'x' },
      format: { type: 'select', label: 'Format', default: 'wav',
        options: [{ value: 'wav', label: 'WAV' }, { value: 'mp3', label: 'MP3' }] },
    },
  },
  {
    id: 'chatglm-audio', kind: 'audio', provider: 'zhipu', label: 'ChatGLM Audio',
    description: 'Zhipu Chinese-first TTS.',
    fields: {
      voice: { type: 'select', label: 'Voice', default: 'female_1',
        options: [
          { value: 'female_1', label: 'Female 1' }, { value: 'female_2', label: 'Female 2' },
          { value: 'male_1',   label: 'Male 1' },   { value: 'male_2',   label: 'Male 2' },
        ],
      },
      speed: { type: 'range', label: 'Speed', min: 0.5, max: 2, step: 0.05, default: 1, suffix: 'x' },
    },
  },
]

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const ALL_CAPABILITIES: Capability[] = [
  ...TEXT_CAPABILITIES,
  ...IMAGE_CAPABILITIES,
  ...VIDEO_CAPABILITIES,
  ...AUDIO_CAPABILITIES,
]

const BY_ID_AND_KIND: Map<string, Capability> = new Map(
  ALL_CAPABILITIES.map(c => [`${c.kind}:${c.id}`, c]),
)

/** Look up a capability by model id + modality. Returns `undefined` if the
 *  model isn't registered, in which case the drawer falls back to a
 *  conservative default. */
export function getCapability(id: string, kind: ModalityKind): Capability | undefined {
  return BY_ID_AND_KIND.get(`${kind}:${id}`)
}

// ---------------------------------------------------------------------------
// Back-compat type aliases — older imports referenced `TextCapability`,
// `ImageCapability`, etc. Keep them as type-only aliases so call sites that
// type-narrow on `kind` still compile.
// ---------------------------------------------------------------------------

export type TextCapability  = Capability & { kind: 'text' }
export type ImageCapability = Capability & { kind: 'image' }
export type VideoCapability = Capability & { kind: 'video' }
export type AudioCapability = Capability & { kind: 'audio' }
