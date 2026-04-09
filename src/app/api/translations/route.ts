import { NextResponse } from 'next/server'
import { DEFAULT_TRANSLATIONS, SUPPORTED_LANGUAGES } from '@/lib/translations'

// GET - Returns default translations (for server-side or initial load)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const langCode = searchParams.get('lang')
  
  if (langCode) {
    // Return translations for specific language
    const translations = DEFAULT_TRANSLATIONS[langCode] || DEFAULT_TRANSLATIONS['en']
    return NextResponse.json({
      language: langCode,
      translations,
    })
  }
  
  // Return all default translations
  return NextResponse.json({
    languages: SUPPORTED_LANGUAGES,
    translations: DEFAULT_TRANSLATIONS,
  })
}

// POST - Validate uploaded translations
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { langCode, translations } = body
    
    if (!langCode || !translations) {
      return NextResponse.json(
        { error: 'Missing langCode or translations' },
        { status: 400 }
      )
    }
    
    // Validate that it's a valid language code
    const isValidLang = SUPPORTED_LANGUAGES.some(l => l.code === langCode)
    if (!isValidLang) {
      return NextResponse.json(
        { error: `Invalid language code: ${langCode}` },
        { status: 400 }
      )
    }
    
    // Validate translations format
    if (typeof translations !== 'object') {
      return NextResponse.json(
        { error: 'Translations must be an object' },
        { status: 400 }
      )
    }
    
    // Check for invalid values
    const invalidEntries = Object.entries(translations).filter(
      ([, value]) => typeof value !== 'string'
    )
    
    if (invalidEntries.length > 0) {
      return NextResponse.json(
        { error: `Invalid translation values for keys: ${invalidEntries.map(([k]) => k).join(', ')}` },
        { status: 400 }
      )
    }
    
    // Return success with validated data
    return NextResponse.json({
      success: true,
      langCode,
      keyCount: Object.keys(translations).length,
      message: `Validated ${Object.keys(translations).length} translations for ${langCode}`,
    })
  } catch (error) {
    console.error('Error processing translations:', error)
    return NextResponse.json(
      { error: 'Failed to process translations' },
      { status: 500 }
    )
  }
}
