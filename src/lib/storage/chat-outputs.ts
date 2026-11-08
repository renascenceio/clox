/**
 * Chat-outputs storage — wraps the `chat-outputs` Supabase bucket so the
 * rest of the codebase has one place to upload sandbox artifacts and
 * mint signed download URLs.
 *
 * Path convention: `<userId>/<chatId>/<filename>`.
 *
 * The first segment must equal the authenticated user's id because the
 * RLS policies on `storage.objects` (see migration in chat session 003)
 * gate per-user access by `(storage.foldername(name))[1] = auth.uid()`.
 * Service role bypasses RLS for the route's writes — the policy is
 * still enforced for the user's own browser when fetching via signed
 * URLs.
 *
 * We deliberately use signed URLs (1 hour TTL) instead of public URLs
 * because the bucket is private. The TTL is short enough that a leaked
 * URL doesn't grant indefinite access; the user can always click the
 * download chip again to mint a fresh one.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { fileUrl } from './file-url'

const BUCKET = 'chat-outputs'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

/** Lazily-constructed service-role client. We use the service role here
 *  because the upload happens from `/api/chat`, which has its own auth
 *  check up-front (project budget assert + caller identity from
 *  cookies). RLS on the bucket still enforces the per-user folder
 *  convention via the path itself. */
let _serviceClient: ReturnType<typeof createServiceClient> | null = null
function getServiceClient() {
  if (_serviceClient) return _serviceClient
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'chat-outputs storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    )
  }
  _serviceClient = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _serviceClient
}

export interface ChatOutputUpload {
  /** Authenticated user id (from caller). */
  userId: string
  /** Conversation id — determines the second path segment. */
  chatId: string
  /** Original filename inside the sandbox (e.g. "report.pdf"). */
  filename: string
  /** File bytes pulled from the sandbox. */
  content: Buffer
  /** Optional content-type. We default to octet-stream so the browser
   *  defers to the filename extension on download. */
  contentType?: string
}

export interface ChatOutputResult {
  /** The full storage path: `<userId>/<chatId>/<filename>`. */
  path: string
  /** A short-lived signed URL — only for handing to outside services
   *  (e.g. a provider fetching an input image). */
  signedUrl: string
  /** Permanent in-app link (`/api/files/…`) — what chats should keep. */
  url: string
  /** Original filename — propagated to the download chip label. */
  filename: string
  /** Resolved mime type — used by the chip to pick an icon. */
  mime: string
  /** Byte size — shown next to the filename ("report.pdf · 124 KB"). */
  size: number
}

/** Sanitise a filename so it can't break out of the per-chat folder.
 *  Sandbox output filenames come from the model and should be treated
 *  as untrusted. Strip path separators, collapse runs of whitespace,
 *  and cap length at 200 characters so storage keys stay reasonable. */
function safeFilename(name: string): string {
  return name
    .replace(/[/\\]+/g, '_')                 // no path traversal
    .replace(/^\.+/, '')                     // no hidden files
    .replace(/\s+/g, ' ')                    // normalise whitespace
    .trim()
    .slice(0, 200) || 'output'
}

/** Upload one sandbox artifact to the user's folder and return a signed
 *  URL. Errors propagate so the caller (chat route) can decide whether
 *  to keep streaming or surface them — we never want a silent loss. */
export async function uploadChatOutput(
  input: ChatOutputUpload,
): Promise<ChatOutputResult> {
  const supabase = getServiceClient()
  const filename = safeFilename(input.filename)
  const path = `${input.userId}/${input.chatId}/${filename}`
  const mime = input.contentType ?? 'application/octet-stream'

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, input.content, {
      contentType: mime,
      // upsert so re-running the same skill on the same chat (e.g. the
      // user asked twice) replaces the old artifact rather than 409-ing.
      upsert: true,
    })
  if (uploadError) {
    throw new Error(`chat-outputs upload failed: ${uploadError.message}`)
  }

  // The Files library lists from this table. Images handed to a provider
  // as input aren't something the user made, so they stay out of it.
  if (!filename.startsWith('input-')) {
    const { error: rowError } = await supabase.from('chat_files').upsert(
      {
        user_id: input.userId,
        chat_id: input.chatId,
        path,
        filename,
        mime,
        size: input.content.byteLength,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'path' },
    )
    if (rowError) console.error('[clox] chat_files record failed:', rowError.message)
  }

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (signError || !data?.signedUrl) {
    throw new Error(
      `chat-outputs sign failed: ${signError?.message ?? 'no url returned'}`,
    )
  }

  return {
    path,
    signedUrl: data.signedUrl,
    url: fileUrl(path),
    filename,
    mime,
    size: input.content.byteLength,
  }
}

/** Hidden sibling folder holding the kit's working state (deck JSON
 *  etc.) so a chat's files survive when its sandbox is replaced. The
 *  chat UI only shows files announced by annotations, never this. */
const WORKSPACE_DIR = '_workspace'

/** Save one working-state file (e.g. `/mnt/user-data/.clox/deck.json`)
 *  under `<user>/<chat>/_workspace/<name>`. */
export async function saveWorkspaceFile(input: {
  userId: string
  chatId: string
  name: string
  content: Buffer
}): Promise<void> {
  const supabase = getServiceClient()
  const path = `${input.userId}/${input.chatId}/${WORKSPACE_DIR}/${safeFilename(input.name)}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, input.content, { contentType: 'application/octet-stream', upsert: true })
  if (error) throw new Error(`workspace save failed: ${error.message}`)
}

export interface StoredChatFiles {
  /** Deliverables, restored into /mnt/user-data/outputs/. */
  outputs: { name: string; content: Buffer }[]
  /** Working state, restored into /mnt/user-data/.clox/. */
  state: { name: string; content: Buffer }[]
}

/** Everything a chat produced so far, for re-seeding a new sandbox. */
export async function loadChatFiles(userId: string, chatId: string): Promise<StoredChatFiles> {
  const supabase = getServiceClient()
  const bucket = supabase.storage.from(BUCKET)
  const base = `${userId}/${chatId}`
  const list = async (dir: string) => {
    const { data } = await bucket.list(dir, { limit: 200 })
    return (data ?? []).filter(f => f.id && f.name && !f.name.startsWith('.'))
  }
  const download = async (path: string) => {
    const { data } = await bucket.download(path)
    return data ? Buffer.from(await data.arrayBuffer()) : null
  }
  const [top, state] = await Promise.all([list(base), list(`${base}/${WORKSPACE_DIR}`)])
  const fetchAll = async (dir: string, files: { name: string }[]) =>
    (await Promise.all(files.map(async f => {
      const content = await download(`${dir}/${f.name}`)
      return content ? { name: f.name, content } : null
    }))).flatMap(f => (f ? [f] : []))
  return {
    outputs: await fetchAll(base, top),
    state: await fetchAll(`${base}/${WORKSPACE_DIR}`, state),
  }
}

/** Fresh signed URL for a stored file (used by `/api/files/…`); null when
 *  the file doesn't exist. `downloadAs` makes the browser save it. */
export async function signChatOutput(path: string, downloadAs?: string): Promise<string | null> {
  const { data, error } = await getServiceClient().storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, downloadAs ? { download: downloadAs } : undefined)
  return error || !data?.signedUrl ? null : data.signedUrl
}

/** Remove one of the user's files (storage object and its library row). */
export async function deleteChatOutput(userId: string, path: string): Promise<void> {
  if (!path.startsWith(`${userId}/`) || path.split('/').length !== 3) throw new Error('Not your file')
  const supabase = getServiceClient()
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(`delete failed: ${error.message}`)
  await supabase.from('chat_files').delete().eq('path', path).eq('user_id', userId)
}

/** Remove everything a chat stored (files, working state, screenshots). */
export async function deleteChatFolder(userId: string, chatId: string): Promise<void> {
  const supabase = getServiceClient()
  const bucket = supabase.storage.from(BUCKET)
  const base = `${userId}/${chatId}`
  const names = async (dir: string) => ((await bucket.list(dir, { limit: 1000 })).data ?? [])
    .filter(f => f.id).map(f => `${dir}/${f.name}`)
  const all = (await Promise.all([base, `${base}/_workspace`, `${base}/_browser`].map(names))).flat()
  if (all.length) await bucket.remove(all)
  await supabase.from('chat_files').delete().eq('user_id', userId).eq('chat_id', chatId)
}

/** Browser screenshots live beside the chat's files, out of sight of the
 *  workspace restore. */
export async function saveBrowserShot(input: {
  userId: string
  chatId: string
  name: string
  content: Buffer
}): Promise<string> {
  const supabase = getServiceClient()
  const path = `${input.userId}/${input.chatId}/_browser/${safeFilename(input.name)}`
  const bucket = supabase.storage.from(BUCKET)
  const { error } = await bucket.upload(path, input.content, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(`screenshot upload failed: ${error.message}`)
  return fileUrl(path)
}
