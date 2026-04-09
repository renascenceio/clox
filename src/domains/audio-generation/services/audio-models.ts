export const AUDIO_MODELS = [
  // ElevenLabs (Text-to-Speech)
  { id: 'elevenlabs-turbo-v2.5', name: 'Turbo v2.5', version: 'Turbo v2.5', provider: 'elevenlabs', brandName: 'ElevenLabs', type: 'voice' },
  { id: 'elevenlabs-multilingual-v2', name: 'Multilingual v2', version: 'Multilingual v2', provider: 'elevenlabs', brandName: 'ElevenLabs', type: 'voice' },
  
  // OpenAI TTS
  { id: 'openai-tts-1-hd', name: 'TTS HD', version: 'TTS-1-HD', provider: 'openai', brandName: 'OpenAI TTS', type: 'voice' },
  { id: 'openai-tts-1', name: 'TTS Standard', version: 'TTS-1', provider: 'openai', brandName: 'OpenAI TTS', type: 'voice' },
  
  // Google WaveNet
  { id: 'google-wavenet', name: 'WaveNet', version: 'WaveNet', provider: 'google', brandName: 'Google Cloud TTS', type: 'voice' },
  
  // Azure Neural TTS (Microsoft)
  { id: 'azure-neural-tts', name: 'Neural TTS', version: 'Neural', provider: 'microsoft', brandName: 'Azure TTS', type: 'voice' },
  
  // Play.ht
  { id: 'play.ht-3.0', name: '3.0', version: '3.0', provider: 'playht', brandName: 'Play.ht', type: 'voice' },
  
  // Suno (Music Generation)
  { id: 'suno-v4', name: 'v4', version: 'v4', provider: 'suno', brandName: 'Suno', type: 'music' },
  { id: 'suno-v3.5', name: 'v3.5', version: 'v3.5', provider: 'suno', brandName: 'Suno', type: 'music' },
  
  // Udio (Music Generation)
  { id: 'udio-v2', name: 'v2', version: 'v2', provider: 'udio', brandName: 'Udio', type: 'music' },
  { id: 'udio-v1.5', name: 'v1.5', version: 'v1.5', provider: 'udio', brandName: 'Udio', type: 'music' },
  
  // MusicLM (Google)
  { id: 'musiclm', name: 'MusicLM', version: 'v1', provider: 'google', brandName: 'MusicLM', type: 'music' },
  
  // Stable Audio (Stability AI)
  { id: 'stable-audio-2', name: 'Audio 2', version: '2', provider: 'stability', brandName: 'Stable Audio', type: 'music' },
  
  // Fish Speech (FishAudio)
  { id: 'fish-speech-1.5', name: '1.5', version: '1.5', provider: 'fishaudio', brandName: 'Fish Speech', type: 'voice' },
  
  // ChatGLM Audio (Zhipu AI)
  { id: 'chatglm-audio', name: 'Audio', version: 'v1', provider: 'zhipu', brandName: 'ChatGLM Audio', type: 'voice' },
]

export const VOICE_STYLES = [
  { label: 'Natural', value: 'natural' },
  { label: 'Professional', value: 'professional' },
  { label: 'Friendly', value: 'friendly' },
  { label: 'Dramatic', value: 'dramatic' },
  { label: 'Calm', value: 'calm' },
  { label: 'Energetic', value: 'energetic' },
]

export const MUSIC_GENRES = [
  { label: 'Pop', value: 'pop' },
  { label: 'Rock', value: 'rock' },
  { label: 'Electronic', value: 'electronic' },
  { label: 'Classical', value: 'classical' },
  { label: 'Hip Hop', value: 'hip-hop' },
  { label: 'Jazz', value: 'jazz' },
  { label: 'Ambient', value: 'ambient' },
  { label: 'Cinematic', value: 'cinematic' },
]

export const AUDIO_DURATIONS = [
  { label: '15 seconds', value: 15 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '2 minutes', value: 120 },
  { label: '3 minutes', value: 180 },
]

export const AUDIO_QUALITY = [
  { label: 'Standard', value: 'standard' },
  { label: 'High', value: 'high' },
  { label: 'Studio', value: 'studio' },
]
