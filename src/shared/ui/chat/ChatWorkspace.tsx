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
// Profile avatar (Dicebear-backed). Renders the same SVG the /settings
// "Regenerate avatar" button persists into `profiles.avatar_seed`, so the
// rail footer chip stays in sync with whatever the user saved last.
import Avatar from '@/shared/ui/components/Avatar'
import { useDictation, type DictationState } from './useDictation'
import { useFileDrop } from './useFileDrop'
import {
  PALETTES,
  MONO_STACK,
  SERIF_STACK,
  SANS_STACK,
  type Palette,
  type PaletteKey,
} from './palettes'
import {
  buildAcceptAttribute,
  summarizeAcceptedFiles,
  type Capability,
} from '@/lib/ai-capabilities'

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
  /** True when the user hasn't configured this model's provider yet
   *  (no env var, no AI Gateway, no local key). The picker still shows
   *  the model so users can discover what's available, but renders a
   *  muted "needs api key" affordance and a Configure shortcut. */
  disconnected?: boolean
}

export interface ModeOption {
  id: string
  label: string
  hint: string
}

/** A user-selectable skill — behavioural modifier stacked on top of the
 *  model's normal behaviour. Multiple skills can be active at once. The
 *  helpers that produce these (filtering by modality, adapting DB rows
 *  into options, building the system-prompt block) live at
 *  `lib/skills.ts`; every skill row is sourced from `public.skills`. */
export interface SkillOption {
  id: string
  label: string
  description: string
  /** Optional grouping for the picker (e.g. "tone", "reasoning"). */
  group?: string
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

/** A file attached to the next outgoing chat message. The page owns this list
 *  and decides how to ship it (e.g. via useChat's `experimental_attachments`).
 *  `dataUrl` is the canonical representation: it round-trips cleanly through
 *  the AI SDK and avoids holding a File reference across re-renders. */
export interface Attachment {
  id: string
  name: string
  /** MIME type, e.g. `image/png`. Used to pick an icon and to decide whether
   *  vision-capable models should see this as an image part. */
  contentType: string
  size: number
  dataUrl: string
}

export interface ChatWorkspaceProps {
  // theming
  theme: PaletteKey
  variant?: ChatVariant
  onChangeTheme?: (next: PaletteKey) => void

  // brand
  brandName?: string
  brandVersion?: string

  // user (rail footer)
  user: { initial: string; name: string; plan: string; email?: string; avatarSeed?: string }
  /** Legacy: opens platform settings. Kept for back-compat — clicking "Settings"
   *  in the avatar dropdown still calls this so existing pages don't break. */
  onOpenSettings?: () => void
  /** Avatar-dropdown specific actions. When provided, the rail footer renders
   *  a clickable avatar that opens the menu shown in the design reference.
   *
   *  `user.avatarSeed` is the same `profiles.avatar_seed` value the /settings
   *  page persists when the user clicks "Regenerate avatar". When present we
   *  render the Dicebear avatar; when missing we fall back to the italic
   *  letter chip so the rail still has a visual anchor for signed-out /
   *  pre-load states. */
  language?: AppLanguage
  onChangeLanguage?: (l: AppLanguage) => void
  onOpenSuperAdmin?: () => void
  onOpenSkills?: () => void
  onSignOut?: () => void
  onDeleteAccount?: () => void

  // rail
  nav: RailNavItem[]
  recent: RailRecentItem[]
  /** Caption above the recent list. Defaults to "recent" — surfaces that
   *  show non-chat items in this slot (e.g. /projects shows recent
   *  projects) override this to be honest about what the list contains.
   *  Always rendered upper-case + tracked, so callers pass the lowercase
   *  word(s) without manually applying the casing. */
  recentLabel?: string
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

  /** Skills available for the current modality. Rendered as a multi-select
   *  chip in the composer, immediately after the model chip. The page is
   *  responsible for merging the selected skill instructions into the
   *  outgoing system prompt / generation prompt before send. */
  skills?: SkillOption[]
  selectedSkillIds?: string[]
  onToggleSkill?: (id: string) => void
  onClearSkills?: () => void
  /** Skills automatically detected for the current draft input. Rendered
   *  as dashed-border "auto" pills in the ActiveSkillsBar so the user can
   *  see what semi-automatic boost their prompt is going to receive
   *  before pressing send. Detection is the page's responsibility — this
   *  prop just carries the result. */
  autoDetectedSkillIds?: string[]
  /** Suppress an auto-detected skill for THIS turn only. */
  onDismissAutoSkill?: (id: string) => void

  // transcript
  transcript: TranscriptMessage[]
  isStreaming?: boolean

  // composer
  inputValue: string
  onInputChange: (v: string) => void
  onSend: () => void
  toolsCount?: number
  tokenEstimate?: { tokens: number; cost: string } | null

  // Attachments — when wired, the attach button opens a file picker and the
  // attached items render as inline chips above the composer. The page is
  // responsible for shuttling them with the request (e.g. via useChat's
  // `experimental_attachments`) and clearing the list on send.
  attachments?: Attachment[]
  onAttach?: (files: FileList) => void
  onRemoveAttachment?: (id: string) => void

  // ⌘K palette
  cmdkGroups?: CommandPaletteGroup[]

  // config drawer
  systemPrompt?: string
  onChangeSystemPrompt?: (v: string) => void
  /** Generic parameter bag driven by the selected model's capability entry.
   *  Keys correspond to the spec field names in `lib/ai-capabilities.ts`
   *  (`temperature`, `topP`, `topK`, `maxTokens`, `presencePenalty`,
   *  `frequencyPenalty`, `reasoningEffort`, `jsonMode`, `toolUse`,
   *  `aspectRatio`, `quality`, `style`, `voice`, etc.). The page reads /
   *  writes the same bag, so adding a new knob is one capability-spec edit. */
  params?: Record<string, unknown>
  onChangeParam?: (key: string, value: unknown) => void
  /** Capability of the currently-selected model. When omitted the drawer
   *  falls back to a conservative text default (temperature + max tokens). */
  capability?: Capability
  /** Legacy temperature/top-p/max-tokens props — wired for back-compat with
   *  pages that haven't moved to `params` yet. New code should not pass these. */
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
    recentLabel,
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
    skills,
    selectedSkillIds,
    onToggleSkill,
    onClearSkills,
    transcript,
    isStreaming,
    inputValue,
    onInputChange,
    onSend,
    toolsCount = 0,
    tokenEstimate,
    attachments,
    onAttach,
    onRemoveAttachment,
    cmdkGroups,
    systemPrompt,
    onChangeSystemPrompt,
    params,
    onChangeParam,
    capability,
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

  // 'skills' is included so the multi-select picker shares the same
  // mutual-exclusion model as the mode/model dropdowns. Picking a skill
  // does not auto-close (it's multi-select); clicking the chip again or
  // any other chip closes it.
  // Composer chip-cluster popover state. Each chip toggles its own
  // panel here, so opening one closes any other. `'tools'` was added
  // when the tools chip became clickable — previously tools were only
  // reachable via the slash palette which most users never discovered.
  const [openMenu, setOpenMenu] = useState<'mode' | 'model' | 'skills' | 'tools' | null>(null)
  const [configOpen, setConfigOpen] = useState(initialConfigOpen)
  const [cmdkOpen, setCmdkOpen] = useState(initialCmdkOpen)

  // Page-level drag-and-drop. Files dropped anywhere on the chat
  // surface (header, transcript, composer) flow into the same
  // `onAttach` channel the paperclip button uses, so the rest of
  // the pipeline (preview chips, useChat's experimental_attachments,
  // server-side handling) needs zero changes. We disable the hook
  // entirely when the host page didn't pass an `onAttach` handler —
  // a chat in a read-only context shouldn't show a drop overlay
  // that would silently swallow the user's file.
  const { active: dropActive, handlers: dropHandlers } = useFileDrop({
    onFiles: onAttach,
    enabled: Boolean(onAttach),
  })

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
        recentLabel={recentLabel}
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
        // `position: relative` anchors the drop overlay below to the
        // main column rather than the whole viewport — the overlay
        // covers exactly the chat surface and respects the config
        // panel's right margin so it doesn't bleed under it.
        {...dropHandlers}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          marginRight: configOpen ? 320 : 0,
          transition: 'margin-right .22s ease',
          position: 'relative',
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
            skills={skills}
            selectedSkillIds={selectedSkillIds}
            onToggleSkill={onToggleSkill}
            onClearSkills={onClearSkills}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            inputValue={inputValue}
            onInputChange={onInputChange}
            onSend={onSend}
            toolsCount={toolsCount}
            tokenEstimate={tokenEstimate}
            attachments={attachments}
            onAttach={onAttach}
            onRemoveAttachment={onRemoveAttachment}
            toolsState={toolsState}
            onToggleTool={onToggleTool}
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
            skills={skills}
            selectedSkillIds={selectedSkillIds}
            onToggleSkill={onToggleSkill}
            onClearSkills={onClearSkills}
            inputValue={inputValue}
            onInputChange={onInputChange}
            onSend={onSend}
            tokenEstimate={tokenEstimate}
            initialPaletteOpen={initialPaletteOpen}
            attachments={attachments}
            onAttach={onAttach}
            onRemoveAttachment={onRemoveAttachment}
            toolsState={toolsState}
            onToggleTool={onToggleTool}
          />
        )}
        </>
        )}

        {/* Drag-and-drop overlay. Rendered as the last child of <main>
            so it stacks on top of the transcript + composer, but
            inside the same positioning context (config panel margin,
            etc.). pointer-events stay enabled because the overlay
            itself needs to receive `dragleave` and `drop` events —
            children with pointer-events:none would lose those.

            Visual treatment follows the editorial palette: a soft
            ink-tinted scrim with a single dashed hairline rectangle
            and a centred caption. We deliberately avoid colour
            accents so the overlay reads as part of the surface
            rather than a separate UI layer. */}
        {dropActive && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              background: 'rgb(var(--ink-rgb) / 0.04)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                border: `2px dashed ${p.ink}`,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgb(var(--surface-rgb) / 0.85)',
              }}
            >
              <div style={{ textAlign: 'center', maxWidth: 320 }}>
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: 10,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: p.inkMuted,
                    marginBottom: 10,
                  }}
                >
                  Drop to attach
                </div>
                <div
                  style={{
                    fontFamily: serif,
                    fontSize: 18,
                    lineHeight: 1.35,
                    color: p.ink,
                  }}
                >
                  Release to add files to this chat
                </div>
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: 11,
                    color: p.inkSoft,
                    marginTop: 10,
                    letterSpacing: '0.04em',
                  }}
                >
                  images · pdfs · text · csv · json
                </div>
              </div>
            </div>
          </div>
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
        capability={capability}
        params={params}
        onChangeParam={onChangeParam}
        temperature={temperature}
        onChangeTemperature={onChangeTemperature}
        topP={topP}
        maxTokens={maxTokens}
        onChangeMaxTokens={onChangeMaxTokens}
        attachments={attachments}
        onAttach={onAttach}
        onRemoveAttachment={onRemoveAttachment}
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
  nav, recent, recentLabel, user,
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
  recentLabel?: string
  user: { initial: string; name: string; plan: string; email?: string; avatarSeed?: string }
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
          <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.inkMuted }}>
            {recentLabel ?? 'recent'}
          </span>
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
            // Empty-state copy follows the label: surfaces showing
            // "recent projects" should not say "no recent threads", and
            // surfaces showing "chats in project" need a different
            // call-to-action than the global "press ⌘N for a new chat".
            // We default to the original chat copy when no override label
            // is set so existing surfaces are unchanged.
            <div style={{ padding: '10px 18px', fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em' }}>
              {recentLabel === 'recent projects'
                ? 'no projects yet'
                : recentLabel === 'chats in project'
                  ? 'no chats in this project yet'
                  : 'no recent threads — press ⌘N'}
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
          {user.avatarSeed ? (
            // Dicebear-backed avatar generated from the seed the user
            // saved on /settings. We wrap in a fixed-size flex shell so
            // the image never collapses against the name/plan column,
            // and we round it here (rather than relying on Avatar's
            // own `rounded-full`) so the surrounding chip looks
            // identical to the legacy initial circle in every theme.
            <div style={{
              width: 26, height: 26, flex: '0 0 26px',
              borderRadius: '50%', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Avatar seed={user.avatarSeed} size={26} />
            </div>
          ) : (
            // Pre-auth / pre-load fallback. Same shape and typography
            // as the rest of the rail so a flicker between this and
            // the Dicebear image is visually quiet.
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: p.ink, color: p.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: serif, fontStyle: 'italic', fontSize: 13,
              flex: '0 0 26px',
            }}>{user.initial}</div>
          )}
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
  // Sticky-to-bottom scrolling. The previous implementation called
  // `endRef.current.scrollIntoView({ behavior: 'smooth' })` on every
  // change to `[transcript.length, isStreaming]`, which had three
  // bad failure modes once a transcript got long:
  //
  //  1. `scrollIntoView` walks UP from the target to find the nearest
  //     scrollable ancestor. With our outer page also scrollable on
  //     some viewports, both the inner messages list AND the document
  //     scrolled, doubling the distance and feel.
  //  2. `behavior: 'smooth'` animates over ~300ms regardless of
  //     distance. After a long generation the bottom can be thousands
  //     of pixels below the user's view, so the smooth animation
  //     "feels" like an endless slow scroll when stream ends.
  //  3. The deps only fire on `transcript.length` changes, which DON'T
  //     trigger during streaming (the array length is stable once the
  //     assistant message is appended; only its content grows). So
  //     during streaming the user's view falls progressively behind,
  //     and the catch-up at end-of-stream is the long animation
  //     described in (2).
  //
  // The new implementation owns its own scroll container ref, watches
  // it with a ResizeObserver so content growth is detected directly,
  // and only auto-scrolls when the user is already near the bottom.
  // Scrolls are instant during streaming (so the tail tracks at any
  // speed without animation pile-up) and instant on new-message
  // append for the same reason. If the user has scrolled up to read
  // history we leave them alone — they explicitly opted out.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  /** Stickiness flag — true when the user's viewport is "close
   *  enough" to the bottom that auto-scroll should keep them pinned.
   *  We treat anything within ~80px as "at the bottom" so a one-line
   *  scroll-up doesn't immediately disable autoscroll. */
  const stickRef = useRef(true)

  // Track scroll position to flip stickiness. We don't use React
  // state because we don't need to re-render on every scroll event —
  // the flag is read by the auto-scroll effect on demand.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      stickRef.current = distanceFromBottom <= 80
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-scroll on new messages or when streaming starts/stops. We
  // use the imperative scroll API on our explicit container (NOT
  // scrollIntoView) so we never accidentally scroll a parent. Behaviour
  // is `auto` (instant) — smooth animation across long distances was
  // the source of the "endless scroll" feel.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !stickRef.current) return
    el.scrollTop = el.scrollHeight
  }, [transcript.length, isStreaming])

  // Track content growth during streaming. ResizeObserver fires once
  // per layout pass when the inner content height changes, which is
  // exactly what we want for tail-following without polling. The
  // observer is only active while streaming so we don't pay for it
  // when the chat is idle.
  useEffect(() => {
    if (!isStreaming) return
    const el = scrollRef.current
    if (!el) return
    const inner = el.firstElementChild as HTMLElement | null
    if (!inner) return
    const ro = new ResizeObserver(() => {
      if (!stickRef.current) return
      el.scrollTop = el.scrollHeight
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [isStreaming])

  return (
    <div ref={scrollRef} style={{
      flex: 1, overflow: 'auto',
      padding: '24px 56px 18px',
      fontFamily: SANS_STACK,
      color: p.ink,
      // Anchor the inner content at the top of the scroll container
      // so the browser doesn't try to be clever about anchoring during
      // resize. Combined with our explicit scrollTop writes this gives
      // us deterministic control over the viewport.
      overflowAnchor: 'none',
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
  p, mono, serif, models, modes, model, setModel, mode, setMode,
  skills, selectedSkillIds, onToggleSkill, onClearSkills,
  openMenu, setOpenMenu,
  inputValue, onInputChange, onSend, toolsCount, tokenEstimate,
  attachments, onAttach, onRemoveAttachment,
  toolsState, onToggleTool,
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
  skills?: SkillOption[]
  selectedSkillIds?: string[]
  onToggleSkill?: (id: string) => void
  onClearSkills?: () => void
  openMenu: 'mode' | 'model' | 'skills' | 'tools' | null
  setOpenMenu: (v: 'mode' | 'model' | 'skills' | 'tools' | null) => void
  inputValue: string
  onInputChange: (v: string) => void
  onSend: () => void
  toolsCount: number
  tokenEstimate?: { tokens: number; cost: string } | null
  attachments?: Attachment[]
  onAttach?: (files: FileList) => void
  onRemoveAttachment?: (id: string) => void
  toolsState?: { label: string; on: boolean }[]
  onToggleTool?: (label: string) => void
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
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
            {/* Skills — multi-select. Sits immediately after the model chip
                because skills are a per-request behavioural overlay on top
                of whichever model is active. The label shows the count when
                ≥1 are selected, otherwise reads "none" so the chip never
                vanishes (consistency with mode/model). */}
            {skills && skills.length > 0 && (
              <Chip
                p={p}
                mono={mono}
                active={openMenu === 'skills' || (selectedSkillIds?.length ?? 0) > 0}
                onClick={() => setOpenMenu(openMenu === 'skills' ? null : 'skills')}
              >
                <span style={{ color: p.inkMuted, marginRight: 6 }}>skills</span>
                <span style={{ color: p.ink }}>
                  {(selectedSkillIds?.length ?? 0) === 0
                    ? 'none'
                    : `${selectedSkillIds!.length} active`}
                </span>
                <span style={{ marginLeft: 4, display: 'inline-flex' }}>{I.caret}</span>
              </Chip>
            )}
            {/* Tools — clickable popover. Previously this chip was a
                passive readout, which meant users had to discover the
                slash palette to find tool toggles and most never did,
                so the count sat at 0 even though web search, code
                exec, and the python sandbox were all available. The
                chip now mirrors the model/skills chips: click to open
                a menu of toggles. The label reads "none" when nothing
                is armed (parallel to the skills chip) so the chip
                stays self-explanatory at any state. */}
            <Chip
              p={p}
              mono={mono}
              active={openMenu === 'tools' || toolsCount > 0}
              onClick={onToggleTool ? () => setOpenMenu(openMenu === 'tools' ? null : 'tools') : undefined}
            >
              <span style={{ color: p.inkMuted, marginRight: 6 }}>tools</span>
              <span style={{ color: p.ink }}>
                {toolsCount === 0 ? 'none' : `${toolsCount} on`}
              </span>
              {onToggleTool && (
                <span style={{ marginLeft: 4, display: 'inline-flex' }}>{I.caret}</span>
              )}
            </Chip>
            <Chip
              p={p}
              mono={mono}
              active={Boolean(attachments && attachments.length > 0)}
              onClick={onAttach ? () => fileInputRef.current?.click() : undefined}
            >
              <span style={{ display: 'inline-flex', marginRight: 5 }}>{I.attach}</span>
              <span style={{ color: p.ink }}>
                attach{attachments && attachments.length > 0 ? ` · ${attachments.length}` : ''}
              </span>
            </Chip>
            {/* Hidden file input the chip + slash buttons both proxy to. */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/*,.md,.csv,.json"
              style={{ display: 'none' }}
              onChange={e => {
                const files = e.target.files
                if (files && files.length > 0) onAttach?.(files)
                // Reset so re-selecting the same file fires onChange.
                e.target.value = ''
              }}
            />
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em' }}>⌘.&nbsp;config</span>
          </div>

          {/* Attachment chips — render between the chip row and textarea so
              the user can remove items before sending. */}
          {attachments && attachments.length > 0 && (
            <AttachmentStrip
              p={p}
              mono={mono}
              attachments={attachments}
              onRemove={onRemoveAttachment}
            />
          )}

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
            <MicButton
              p={p}
              size={34}
              value={inputValue}
              onChange={onInputChange}
              fillOnRecord
            />
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
          {openMenu === 'skills' && skills && (
            <SkillsMenu
              p={p}
              mono={mono}
              serif={serif}
              skills={skills}
              selectedSkillIds={selectedSkillIds ?? []}
              onToggleSkill={id => onToggleSkill?.(id)}
              onClearSkills={() => onClearSkills?.()}
              onClose={() => setOpenMenu(null)}
              left={130}
            />
          )}
          {openMenu === 'tools' && toolsState && (
            <ToolsMenu
              p={p}
              mono={mono}
              toolsState={toolsState}
              onToggleTool={label => onToggleTool?.(label)}
              left={250}
            />
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
              toolsState={toolsState}
              onToggleTool={onToggleTool}
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

/* =====================================================================
   Attachment strip — renders the queued files as small chips above the
   textarea. Image attachments show a thumbnail preview; everything else
   shows a doc icon + filename. Each chip has a remove (×) affordance.
   ===================================================================== */

function AttachmentStrip({
  p, mono, attachments, onRemove,
}: {
  p: Palette
  mono: string
  attachments: Attachment[]
  onRemove?: (id: string) => void
}) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
      padding: '10px 12px 0',
    }}>
      {attachments.map(a => {
        const isImage = a.contentType.startsWith('image/')
        return (
          <div
            key={a.id}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: isImage ? '3px 8px 3px 3px' : '4px 8px',
              background: p.surfaceAlt,
              border: `1px solid ${p.hairline}`,
              borderRadius: 2,
              fontFamily: mono, fontSize: 11,
              maxWidth: 220,
            }}
            title={`${a.name} · ${formatBytes(a.size)}`}
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.dataUrl}
                alt={a.name}
                style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 1, display: 'block' }}
              />
            ) : (
              <span style={{ display: 'inline-flex', color: p.inkSoft }}>{I.doc}</span>
            )}
            <span style={{
              color: p.ink, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>{a.name}</span>
            {onRemove && (
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                onClick={() => onRemove(a.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 16, height: 16, borderRadius: 999,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: p.inkMuted, padding: 0,
                  fontSize: 14, lineHeight: 1,
                }}
              >×</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
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
      padding: '6px 0', zIndex: 10,
      // The video registry has 14+ models (Sora, Luma, Runway, Pika,
      // Haiper, Kling, HeyGen, Synthesia, D-ID, etc.) — capping at the
      // old 320px hid roughly half the list below an unobvious scroll
      // boundary. Switching to a vh-based ceiling lets every connected
      // *and* disconnected model fit in view on a normal-height screen,
      // while still leaving headroom on small viewports.
      maxHeight: 'min(70vh, 640px)', overflow: 'auto',
    }}>
      <div style={{ padding: '8px 14px 4px', fontFamily: mono, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.inkMuted }}>select model</div>
      {models.map(m => {
        // Disconnected models stay clickable so users can read the
        // "needs api key" affordance and pick one anyway — submitting
        // surfaces the route's missing-key error which directs them to
        // Super Admin → API Keys. We mute the label so the connected
        // ones read as the obvious default.
        const muted = Boolean(m.disconnected)
        return (
          <button key={m.id} onClick={() => setModel(m.id)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '8px 14px',
            background: model === m.id ? p.surfaceAlt : 'transparent',
            border: 'none', cursor: 'pointer',
            color: muted ? p.inkMuted : p.ink,
            fontFamily: SANS_STACK,
            opacity: muted ? 0.78 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 14 }}>{m.label}</span>
              {model === m.id && <span style={{ fontFamily: mono, fontSize: 10, color: p.accent }}>active</span>}
            </div>
            <div style={{
              fontFamily: mono, fontSize: 10.5,
              // Tag colour leans on the same accent for "needs api key"
              // so the call-to-action reads in two beats: spot the row,
              // see why it's muted.
              color: muted ? p.accent : p.inkMuted,
              marginTop: 2, letterSpacing: '0.04em',
            }}>{m.tag}</div>
          </button>
        )
      })}
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

/* ---------------------------------------------------------------------
   ToolsMenu — popover for the Tools chip.
   Mirrors ModeMenu's frame but renders on/off rows: clicking a row
   flips the toggle without closing the menu (so users can arm a
   couple of tools in one pass). The footer note teaches users that
   the python sandbox is also auto-armed at request time when an
   active skill needs filesystem access — a deliberate reduction in
   manual toggling, not a UX gap.
   --------------------------------------------------------------------- */
function ToolsMenu({ p, mono, toolsState, onToggleTool, left = 12 }: {
  p: Palette
  mono: string
  toolsState: { label: string; on: boolean }[]
  onToggleTool: (label: string) => void
  left?: number
}) {
  // Static descriptions per toggle. Kept here so the menu is fully
  // self-contained — the labels in `toolsState` come from the parent
  // (single source of truth for the on/off state) but the human-
  // readable hint copy lives with the rendering.
  const HINTS: Record<string, string> = {
    'web search':     'tavily · live web results',
    'code execute':   'in-process node vm · 1s timeout',
    'python sandbox': 'micro-vm · python 3.13 + bash',
  }

  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 6px)', left,
      width: 320, background: p.surface,
      border: `1px solid ${p.hairline}`, borderRadius: 3,
      boxShadow: `0 12px 40px ${p.bg === '#14130E' ? 'rgba(0,0,0,.45)' : 'rgba(22,20,16,.10)'}`,
      padding: '6px 0', zIndex: 10,
    }}>
      <div style={{
        padding: '8px 14px 4px', fontFamily: mono, fontSize: 9.5,
        letterSpacing: '0.18em', textTransform: 'uppercase', color: p.inkMuted,
      }}>
        model tools
      </div>
      {toolsState.map(t => (
        <button
          key={t.label}
          onClick={() => onToggleTool(t.label)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '8px 14px',
            background: 'transparent',
            border: 'none', cursor: 'pointer', color: p.ink,
            fontFamily: SANS_STACK,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13 }}>{t.label}</span>
            <span style={{
              fontFamily: mono, fontSize: 10, letterSpacing: '0.06em',
              color: t.on ? p.accent : p.inkMuted,
            }}>
              {t.on ? '● on' : 'off'}
            </span>
          </div>
          <div style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, marginTop: 2 }}>
            {HINTS[t.label] ?? ''}
          </div>
        </button>
      ))}
      <div style={{
        margin: '4px 14px 8px',
        paddingTop: 8,
        borderTop: `1px solid ${p.hairlineSoft ?? p.hairline}`,
        fontFamily: mono, fontSize: 10, color: p.inkMuted,
        lineHeight: 1.5,
      }}>
        python sandbox is auto-armed when a file-handling skill (PDF,
        DOCX, XLSX, PPTX read &amp; write, file reading) is active —
        no need to flip it manually for those.
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------
   SkillsMenu — multi-select dropdown for the Skills chip.
   Skills are grouped by `group` for scanability. Clicking a row toggles
   its membership; the menu stays open. Click-outside / Escape closes.
   --------------------------------------------------------------------- */

function SkillsMenu({
  p, mono, serif, skills, selectedSkillIds, onToggleSkill, onClearSkills, onClose, left = 12,
}: {
  p: Palette; mono: string; serif: string
  skills: SkillOption[]
  selectedSkillIds: string[]
  onToggleSkill: (id: string) => void
  onClearSkills: () => void
  onClose: () => void
  left?: number
}) {
  // Close on Escape; click-outside is handled via a backdrop click target
  // to keep the implementation self-contained and avoid stomping on the
  // chip toggle's own click handler.
  useEffect(() => {
    function key(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  // Stable group order so the menu doesn't shuffle as the user scrolls
  // through skills. Unknown / missing groups fall under "other". Defined
  // inside the memo so React's exhaustive-deps lint stays satisfied
  // without us having to pull a constant tuple onto the dep array.
  const grouped = useMemo(() => {
    const groupOrder = ['reasoning', 'tone', 'format', 'craft', 'media', 'other'] as const
    const map = new Map<string, SkillOption[]>()
    for (const s of skills) {
      const g = s.group ?? 'other'
      const arr = map.get(g) ?? []
      arr.push(s)
      map.set(g, arr)
    }
    return groupOrder
      .map(g => ({ group: g, items: map.get(g) ?? [] }))
      .filter(g => g.items.length > 0)
  }, [skills])

  const selected = new Set(selectedSkillIds)

  return (
    <>
      {/* Click-outside backdrop. Transparent and behind the menu but in
          front of the rest of the composer so the user can dismiss by
          clicking anywhere off the panel. */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9, background: 'transparent',
        }}
      />
      <div
        role="listbox"
        aria-multiselectable="true"
        style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left,
          width: 320, maxHeight: 400, overflow: 'auto',
          background: p.surface,
          border: `1px solid ${p.hairline}`, borderRadius: 3,
          boxShadow: `0 12px 40px ${p.bg === '#14130E' ? 'rgba(0,0,0,.45)' : 'rgba(22,20,16,.10)'}`,
          padding: '6px 0', zIndex: 10,
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px 6px',
        }}>
          <span style={{
            fontFamily: mono, fontSize: 9.5, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: p.inkMuted,
          }}>
            skills · {selected.size} active
          </span>
          {selected.size > 0 && (
            <button
              onClick={onClearSkills}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: mono, fontSize: 10, letterSpacing: '0.06em',
                color: p.inkMuted, textTransform: 'uppercase', padding: 0,
              }}
            >clear</button>
          )}
        </div>

        {grouped.map(({ group, items }) => (
          <div key={group}>
            <div style={{
              padding: '6px 14px 2px',
              fontFamily: mono, fontSize: 9, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: p.inkMuted, opacity: 0.7,
            }}>{group}</div>
            {items.map(s => {
              const on = selected.has(s.id)
              return (
                <button
                  key={s.id}
                  role="option"
                  aria-selected={on}
                  onClick={() => onToggleSkill(s.id)}
                  style={{
                    display: 'flex', width: '100%', textAlign: 'left',
                    padding: '8px 14px', gap: 10, alignItems: 'flex-start',
                    background: on ? p.surfaceAlt : 'transparent',
                    border: 'none', cursor: 'pointer', color: p.ink,
                    fontFamily: SANS_STACK,
                  }}
                >
                  {/* Custom checkbox — square hairline tick to match the
                      editorial aesthetic. Filled when active. */}
                  <span
                    aria-hidden="true"
                    style={{
                      flex: '0 0 auto',
                      width: 13, height: 13, marginTop: 2,
                      border: `1px solid ${on ? p.ink : p.hairline}`,
                      background: on ? p.ink : 'transparent',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 1,
                    }}
                  >
                    {on && (
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <path d="M1 4.5L3.5 7L8 1.5" stroke={p.bg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
                    }}>
                      <span style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 13.5 }}>{s.label}</span>
                      {on && <span style={{ fontFamily: mono, fontSize: 9.5, color: p.accent, letterSpacing: '0.06em' }}>on</span>}
                    </div>
                    <div style={{
                      fontFamily: mono, fontSize: 10.5, color: p.inkMuted,
                      marginTop: 2, letterSpacing: '0.02em', lineHeight: 1.45,
                    }}>{s.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

/* =====================================================================
   Composer · variant B: slash composer
   ===================================================================== */

function ComposerSlash({
  p, mono, serif, models, modes, model, setModel, mode, setMode,
  skills, selectedSkillIds, onToggleSkill, onClearSkills,
  inputValue, onInputChange, onSend, tokenEstimate, initialPaletteOpen,
  attachments, onAttach, onRemoveAttachment,
  toolsState, onToggleTool,
}: {
  p: Palette; mono: string; serif: string
  models: ModelOption[]; modes: ModeOption[]
  model: string; setModel: (id: string) => void
  mode: string; setMode: (id: string) => void
  skills?: SkillOption[]
  selectedSkillIds?: string[]
  onToggleSkill?: (id: string) => void
  onClearSkills?: () => void
  inputValue: string; onInputChange: (v: string) => void; onSend: () => void
  tokenEstimate?: { tokens: number; cost: string } | null
  initialPaletteOpen?: boolean
  attachments?: Attachment[]
  onAttach?: (files: FileList) => void
  onRemoveAttachment?: (id: string) => void
  toolsState?: { label: string; on: boolean }[]
  onToggleTool?: (label: string) => void
}) {
  // The slash composer surfaces skills via a small inline pill in the
  // top status line + a section in the slash palette. We intentionally
  // don't crowd the bottom action row with another button — the chip
  // composer is the primary editing surface for skills.
  const [showSkillsMenu, setShowSkillsMenu] = useState(false)
  const [showPalette, setShowPalette] = useState(initialPaletteOpen ?? false)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <span style={{ color: p.ink }}>{modeLabel}</span><span>·</span>
            <span style={{ color: p.ink }}>{modelLabel}</span><span>·</span>
            {skills && skills.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowSkillsMenu(v => !v)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: mono, fontSize: 10.5, letterSpacing: '0.06em',
                    color: (selectedSkillIds?.length ?? 0) > 0 ? p.ink : p.inkMuted,
                    padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {(selectedSkillIds?.length ?? 0) === 0
                    ? '0 skills'
                    : `${selectedSkillIds!.length} skill${selectedSkillIds!.length === 1 ? '' : 's'}`}
                  <span style={{ display: 'inline-flex' }}>{I.caret}</span>
                </button>
                <span>·</span>
                {showSkillsMenu && (
                  <SkillsMenu
                    p={p} mono={mono} serif={serif}
                    skills={skills}
                    selectedSkillIds={selectedSkillIds ?? []}
                    onToggleSkill={id => onToggleSkill?.(id)}
                    onClearSkills={() => onClearSkills?.()}
                    onClose={() => setShowSkillsMenu(false)}
                    left={0}
                  />
                )}
              </>
            )}
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
          {attachments && attachments.length > 0 && (
            <AttachmentStrip
              p={p}
              mono={mono}
              attachments={attachments}
              onRemove={onRemoveAttachment}
            />
          )}
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
            <button
              title="Attach files"
              onClick={() => fileInputRef.current?.click()}
              style={{
                ...iconBtn(p, 28),
                color: attachments && attachments.length > 0 ? p.ink : p.inkSoft,
                borderColor: attachments && attachments.length > 0 ? p.ink : 'transparent',
              }}
            >
              {I.attach}
              {attachments && attachments.length > 0 && (
                <span style={{ fontFamily: mono, fontSize: 10, marginLeft: 4 }}>
                  {attachments.length}
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/*,.md,.csv,.json"
              style={{ display: 'none' }}
              onChange={e => {
                const files = e.target.files
                if (files && files.length > 0) onAttach?.(files)
                e.target.value = ''
              }}
            />
            <div style={{ flex: 1 }} />
            <MicButton p={p} size={28} value={inputValue} onChange={onInputChange} />
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
              toolsState={toolsState}
              onToggleTool={onToggleTool}
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
  toolsState, onToggleTool,
}: {
  p: Palette; mono: string; serif: string
  models: ModelOption[]; modes: ModeOption[]
  model: string; setModel: (id: string) => void
  mode: string; setMode: (id: string) => void
  onClose?: () => void
  /** Tools the host page wants to expose as togglable. The slash menu used
   *  to render these as static decorative rows; passing real state turns
   *  each one into a clickable on/off pill that flows through to the API
   *  request via the host's `body` override. Static "attach file" and
   *  "voice input" rows still appear because they're driven by other
   *  affordances (paperclip, dictation button) — only the toggleable
   *  capabilities live in this prop. */
  toolsState?: { label: string; on: boolean }[]
  onToggleTool?: (label: string) => void
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
    // Tool rows split into two flavours. `static` rows describe shortcut
    // affordances the user already has (attach, voice) — they're not
    // togglable, just informational. `toggle` rows correspond to real
    // model-callable tools (web_search, run_javascript) and clicking
    // them flips the on/off state via onToggleTool.
    | { kind: 'tool-static'; label: string; hint: string }
    | { kind: 'tool-toggle'; label: string; on: boolean }

  const items: Item[] = useMemo(() => {
    const list: Item[] = []
    list.push({ kind: 'header', label: 'mode' })
    modes.forEach(m => list.push({ kind: 'mode', id: m.id, label: m.label, hint: m.hint, active: mode === m.id }))
    list.push({ kind: 'header', label: 'model' })
    models.forEach(m => list.push({ kind: 'model', id: m.id, label: m.label, tag: m.tag, short: m.short, active: model === m.id }))
    list.push({ kind: 'header', label: 'tools' })
    // Static affordances stay so the user remembers the keyboard shortcut.
    list.push({ kind: 'tool-static', label: 'attach file', hint: '⌘U' })
    // Real togglable tools — only render the rows the host page actually
    // wired up. If `toolsState` is undefined we fall back to nothing
    // (instead of the fake "on" rows we used to show), which makes it
    // obvious to the developer that these need plumbing on this surface.
    if (toolsState) {
      for (const t of toolsState) {
        list.push({ kind: 'tool-toggle', label: t.label, on: t.on })
      }
    }
    list.push({ kind: 'tool-static', label: 'voice input', hint: '⌘\\' })
    return list
  }, [models, modes, model, mode, toolsState])

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
        if (it.kind === 'tool-static') {
          return (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '5px 16px', fontSize: 13, color: p.ink,
            }}>
              <span>{it.label}</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted }}>{it.hint}</span>
            </div>
          )
        }
        // tool-toggle — clickable on/off row. The "on/off" hint is colour-
        // coded against the same accent the active-model marker uses so
        // the user gets a fast visual scan of which tools are armed.
        return (
          <button key={i} onClick={() => onToggleTool?.(it.label)} style={{
            display: 'flex', width: '100%', justifyContent: 'space-between',
            padding: '5px 16px', fontSize: 13, color: p.ink, textAlign: 'left',
            background: 'transparent', border: 'none', cursor: 'pointer',
          }}>
            <span>{it.label}</span>
            <span style={{
              fontFamily: mono, fontSize: 10,
              color: it.on ? p.accent : p.inkMuted,
              letterSpacing: '0.06em',
            }}>
              {it.on ? '● on' : 'off'}
            </span>
          </button>
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
  capability,
  params,
  onChangeParam,
  // Legacy text-only knobs — preserved for back-compat with pages that haven't
  // moved to the `params` bag yet. New code should use `capability` + `params`.
  temperature, onChangeTemperature,
  topP,
  maxTokens, onChangeMaxTokens,
  attachments,
  onAttach,
  onRemoveAttachment,
  knowledgeDocs, toolsState, onToggleTool,
}: {
  p: Palette; mono: string; serif: string
  open: boolean; onClose: () => void
  systemPrompt?: string; onChangeSystemPrompt?: (v: string) => void
  capability?: Capability
  params?: Record<string, unknown>
  onChangeParam?: (key: string, value: unknown) => void
  temperature?: number; onChangeTemperature?: (v: number) => void
  topP?: number
  maxTokens?: number; onChangeMaxTokens?: (v: number) => void
  attachments?: Attachment[]
  onAttach?: (files: FileList) => void
  onRemoveAttachment?: (id: string) => void
  knowledgeDocs?: { name: string }[]
  toolsState?: { label: string; on: boolean }[]
  onToggleTool?: (label: string) => void
}) {
  // Native file picker — wired to onAttach so the document section actually
  // attaches files to the next outgoing message (which then ride along as
  // `experimental_attachments` on the underlying useChat call).
  const docInputRef = useRef<HTMLInputElement | null>(null)

  if (!open) return null

  // Resolve the effective parameter bag. The drawer reads from `params` first,
  // then falls back to the legacy individual props so older call sites keep
  // working unchanged.
  const readParam = <T,>(key: string, fallback: T): T => {
    const v = params?.[key]
    return (v === undefined || v === null ? fallback : v) as T
  }
  const writeParam = (key: string, value: unknown) => {
    onChangeParam?.(key, value)
    if (key === 'temperature') onChangeTemperature?.(Number(value))
    if (key === 'maxTokens') onChangeMaxTokens?.(Number(value))
  }

  // Capability shorthands.
  const fields = capability?.fields
  const acceptsFiles = capability?.attachments
  const acceptAttr = acceptsFiles ? buildAcceptAttribute(acceptsFiles) : ''
  const acceptedTypesLabel = acceptsFiles ? summarizeAcceptedFiles(acceptsFiles) : ''
  const showSystemPrompt = capability?.kind !== 'image' && capability?.kind !== 'video' && capability?.kind !== 'audio'

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 340,
      background: p.surface,
      borderLeft: `1px solid ${p.hairline}`,
      padding: '20px 22px',
      overflow: 'auto',
      fontFamily: SANS_STACK,
      color: p.ink,
      animation: 'anthologySlideIn .22s ease',
      zIndex: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: serif, fontSize: 17, fontStyle: 'italic' }}>Configure</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>⌘.</span>
        </div>
        <button onClick={onClose} style={iconBtn(p)} title="Close">{I.close}</button>
      </div>

      {/* Capability summary — tells the user which model these knobs control
          and what its native input/output story is. Keeps the drawer honest:
          if the model doesn't support a knob, we don't render it. */}
      {capability && (
        <div style={{
          marginBottom: 18,
          padding: '10px 12px',
          border: `1px solid ${p.hairlineSoft}`,
          background: p.bg,
          borderRadius: 2,
          fontFamily: mono,
          fontSize: 11,
          color: p.inkSoft,
          lineHeight: 1.55,
          letterSpacing: '0.02em',
        }}>
          <div style={{ color: p.ink, marginBottom: 2 }}>{capability.label}</div>
          <div style={{ fontSize: 10.5, color: p.inkMuted, letterSpacing: '0.04em' }}>
            {capability.provider} · {capability.kind}
            {capability.contextWindow ? ` · ${(capability.contextWindow / 1000).toFixed(0)}k ctx` : ''}
          </div>
          {capability.description && (
            <div style={{ marginTop: 6, fontFamily: serif, fontStyle: 'italic', fontSize: 12, color: p.inkSoft, letterSpacing: 0 }}>
              {capability.description}
            </div>
          )}
        </div>
      )}

      {showSystemPrompt && (
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
      )}

      {/* Parameters — driven by the capability's `fields` map. Each spec
          knows its own range/options/label, so adding a new knob is a
          one-line edit in lib/ai-capabilities.ts. */}
      {fields ? (
        <Section p={p} mono={mono} title="Parameters">
          {renderCapabilityFields({ p, mono, capability, fields, readParam, writeParam })}
        </Section>
      ) : (
        // Conservative fallback for callers that don't pass a capability yet
        // — keeps the drawer useful in legacy text-only contexts.
        <Section p={p} mono={mono} title="Parameters">
          <Param p={p} mono={mono} k="temperature" v={(temperature ?? 0.7).toFixed(2)}>
            <input
              type="range" min={0} max={2} step={0.1}
              value={temperature ?? 0.7}
              onChange={e => onChangeTemperature?.(parseFloat(e.target.value))}
              style={{ width: 130, accentColor: p.ink }}
            />
          </Param>
          {topP !== undefined && <Param p={p} mono={mono} k="top-p" v={topP.toFixed(2)} />}
          <Param p={p} mono={mono} k="max tokens" v={(maxTokens ?? 2048).toLocaleString()}>
            <input
              type="range" min={256} max={8192} step={256}
              value={maxTokens ?? 2048}
              onChange={e => onChangeMaxTokens?.(parseInt(e.target.value))}
              style={{ width: 130, accentColor: p.ink }}
            />
          </Param>
        </Section>
      )}

      {/* Tool toggles — only render the slots the capability actually
          supports. Models without function-calling don't get a "tools"
          section at all. */}
      {/* Tools section is now rendered inline by `renderCapabilityFields`
          via the `toolUse` toggle field. The drawer no longer needs its
          own dedicated tools section because the capability declaratively
          owns whether tool use is exposed. */}
      {false && capability?.kind === 'text' && (
        <Section p={p} mono={mono} title="Tools">
          {(toolsState ?? [
            { label: 'Web search', on: true },
            { label: 'Code execute', on: true },
            { label: 'File search', on: true },
          ]).map(t => (
            <Toggle key={t.label} p={p} label={t.label} on={t.on} onClick={() => onToggleTool?.(t.label)} />
          ))}
        </Section>
      )}

      {/* Document attachment — wired via the page's onAttach handler so the
          attached files ride along with the next message. We surface what
          the model actually accepts so users don't try to upload, e.g., a
          PDF to an audio-only TTS model. */}
      {acceptsFiles && acceptAttr && (
        <Section p={p} mono={mono} title="Documents">
          <input
            ref={docInputRef}
            type="file"
            accept={acceptAttr}
            multiple={acceptsFiles.maxFiles !== 1}
            style={{ display: 'none' }}
            onChange={e => {
              const files = e.target.files
              if (files && files.length > 0) onAttach?.(files)
              if (e.target) e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            disabled={!onAttach}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              border: `1px solid ${p.hairlineSoft}`,
              background: p.bg,
              color: onAttach ? p.ink : p.inkMuted,
              fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: onAttach ? 'pointer' : 'not-allowed',
              borderRadius: 2,
              width: '100%', justifyContent: 'center',
            }}
          >
            {I.attach}
            <span>attach files</span>
          </button>
          <div style={{
            marginTop: 8,
            fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.03em',
            lineHeight: 1.55,
          }}>
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}>accepts</span>
            <br />
            {acceptedTypesLabel}
          </div>
          {attachments && attachments.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {attachments.map(a => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px',
                    border: `1px solid ${p.hairlineSoft}`,
                    borderRadius: 2,
                    background: p.bg,
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <span style={{ color: p.inkSoft, display: 'inline-flex' }}>{I.doc}</span>
                    <span style={{
                      fontFamily: mono, fontSize: 11, color: p.ink,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{a.name}</span>
                  </div>
                  {onRemoveAttachment && (
                    <button
                      onClick={() => onRemoveAttachment(a.id)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: p.inkMuted, padding: 2, display: 'inline-flex',
                      }}
                      title="Remove"
                    >
                      {I.close}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Knowledge docs — these are the persistent project-attached
          documents (separate from per-message attachments). */}
      {knowledgeDocs && knowledgeDocs.length > 0 && (
        <Section p={p} mono={mono} title="Knowledge">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {knowledgeDocs.map((d, i) => (
              <Doc key={i} p={p} mono={mono} name={d.name} />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

/** Render the parameter rows declared by a capability's `fields` map. Lives
 *  next to ConfigDrawer because it's tightly coupled to the drawer's layout
 *  and styling primitives (Param/Toggle). */
function renderCapabilityFields({
  p, mono, capability, fields, readParam, writeParam,
}: {
  p: Palette; mono: string; capability: Capability | undefined
  fields: NonNullable<Capability['fields']>
  readParam: <T,>(key: string, fallback: T) => T
  writeParam: (key: string, value: unknown) => void
}) {
  const out: ReactNode[] = []
  for (const [key, raw] of Object.entries(fields)) {
    if (!raw) continue
    const f = raw

    if (f.type === 'range') {
      const v = readParam<number>(key, f.default)
      const decimals = f.step < 1 ? 2 : 0
      out.push(
        <Param key={key} p={p} mono={mono} k={f.label} v={v.toFixed(decimals) + (f.suffix ?? '')}>
          <input
            type="range"
            min={f.min} max={f.max} step={f.step}
            value={v}
            onChange={e => writeParam(key, parseFloat(e.target.value))}
            style={{ width: 130, accentColor: p.ink }}
          />
        </Param>
      )
    } else if (f.type === 'integer') {
      const v = readParam<number>(key, f.default)
      out.push(
        <Param key={key} p={p} mono={mono} k={f.label} v={v.toLocaleString() + (f.suffix ?? '')}>
          <input
            type="range"
            min={f.min} max={f.max} step={f.step ?? 1}
            value={v}
            onChange={e => writeParam(key, parseInt(e.target.value, 10))}
            style={{ width: 130, accentColor: p.ink }}
          />
        </Param>
      )
    } else if (f.type === 'select') {
      const v = readParam<string>(key, f.default)
      out.push(
        <Param key={key} p={p} mono={mono} k={f.label} v="">
          <select
            value={v}
            onChange={e => writeParam(key, e.target.value)}
            style={{
              fontFamily: mono, fontSize: 11, color: p.ink, background: p.bg,
              border: `1px solid ${p.hairlineSoft}`, borderRadius: 2,
              padding: '4px 8px', minWidth: 110, outline: 'none',
            }}
          >
            {f.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Param>
      )
    } else if (f.type === 'toggle') {
      const v = readParam<boolean>(key, f.default)
      out.push(
        <Toggle key={key} p={p} label={f.label} on={v} onClick={() => writeParam(key, !v)} />
      )
    } else if (f.type === 'text') {
      const v = readParam<string>(key, f.default ?? '')
      out.push(
        <div key={key} style={{ padding: '6px 0', borderBottom: `1px solid ${p.hairlineSoft}` }}>
          <div style={{
            fontFamily: mono, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: p.inkMuted, marginBottom: 4,
          }}>{f.label}</div>
          <input
            type="text"
            value={v}
            placeholder={f.placeholder}
            onChange={e => writeParam(key, e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              fontFamily: mono, fontSize: 11.5, color: p.ink, background: p.bg,
              border: `1px solid ${p.hairlineSoft}`, borderRadius: 2,
              padding: '6px 10px', outline: 'none',
            }}
          />
        </div>
      )
    }
  }

  // Show empty-state only if the capability legitimately has no
  // configurable parameters (e.g. an image-edit-only model with fixed defaults).
  if (out.length === 0) {
    return (
      <div style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.04em' }}>
        {capability?.label ?? 'this model'} has no user-configurable parameters
      </div>
    )
  }
  return out
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

/**
 * MicButton — voice-to-text dictation control shared by every composer.
 *
 * Lifecycle:
 *   1. Click while idle → starts MediaRecorder and shows a red dot.
 *   2. Click while recording → stops, uploads to /api/transcribe.
 *   3. While the upload is in flight → shows a hairline spinner and is
 *      visually disabled so the user can't double-fire.
 *
 * The transcript is APPENDED to the current input value rather than
 * replacing it, so a user can dictate a phrase, type a correction,
 * and dictate again without losing earlier text. We add a single
 * space when the existing input doesn't end with whitespace.
 *
 * Errors surface inline as a brief tooltip-style flash under the
 * button — non-modal, dismissed by the next click. We avoid `alert()`
 * to keep the editorial composer's quiet aesthetic intact.
 */
function MicButton({
  p, size, value, onChange, fillOnRecord = false,
}: {
  p: Palette
  /** Square size matching the surrounding icon-button dimensions. */
  size: number
  /** Current composer value — needed so we can append the transcript. */
  value: string
  /** Composer's onChange — receives the new full value (existing + transcript). */
  onChange: (v: string) => void
  /** When true (chip composer), recording fills the button with `ink`
   *  for stronger emphasis. When false (slash composer), recording is
   *  shown more subtly so the dot stays in keeping with the smaller
   *  button. */
  fillOnRecord?: boolean
}) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // `isBusy` is also exposed by the hook but we drive the visual
  // disabled state directly off `state === 'transcribing'` below, so
  // pulling it here would just be dead weight (and the linter rightly
  // flagged it). If we ever need a "either recording or transcribing"
  // affordance, re-add it then.
  const { state, toggle } = useDictation({
    onTranscript(text) {
      // Append a single space between the existing text and the
      // transcript when needed — handles "dictate, type, dictate"
      // workflows naturally and never produces "wordsword".
      const sep = value.length === 0 || /\s$/.test(value) ? '' : ' '
      onChange(value + sep + text)
    },
    onError(msg) {
      setErrorMsg(msg)
      // Auto-dismiss the error toast after 3.5s; if the user clicks
      // the mic again it'll clear immediately via toggle().
      window.setTimeout(() => setErrorMsg(null), 3500)
    },
  })

  // Pick title + visual decoration from the recorder state. The label
  // doubles as the aria-label for screen-reader users.
  const label =
    state === 'recording'  ? 'Stop recording'
    : state === 'transcribing' ? 'Transcribing…'
    : 'Voice input'

  const recording = state === 'recording'
  const transcribing = state === 'transcribing'

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={recording}
        onClick={() => { setErrorMsg(null); toggle() }}
        disabled={transcribing}
        style={{
          ...iconBtn(p, size),
          // Recording: red dot in the middle. We render the icon with
          // a recording overlay rather than swapping the icon entirely
          // so the affordance stays visually anchored.
          background: recording && fillOnRecord ? p.ink : 'transparent',
          color: recording
            ? (fillOnRecord ? p.bg : '#c2362b')
            : p.inkSoft,
          borderColor: recording ? '#c2362b' : p.hairlineSoft,
          cursor: transcribing ? 'progress' : 'pointer',
          opacity: transcribing ? 0.6 : 1,
        }}
      >
        {transcribing ? (
          <DictationSpinner color={p.inkSoft} />
        ) : recording ? (
          <span
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#c2362b',
              boxShadow: '0 0 0 0 rgba(194, 54, 43, 0.6)',
              animation: 'clox-mic-pulse 1.2s ease-out infinite',
              display: 'inline-block',
            }}
          />
        ) : (
          I.mic
        )}
      </button>

      {/* Error toast — anchored above the button so it doesn't push
          composer layout around. Pointer-events:none so a click goes
          straight to the mic button to retry. */}
      {errorMsg && (
        <span
          role="status"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            whiteSpace: 'nowrap',
            background: p.ink,
            color: p.bg,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 10.5,
            padding: '4px 8px',
            borderRadius: 2,
            letterSpacing: '0.02em',
            pointerEvents: 'none',
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {errorMsg}
        </span>
      )}

      {/* Keyframes for the recording dot pulse. Scoped to a unique
          name so it can't collide with other animations on the page,
          and rendered inline so we don't have to plumb through the
          global stylesheet. */}
      {recording && (
        <style jsx>{`
          @keyframes clox-mic-pulse {
            0%   { box-shadow: 0 0 0 0   rgba(194, 54, 43, 0.55); }
            70%  { box-shadow: 0 0 0 8px rgba(194, 54, 43, 0);    }
            100% { box-shadow: 0 0 0 0   rgba(194, 54, 43, 0);    }
          }
        `}</style>
      )}
    </span>
  )
}

/** Tiny inline SVG spinner for the transcribing state. We avoid
 *  pulling in a dependency for a single 12px graphic. */
function DictationSpinner({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="1.4" />
      <path
        d="M11.5 6.5a5 5 0 0 0-5-5"
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        style={{ transformOrigin: '6.5px 6.5px', animation: 'clox-spin 0.9s linear infinite' }}
      />
      <style jsx>{`
        @keyframes clox-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  )
}

// Avoid TS complaining about an unused export when DictationState is
// referenced only via the hook; importing the type keeps the editor
// hint surface in sync between this file and useDictation.
type _MicStateRef = DictationState // eslint-disable-line @typescript-eslint/no-unused-vars
