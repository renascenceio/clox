import { redirect } from 'next/navigation'

/**
 * The dedicated `/audio` surface has been retired. The unified `/text`
 * shell hosts voice generation alongside the other modalities and is
 * driven by the slash-menu mode switcher. This redirect keeps any old
 * bookmarks pointing at the (now stub) `/audio` route working — it just
 * forwards to `/text` with the voice modality preselected.
 */
export default function LegacyAudioRedirect() {
  // Forward to the unified chat surface. Modality is selected from the
  // in-composer slash menu — there is no longer a per-modality URL.
  redirect('/text')
}
