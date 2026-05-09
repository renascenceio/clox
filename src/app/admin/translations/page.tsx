'use client'

/**
 * /admin/translations — re-skinned in AdminShell.
 *
 * All persistence still goes through @/lib/translations (localStorage today).
 * That layer can be swapped for a DB-backed implementation later without
 * touching this surface.
 */

import { useState, useEffect, useRef } from 'react'
import AdminShell, { AdminPanel, AdminBtn } from '@/shared/ui/admin/AdminShell'
import {
  SUPPORTED_LANGUAGES,
  getLanguageTranslations,
  setTranslation,
  deleteTranslation,
  exportTranslations,
  exportAllTranslations,
  importTranslations,
  getTranslationProgress,
  getMissingTranslations,
  DEFAULT_TRANSLATIONS,
} from '@/lib/translations'

export default function TranslationsPage() {
  const [selectedLang, setSelectedLang] = useState('en')
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [showMissingOnly, setShowMissingOnly] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTranslations(getLanguageTranslations(selectedLang))
  }, [selectedLang])

  function flash(msg: string) {
    setSavedMessage(msg)
    setTimeout(() => setSavedMessage(null), 2400)
  }

  function handleSave(key: string, value: string) {
    setTranslation(selectedLang, key, value)
    setEditingKey(null)
    setTranslations(getLanguageTranslations(selectedLang))
    flash('translation saved')
  }

  function handleDelete(key: string) {
    if (!confirm(`Delete translation for "${key}"?`)) return
    deleteTranslation(selectedLang, key)
    setTranslations(getLanguageTranslations(selectedLang))
    flash('translation deleted')
  }

  function handleAddNew() {
    if (!newKey.trim() || !newValue.trim()) return
    setTranslation(selectedLang, newKey.trim(), newValue.trim())
    setNewKey('')
    setNewValue('')
    setShowAddForm(false)
    setTranslations(getLanguageTranslations(selectedLang))
    flash('translation added')
  }

  function downloadJson(filename: string, json: string) {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target?.result as string)
        if (typeof json !== 'object' || Array.isArray(json)) throw new Error('invalid')
        const firstKey = Object.keys(json)[0]
        const firstValue = json[firstKey]
        if (typeof firstValue === 'string') {
          importTranslations(selectedLang, json)
          flash(`imported ${Object.keys(json).length} keys for ${selectedLang}`)
        } else if (typeof firstValue === 'object') {
          Object.entries(json).forEach(([code, val]) => {
            if (typeof val === 'object' && !Array.isArray(val)) {
              importTranslations(code, val as Record<string, string>)
            }
          })
          flash('imported all languages')
        }
        setTranslations(getLanguageTranslations(selectedLang))
      } catch (err) {
        console.error('[v0] translation import failed', err)
        alert('Failed to import. Check the JSON shape.')
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const progress = getTranslationProgress(selectedLang)
  const missingKeys = getMissingTranslations(selectedLang)
  const filteredKeys = (showMissingOnly ? missingKeys : Object.keys(translations))
    .filter(
      k =>
        k.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (translations[k] || '').toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort()

  const langMeta = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)

  return (
    <AdminShell
      crumb={['admin', 'platform']}
      here="Translations"
      eyebrow="i18n · localStorage today"
      heading={<>Every string, in <em className="italic">every language.</em></>}
      lead="English is the source of truth. Pick a target language, fill in the missing strings, and download the JSON to ship. Persistence still flows through localStorage; swap the lib for a DB-backed implementation when you're ready."
      syncHint={
        selectedLang === 'en'
          ? `${Object.keys(translations).length} keys · english source`
          : `${progress.translated}/${progress.total} translated · ${progress.percentage}%`
      }
    >
      <AdminPanel
        title="Languages"
        meta="english is the source of truth"
        toolbar={
          <div className="px-[18px] py-2 border-b border-hairline-soft flex items-center justify-end min-h-[28px]">
            {savedMessage ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
                {savedMessage}
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">
                in sync
              </span>
            )}
          </div>
        }
      >
        <div className="px-[18px] py-3 flex flex-wrap gap-1.5">
          {SUPPORTED_LANGUAGES.map(lang => {
            const active = selectedLang === lang.code
            return (
              <button
                key={lang.code}
                onClick={() => setSelectedLang(lang.code)}
                className={`px-2.5 h-7 rounded-sharp border font-mono text-[11px] tracking-[0.04em] transition-colors ${
                  active
                    ? 'bg-ink text-bg border-ink'
                    : 'bg-transparent text-ink border-hairline hover:border-ink'
                }`}
              >
                {lang.code.toUpperCase()} · {lang.label}
              </button>
            )
          })}
        </div>

        {selectedLang !== 'en' && (
          <div className="px-[18px] py-3 border-t border-hairline-soft flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">
              progress
            </span>
            <div className="flex-1 h-1 bg-surface-alt relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-ink"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-ink tabular-nums">
              {progress.translated}/{progress.total} · {progress.percentage}%
            </span>
          </div>
        )}

        <div className="px-[18px] py-3 border-t border-hairline-soft flex flex-wrap gap-2">
          <AdminBtn
            onClick={() =>
              downloadJson(
                `translations_${selectedLang}.json`,
                exportTranslations(selectedLang),
              )
            }
          >
            Download {langMeta?.label ?? selectedLang}
          </AdminBtn>
          <AdminBtn onClick={() => downloadJson('translations_all.json', exportAllTranslations())}>
            Export all
          </AdminBtn>
          <label className="inline-flex items-center gap-2 px-3 h-[30px] font-mono text-[10.5px] tracking-[0.08em] uppercase border border-hairline bg-transparent rounded-sharp transition-colors hover:border-ink cursor-pointer">
            Upload JSON
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
          <AdminBtn onClick={() => setShowAddForm(s => !s)}>
            {showAddForm ? 'Cancel' : 'Add translation'}
          </AdminBtn>
        </div>

        {showAddForm && (
          <div className="px-[18px] py-3 border-t border-hairline-soft flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="key (e.g. common.hello)"
              className="h-8 px-2 bg-bg border border-hairline rounded-sharp font-mono text-[11.5px] text-ink outline-none focus:border-ink min-w-[240px]"
            />
            <input
              type="text"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder="value"
              className="h-8 px-2 bg-bg border border-hairline rounded-sharp font-mono text-[11.5px] text-ink outline-none focus:border-ink flex-1 min-w-[200px]"
            />
            <AdminBtn primary onClick={handleAddNew}>
              Save
            </AdminBtn>
          </div>
        )}
      </AdminPanel>

      <AdminPanel
        title="Strings"
        meta={
          showMissingOnly && selectedLang !== 'en'
            ? `${missingKeys.length} missing in ${langMeta?.label ?? selectedLang}`
            : `${filteredKeys.length} keys`
        }
        toolbar={
          <div className="px-[18px] py-2 border-b border-hairline-soft flex items-center gap-2 justify-end">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="search keys + values"
              className="h-7 px-2 bg-bg border border-hairline rounded-sharp font-mono text-[11px] text-ink outline-none focus:border-ink w-56"
            />
            {selectedLang !== 'en' && missingKeys.length > 0 && (
              <button
                onClick={() => setShowMissingOnly(s => !s)}
                className={`h-7 px-2 border rounded-sharp font-mono text-[11px] tracking-[0.04em] transition-colors ${
                  showMissingOnly
                    ? 'bg-accent text-bg border-accent'
                    : 'bg-transparent text-ink border-hairline hover:border-ink'
                }`}
              >
                {missingKeys.length} missing
              </button>
            )}
          </div>
        }
      >
        {filteredKeys.length === 0 ? (
          <div className="px-[18px] py-10 font-mono text-[11.5px] text-ink-muted text-center">
            {searchQuery ? 'no matches.' : 'no translations.'}
          </div>
        ) : (
          <div className="divide-y divide-hairline-soft max-h-[640px] overflow-y-auto">
            <div className="px-[18px] py-2 grid grid-cols-[280px_1fr_auto] gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted sticky top-0 bg-surface border-b border-hairline-soft">
              <div>Key</div>
              <div>Value · {langMeta?.label ?? selectedLang}</div>
              <div className="text-right pr-2">Actions</div>
            </div>
            {filteredKeys.map(key => {
              const value = translations[key] || ''
              const englishValue = DEFAULT_TRANSLATIONS['en'][key] || ''
              const isMissing = selectedLang !== 'en' && !value && englishValue
              const isEditing = editingKey === key

              return (
                <div
                  key={key}
                  className={`px-[18px] py-2.5 grid grid-cols-[280px_1fr_auto] gap-3 items-start ${
                    isMissing ? 'bg-surface-alt/40' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <code className="font-mono text-[11.5px] text-ink break-all">{key}</code>
                    {selectedLang !== 'en' && englishValue && (
                      <div
                        className="font-mono text-[10.5px] text-ink-muted mt-1 truncate"
                        title={englishValue}
                      >
                        en: {englishValue}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    {isEditing ? (
                      <div className="flex gap-2 items-start">
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSave(key, editValue)
                            if (e.key === 'Escape') setEditingKey(null)
                          }}
                          autoFocus
                          className="flex-1 min-w-0 h-8 px-2 bg-bg border border-ink rounded-sharp font-mono text-[11.5px] text-ink outline-none"
                        />
                        <AdminBtn primary onClick={() => handleSave(key, editValue)}>
                          save
                        </AdminBtn>
                        <AdminBtn onClick={() => setEditingKey(null)}>cancel</AdminBtn>
                      </div>
                    ) : (
                      <span
                        className={`font-mono text-[11.5px] ${
                          value ? 'text-ink' : 'text-ink-muted italic'
                        }`}
                      >
                        {value || (isMissing ? 'not translated' : '—')}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end gap-1.5 pr-2">
                    {!isEditing && (
                      <>
                        <AdminBtn
                          onClick={() => {
                            setEditingKey(key)
                            setEditValue(value || englishValue)
                          }}
                        >
                          edit
                        </AdminBtn>
                        <AdminBtn danger onClick={() => handleDelete(key)}>
                          delete
                        </AdminBtn>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </AdminPanel>

      <AdminPanel title="Conventions" meta="how to keep translations consistent">
        <div className="px-[18px] py-4 font-mono text-[11.5px] text-ink-muted leading-[1.6] space-y-1.5">
          <div>
            · Dot-notation keys: <code className="text-ink">common.save</code>,{' '}
            <code className="text-ink">nav.home</code>
          </div>
          <div>
            · Variables in curly braces:{' '}
            <code className="text-ink">{'Hello, {name}!'}</code>
          </div>
          <div>· Download English as the canonical template for new languages</div>
          <div>· Upload a JSON to bulk import; multi-language files are also supported</div>
        </div>
      </AdminPanel>
    </AdminShell>
  )
}
