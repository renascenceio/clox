/**
 * Shared types for the /projects/[id] workspace tabs and components.
 */

export interface ProjectFull {
  id: string
  title: string
  description: string | null
  model: string
  owner_id: string
  owner_email: string
  owner_domain: string | null
  default_modality: 'text' | 'image' | 'video' | 'audio' | 'research' | 'code'
  system_prompt: string | null
  temperature: number
  max_tokens: number
  credit_budget_usd: number | null
  credit_spent_usd: number
  budget_period: 'lifetime' | 'monthly'
  budget_resets_at: string | null
  archived_at: string | null
  allow_external: boolean
  last_activity_at: string
  created_at: string
  updated_at: string
  my_role: 'owner' | 'admin' | 'member'
  member_count: number
}

export interface ProjectMember {
  id: string
  user_id: string | null
  email: string
  role: 'owner' | 'admin' | 'member'
  credit_limit_usd: number | null
  credit_spent_usd: number
  joined_at: string | null
}

export interface ProjectInvite {
  id: string
  email: string
  role: 'admin' | 'member'
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface ProjectChat {
  id: string
  title: string
  modality: string
  model: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner_id: string
}

export interface ProjectFile {
  id: string
  name: string
  content_type: string | null
  size_bytes: number
  blob_url: string
  uploaded_by: string | null
  created_at: string
}

export interface UsageEntry {
  id: string
  user_id: string | null
  user_email: string | null
  model: string | null
  modality: string | null
  cost_usd: number
  prompt_tokens: number | null
  completion_tokens: number | null
  chat_id: string | null
  created_at: string
}

export interface ActivityEntry {
  id: string
  actor_email: string | null
  action: string
  target_kind: string | null
  target_id: string | null
  payload: Record<string, unknown>
  created_at: string
}
