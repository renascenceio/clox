// Translation system with localStorage persistence

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸', nativeName: 'English' },
  { code: 'es', label: 'Español', flag: '🇪🇸', nativeName: 'Spanish' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', nativeName: 'French' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', nativeName: 'German' },
  { code: 'ja', label: '日本語', flag: '🇯🇵', nativeName: 'Japanese' },
  { code: 'zh', label: '中文', flag: '🇨🇳', nativeName: 'Chinese' },
  { code: 'ko', label: '한국어', flag: '🇰🇷', nativeName: 'Korean' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺', nativeName: 'Russian' },
] as const

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code']

// Default English translations (base for all other translations)
export const DEFAULT_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.submit': 'Submit',
    'common.download': 'Download',
    'common.upload': 'Upload',
    
    // Navigation
    'nav.text': 'Text',
    'nav.image': 'Image',
    'nav.video': 'Video',
    'nav.audio': 'Audio',
    'nav.gallery': 'Gallery',
    'nav.admin': 'Admin',
    'nav.settings': 'Settings',
    'nav.apiKeys': 'API Keys',
    'nav.translations': 'Translations',
    
    // Sidebar
    'sidebar.newChat': 'New Chat',
    'sidebar.newProject': 'New Project',
    'sidebar.newFolder': 'New Folder',
    'sidebar.recentActivity': 'Recent Activity',
    'sidebar.projects': 'Projects',
    'sidebar.folders': 'Folders',
    'sidebar.noChats': 'No chats yet',
    'sidebar.noProjects': 'No projects yet',
    'sidebar.noFolders': 'No folders yet',
    
    // Chat
    'chat.placeholder': 'Message {aiType} AI...',
    'chat.send': 'Send',
    'chat.thinking': 'Thinking...',
    'chat.regenerate': 'Regenerate',
    'chat.copy': 'Copy',
    'chat.copied': 'Copied!',
    
    // Models
    'models.selectModel': 'Select Model',
    'models.selectBrand': 'Select Brand',
    
    // Admin
    'admin.dashboard': 'Admin Dashboard',
    'admin.apiKeys': 'API Keys',
    'admin.translations': 'Translations',
    'admin.settings': 'Settings',
    'admin.contentModeration': 'Content Moderation',
    
    // Translations Admin
    'translations.title': 'Translation Management',
    'translations.description': 'Manage translations for all supported languages',
    'translations.selectLanguage': 'Select Language',
    'translations.key': 'Key',
    'translations.value': 'Translation',
    'translations.addNew': 'Add New Translation',
    'translations.download': 'Download Language File',
    'translations.upload': 'Upload Language File',
    'translations.uploadDescription': 'Upload a JSON file with translations',
    'translations.saved': 'Translations saved!',
    'translations.imported': 'Translations imported successfully!',
    'translations.exportAll': 'Export All Languages',
    'translations.importFromFile': 'Import from File',
    'translations.missingTranslations': 'Missing Translations',
    'translations.allComplete': 'All translations complete',
    'translations.progress': '{count} of {total} translated',
    
    // Theme
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.system': 'System',
    
    // Credits
    'credits.label': 'Credits',
    'credits.remaining': 'Remaining',
    
    // Workspace
    'workspace.personal': 'Personal',
    'workspace.create': 'Create Workspace',
    'workspace.switch': 'Switch Workspace',
    
    // Errors
    'error.generic': 'Something went wrong',
    'error.noApiKey': 'No API key configured for {provider}. Please add your API key in Admin > API Keys.',
    'error.connectionFailed': 'Connection failed',
    'error.invalidFile': 'Invalid file format',
  },
  
  // Spanish translations
  es: {
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.create': 'Crear',
    'common.search': 'Buscar',
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.confirm': 'Confirmar',
    'common.close': 'Cerrar',
    'common.back': 'Atrás',
    'common.next': 'Siguiente',
    'common.submit': 'Enviar',
    'common.download': 'Descargar',
    'common.upload': 'Subir',
    'nav.text': 'Texto',
    'nav.image': 'Imagen',
    'nav.video': 'Video',
    'nav.audio': 'Audio',
    'nav.gallery': 'Galería',
    'nav.admin': 'Admin',
    'sidebar.newChat': 'Nuevo Chat',
    'sidebar.newProject': 'Nuevo Proyecto',
    'sidebar.newFolder': 'Nueva Carpeta',
    'sidebar.recentActivity': 'Actividad Reciente',
    'chat.placeholder': 'Mensaje a {aiType} AI...',
    'chat.send': 'Enviar',
    'chat.thinking': 'Pensando...',
  },
  
  // French translations
  fr: {
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.create': 'Créer',
    'common.search': 'Rechercher',
    'common.loading': 'Chargement...',
    'nav.text': 'Texte',
    'nav.image': 'Image',
    'nav.video': 'Vidéo',
    'nav.audio': 'Audio',
    'sidebar.newChat': 'Nouveau Chat',
    'chat.placeholder': 'Message à {aiType} AI...',
  },
  
  // German translations
  de: {
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'common.delete': 'Löschen',
    'common.edit': 'Bearbeiten',
    'common.create': 'Erstellen',
    'common.search': 'Suchen',
    'common.loading': 'Laden...',
    'nav.text': 'Text',
    'nav.image': 'Bild',
    'nav.video': 'Video',
    'nav.audio': 'Audio',
    'sidebar.newChat': 'Neuer Chat',
    'chat.placeholder': 'Nachricht an {aiType} AI...',
  },
  
  // Japanese translations
  ja: {
    'common.save': '保存',
    'common.cancel': 'キャンセル',
    'common.delete': '削除',
    'common.edit': '編集',
    'common.create': '作成',
    'common.search': '検索',
    'common.loading': '読み込み中...',
    'nav.text': 'テキスト',
    'nav.image': '画像',
    'nav.video': '動画',
    'nav.audio': '音声',
    'sidebar.newChat': '新規チャット',
    'chat.placeholder': '{aiType} AIにメッセージ...',
  },
  
  // Chinese translations
  zh: {
    'common.save': '保存',
    'common.cancel': '取消',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.create': '创建',
    'common.search': '搜索',
    'common.loading': '加载中...',
    'nav.text': '文本',
    'nav.image': '图像',
    'nav.video': '视频',
    'nav.audio': '音频',
    'sidebar.newChat': '新聊天',
    'chat.placeholder': '给{aiType} AI发消息...',
  },
  
  // Korean translations
  ko: {
    'common.save': '저장',
    'common.cancel': '취소',
    'common.delete': '삭제',
    'common.edit': '편집',
    'common.create': '만들기',
    'common.search': '검색',
    'common.loading': '로딩 중...',
    'nav.text': '텍스트',
    'nav.image': '이미지',
    'nav.video': '비디오',
    'nav.audio': '오디오',
    'sidebar.newChat': '새 채팅',
    'chat.placeholder': '{aiType} AI에게 메시지...',
  },
  
  // Russian translations
  ru: {
    'common.save': 'Сохранить',
    'common.cancel': 'Отмена',
    'common.delete': 'Удалить',
    'common.edit': 'Редактировать',
    'common.create': 'Создать',
    'common.search': 'Поиск',
    'common.loading': 'Загрузка...',
    'nav.text': 'Текст',
    'nav.image': 'Изображение',
    'nav.video': 'Видео',
    'nav.audio': 'Аудио',
    'sidebar.newChat': 'Новый чат',
    'chat.placeholder': 'Сообщение {aiType} AI...',
  },
}

const STORAGE_KEY = 'clox_translations'
const LANGUAGE_KEY = 'language'

// Get all translations from localStorage (merged with defaults)
export function getTranslations(): Record<string, Record<string, string>> {
  if (typeof window === 'undefined') {
    return DEFAULT_TRANSLATIONS
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge with defaults (stored overrides defaults)
      const merged: Record<string, Record<string, string>> = {}
      
      for (const lang of SUPPORTED_LANGUAGES) {
        merged[lang.code] = {
          ...DEFAULT_TRANSLATIONS[lang.code],
          ...parsed[lang.code],
        }
      }
      
      return merged
    }
  } catch (e) {
    console.error('Failed to load translations:', e)
  }
  
  return DEFAULT_TRANSLATIONS
}

// Get translations for a specific language
export function getLanguageTranslations(langCode: string): Record<string, string> {
  const allTranslations = getTranslations()
  return allTranslations[langCode] || allTranslations['en'] || {}
}

// Save translations for a specific language
export function setLanguageTranslations(langCode: string, translations: Record<string, string>) {
  if (typeof window === 'undefined') return
  
  const allTranslations = getTranslations()
  allTranslations[langCode] = {
    ...allTranslations[langCode],
    ...translations,
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allTranslations))
  
  // Dispatch event for listeners
  window.dispatchEvent(new CustomEvent('translations-changed', { detail: { langCode } }))
}

// Set a single translation
export function setTranslation(langCode: string, key: string, value: string) {
  const translations = getLanguageTranslations(langCode)
  translations[key] = value
  setLanguageTranslations(langCode, translations)
}

// Delete a translation key from a language
export function deleteTranslation(langCode: string, key: string) {
  const translations = getLanguageTranslations(langCode)
  delete translations[key]
  setLanguageTranslations(langCode, translations)
}

// Import translations from JSON
export function importTranslations(langCode: string, json: Record<string, string>) {
  setLanguageTranslations(langCode, json)
}

// Export translations for a language as JSON
export function exportTranslations(langCode: string): string {
  const translations = getLanguageTranslations(langCode)
  return JSON.stringify(translations, null, 2)
}

// Export all translations
export function exportAllTranslations(): string {
  const translations = getTranslations()
  return JSON.stringify(translations, null, 2)
}

// Get current language
export function getCurrentLanguage(): string {
  if (typeof window === 'undefined') return 'en'
  return localStorage.getItem(LANGUAGE_KEY) || 'en'
}

// Set current language
export function setCurrentLanguage(langCode: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LANGUAGE_KEY, langCode)
  window.dispatchEvent(new CustomEvent('language-changed', { detail: { langCode } }))
}

// Translation function with variable interpolation
export function t(key: string, variables?: Record<string, string>): string {
  const langCode = getCurrentLanguage()
  const translations = getLanguageTranslations(langCode)
  
  let text = translations[key] || DEFAULT_TRANSLATIONS['en'][key] || key
  
  // Replace variables like {name} with actual values
  if (variables) {
    Object.entries(variables).forEach(([varName, value]) => {
      text = text.replace(new RegExp(`\\{${varName}\\}`, 'g'), value)
    })
  }
  
  return text
}

// Get missing translations for a language compared to English
export function getMissingTranslations(langCode: string): string[] {
  if (langCode === 'en') return []
  
  const englishKeys = Object.keys(getLanguageTranslations('en'))
  const langTranslations = getLanguageTranslations(langCode)
  
  return englishKeys.filter(key => !langTranslations[key])
}

// Get translation progress for a language
export function getTranslationProgress(langCode: string): { translated: number; total: number; percentage: number } {
  const englishKeys = Object.keys(getLanguageTranslations('en'))
  const langTranslations = getLanguageTranslations(langCode)
  
  const translated = englishKeys.filter(key => langTranslations[key]).length
  const total = englishKeys.length
  const percentage = Math.round((translated / total) * 100)
  
  return { translated, total, percentage }
}
