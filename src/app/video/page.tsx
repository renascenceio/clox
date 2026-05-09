import { redirect } from 'next/navigation'

/**
 * The dedicated `/video` surface has been retired in favour of the
 * unified `/text` shell. This stub stays for back-compat with any
 * bookmarks or external links pointing at the old route — it just
 * forwards to the composer with the video modality preselected.
 */
export default function LegacyVideoRedirect() {
  redirect('/text?mode=video')
}
