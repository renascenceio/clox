/**
 * Single source of truth for all AI providers across text, image, video and audio.
 * The Admin API Keys page, dropdowns, and the isModelAvailable() helper all read from here.
 */

export type ProviderCategory = 'text' | 'image' | 'video' | 'audio'

export interface ProviderEntry {
  id: string
  name: string
  envKey: string
  categories: ProviderCategory[]
  /** Hint about how keys are obtained / where to get one */
  docsUrl?: string
  /** If true, the provider requires an extra secret (e.g. Azure region or API secret) */
  requiresSecret?: boolean
}

export const PROVIDERS: ProviderEntry[] = [
  // ————— Core chat / text —————
  { id: 'google', name: 'Google Gemini', envKey: 'GOOGLE_GENERATIVE_AI_API_KEY', categories: ['text', 'image', 'audio'], docsUrl: 'https://aistudio.google.com/apikey' },
  { id: 'openai', name: 'OpenAI', envKey: 'OPENAI_API_KEY', categories: ['text', 'image', 'audio', 'video'], docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic Claude', envKey: 'ANTHROPIC_API_KEY', categories: ['text'], docsUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'mistral', name: 'Mistral AI', envKey: 'MISTRAL_API_KEY', categories: ['text'], docsUrl: 'https://console.mistral.ai/api-keys' },
  { id: 'xai', name: 'xAI Grok', envKey: 'XAI_API_KEY', categories: ['text'], docsUrl: 'https://console.x.ai' },
  { id: 'deepseek', name: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY', categories: ['text'], docsUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'moonshot', name: 'Moonshot Kimi', envKey: 'MOONSHOT_API_KEY', categories: ['text'], docsUrl: 'https://platform.moonshot.cn/console/api-keys' },
  { id: 'alibaba', name: 'Alibaba Qwen', envKey: 'DASHSCOPE_API_KEY', categories: ['text', 'image'], docsUrl: 'https://bailian.console.aliyun.com/?apiKey=1' },
  { id: 'cohere', name: 'Cohere', envKey: 'COHERE_API_KEY', categories: ['text'], docsUrl: 'https://dashboard.cohere.com/api-keys' },
  { id: 'perplexity', name: 'Perplexity', envKey: 'PERPLEXITY_API_KEY', categories: ['text'], docsUrl: 'https://www.perplexity.ai/settings/api' },
  { id: 'zhipu', name: 'Zhipu (ChatGLM)', envKey: 'ZHIPUAI_API_KEY', categories: ['text', 'image', 'video', 'audio'], docsUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },

  // ————— Image —————
  { id: 'midjourney', name: 'Midjourney', envKey: 'MIDJOURNEY_API_KEY', categories: ['image'], docsUrl: 'https://docs.midjourney.com' },
  { id: 'stability', name: 'Stability AI', envKey: 'STABILITY_API_KEY', categories: ['image', 'audio', 'video'], docsUrl: 'https://platform.stability.ai/account/keys' },
  { id: 'black-forest-labs', name: 'FLUX (BFL)', envKey: 'BFL_API_KEY', categories: ['image'], docsUrl: 'https://docs.bfl.ml' },
  { id: 'ideogram', name: 'Ideogram', envKey: 'IDEOGRAM_API_KEY', categories: ['image'], docsUrl: 'https://developer.ideogram.ai' },
  { id: 'recraft', name: 'Recraft', envKey: 'RECRAFT_API_KEY', categories: ['image'], docsUrl: 'https://www.recraft.ai/docs' },
  { id: 'playground', name: 'Playground AI', envKey: 'PLAYGROUND_API_KEY', categories: ['image'], docsUrl: 'https://playgroundai.com' },
  { id: 'baidu', name: 'Baidu ERNIE', envKey: 'BAIDU_API_KEY', categories: ['image'], requiresSecret: true, docsUrl: 'https://console.bce.baidu.com/' },
  { id: 'kuaishou', name: 'Kuaishou Kling/Kolors', envKey: 'KLING_API_KEY', categories: ['image', 'video'], requiresSecret: true, docsUrl: 'https://app.klingai.com' },

  // ————— Video —————
  { id: 'runway', name: 'Runway', envKey: 'RUNWAY_API_KEY', categories: ['video'], docsUrl: 'https://app.runwayml.com' },
  { id: 'luma', name: 'Luma AI', envKey: 'LUMAAI_API_KEY', categories: ['video'], docsUrl: 'https://lumalabs.ai/dream-machine/api' },
  { id: 'pika', name: 'Pika Labs', envKey: 'PIKA_API_KEY', categories: ['video'], docsUrl: 'https://pika.art' },
  { id: 'haiper', name: 'Haiper', envKey: 'HAIPER_API_KEY', categories: ['video'], docsUrl: 'https://haiper.ai' },
  { id: 'pixverse', name: 'PixVerse', envKey: 'PIXVERSE_API_KEY', categories: ['video'], docsUrl: 'https://app.pixverse.ai' },
  { id: 'shengshu', name: 'Vidu (Shengshu)', envKey: 'VIDU_API_KEY', categories: ['video'], docsUrl: 'https://www.vidu.studio' },
  { id: 'heygen', name: 'HeyGen', envKey: 'HEYGEN_API_KEY', categories: ['video'], docsUrl: 'https://app.heygen.com/settings?nav=API' },
  { id: 'synthesia', name: 'Synthesia', envKey: 'SYNTHESIA_API_KEY', categories: ['video'], docsUrl: 'https://www.synthesia.io/api' },
  { id: 'did', name: 'D-ID', envKey: 'DID_API_KEY', categories: ['video'], docsUrl: 'https://studio.d-id.com/account-settings' },

  // ————— Audio —————
  { id: 'elevenlabs', name: 'ElevenLabs', envKey: 'ELEVENLABS_API_KEY', categories: ['audio'], docsUrl: 'https://elevenlabs.io/app/settings/api-keys' },
  { id: 'playht', name: 'Play.ht', envKey: 'PLAYHT_API_KEY', categories: ['audio'], requiresSecret: true, docsUrl: 'https://play.ht/app/api-access' },
  { id: 'suno', name: 'Suno', envKey: 'SUNO_API_KEY', categories: ['audio'], docsUrl: 'https://suno.com' },
  { id: 'udio', name: 'Udio', envKey: 'UDIO_API_KEY', categories: ['audio'], docsUrl: 'https://www.udio.com' },
  { id: 'microsoft', name: 'Azure Speech', envKey: 'AZURE_SPEECH_KEY', categories: ['audio'], requiresSecret: true, docsUrl: 'https://portal.azure.com' },
  { id: 'fishaudio', name: 'Fish Audio', envKey: 'FISHAUDIO_API_KEY', categories: ['audio'], docsUrl: 'https://fish.audio' },
]

export function getProvidersByCategory(category: ProviderCategory): ProviderEntry[] {
  return PROVIDERS.filter(p => p.categories.includes(category))
}

export function getProviderById(id: string): ProviderEntry | undefined {
  return PROVIDERS.find(p => p.id === id)
}
