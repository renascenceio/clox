export const AUDIO_MODELS = [
  // Text-to-Speech / Voice
  { id: 'elevenlabs-turbo-v2.5', name: 'ElevenLabs Turbo v2.5', provider: 'elevenlabs', category: 'Western AI', type: 'voice' },
  { id: 'elevenlabs-multilingual-v2', name: 'ElevenLabs Multilingual v2', provider: 'elevenlabs', category: 'Western AI', type: 'voice' },
  { id: 'openai-tts-1-hd', name: 'OpenAI TTS HD', provider: 'openai', category: 'Western AI', type: 'voice' },
  { id: 'openai-tts-1', name: 'OpenAI TTS', provider: 'openai', category: 'Western AI', type: 'voice' },
  { id: 'google-wavenet', name: 'Google WaveNet', provider: 'google', category: 'Western AI', type: 'voice' },
  { id: 'azure-neural-tts', name: 'Azure Neural TTS', provider: 'microsoft', category: 'Western AI', type: 'voice' },
  { id: 'play.ht-3.0', name: 'Play.ht 3.0', provider: 'playht', category: 'Western AI', type: 'voice' },
  
  // Music Generation
  { id: 'suno-v4', name: 'Suno v4', provider: 'suno', category: 'Western AI', type: 'music' },
  { id: 'suno-v3.5', name: 'Suno v3.5', provider: 'suno', category: 'Western AI', type: 'music' },
  { id: 'udio-v2', name: 'Udio v2', provider: 'udio', category: 'Western AI', type: 'music' },
  { id: 'udio-v1.5', name: 'Udio v1.5', provider: 'udio', category: 'Western AI', type: 'music' },
  { id: 'musiclm', name: 'MusicLM', provider: 'google', category: 'Western AI', type: 'music' },
  { id: 'stable-audio-2', name: 'Stable Audio 2', provider: 'stability', category: 'Western AI', type: 'music' },
  
  // Chinese AI
  { id: 'fish-speech-1.5', name: 'Fish Speech 1.5', provider: 'fishaudio', category: 'Chinese AI', type: 'voice' },
  { id: 'chatglm-audio', name: 'ChatGLM Audio', provider: 'zhipu', category: 'Chinese AI', type: 'voice' },
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
