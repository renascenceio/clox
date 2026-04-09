'use client'

import { motion } from 'framer-motion'
import { stagger, cardVariant } from '@/shared/ui/layout/AppLayout'
import { useState, useEffect, useRef } from 'react'
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

  // Load translations on mount and when language changes
  useEffect(() => {
    const langTranslations = getLanguageTranslations(selectedLang)
    setTranslations(langTranslations)
  }, [selectedLang])

  const handleSave = (key: string, value: string) => {
    setTranslation(selectedLang, key, value)
    setEditingKey(null)
    setTranslations(getLanguageTranslations(selectedLang))
    showSavedMessage('Translation saved!')
  }

  const handleDelete = (key: string) => {
    if (confirm(`Delete translation for "${key}"?`)) {
      deleteTranslation(selectedLang, key)
      setTranslations(getLanguageTranslations(selectedLang))
      showSavedMessage('Translation deleted!')
    }
  }

  const handleAddNew = () => {
    if (!newKey.trim() || !newValue.trim()) return
    setTranslation(selectedLang, newKey.trim(), newValue.trim())
    setNewKey('')
    setNewValue('')
    setShowAddForm(false)
    setTranslations(getLanguageTranslations(selectedLang))
    showSavedMessage('New translation added!')
  }

  const handleDownload = () => {
    const json = exportTranslations(selectedLang)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `translations_${selectedLang}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadAll = () => {
    const json = exportAllTranslations()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'translations_all.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string)
        
        // Validate the JSON structure
        if (typeof json !== 'object' || Array.isArray(json)) {
          throw new Error('Invalid file format')
        }

        // Check if it's a single language or all languages
        const firstKey = Object.keys(json)[0]
        const firstValue = json[firstKey]
        
        if (typeof firstValue === 'string') {
          // Single language file
          importTranslations(selectedLang, json)
          showSavedMessage(`Imported ${Object.keys(json).length} translations for ${selectedLang}!`)
        } else if (typeof firstValue === 'object') {
          // Multi-language file
          Object.entries(json).forEach(([langCode, langTranslations]) => {
            if (typeof langTranslations === 'object' && !Array.isArray(langTranslations)) {
              importTranslations(langCode, langTranslations as Record<string, string>)
            }
          })
          showSavedMessage('Imported translations for all languages!')
        }
        
        setTranslations(getLanguageTranslations(selectedLang))
      } catch (error) {
        console.error('Failed to import:', error)
        alert('Failed to import translations. Please check the file format.')
      }
    }
    reader.readAsText(file)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const showSavedMessage = (message: string) => {
    setSavedMessage(message)
    setTimeout(() => setSavedMessage(null), 3000)
  }

  const progress = getTranslationProgress(selectedLang)
  const missingKeys = getMissingTranslations(selectedLang)

  // Filter translations based on search and missing filter
  const filteredKeys = (showMissingOnly ? missingKeys : Object.keys(translations))
    .filter(key => 
      key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (translations[key] || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort()

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="p-8 max-w-6xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={cardVariant} className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-label-primary mb-2">
          Translation Management
        </h1>
        <p className="text-label-secondary">
          Manage translations for all supported languages. Download, edit, and upload language files.
        </p>
      </motion.div>

      {/* Success Message */}
      {savedMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="mb-6 p-4 bg-success/10 border border-success/30 rounded-hig-lg flex items-center gap-3"
        >
          <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-success font-medium">{savedMessage}</span>
        </motion.div>
      )}

      {/* Language Selector & Actions */}
      <motion.div variants={cardVariant} className="bg-surface-secondary dark:bg-surface border border-separator rounded-hig-xl p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Language Tabs */}
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => setSelectedLang(lang.code)}
                className={`flex items-center gap-2 px-4 py-2 rounded-hig-lg text-sm font-medium transition-all ${
                  selectedLang === lang.code
                    ? 'bg-brown dark:bg-teal text-white shadow-brown-glow dark:shadow-teal-glow'
                    : 'bg-surface-tertiary hover:bg-fill text-label-primary'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.code.toUpperCase()}</span>
              </button>
            ))}
          </div>

          {/* Progress */}
          {selectedLang !== 'en' && (
            <div className="flex items-center gap-3">
              <div className="text-sm text-label-secondary">
                {progress.translated}/{progress.total} translated
              </div>
              <div className="w-24 h-2 bg-surface-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brown to-teal transition-all"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <span className="text-sm font-bold text-label-primary">{progress.percentage}%</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-separator">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-surface-tertiary hover:bg-fill text-label-primary rounded-hig-lg text-sm font-medium transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download {SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.label}
          </button>
          
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-2 px-4 py-2 bg-surface-tertiary hover:bg-fill text-label-primary rounded-hig-lg text-sm font-medium transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export All Languages
          </button>

          <label className="flex items-center gap-2 px-4 py-2 bg-brown/10 dark:bg-teal/10 hover:bg-brown/20 dark:hover:bg-teal/20 text-brown dark:text-teal rounded-hig-lg text-sm font-medium transition-all cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Language File
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 gradient-brown-teal text-white rounded-hig-lg text-sm font-bold transition-all hover:shadow-brown-glow"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Translation
          </button>
        </div>
      </motion.div>

      {/* Add New Translation Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-brown/5 dark:bg-teal/5 border border-brown/20 dark:border-teal/20 rounded-hig-xl p-6 mb-6"
        >
          <h3 className="font-bold text-label-primary mb-4">Add New Translation</h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Translation key (e.g., common.hello)"
              className="flex-1 px-4 py-2 bg-surface-secondary border border-separator rounded-hig-lg text-sm outline-none focus:border-brown dark:focus:border-teal"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Translation value"
              className="flex-1 px-4 py-2 bg-surface-secondary border border-separator rounded-hig-lg text-sm outline-none focus:border-brown dark:focus:border-teal"
            />
            <button
              onClick={handleAddNew}
              disabled={!newKey.trim() || !newValue.trim()}
              className="px-6 py-2 gradient-brown-teal text-white rounded-hig-lg text-sm font-bold disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-surface-tertiary text-label-secondary rounded-hig-lg text-sm font-medium hover:bg-fill"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Search & Filters */}
      <motion.div variants={cardVariant} className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-label-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search translations..."
            className="w-full pl-11 pr-4 py-3 bg-surface-secondary border border-separator rounded-hig-lg text-sm outline-none focus:border-brown dark:focus:border-teal"
          />
        </div>
        
        {selectedLang !== 'en' && missingKeys.length > 0 && (
          <button
            onClick={() => setShowMissingOnly(!showMissingOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-hig-lg text-sm font-medium transition-all ${
              showMissingOnly
                ? 'bg-warning/20 text-warning border border-warning/30'
                : 'bg-surface-tertiary text-label-primary hover:bg-fill'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {missingKeys.length} Missing
          </button>
        )}
      </motion.div>

      {/* Translations Table */}
      <motion.div variants={cardVariant} className="bg-surface-secondary dark:bg-surface border border-separator rounded-hig-xl overflow-hidden">
        <div className="grid grid-cols-[300px_1fr_100px] gap-4 px-6 py-3 bg-surface-tertiary/50 border-b border-separator text-xs font-bold text-label-tertiary uppercase tracking-widest">
          <div>Key</div>
          <div>Translation ({SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.label})</div>
          <div className="text-right">Actions</div>
        </div>

        <div className="divide-y divide-separator max-h-[600px] overflow-y-auto custom-scrollbar">
          {filteredKeys.length === 0 ? (
            <div className="px-6 py-12 text-center text-label-tertiary">
              {searchQuery ? 'No translations found matching your search.' : 'No translations available.'}
            </div>
          ) : (
            filteredKeys.map(key => {
              const value = translations[key] || ''
              const englishValue = DEFAULT_TRANSLATIONS['en'][key] || ''
              const isMissing = selectedLang !== 'en' && !value && englishValue

              return (
                <div
                  key={key}
                  className={`grid grid-cols-[300px_1fr_100px] gap-4 px-6 py-4 items-center hover:bg-surface-tertiary/30 ${
                    isMissing ? 'bg-warning/5' : ''
                  }`}
                >
                  <div>
                    <code className="text-sm font-mono text-label-primary break-all">{key}</code>
                    {selectedLang !== 'en' && englishValue && (
                      <div className="text-xs text-label-tertiary mt-1 truncate" title={englishValue}>
                        EN: {englishValue}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    {editingKey === key ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(key, editValue)
                            if (e.key === 'Escape') setEditingKey(null)
                          }}
                          className="flex-1 px-3 py-1.5 bg-surface border border-brown dark:border-teal rounded-hig-lg text-sm outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSave(key, editValue)}
                          className="px-3 py-1.5 bg-success/20 text-success rounded-hig-lg text-sm font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="px-3 py-1.5 bg-surface-tertiary text-label-secondary rounded-hig-lg text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className={`text-sm ${value ? 'text-label-primary' : 'text-label-tertiary italic'}`}>
                        {value || (isMissing ? 'Not translated' : '—')}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingKey(key)
                        setEditValue(value || englishValue)
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-hig-lg hover:bg-surface-tertiary text-label-secondary hover:text-brown dark:hover:text-teal transition-all"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(key)}
                      className="w-8 h-8 flex items-center justify-center rounded-hig-lg hover:bg-error/10 text-label-secondary hover:text-error transition-all"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </motion.div>

      {/* Help Text */}
      <motion.div variants={cardVariant} className="mt-6 p-4 bg-surface-tertiary/50 rounded-hig-lg">
        <h4 className="text-sm font-bold text-label-primary mb-2">Tips</h4>
        <ul className="text-sm text-label-secondary space-y-1">
          <li>• Use dot notation for keys (e.g., <code className="bg-surface-tertiary px-1 rounded">common.save</code>, <code className="bg-surface-tertiary px-1 rounded">nav.home</code>)</li>
          <li>• Use curly braces for variables (e.g., <code className="bg-surface-tertiary px-1 rounded">Hello, {'{name}'}!</code>)</li>
          <li>• Download the English file as a template for new languages</li>
          <li>• Upload a JSON file to bulk import translations</li>
        </ul>
      </motion.div>
    </motion.div>
  )
}
