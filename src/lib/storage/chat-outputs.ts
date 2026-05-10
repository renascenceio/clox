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
  /** A short-lived signed URL the browser can fetch directly. */
  signedUrl: string
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
    filename,
    mime,
    size: input.content.byteLength,
  }
}
