'use client'

/**
 * One workspace shell for every app page.
 *
 * Each page used to render its own <ChatWorkspace>, so clicking from
 * Projects to Chats tore the whole shell down (rail, recents, account
 * menu) and built it again. The host lives in the root layout and keeps a
 * single <ChatWorkspace> mounted; pages render <WorkspaceSlot {...props}/>,
 * which hands their props to the host and draws nothing itself. Only the
 * main column is rebuilt when the page changes.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import ChatWorkspace, { type ChatWorkspaceProps } from './ChatWorkspace'
import { startChatCloud } from '@/lib/chat-cloud'
import { PREFETCH_PATHS, beginNav, endNav, useNavPending } from './nav-pending'

type Register = (owner: object, props: ChatWorkspaceProps | null) => void

const HostContext = createContext<Register | null>(null)

export function WorkspaceHost({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<{ owner: object; props: ChatWorkspaceProps } | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const navPending = useNavPending()

  // Every page navigates with router.push (about forty call sites). The
  // router object is shared, so wrapping its push once here lets the shell
  // show the next page's ghost the moment any of them fires.
  useEffect(() => {
    const r = router as typeof router & { __cloxNav?: boolean }
    if (r.__cloxNav) return
    const push = r.push.bind(r)
    r.push = (href, options) => {
      beginNav(String(href))
      return push(href, options)
    }
    r.__cloxNav = true
  }, [router])

  useEffect(() => { endNav() }, [pathname])

  // Fetch the code of the main pages while the browser is idle, so moving
  // between them doesn't wait on the network.
  useEffect(() => {
    if (!APP_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) return
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    const run = () => PREFETCH_PATHS.forEach(p => { if (p !== pathname) router.prefetch(p) })
    if (idle) idle(run)
    else setTimeout(run, 1200)
  }, [pathname, router])

  const register = useCallback<Register>((owner, props) => {
    setEntry(current => {
      if (props) return { owner, props }
      // A leaving page only clears the shell if nobody newer took it over
      // in the same commit, so moving between pages never unmounts it.
      return current && current.owner === owner ? null : current
    })
  }, [])

  return (
    <HostContext.Provider value={register}>
      <HostReady />
      {entry && (
        <div className="fixed inset-0 isolate">
          <ChatWorkspace {...entry.props} pageKey={pathname} navPending={navPending} />
        </div>
      )}
      {children}
    </HostContext.Provider>
  )
}

/** True once the host has mounted in this tab. Until then (server render
 *  and hydration of the first page) a slot draws the shell itself so the
 *  first HTML isn't blank; it hands over to the host right after. */
let hostMounted = false

function HostReady() {
  const pathname = usePathname()
  useLayoutEffect(() => { hostMounted = true }, [])
  // Save chats on the server and bring down ones from other devices. Only
  // inside the app — the public pages have no chats and no session.
  useEffect(() => {
    if (APP_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) startChatCloud()
  }, [pathname])
  return null
}

const APP_PATHS = ['/text', '/chats', '/projects', '/files', '/gallery', '/history', '/settings', '/skills', '/archives', '/deleted', '/image', '/video', '/audio']

/** Drop-in replacement for a page's `<ChatWorkspace … />`. */
export default function WorkspaceSlot(props: ChatWorkspaceProps) {
  const register = useContext(HostContext)
  const owner = useRef({}).current
  const [inline, setInline] = useState(() => !register || !hostMounted)

  // Every render hands over the latest props (they close over page state).
  useLayoutEffect(() => {
    if (!register) return
    register(owner, props)
    if (inline) setInline(false)
  })
  useLayoutEffect(() => () => register?.(owner, null), [register, owner])

  if (inline) {
    return (
      <div className="fixed inset-0 isolate">
        <ChatWorkspace {...props} />
      </div>
    )
  }
  return null
}
