export const IMAGE_MODELS = [
  // Western AI
  { id: 'dall-e-4', name: 'DALL-E 4', provider: 'openai', category: 'Western AI' },
  { id: 'dall-e-3', name: 'DALL-E 3', provider: 'openai', category: 'Western AI' },
  { id: 'midjourney-v7', name: 'Midjourney v7', provider: 'midjourney', category: 'Western AI' },
  { id: 'midjourney-v6.1', name: 'Midjourney v6.1', provider: 'midjourney', category: 'Western AI' },
  { id: 'stable-diffusion-3.5', name: 'SD 3.5 Large', provider: 'stability', category: 'Western AI' },
  { id: 'stable-diffusion-xl', name: 'SDXL 1.0', provider: 'stability', category: 'Western AI' },
  { id: 'flux-1.1-pro-ultra', name: 'FLUX.1.1 Pro Ultra', provider: 'black-forest-labs', category: 'Western AI' },
  { id: 'flux-1-pro', name: 'FLUX.1 Pro', provider: 'black-forest-labs', category: 'Western AI' },
  { id: 'flux-1-dev', name: 'FLUX.1 Dev', provider: 'black-forest-labs', category: 'Western AI' },
  { id: 'imagen-3', name: 'Imagen 3', provider: 'google', category: 'Western AI' },
  { id: 'ideogram-3.0', name: 'Ideogram 3.0', provider: 'ideogram', category: 'Western AI' },
  { id: 'ideogram-2.0-turbo', name: 'Ideogram 2.0 Turbo', provider: 'ideogram', category: 'Western AI' },
  { id: 'recraft-v3', name: 'Recraft V3', provider: 'recraft', category: 'Western AI' },
  { id: 'playground-v3', name: 'Playground v3', provider: 'playground', category: 'Western AI' },
  
  // Chinese AI
  { id: 'cogview-3-plus', name: 'CogView-3 Plus', provider: 'zhipu', category: 'Chinese AI' },
  { id: 'wanxiang-2.1', name: 'Wanxiang 2.1', provider: 'alibaba', category: 'Chinese AI' },
  { id: 'tongyi-wanxiang', name: 'Tongyi Wanxiang', provider: 'alibaba', category: 'Chinese AI' },
  { id: 'ernie-vilg-2.0', name: 'ERNIE-ViLG 2.0', provider: 'baidu', category: 'Chinese AI' },
  { id: 'wenxin-yige', name: 'Wenxin Yige', provider: 'baidu', category: 'Chinese AI' },
  { id: 'kolors', name: 'Kolors', provider: 'kuaishou', category: 'Chinese AI' },
]

export const ASPECT_RATIOS = [
  { label: '1:1 Square', value: '1:1' },
  { label: '4:3 Landscape', value: '4:3' },
  { label: '3:4 Portrait', value: '3:4' },
  { label: '16:9 Widescreen', value: '16:9' },
  { label: '9:16 Vertical', value: '9:16' },
  { label: '21:9 Ultrawide', value: '21:9' },
  { label: '2:3 Photo', value: '2:3' },
  { label: '3:2 Photo', value: '3:2' },
]

export const QUALITY_LEVELS = [
  { label: 'Standard', value: 'standard' },
  { label: 'HD', value: 'hd' },
  { label: 'Ultra HD', value: 'ultra' },
]

export const STYLE_PRESETS = [
  { label: 'Photorealistic', value: 'photorealistic' },
  { label: 'Artistic', value: 'artistic' },
  { label: 'Anime', value: 'anime' },
  { label: 'Digital Art', value: 'digital-art' },
  { label: '3D Render', value: '3d-render' },
  { label: 'Oil Painting', value: 'oil-painting' },
  { label: 'Watercolor', value: 'watercolor' },
  { label: 'Sketch', value: 'sketch' },
]
