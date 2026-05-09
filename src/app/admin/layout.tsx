import type { ReactNode } from 'react'
import { requireSuperAdmin } from '@/lib/admin/server'

/**
 * Admin gate — runs on the server before any /admin/** page renders. Non
 * super-admins are silently redirected to /text via `requireSuperAdmin`,
 * so no admin chrome ever flashes for the wrong user.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSuperAdmin()
  return <>{children}</>
}
