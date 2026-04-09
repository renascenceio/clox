export const VIDEO_MODELS = [
  // Sora (OpenAI)
  { id: 'sora-turbo', name: 'Turbo', version: 'Turbo', provider: 'openai', brandName: 'Sora', maxDuration: 60 },
  { id: 'sora', name: 'Standard', version: 'Standard', provider: 'openai', brandName: 'Sora', maxDuration: 20 },
  
  // Runway
  { id: 'runway-gen-4-turbo', name: 'Gen-4 Turbo', version: 'Gen-4 Turbo', provider: 'runway', brandName: 'Runway', maxDuration: 10 },
  { id: 'runway-gen-3-alpha', name: 'Gen-3 Alpha', version: 'Gen-3 Alpha', provider: 'runway', brandName: 'Runway', maxDuration: 10 },
  
  // Luma Dream Machine
  { id: 'luma-dream-machine-2', name: 'Dream Machine 2', version: '2', provider: 'luma', brandName: 'Luma AI', maxDuration: 5 },
  { id: 'luma-dream-machine', name: 'Dream Machine', version: '1', provider: 'luma', brandName: 'Luma AI', maxDuration: 5 },
  
  // Pika
  { id: 'pika-2.0', name: '2.0', version: '2.0', provider: 'pika', brandName: 'Pika', maxDuration: 6 },
  { id: 'pika-1.5', name: '1.5', version: '1.5', provider: 'pika', brandName: 'Pika', maxDuration: 3 },
  
  // Haiper
  { id: 'haiper-2.0', name: '2.0', version: '2.0', provider: 'haiper', brandName: 'Haiper', maxDuration: 6 },
  
  // Stable Video Diffusion (Stability AI)
  { id: 'stability-video', name: 'Video Diffusion', version: '1.0', provider: 'stability', brandName: 'Stable Video', maxDuration: 4 },
  
  // Kling (Kuaishou)
  { id: 'kling-2.0', name: '2.0', version: '2.0', provider: 'kuaishou', brandName: 'Kling', maxDuration: 10 },
  { id: 'kling-1.5', name: '1.5', version: '1.5', provider: 'kuaishou', brandName: 'Kling', maxDuration: 5 },
  
  // CogVideo (Zhipu AI)
  { id: 'cogvideo-x', name: 'CogVideoX', version: 'X', provider: 'zhipu', brandName: 'CogVideo', maxDuration: 6 },
  
  // PixVerse
  { id: 'pixverse-v3', name: 'V3', version: 'V3', provider: 'pixverse', brandName: 'PixVerse', maxDuration: 4 },
  
  // Vidu (Shengshu)
  { id: 'vidu-1.5', name: '1.5', version: '1.5', provider: 'shengshu', brandName: 'Vidu', maxDuration: 8 },
]

export const VIDEO_RESOLUTIONS = [
  { label: '720p HD', value: '720p' },
  { label: '1080p Full HD', value: '1080p' },
  { label: '4K Ultra HD', value: '4k' },
]

export const VIDEO_DURATIONS = [
  { label: '3 seconds', value: 3 },
  { label: '5 seconds', value: 5 },
  { label: '6 seconds', value: 6 },
  { label: '10 seconds', value: 10 },
  { label: '20 seconds', value: 20 },
]

export const VIDEO_ASPECT_RATIOS = [
  { label: '16:9 Landscape', value: '16:9' },
  { label: '9:16 Portrait', value: '9:16' },
  { label: '1:1 Square', value: '1:1' },
  { label: '4:3 Standard', value: '4:3' },
  { label: '21:9 Cinematic', value: '21:9' },
]

export const VIDEO_STYLES = [
  { label: 'Cinematic', value: 'cinematic' },
  { label: 'Realistic', value: 'realistic' },
  { label: 'Animated', value: 'animated' },
  { label: 'Abstract', value: 'abstract' },
  { label: 'Documentary', value: 'documentary' },
]
