import { redirect } from 'next/navigation'

/**
 * The dedicated `/video` surface has been retired in favour of the
 * unified `/text` shell. This stub stays for back-compat with any
 * bookmarks or external links pointing at the old route — it just
 * forwards to the composer with the video modality preselected.
 */
export default function LegacyVideoRedirect() {
  // Forward to the unified chat surface. Modality is selected from the
  // in-composer slash menu — there is no longer a per-modality URL.
  redirect('/text')
}
