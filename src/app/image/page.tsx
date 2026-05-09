import { redirect } from 'next/navigation'

/**
 * The dedicated `/image` surface has been retired. The unified `/text`
 * shell hosts every modality now (text / image / video / voice) and
 * switches in-place via the slash menu. We keep this route only as a
 * permanent server-side redirect so old bookmarks, deeplinks, and the
 * occasional handwritten URL still land on the right composer.
 */
export default function LegacyImageRedirect() {
  redirect('/text?mode=image')
}
