'use client'

/**
 * Editorial × Productivity chat workspace.
 *
 * Direct port of `chat-workspace-G2M12.jsx` (the design reference). Inline
 * styles are kept verbatim — including spacing, font sizes, hairline rules
 * and the `serif` italic accents — so swapping palettes is a runtime swap,
 * never a rebuild, and the component matches the reference pixel-for-pixel.
 *
 * The shell is _data-driven_: chat history, model/mode lists, the recent
 * threads in the rail, and the user identity are all passed in as props.
 * Page-level wiring lives in `app/text/page.tsx` (and siblings).
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { I } from './icons'
import {
  PALETTES,
  MONO_STACK,
  SERIF_STACK,
  SANS_STACK,
  type Palette,
  type PaletteKey,
} from './palettes'

/* =====================================================================
   Public types
   ===================================================================== */

export type ChatVariant = 'chip' | 'slash'

export interface RailNavItem {
  id: string
  label: string
  icon: ReactNode
  count?: number | null
  active?: boolean
  onClick?: () => void
}

export interface RailRecentItem {
  id: string
  title: string
  meta: string
  active?: boolean
  onClick?: () => void
}

export interface ModelOption {
  id: string
  label: string
  tag: string
  short: string
}

export interface ModeOption {
  id: string
  label: string
  hint: string
}

export interface CommandPaletteGroup {
  label: string
  items: Array<{
    icon?: ReactNode
    label: string
    hint?: string
    onSelect?: () => void
  }>
}

export interface TranscriptMessage {
  id: string
  who: 'you' | 'ai'
  time: string
  /** Required for `who: 'ai'` — model byline that appears next to "claude". */
  model?: string
  body: ReactNode
  /** Render this AI message as a serif-italic pull quote (no card). */
  isPullquote?: boolean
}

export type AppLanguage = 'en' | 'ru'

export interface ChatWorkspaceProps {
  // theming
  theme: PaletteKey
  variant?: ChatVariant
  onChangeTheme?: (next: PaletteKey) => void

  // brand
  brandName?: string
  brandVersion?: string

  // user (rail footer)
  user: { initial: string; name: string; plan: string; email?: string }
  /** Legacy: opens platform settings. Kept for back-compat — clicking "Settings"
   *  in the avatar dropdown still calls this so existing pages don't break. */
  onOpenSettings?: () => void
  /** Avatar-dropdown specific actions. When provided, the rail footer renders
   *  a clickable avatar that opens the menu shown in the design reference. */
  language?: AppLanguage
  onChangeLanguage?: (l: AppLanguage) => void
  onOpenSuperAdmin?: () => void
  onOpenSkills?: () => void
  onSignOut?: () => void
  onDeleteAccount?: () => void

  // rail
  nav: RailNavItem[]
  recent: RailRecentItem[]
  onSeeAllRecent?: () => void
  onNewChat?: () => void
  onOpenCmdK?: () => void

  // top strip
  breadcrumb: string
  title: string
  onShare?: () => void

  /** When provided, replaces the messages + composer area with custom content.
   *  Used by /history and /gallery to share the rail + topstrip chrome without
   *  rendering a chat composer. */
  bodySlot?: ReactNode

  // model + mode
  models: ModelOption[]
  modelId: string
  onChangeModel: (id: string) => void
  modes: ModeOption[]
  modeId: string
  onChangeMode: (id: string) => void

  // transcript
  transcript: TranscriptMessage[]
  isStreaming?: boolean

  // composer
  inputValue: string
  onInputChange: (v: string) => void
  onSend: () => void
  toolsCount?: number
  tokenEstimate?: { tokens: number; cost: string } | null

  // ⌘K palette
  cmdkGroups?: CommandPaletteGroup[]

  // config drawer
  systemPrompt?: string
  onChangeSystemPrompt?: (v: string) => void
  temperature?: number
  onChangeTemperature?: (v: number) => void
  topP?: number
  maxTokens?: number
  onChangeMaxTokens?: (v: number) => void
  knowledgeDocs?: { name: string }[]
  toolsState?: { label: string; on: boolean }[]
  onToggleTool?: (label: string) => void

  // initial UI state (for testing parity with the reference snapshots)
  initialConfigOpen?: boolean
  initialPaletteOpen?: boolean
  initialCmdkOpen?: boolean
}

/* =====================================================================
   Component
   ===================================================================== */

export default function ChatWorkspace(props: ChatWorkspaceProps) {
  const {
    theme,
    variant = 'chip',
    onChangeTheme,
    brandName = 'Clox',
    brandVersion = '0.4',
    user,
    onOpenSettings,
    language = 'en',
    onChangeLanguage,
    onOpenSuperAdmin,
    onOpenSkills,
    onSignOut,
    onDeleteAccount,
    bodySlot,
    nav,
    recent,
    onSeeAllRecent,
    onNewChat,
    onOpenCmdK,
    breadcrumb,
    title,
    onShare,
    models,
    modelId,
    onChangeModel,
    modes,
    modeId,
    onChangeMode,
    transcript,
    isStreaming,
    inputValue,
    onInputChange,
    onSend,
    toolsCount = 0,
    tokenEstimate,
    cmdkGroups,
    systemPrompt,
    onChangeSystemPrompt,
    temperature,
    onChangeTemperature,
    topP,
    maxTokens,
    onChangeMaxTokens,
    knowledgeDocs,
    toolsState,
    onToggleTool,
    initialConfigOpen = false,
    initialPaletteOpen = false,
    initialCmdkOpen = false,
  } = props

  const p = PALETTES[theme]
  const mono = MONO_STACK
  const serif = SERIF_STACK

  const [openMenu, setOpenMenu] = useState<'mode' | 'model' | null>(null)
  const [configOpen, setConfigOpen] = useState(initialConfigOpen)
  const [cmdkOpen, setCmdkOpen] = useState(initialCmdkOpen)

  // Global shortcuts — ⌘K palette, ⌘. config, ⌘N new chat.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdkOpen(v => !v)
        onOpenCmdK?.()
      } else if (meta && e.key === '.') {
        e.preventDefault()
        setConfigOpen(v => !v)
      } else if (meta && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault()
        onNewChat?.()
      } else if (e.key === 'Escape') {
        setCmdkOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNewChat, onOpenCmdK])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: p.bg,
        color: p.ink,
        fontFamily: SANS_STACK,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <LeftRail
        p={p}
        mono={mono}
        serif={serif}
        brandName={brandName}
        brandVersion={brandVersion}
        nav={nav}
        recent={recent}
        user={user}
        onNewChat={onNewChat}
        onOpenSettings={onOpenSettings}
        onSeeAllRecent={onSeeAllRecent}
        theme={theme}
        onChangeTheme={onChangeTheme}
        language={language}
        onChangeLanguage={onChangeLanguage}
        onOpenSuperAdmin={onOpenSuperAdmin}
        onOpenSkills={onOpenSkills}
        onSignOut={onSignOut}
        onDeleteAccount={onDeleteAccount}
        onOpenCmdK={() => {
          setCmdkOpen(true)
          onOpenCmdK?.()
        }}
      />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          marginRight: configOpen ? 320 : 0,
          transition: 'margin-right .22s ease',
        }}
      >
        <TopStrip
          p={p}
          mono={mono}
          serif={serif}
          breadcrumb={breadcrumb}
          title={title}
          modeLabel={modes.find(m => m.id === modeId)?.label.toLowerCase() ?? modeId}
          modelLabel={models.find(m => m.id === modelId)?.short ?? modelId}
          onOpenConfig={() => setConfigOpen(v => !v)}
          onShare={onShare}
        />

        {bodySlot ? (
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: p.bg }}>
            {bodySlot}
          </div>
        ) : (
        <>
        <Messages
          p={p}
          mono={mono}
          serif={serif}
          transcript={transcript}
          isStreaming={isStreaming}
          userInitial={user.initial}
          userName={user.name}
        />

        {variant === 'chip' ? (
          <ComposerChip
            p={p}
            mono={mono}
            serif={serif}
            models={models}
            modes={modes}
            model={modelId}
            setModel={onChangeModel}
            mode={modeId}
            setMode={onChangeMode}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            inputValue={inputValue}
            onInputChange={onInputChange}
            onSend={onSend}
            toolsCount={toolsCount}
            tokenEstimate={tokenEstimate}
          />
        ) : (
          <ComposerSlash
            p={p}
            mono={mono}
            serif={serif}
            models={models}
            modes={modes}
            model={modelId}
            setModel={onChangeModel}
            mode={modeId}
            setMode={onChangeMode}
            inputValue={inputValue}
            onInputChange={onInputChange}
            onSend={onSend}
            tokenEstimate={tokenEstimate}
            initialPaletteOpen={initialPaletteOpen}
          />
        )}
        </>
        )}
      </main>

      <ConfigDrawer
        p={p}
        mono={mono}
        serif={serif}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        systemPrompt={systemPrompt}
        onChangeSystemPrompt={onChangeSystemPrompt}
        temperature={temperature}
        onChangeTemperature={onChangeTemperature}
        topP={topP}
        maxTokens={maxTokens}
        onChangeMaxTokens={onChangeMaxTokens}
        knowledgeDocs={knowledgeDocs}
        toolsState={toolsState}
        onToggleTool={onToggleTool}
      />

      <CommandK
        p={p}
        mono={mono}
        serif={serif}
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        groups={cmdkGroups}
      />

      {/* keyframes used inline */}
      <style jsx global>{`
        @keyframes anthologyBlink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes anthologySlideIn { from { transform: translateX(8px); opacity: 0 } to { transform: none; opacity: 1 } }
      `}</style>
    </div>
  )
}

/* =====================================================================
   Left rail
   ===================================================================== */

function LeftRail({
  p, mono, serif,
  brandName, brandVersion,
  nav, recent, user,
  onNewChat, onOpenSettings, onOpenCmdK, onSeeAllRecent,
  theme, onChangeTheme,
  language = 'en', onChangeLanguage,
  onOpenSuperAdmin, onOpenSkills, onSignOut, onDeleteAccount,
}: {
  p: Palette
  mono: string
  serif: string
  brandName: string
  brandVersion: string
  nav: RailNavItem[]
  recent: RailRecentItem[]
  user: { initial: string; name: string; plan: string; email?: string }
  onNewChat?: () => void
  onOpenSettings?: () => void
  onOpenCmdK?: () => void
  onSeeAllRecent?: () => void
  theme: PaletteKey
  onChangeTheme?: (next: PaletteKey) => void
  language?: AppLanguage
  onChangeLanguage?: (l: AppLanguage) => void
  onOpenSuperAdmin?: () => void
  onOpenSkills?: () => void
  onSignOut?: () => void
  onDeleteAccount?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <aside style={{
      width: 248, flex: '0 0 248px',
      background: p.rail,
      borderRight: `1px solid ${p.hairline}`,
      display: 'flex', flexDirection: 'column',
      fontFamily: SANS_STACK,
      color: p.ink,
    }}>
      {/* brand */}
      <div style={{
        padding: '16px 18px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: serif, fontSize: 19, fontStyle: 'italic', letterSpacing: '-0.01em' }}>{brandName}</span>
          <span style={{ fontFamily: mono, fontSize: 9.5, color: p.inkMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{brandVersion}</span>
        </div>
        <button title="New chat (⌘N)" onClick={onNewChat} style={iconBtn(p)}>
          {I.plus}
        </button>
      </div>

      {/* search / cmd-k */}
      <div style={{ padding: '4px 14px 10px' }}>
        <button onClick={onOpenCmdK} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px',
          background: p.railSoft,
          border: `1px solid ${p.hairlineSoft}`,
          borderRadius: 2,
          fontFamily: mono, fontSize: 11, color: p.inkMuted,
          width: '100%', textAlign: 'left', cursor: 'pointer',
        }}>
          {I.search}
          <span style={{ flex: 1 }}>search & jump</span>
          <span style={{ color: p.inkMuted, opacity: 0.8 }}>⌘K</span>
        </button>
      </div>

      {/* primary nav */}
      <nav style={{ padding: '4px 8px 8px' }}>
        {nav.map(n => (
          <button
            key={n.id}
            onClick={n.onClick}
            style={{
              display: 'flex', width: '100%', alignItems: 'center', gap: 10,
              padding: '7px 10px',
              background: n.active ? p.bg : 'transparent',
              border: 'none', borderRadius: 2,
              color: p.ink, cursor: 'pointer',
              fontFamily: SANS_STACK, fontSize: 13,
              fontWeight: n.active ? 500 : 400,
              position: 'relative', textAlign: 'left',
            }}
          >
            {n.active && <span style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 2, background: p.ink }} />}
            <span style={{ color: n.active ? p.ink : p.inkSoft, display: 'inline-flex' }}>{n.icon}</span>
            <span style={{ flex: 1 }}>{n.label}</span>
            {n.count != null && (
              <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em' }}>{n.count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* recent threads */}
      <div style={{ flex: 1, overflow: 'auto', borderTop: `1px solid ${p.hairlineSoft}`, paddingTop: 6 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px 6px',
        }}>
          <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.inkMuted }}>recent</span>
          <button
            onClick={onSeeAllRecent}
            style={{ background: 'none', border: 'none', padding: 0, fontFamily: mono, fontSize: 9.5, color: p.inkMuted, letterSpacing: '0.06em', cursor: 'pointer' }}
          >
            see all →
          </button>
        </div>
        <div>
          {recent.map(it => (
            <button
              key={it.id}
              onClick={it.onClick}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 18px',
                background: it.active ? p.bg : 'transparent',
                border: 'none',
                color: p.ink, cursor: 'pointer',
                fontFamily: SANS_STACK,
                position: 'relative',
              }}
            >
              {it.active && <span style={{ position: 'absolute', left: 0, top: 7, bottom: 7, width: 2, background: p.ink }} />}
              <div style={{ fontSize: 12.5, lineHeight: 1.3, fontWeight: it.active ? 500 : 400, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{it.title}</div>
              <div style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, marginTop: 2, letterSpacing: '0.04em' }}>{it.meta}</div>
            </button>
          ))}
          {recent.length === 0 && (
            <div style={{ padding: '10px 18px', fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em' }}>
              no recent threads — press ⌘N
            </div>
          )}
        </div>
      </div>

      {/* footer — user (clickable, opens avatar dropdown) */}
      <div style={{ position: 'relative' }}>
        {menuOpen && (
          <UserMenu
            p={p}
            mono={mono}
            theme={theme}
            onChangeTheme={onChangeTheme}
            language={language}
            onChangeLanguage={onChangeLanguage}
            onOpenSettings={onOpenSettings}
            onOpenSuperAdmin={onOpenSuperAdmin}
            onOpenSkills={onOpenSkills}
            onSignOut={onSignOut}
            onDeleteAccount={onDeleteAccount}
            onClose={() => setMenuOpen(false)}
          />
        )}
        <button
          onClick={() => setMenuOpen(v => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderTop: `1px solid ${p.hairlineSoft}`,
            background: menuOpen ? p.railSoft : 'transparent',
            border: 'none', borderTopColor: p.hairlineSoft,
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', color: 'inherit', textAlign: 'left',
            transition: 'background .15s',
          }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: p.ink, color: p.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: serif, fontStyle: 'italic', fontSize: 13,
            flex: '0 0 26px',
          }}>{user.initial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.2, color: p.ink, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.name}</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em' }}>{user.plan}</div>
          </div>
          <span style={{ color: p.inkMuted, transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', display: 'inline-flex' }}>{I.caret}</span>
        </button>
      </div>
    </aside>
  )
}

/* =====================================================================
   User dropdown — avatar menu
   ===================================================================== */

const NEXT_THEME: Record<PaletteKey, PaletteKey> = {
  light: 'dark',
  pearl: 'dark',
  pearlLight: 'dark',
  pearlNeutral: 'dark',
  linen: 'dark',
  mist: 'dark',
  slate: 'dark',
  frost: 'dark',
  dark: 'pearl',
}

function UserMenu({
  p, mono,
  theme, onChangeTheme,
  language, onChangeLanguage,
  onOpenSettings, onOpenSuperAdmin, onOpenSkills, onSignOut, onDeleteAccount,
  onClose,
}: {
  p: Palette
  mono: string
  theme: PaletteKey
  onChangeTheme?: (next: PaletteKey) => void
  language: AppLanguage
  onChangeLanguage?: (l: AppLanguage) => void
  onOpenSettings?: () => void
  onOpenSuperAdmin?: () => void
  onOpenSkills?: () => void
  onSignOut?: () => void
  onDeleteAccount?: () => void
  onClose: () => void
}) {
  // Click-outside + Escape close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    function onDocClick(e: MouseEvent) {
      const tgt = e.target as HTMLElement
      if (!tgt.closest?.('[data-clox-user-menu]') && !tgt.closest?.('[aria-haspopup="menu"]')) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDocClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDocClick)
    }
  }, [onClose])

  const isDark = theme === 'dark'

  return (
    <div
      data-clox-user-menu
      role="menu"
      style={{
        position: 'absolute', bottom: 'calc(100% + 6px)', left: 10, right: 10,
        background: p.surface,
        border: `1px solid ${p.hairline}`,
        borderRadius: 4,
        boxShadow: `0 18px 56px ${isDark ? 'rgba(0,0,0,.55)' : 'rgba(22,20,16,.14)'}`,
        padding: '6px 0',
        fontFamily: SANS_STACK,
        zIndex: 60,
      }}
    >
      <UserMenuRow
        p={p} icon={I.user} label="Settings"
        onClick={() => { onOpenSettings?.(); onClose() }}
      />
      <UserMenuRow
        p={p} icon={I.lang} label="Language"
        right={
          <div style={{
            display: 'inline-flex', border: `1px solid ${p.hairline}`,
            borderRadius: 999, overflow: 'hidden',
            fontFamily: mono, fontSize: 10.5, letterSpacing: '0.06em',
          }}>
            {(['en', 'ru'] as const).map(lng => (
              <button
                key={lng}
                onClick={(e) => { e.stopPropagation(); onChangeLanguage?.(lng) }}
                style={{
                  padding: '3px 10px',
                  background: language === lng ? p.ink : 'transparent',
                  color: language === lng ? p.bg : p.inkSoft,
                  border: 'none', cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >{lng}</button>
            ))}
          </div>
        }
      />
      <UserMenuRow
        p={p} icon={isDark ? I.sun : I.moon} label="Theme"
        right={
          <button
            onClick={(e) => {
              e.stopPropagation()
              onChangeTheme?.(NEXT_THEME[theme] ?? (isDark ? 'pearl' : 'dark'))
            }}
            title={isDark ? 'Switch to light' : 'Switch to dark'}
            style={{
              width: 26, height: 26, borderRadius: 999,
              background: isDark ? p.bg : p.ink,
              color: isDark ? p.ink : p.bg,
              border: `1px solid ${p.hairline}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
            }}
          >{isDark ? I.sun : I.moon}</button>
        }
      />

      <div style={{ height: 1, background: p.hairlineSoft, margin: '6px 12px' }} />

      <UserMenuRow
        p={p} icon={I.shield} label="Super Admin"
        onClick={() => { onOpenSuperAdmin?.(); onClose() }}
      />
      <UserMenuRow
        p={p} icon={I.bulb} label="Skills"
        onClick={() => { onOpenSkills?.(); onClose() }}
      />

      <div style={{ height: 1, background: p.hairlineSoft, margin: '6px 12px' }} />

      <UserMenuRow
        p={p} icon={I.door} label="Sign out"
        onClick={() => { onSignOut?.(); onClose() }}
      />
      <UserMenuRow
        p={p} icon={I.trash} label="Delete account" muted
        onClick={() => { onDeleteAccount?.(); onClose() }}
      />
    </div>
  )
}

function UserMenuRow({
  p, icon, label, right, onClick, muted,
}: {
  p: Palette
  icon: ReactNode
  label: string
  right?: ReactNode
  onClick?: () => void
  muted?: boolean
}) {
  const interactive = Boolean(onClick)
  const Cmp: keyof JSX.IntrinsicElements = interactive ? 'button' : 'div'
  return (
    <Cmp
      role={interactive ? 'menuitem' : undefined}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '8px 14px',
        background: 'transparent',
        border: 'none', borderRadius: 0,
        color: muted ? p.inkMuted : p.ink,
        cursor: interactive ? 'pointer' : 'default',
        textAlign: 'left',
        fontSize: 13, fontFamily: SANS_STACK,
      }}
      onMouseEnter={interactive ? (e) => { (e.currentTarget as HTMLElement).style.background = p.surfaceAlt } : undefined}
      onMouseLeave={interactive ? (e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' } : undefined}
    >
      <span style={{ display: 'inline-flex', color: muted ? p.inkMuted : p.inkSoft, width: 14, justifyContent: 'center' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {right}
    </Cmp>
  )
}

/* =====================================================================
   Top strip
   ===================================================================== */

function TopStrip({
  p, mono, serif, breadcrumb, title, modeLabel, modelLabel,
  onShare, onOpenConfig,
}: {
  p: Palette
  mono: string
  serif: string
  breadcrumb: string
  title: string
  modeLabel: string
  modelLabel: string
  onShare?: () => void
  onOpenConfig: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 32px',
      borderBottom: `1px solid ${p.hairlineSoft}`,
      fontFamily: SANS_STACK,
      color: p.ink,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.16em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{breadcrumb}</span>
        <span style={{ color: p.inkMuted }}>/</span>
        <span style={{ fontFamily: serif, fontSize: 17, fontStyle: 'italic', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em' }}>
          {modeLabel} · {modelLabel}
        </span>
        <span style={{ width: 1, height: 12, background: p.hairline, margin: '0 6px' }} />
        <button onClick={onShare} style={iconBtn(p)} title="Share">{I.share}</button>
        <button onClick={onOpenConfig} style={iconBtn(p)} title="Configure (⌘.)">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 3.5h9M2 6.5h9M2 9.5h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            <circle cx="9" cy="9.5" r="1.4" fill={p.bg} stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* =====================================================================
   Messages
   ===================================================================== */

function Messages({
  p, mono, serif, transcript, isStreaming, userInitial, userName,
}: {
  p: Palette
  mono: string
  serif: string
  transcript: TranscriptMessage[]
  isStreaming?: boolean
  userInitial: string
  userName: string
}) {
  const endRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [transcript.length, isStreaming])

  return (
    <div style={{
      flex: 1, overflow: 'auto',
      padding: '24px 56px 18px',
      fontFamily: SANS_STACK,
      color: p.ink,
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {transcript.length === 0 && !isStreaming && (
          <div style={{ padding: '64px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.inkMuted, marginBottom: 14 }}>begin</div>
            <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.01em', color: p.ink, maxWidth: 520, margin: '0 auto' }}>
              Ask, draft, or paste a passage to refine.
            </div>
            <div style={{ marginTop: 16, fontFamily: mono, fontSize: 11, color: p.inkMuted, letterSpacing: '0.04em' }}>
              press <kbd style={kbdStyle(p, mono)}>⌘K</kbd> to jump · <kbd style={kbdStyle(p, mono)}>⌘.</kbd> to configure
            </div>
          </div>
        )}

        {transcript.map(m => (
          m.who === 'you'
            ? <YouMsg key={m.id} p={p} mono={mono} m={m} userInitial={userInitial} userName={userName} />
            : <AiMsg  key={m.id} p={p} mono={mono} serif={serif} m={m} />
        ))}

        {isStreaming && <ThinkingIndicator p={p} mono={mono} serif={serif} />}
        <div ref={endRef} />
      </div>
    </div>
  )
}

/* =====================================================================
   Thinking indicator — walks through phases while the assistant streams
   ("understanding → reasoning → drafting → composing"). Each phase advances
   on a timer so the user sees real progress instead of a static "composing".
   ===================================================================== */

const THINKING_PHASES = [
  { label: 'understanding', dwell: 1200 },
  { label: 'reasoning',     dwell: 1700 },
  { label: 'drafting',      dwell: 1700 },
  { label: 'composing',     dwell: Infinity },
]

function ThinkingIndicator({ p, mono, serif }: { p: Palette; mono: string; serif: string }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (phase >= THINKING_PHASES.length - 1) return
    const t = window.setTimeout(() => setPhase(i => i + 1), THINKING_PHASES[phase].dwell)
    return () => window.clearTimeout(t)
  }, [phase])

  const label = THINKING_PHASES[phase]?.label ?? 'composing'

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{
        width: 28, height: 28, flex: '0 0 28px',
        border: `1px solid ${p.ink}`, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: serif, fontStyle: 'italic', fontSize: 14, color: p.ink,
      }}>C</div>
      <div style={{ paddingTop: 6 }}>
        <div style={{
          fontFamily: mono, fontSize: 10.5, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: p.inkMuted, marginBottom: 4,
        }}>
          clox · status
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            key={label}
            style={{
              fontFamily: serif, fontStyle: 'italic', fontSize: 16,
              color: p.ink,
              animation: 'cloxPhaseFade .4s ease-out',
            }}
          >{label}</span>
          <span style={{ display: 'inline-flex', gap: 3 }} aria-hidden>
            <Dot p={p} delay={0} />
            <Dot p={p} delay={0.18} />
            <Dot p={p} delay={0.36} />
          </span>
        </div>
      </div>
      <style jsx>{`
        @keyframes cloxPhaseFade {
          0% { opacity: 0; transform: translateY(2px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes cloxThinkPulse {
          0%, 80%, 100% { opacity: .25; transform: scale(.85); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

function Dot({ p, delay }: { p: Palette; delay: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 4, height: 4, borderRadius: '50%',
        background: p.ink,
        animation: `cloxThinkPulse 1.1s ease-in-out ${delay}s infinite`,
      }}
    />
  )
}

function YouMsg({
  p, mono, m, userName,
}: { p: Palette; mono: string; m: TranscriptMessage; userInitial: string; userName: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ maxWidth: '78%' }}>
        <div style={{
          fontFamily: mono, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: p.inkMuted, marginBottom: 6, textAlign: 'right',
        }}>
          <span style={{ color: p.ink }}>{userName.toLowerCase().split(' ')[0]}</span>&nbsp;·&nbsp;<span>{m.time}</span>
        </div>
        <div style={{
          background: p.youBg, color: p.youFg,
          padding: '12px 16px', borderRadius: 3,
          fontSize: 14, lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
        }}>
          {m.body}
        </div>
      </div>
    </div>
  )
}

function AiMsg({
  p, mono, serif, m,
}: { p: Palette; mono: string; serif: string; m: TranscriptMessage }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{
        width: 28, height: 28, flex: '0 0 28px',
        border: `1px solid ${p.ink}`, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: serif, fontStyle: 'italic', fontSize: 14, color: p.ink,
        marginTop: 18,
      }}>C</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: mono, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: p.inkMuted, marginBottom: 6,
        }}>
          <span style={{ color: p.accent }}>clox</span>&nbsp;·&nbsp;<span>{m.model}</span>&nbsp;·&nbsp;<span>{m.time}</span>
        </div>
        <div style={
          m.isPullquote
            ? {
                fontFamily: serif, fontStyle: 'italic', fontSize: 17, lineHeight: 1.5,
                color: p.ink, paddingLeft: 14, borderLeft: `2px solid ${p.ink}`, marginTop: 2,
              }
            : {
                fontSize: 14.5, lineHeight: 1.65, color: p.ink,
                background: p.aiBg, padding: '12px 16px', borderRadius: 3,
                border: `1px solid ${p.hairlineSoft}`,
              }
        }>
          {m.body}
        </div>
      </div>
    </div>
  )
}

/* =====================================================================
   Composer · variant A: chip cluster
   ===================================================================== */

function ComposerChip({
  p, mono, serif, models, modes, model, setModel, mode, setMode, openMenu, setOpenMenu,
  inputValue, onInputChange, onSend, toolsCount, tokenEstimate,
}: {
  p: Palette
  mono: string
  serif: string
  models: ModelOption[]
  modes: ModeOption[]
  model: string
  setModel: (id: string) => void
  mode: string
  setMode: (id: string) => void
  openMenu: 'mode' | 'model' | null
  setOpenMenu: (v: 'mode' | 'model' | null) => void
  inputValue: string
  onInputChange: (v: string) => void
  onSend: () => void
  toolsCount: number
  tokenEstimate?: { tokens: number; cost: string } | null
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const [showSlash, setShowSlash] = useState(false)

  // auto-grow
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [inputValue])

  // Auto-open the slash palette when the user types `/` as the first character
  // (mirrors the slash-composer reference). Closing happens on selection or Esc.
  useEffect(() => {
    if (inputValue === '/') setShowSlash(true)
    else if (inputValue.length === 0) setShowSlash(false)
  }, [inputValue])

  const modelLabel = models.find(m => m.id === model)?.short ?? model
  const modeLabel = modes.find(m => m.id === mode)?.label.toLowerCase() ?? mode

  return (
    <div style={{
      borderTop: `1px solid ${p.hairlineSoft}`,
      padding: '18px 56px 22px',
      background: p.bg,
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{
          background: p.surface,
          border: `1px solid ${showSlash ? p.ink : p.hairline}`,
          borderRadius: 4,
          position: 'relative',
          transition: 'border-color .15s',
        }}>
          {/* chip row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 12px 0',
            flexWrap: 'wrap',
          }}>
            <Chip p={p} mono={mono} active={openMenu === 'mode'} onClick={() => setOpenMenu(openMenu === 'mode' ? null : 'mode')}>
              <span style={{ color: p.inkMuted, marginRight: 6 }}>mode</span>
              <span style={{ color: p.ink }}>{modeLabel}</span>
              <span style={{ marginLeft: 4, display: 'inline-flex' }}>{I.caret}</span>
            </Chip>
            <Chip p={p} mono={mono} active={openMenu === 'model'} onClick={() => setOpenMenu(openMenu === 'model' ? null : 'model')}>
              <span style={{ color: p.inkMuted, marginRight: 6 }}>model</span>
              <span style={{ color: p.ink }}>{modelLabel}</span>
              <span style={{ marginLeft: 4, display: 'inline-flex' }}>{I.caret}</span>
            </Chip>
            <Chip p={p} mono={mono}>
              <span style={{ color: p.inkMuted, marginRight: 6 }}>tools</span>
              <span style={{ color: p.ink }}>{toolsCount}</span>
            </Chip>
            <Chip p={p} mono={mono}>
              <span style={{ display: 'inline-flex', marginRight: 5 }}>{I.attach}</span>
              <span style={{ color: p.ink }}>attach</span>
            </Chip>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em' }}>⌘.&nbsp;config</span>
          </div>

          {/* textarea + voice + send */}
          <div style={{ display: 'flex', alignItems: 'flex-end', padding: '10px 14px 12px', gap: 8 }}>
            <textarea
              ref={taRef}
              value={inputValue}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSend()
                }
              }}
              rows={1}
              placeholder="A line. A draft. A question. Anything."
              style={{
                flex: 1,
                fontFamily: SANS_STACK, fontSize: 14.5, lineHeight: 1.55,
                color: p.ink, minHeight: 44, maxHeight: 200, resize: 'none',
                background: 'transparent', border: 'none', outline: 'none',
              }}
            />
            <button title="Voice input" style={{ ...iconBtn(p, 34), border: `1px solid ${p.hairline}`, color: p.ink }}>
              {I.mic}
            </button>
            <button onClick={onSend} disabled={!inputValue.trim()} style={{
              padding: '8px 14px',
              background: p.ink, color: p.bg,
              border: 'none', borderRadius: 2,
              fontFamily: mono, fontSize: 11, letterSpacing: '0.06em',
              textTransform: 'uppercase', cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
              opacity: inputValue.trim() ? 1 : 0.4,
              display: 'inline-flex', alignItems: 'center', gap: 7,
              height: 34,
            }}>
              send
              <span style={{ opacity: 0.6 }}>⏎</span>
            </button>
          </div>

          {openMenu === 'model' && (
            <ModelMenu p={p} mono={mono} serif={serif} models={models} model={model} setModel={id => { setModel(id); setOpenMenu(null) }} left={68} />
          )}
          {openMenu === 'mode' && (
            <ModeMenu p={p} mono={mono} modes={modes} mode={mode} setMode={id => { setMode(id); setOpenMenu(null) }} left={12} />
          )}

          {/* Slash palette — opens when the user types `/` as the first
              character. Picking any item replaces the input and closes. */}
          {showSlash && (
            <SlashPalette
              p={p} mono={mono} serif={serif}
              models={models} modes={modes}
              model={model}
              setModel={id => { setModel(id); setShowSlash(false); onInputChange('') }}
              mode={mode}
              setMode={id => { setMode(id); setShowSlash(false); onInputChange('') }}
              onClose={() => { setShowSlash(false); if (inputValue === '/') onInputChange('') }}
            />
          )}
        </div>

        <div style={{
          marginTop: 10, display: 'flex', justifyContent: 'space-between',
          fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em',
        }}>
          <span>shift + ⏎  newline</span>
          {tokenEstimate && <span>{tokenEstimate.tokens.toLocaleString()} tokens · {tokenEstimate.cost}</span>}
        </div>
      </div>
    </div>
  )
}

function Chip({ p, mono, children, active, onClick }: {
  p: Palette
  mono: string
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '4px 9px',
        background: active ? p.surfaceAlt : 'transparent',
        border: `1px solid ${active ? p.hairline : p.hairlineSoft}`,
        borderRadius: 2,
        fontFamily: mono, fontSize: 11, letterSpacing: '0.02em',
        cursor: 'pointer', color: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

function ModelMenu({ p, mono, serif, models, model, setModel, left = 12 }: {
  p: Palette; mono: string; serif: string
  models: ModelOption[]; model: string; setModel: (id: string) => void; left?: number
}) {
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 6px)', left,
      width: 280, background: p.surface,
      border: `1px solid ${p.hairline}`, borderRadius: 3,
      boxShadow: `0 12px 40px ${p.bg === '#14130E' ? 'rgba(0,0,0,.45)' : 'rgba(22,20,16,.10)'}`,
      padding: '6px 0', zIndex: 10, maxHeight: 320, overflow: 'auto',
    }}>
      <div style={{ padding: '8px 14px 4px', fontFamily: mono, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.inkMuted }}>select model</div>
      {models.map(m => (
        <button key={m.id} onClick={() => setModel(m.id)} style={{
          display: 'block', width: '100%', textAlign: 'left',
          padding: '8px 14px',
          background: model === m.id ? p.surfaceAlt : 'transparent',
          border: 'none', cursor: 'pointer', color: p.ink,
          fontFamily: SANS_STACK,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 14 }}>{m.label}</span>
            {model === m.id && <span style={{ fontFamily: mono, fontSize: 10, color: p.accent }}>active</span>}
          </div>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: p.inkMuted, marginTop: 2, letterSpacing: '0.04em' }}>{m.tag}</div>
        </button>
      ))}
    </div>
  )
}

function ModeMenu({ p, mono, modes, mode, setMode, left = 12 }: {
  p: Palette; mono: string
  modes: ModeOption[]; mode: string; setMode: (id: string) => void; left?: number
}) {
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 6px)', left,
      width: 240, background: p.surface,
      border: `1px solid ${p.hairline}`, borderRadius: 3,
      boxShadow: `0 12px 40px ${p.bg === '#14130E' ? 'rgba(0,0,0,.45)' : 'rgba(22,20,16,.10)'}`,
      padding: '6px 0', zIndex: 10,
    }}>
      <div style={{ padding: '8px 14px 4px', fontFamily: mono, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.inkMuted }}>generation mode</div>
      {modes.map(m => (
        <button key={m.id} onClick={() => setMode(m.id)} style={{
          display: 'block', width: '100%', textAlign: 'left',
          padding: '7px 14px',
          background: mode === m.id ? p.surfaceAlt : 'transparent',
          border: 'none', cursor: 'pointer', color: p.ink,
          fontFamily: SANS_STACK,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13 }}>{m.label}</span>
            <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted }}>{m.hint}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

/* =====================================================================
   Composer · variant B: slash composer
   ===================================================================== */

function ComposerSlash({
  p, mono, serif, models, modes, model, setModel, mode, setMode,
  inputValue, onInputChange, onSend, tokenEstimate, initialPaletteOpen,
}: {
  p: Palette; mono: string; serif: string
  models: ModelOption[]; modes: ModeOption[]
  model: string; setModel: (id: string) => void
  mode: string; setMode: (id: string) => void
  inputValue: string; onInputChange: (v: string) => void; onSend: () => void
  tokenEstimate?: { tokens: number; cost: string } | null
  initialPaletteOpen?: boolean
}) {
  const [showPalette, setShowPalette] = useState(initialPaletteOpen ?? false)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'
  }, [inputValue])

  // Auto-open palette when user types `/` as the first character.
  useEffect(() => {
    if (inputValue === '/') setShowPalette(true)
  }, [inputValue])

  const modelLabel = models.find(m => m.id === model)?.short ?? model
  const modeLabel = modes.find(m => m.id === mode)?.label.toLowerCase() ?? mode

  return (
    <div style={{
      borderTop: `1px solid ${p.hairlineSoft}`,
      padding: '20px 56px 24px',
      background: p.bg,
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: mono, fontSize: 10.5, color: p.inkMuted, letterSpacing: '0.06em',
          marginBottom: 8, padding: '0 4px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: p.ink }}>{modeLabel}</span><span>·</span>
            <span style={{ color: p.ink }}>{modelLabel}</span><span>·</span>
            <span>{0} tools</span>
          </div>
          <span>type&nbsp;<kbd style={kbdStyle(p, mono)}>/</kbd>&nbsp;to change</span>
        </div>

        <div style={{
          background: p.surface,
          border: `1px solid ${showPalette ? p.ink : p.hairline}`,
          borderRadius: 3,
          transition: 'border-color .15s',
          position: 'relative',
        }}>
          <textarea
            ref={taRef}
            value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            rows={1}
            placeholder="A line. A draft. A question. Anything."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '16px 18px 50px',
              fontFamily: serif, fontSize: 18, fontStyle: 'italic', lineHeight: 1.5,
              color: p.ink, minHeight: 70, maxHeight: 220, resize: 'none',
              background: 'transparent', border: 'none', outline: 'none',
              letterSpacing: '-0.005em',
            }}
          />

          <div style={{
            position: 'absolute', right: 12, bottom: 10, left: 12,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <button onClick={() => setShowPalette(v => !v)} style={{
              ...iconBtn(p, 28),
              borderColor: showPalette ? p.ink : p.hairlineSoft,
              color: showPalette ? p.ink : p.inkSoft,
            }} title="Command palette (/)">
              <span style={{ fontFamily: mono, fontSize: 12 }}>/</span>
            </button>
            <button title="Attach" style={iconBtn(p, 28)}>{I.attach}</button>
            <div style={{ flex: 1 }} />
            <button title="Voice input" style={iconBtn(p, 28)}>{I.mic}</button>
            <button onClick={onSend} disabled={!inputValue.trim()} style={{
              padding: '6px 12px',
              background: p.ink, color: p.bg,
              border: 'none', borderRadius: 2,
              fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
              opacity: inputValue.trim() ? 1 : 0.4,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 28,
            }}>↑ send</button>
          </div>

          {showPalette && (
            <SlashPalette
              p={p} mono={mono} serif={serif}
              models={models} modes={modes}
              model={model} setModel={id => { setModel(id); setShowPalette(false) }}
              mode={mode} setMode={id => { setMode(id); setShowPalette(false) }}
            />
          )}
        </div>

        <div style={{
          marginTop: 10, display: 'flex', justifyContent: 'space-between',
          fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em',
        }}>
          {tokenEstimate ? <span>{tokenEstimate.tokens.toLocaleString()} tokens · {tokenEstimate.cost}</span> : <span />}
          <span>⌘. &nbsp;configure</span>
        </div>
      </div>
    </div>
  )
}

function kbdStyle(p: Palette, mono: string): CSSProperties {
  return {
    fontFamily: mono, fontSize: 10,
    padding: '1px 5px',
    border: `1px solid ${p.hairline}`,
    borderRadius: 2, color: p.ink,
    background: p.surface,
  }
}

function SlashPalette({
  p, mono, serif, models, modes, model, setModel, mode, setMode, onClose,
}: {
  p: Palette; mono: string; serif: string
  models: ModelOption[]; modes: ModeOption[]
  model: string; setModel: (id: string) => void
  mode: string; setMode: (id: string) => void
  onClose?: () => void
}) {
  // Escape closes the palette + click-outside (chip-composer wraps it in a
  // relatively-positioned anchor, so we hook into document listeners).
  useEffect(() => {
    if (!onClose) return
    const close = onClose
    function key(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    function clk(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (!t.closest?.('[data-clox-slash-palette]')) close()
    }
    window.addEventListener('keydown', key)
    document.addEventListener('mousedown', clk)
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('mousedown', clk) }
  }, [onClose])
  type Item =
    | { kind: 'header'; label: string }
    | { kind: 'mode'; id: string; label: string; hint: string; active: boolean }
    | { kind: 'model'; id: string; label: string; tag: string; short: string; active: boolean }
    | { kind: 'tool'; label: string; hint: string }

  const items: Item[] = useMemo(() => {
    const list: Item[] = []
    list.push({ kind: 'header', label: 'mode' })
    modes.forEach(m => list.push({ kind: 'mode', id: m.id, label: m.label, hint: m.hint, active: mode === m.id }))
    list.push({ kind: 'header', label: 'model' })
    models.forEach(m => list.push({ kind: 'model', id: m.id, label: m.label, tag: m.tag, short: m.short, active: model === m.id }))
    list.push({ kind: 'header', label: 'tools' })
    list.push({ kind: 'tool', label: 'attach file', hint: '⌘U' })
    list.push({ kind: 'tool', label: 'web search', hint: 'on' })
    list.push({ kind: 'tool', label: 'code execute', hint: 'on' })
    list.push({ kind: 'tool', label: 'voice input', hint: '⌘\\' })
    return list
  }, [models, modes, model, mode])

  return (
    <div data-clox-slash-palette style={{
      position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0,
      background: p.surface,
      border: `1px solid ${p.hairline}`, borderRadius: 3,
      boxShadow: `0 18px 56px ${p.bg === '#14130E' ? 'rgba(0,0,0,.55)' : 'rgba(22,20,16,.12)'}`,
      maxHeight: 360, overflow: 'auto',
      padding: '6px 0',
      fontFamily: SANS_STACK,
      zIndex: 12,
    }}>
      {items.map((it, i) => {
        if (it.kind === 'header') {
          return (
            <div key={i} style={{
              padding: '10px 16px 4px',
              fontFamily: mono, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: p.inkMuted,
              borderTop: i > 0 ? `1px solid ${p.hairlineSoft}` : 'none',
              marginTop: i > 0 ? 4 : 0,
            }}>{it.label}</div>
          )
        }
        if (it.kind === 'model') {
          return (
            <button key={i} onClick={() => setModel(it.id)} style={{
              display: 'flex', width: '100%', alignItems: 'baseline', justifyContent: 'space-between',
              padding: '6px 16px',
              background: it.active ? p.surfaceAlt : 'transparent',
              border: 'none', cursor: 'pointer', color: p.ink, textAlign: 'left',
            }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 14 }}>{it.label}</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em' }}>{it.tag}</span>
              </span>
              {it.active && <span style={{ fontFamily: mono, fontSize: 10, color: p.accent, letterSpacing: '0.06em' }}>● active</span>}
            </button>
          )
        }
        if (it.kind === 'mode') {
          return (
            <button key={i} onClick={() => setMode(it.id)} style={{
              display: 'flex', width: '100%', alignItems: 'baseline', justifyContent: 'space-between',
              padding: '5px 16px',
              background: it.active ? p.surfaceAlt : 'transparent',
              border: 'none', cursor: 'pointer', color: p.ink, textAlign: 'left',
            }}>
              <span style={{ fontSize: 13 }}>{it.label}</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted }}>{it.hint}</span>
            </button>
          )
        }
        return (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '5px 16px', fontSize: 13, color: p.ink,
          }}>
            <span>{it.label}</span>
            <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted }}>{it.hint}</span>
          </div>
        )
      })}
    </div>
  )
}

/* =====================================================================
   ⌘K palette
   ===================================================================== */

function CommandK({
  p, mono, serif, open, onClose, groups,
}: {
  p: Palette; mono: string; serif: string
  open: boolean; onClose: () => void
  groups?: CommandPaletteGroup[]
}) {
  if (!open) return null
  const list = groups ?? []

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: p.bg === '#14130E' ? 'rgba(0,0,0,0.45)' : 'rgba(22,20,16,0.22)',
        display: 'flex', justifyContent: 'center', paddingTop: 96,
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{
        width: 580, maxHeight: '70vh',
        background: p.surface,
        border: `1px solid ${p.hairline}`,
        borderRadius: 4,
        boxShadow: `0 24px 80px ${p.bg === '#14130E' ? 'rgba(0,0,0,.6)' : 'rgba(22,20,16,.18)'}`,
        display: 'flex', flexDirection: 'column',
        fontFamily: SANS_STACK, color: p.ink,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px',
          borderBottom: `1px solid ${p.hairlineSoft}`,
        }}>
          <span style={{ color: p.inkMuted }}>{I.search}</span>
          <span style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 18, color: p.ink, flex: 1 }}>
            search workspace
            <span style={{ display: 'inline-block', width: 1, height: '1em', background: p.ink, marginLeft: 2, verticalAlign: '-0.18em', animation: 'anthologyBlink 1s steps(2) infinite' }} />
          </span>
          <kbd style={kbdStyle(p, mono)}>esc</kbd>
        </div>

        <div style={{ overflow: 'auto', padding: '4px 0 8px' }}>
          {list.map((g, gi) => (
            <div key={gi}>
              <div style={{
                padding: '10px 18px 4px',
                fontFamily: mono, fontSize: 9.5, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: p.inkMuted,
                borderTop: gi > 0 ? `1px solid ${p.hairlineSoft}` : 'none',
                marginTop: gi > 0 ? 4 : 0,
              }}>{g.label}</div>
              {g.items.map((it, i) => (
                <button key={i} onClick={() => { it.onSelect?.(); onClose() }} style={{
                  display: 'flex', width: '100%', alignItems: 'center', gap: 12,
                  padding: '7px 18px',
                  background: gi === 0 && i === 0 ? p.surfaceAlt : 'transparent',
                  border: 'none', cursor: 'pointer', color: p.ink, textAlign: 'left',
                }}>
                  {it.icon && <span style={{ color: p.inkSoft, display: 'inline-flex' }}>{it.icon}</span>}
                  <span style={{ flex: 1, fontSize: 13.5 }}>{it.label}</span>
                  {it.hint && <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em' }}>{it.hint}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{
          padding: '9px 18px',
          borderTop: `1px solid ${p.hairlineSoft}`,
          display: 'flex', alignItems: 'center', gap: 14,
          fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em',
        }}>
          <span><kbd style={kbdStyle(p, mono)}>↑</kbd>&nbsp;<kbd style={kbdStyle(p, mono)}>↓</kbd>&nbsp;navigate</span>
          <span><kbd style={kbdStyle(p, mono)}>⏎</kbd>&nbsp;open</span>
          <span><kbd style={kbdStyle(p, mono)}>⌘⏎</kbd>&nbsp;new tab</span>
          <span style={{ flex: 1 }} />
          <span>clox · ⌘K</span>
        </div>
      </div>
    </div>
  )
}

/* =====================================================================
   Config drawer
   ===================================================================== */

function ConfigDrawer({
  p, mono, serif, open, onClose,
  systemPrompt, onChangeSystemPrompt,
  temperature, onChangeTemperature,
  topP,
  maxTokens, onChangeMaxTokens,
  knowledgeDocs, toolsState, onToggleTool,
}: {
  p: Palette; mono: string; serif: string
  open: boolean; onClose: () => void
  systemPrompt?: string; onChangeSystemPrompt?: (v: string) => void
  temperature?: number; onChangeTemperature?: (v: number) => void
  topP?: number
  maxTokens?: number; onChangeMaxTokens?: (v: number) => void
  knowledgeDocs?: { name: string }[]
  toolsState?: { label: string; on: boolean }[]
  onToggleTool?: (label: string) => void
}) {
  if (!open) return null
  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 320,
      background: p.surface,
      borderLeft: `1px solid ${p.hairline}`,
      padding: '20px 22px',
      overflow: 'auto',
      fontFamily: SANS_STACK,
      color: p.ink,
      animation: 'anthologySlideIn .22s ease',
      zIndex: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: serif, fontSize: 17, fontStyle: 'italic' }}>Configure</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>⌘.</span>
        </div>
        <button onClick={onClose} style={iconBtn(p)} title="Close">{I.close}</button>
      </div>

      <Section p={p} mono={mono} title="System prompt">
        <textarea
          value={systemPrompt ?? ''}
          onChange={e => onChangeSystemPrompt?.(e.target.value)}
          placeholder="You are a thoughtful editor…"
          style={{
            fontFamily: serif, fontSize: 13.5, fontStyle: 'italic', lineHeight: 1.55,
            padding: '10px 12px', border: `1px solid ${p.hairlineSoft}`, borderRadius: 2,
            color: p.inkSoft, background: p.bg,
            width: '100%', minHeight: 84, resize: 'vertical', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </Section>

      <Section p={p} mono={mono} title="Parameters">
        <Param p={p} mono={mono} k="temperature" v={temperature?.toFixed(2) ?? '—'}>
          <input
            type="range" min={0} max={2} step={0.1}
            value={temperature ?? 0.7}
            onChange={e => onChangeTemperature?.(parseFloat(e.target.value))}
            style={{ width: 120, accentColor: p.ink }}
          />
        </Param>
        <Param p={p} mono={mono} k="top-p" v={topP?.toFixed(2) ?? '0.95'} />
        <Param p={p} mono={mono} k="max tokens" v={maxTokens?.toLocaleString() ?? '—'}>
          <input
            type="range" min={256} max={8192} step={256}
            value={maxTokens ?? 2048}
            onChange={e => onChangeMaxTokens?.(parseInt(e.target.value))}
            style={{ width: 120, accentColor: p.ink }}
          />
        </Param>
      </Section>

      <Section p={p} mono={mono} title="Tools">
        {(toolsState ?? [
          { label: 'Web search', on: true },
          { label: 'Code execute', on: true },
          { label: 'File search', on: true },
          { label: 'Image input', on: false },
        ]).map(t => (
          <Toggle key={t.label} p={p} label={t.label} on={t.on} onClick={() => onToggleTool?.(t.label)} />
        ))}
      </Section>

      <Section p={p} mono={mono} title="Knowledge">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(knowledgeDocs ?? []).map((d, i) => (
            <Doc key={i} p={p} mono={mono} name={d.name} />
          ))}
          {(knowledgeDocs ?? []).length === 0 && (
            <div style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em' }}>
              no documents attached
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}

function Section({ p, mono, title, children }: { p: Palette; mono: string; title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontFamily: mono, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: p.inkMuted, marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  )
}

function Param({ p, mono, k, v, children }: { p: Palette; mono: string; k: string; v: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 12.5, borderBottom: `1px solid ${p.hairlineSoft}`, gap: 12 }}>
      <span style={{ color: p.inkSoft }}>{k}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {children}
        <span style={{ fontFamily: mono, fontSize: 11.5, color: p.ink, minWidth: 38, textAlign: 'right' }}>{v}</span>
      </div>
    </div>
  )
}

function Toggle({ p, label, on, onClick }: { p: Palette; label: string; on: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 0', fontSize: 12.5, borderBottom: `1px solid ${p.hairlineSoft}`,
        background: 'none', border: 'none', borderBottomColor: p.hairlineSoft,
        cursor: 'pointer', color: p.ink, width: '100%', textAlign: 'left',
      }}
    >
      <span>{label}</span>
      <span style={{
        width: 26, height: 14, borderRadius: 8, padding: 1.5,
        background: on ? p.ink : 'transparent',
        border: `1px solid ${on ? p.ink : p.hairline}`,
        display: 'inline-flex', justifyContent: on ? 'flex-end' : 'flex-start',
      }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: on ? p.bg : p.inkSoft }} />
      </span>
    </button>
  )
}

function Doc({ p, mono, name }: { p: Palette; mono: string; name: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', border: `1px solid ${p.hairlineSoft}`, borderRadius: 2 }}>
      <span style={{ color: p.inkSoft, display: 'inline-flex' }}>{I.doc}</span>
      <span style={{ fontFamily: mono, fontSize: 11, color: p.ink, letterSpacing: '0.02em' }}>{name}</span>
    </div>
  )
}

/* =====================================================================
   Helpers
   ===================================================================== */

function iconBtn(p: Palette, size = 26): CSSProperties {
  return {
    width: size, height: size,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent',
    border: `1px solid ${p.hairlineSoft}`,
    borderRadius: 2,
    color: p.inkSoft,
    cursor: 'pointer',
    transition: 'border-color .15s, color .15s',
    padding: 0,
  }
}
