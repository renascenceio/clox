'use client'

import { useEffect, useMemo, useState } from 'react'
import WorkspaceSlot from '@/shared/ui/chat/workspace-host'
import { useChatChrome } from '@/shared/ui/chat/useChatChrome'
import { PALETTES } from '@/shared/ui/chat/palettes'
import { listChats, type Chat } from '@/lib/chat-store'
import FilesLibrary from './_components/FilesLibrary'

// /files — every deck, document, sheet and image the user made in a chat,
// with previews. Files are listed from the server, so they show up on any
// device and their links never expire.

export default function FilesPage() {
  const chrome = useChatChrome('files')
  const p = PALETTES[chrome.theme]
  const mono = `'Geist Mono', ui-monospace, monospace`
  const serif = `'Newsreader', Georgia, serif`

  const [chats, setChats] = useState<Chat[]>([])
  useEffect(() => {
    const refresh = () => setChats(listChats())
    refresh()
    window.addEventListener('clox-chats-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('clox-chats-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const chatTitles = useMemo(() => new Map(chats.map(c => [c.id, c.title])), [chats])

  function openChat(chatId: string) {
    const chat = chats.find(c => c.id === chatId)
    const mod = chat?.modality ?? 'text'
    localStorage.setItem(`activeChatId:${mod}`, chatId)
    const mode = mod === 'text' ? 'chat' : mod === 'audio' ? 'voice' : mod
    chrome.router.push(`/text?mode=${mode}`)
  }

  const recent = chats
    .filter(c => (c.modality ?? 'text') === 'text' && !c.archived)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6)
    .map(c => ({
      id: c.id,
      title: c.title,
      meta: new Date(c.createdAt).toLocaleString([], { month: 'short', day: 'numeric' }) + ' · ' + (c.model || '').toLowerCase(),
      onClick: () => openChat(c.id),
    }))

  return (
    <WorkspaceSlot
      theme={chrome.theme}
      onChangeTheme={chrome.handleThemeChange}
      brandName="Omma"
      user={chrome.user}
      language={chrome.language}
      onChangeLanguage={chrome.handleChangeLanguage}
      onOpenSettings={chrome.onOpenSettings}
      onOpenSuperAdmin={chrome.onOpenSuperAdmin}
      onOpenSkills={chrome.onOpenSkills}
      onSignOut={chrome.handleSignOut}
      onDeleteAccount={chrome.handleDeleteAccount}
      nav={chrome.nav}
      recent={recent}
      onSeeAllRecent={chrome.onSeeAllRecent}
      onNewChat={chrome.onNewChat}
      breadcrumb="library · files"
      title="Files"
      models={[]}
      modelId=""
      onChangeModel={() => undefined}
      modes={[]}
      modeId=""
      onChangeMode={() => undefined}
      transcript={[]}
      inputValue=""
      onInputChange={() => undefined}
      onSend={() => undefined}
      bodySlot={<FilesLibrary p={p} mono={mono} serif={serif} chatTitles={chatTitles} onOpenChat={openChat} />}
    />
  )
}
