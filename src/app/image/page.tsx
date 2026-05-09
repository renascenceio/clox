import { redirect } from 'next/navigation'

/**
 * The dedicated `/image` surface has been retired. The unified `/text`
 * shell hosts every modality now (text / image / video / voice) and
 * switches in-place via the slash menu. We keep this route only as a
 * permanent server-side redirect so old bookmarks, deeplinks, and the
 * occasional handwritten URL still land on the right composer.
 */
export default function LegacyImageRedirect() {
  // Forward to the unified chat surface. Modality is selected from the
  // in-composer slash menu — there is no longer a per-modality URL.
  redirect('/text')
}
