export type GatewayModelType = 'language' | 'image' | 'video' | 'speech' | 'transcription'

export type ReasoningOption =
  | { type: 'toggle' }
  | { type: 'effort'; values: string[] }
  | { type: 'budget_tokens'; min?: number; max?: number }

export interface VideoCapabilities {
  supported_operations?: string[]
  supported_resolutions?: string[]
  supported_aspect_ratios?: string[]
  supported_durations_seconds?: number[]
  generate_audio?: boolean
  supported_fps?: number[]
  max_sample_count?: number
  input_limits?: {
    image?: { max_count?: number; max_file_size_mb?: number; [k: string]: unknown }
    [kind: string]: unknown
  }
  [extra: string]: unknown
}

export interface GatewayCatalogEntry {
  id: string
  name: string
  owner: string
  type: GatewayModelType
  released: number
  description?: string
  context?: number
  maxOutput?: number
  tags?: string[]
  input?: string[]
  output?: string[]
  params?: string[]
  temperature?: boolean
  reasoning?: ReasoningOption[]
  video?: VideoCapabilities
}
