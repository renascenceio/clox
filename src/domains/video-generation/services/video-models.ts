export const VIDEO_MODELS = [
  // Western AI
  { id: 'sora-turbo', name: 'Sora Turbo', provider: 'openai', category: 'Western AI', maxDuration: 60 },
  { id: 'sora', name: 'Sora', provider: 'openai', category: 'Western AI', maxDuration: 20 },
  { id: 'runway-gen-4-turbo', name: 'Gen-4 Turbo', provider: 'runway', category: 'Western AI', maxDuration: 10 },
  { id: 'runway-gen-3-alpha', name: 'Gen-3 Alpha', provider: 'runway', category: 'Western AI', maxDuration: 10 },
  { id: 'luma-dream-machine-2', name: 'Dream Machine 2', provider: 'luma', category: 'Western AI', maxDuration: 5 },
  { id: 'luma-dream-machine', name: 'Dream Machine', provider: 'luma', category: 'Western AI', maxDuration: 5 },
  { id: 'pika-2.0', name: 'Pika 2.0', provider: 'pika', category: 'Western AI', maxDuration: 6 },
  { id: 'pika-1.5', name: 'Pika 1.5', provider: 'pika', category: 'Western AI', maxDuration: 3 },
  { id: 'haiper-2.0', name: 'Haiper 2.0', provider: 'haiper', category: 'Western AI', maxDuration: 6 },
  { id: 'stability-video', name: 'Stable Video Diffusion', provider: 'stability', category: 'Western AI', maxDuration: 4 },
  
  // Chinese AI
  { id: 'kling-2.0', name: 'Kling 2.0', provider: 'kuaishou', category: 'Chinese AI', maxDuration: 10 },
  { id: 'kling-1.5', name: 'Kling 1.5', provider: 'kuaishou', category: 'Chinese AI', maxDuration: 5 },
  { id: 'cogvideo-x', name: 'CogVideoX', provider: 'zhipu', category: 'Chinese AI', maxDuration: 6 },
  { id: 'pixverse-v3', name: 'PixVerse V3', provider: 'pixverse', category: 'Chinese AI', maxDuration: 4 },
  { id: 'vidu-1.5', name: 'Vidu 1.5', provider: 'shengshu', category: 'Chinese AI', maxDuration: 8 },
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
