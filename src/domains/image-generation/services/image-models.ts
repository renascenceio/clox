export const IMAGE_MODELS = [
  // DALL-E (OpenAI)
  { id: 'dall-e-4', name: 'DALL-E 4', version: '4', provider: 'openai', brandName: 'DALL-E' },
  { id: 'dall-e-3', name: 'DALL-E 3', version: '3', provider: 'openai', brandName: 'DALL-E' },
  
  // Midjourney
  { id: 'midjourney-v7', name: 'v7', version: 'v7', provider: 'midjourney', brandName: 'Midjourney' },
  { id: 'midjourney-v6.1', name: 'v6.1', version: 'v6.1', provider: 'midjourney', brandName: 'Midjourney' },
  
  // Stable Diffusion (Stability AI)
  { id: 'stable-diffusion-3.5', name: '3.5 Large', version: '3.5 Large', provider: 'stability', brandName: 'Stable Diffusion' },
  { id: 'stable-diffusion-xl', name: 'XL 1.0', version: 'XL 1.0', provider: 'stability', brandName: 'Stable Diffusion' },
  
  // FLUX (Black Forest Labs)
  { id: 'flux-1.1-pro-ultra', name: '1.1 Pro Ultra', version: '1.1 Pro Ultra', provider: 'black-forest-labs', brandName: 'FLUX' },
  { id: 'flux-1-pro', name: '1 Pro', version: '1 Pro', provider: 'black-forest-labs', brandName: 'FLUX' },
  { id: 'flux-1-dev', name: '1 Dev', version: '1 Dev', provider: 'black-forest-labs', brandName: 'FLUX' },
  
  // Imagen (Google)
  { id: 'imagen-3', name: 'Imagen 3', version: '3', provider: 'google', brandName: 'Imagen' },
  
  // Ideogram
  { id: 'ideogram-3.0', name: '3.0', version: '3.0', provider: 'ideogram', brandName: 'Ideogram' },
  { id: 'ideogram-2.0-turbo', name: '2.0 Turbo', version: '2.0 Turbo', provider: 'ideogram', brandName: 'Ideogram' },
  
  // Recraft
  { id: 'recraft-v3', name: 'V3', version: 'V3', provider: 'recraft', brandName: 'Recraft' },
  
  // Playground
  { id: 'playground-v3', name: 'v3', version: 'v3', provider: 'playground', brandName: 'Playground' },
  
  // CogView (Zhipu AI)
  { id: 'cogview-3-plus', name: '3 Plus', version: '3 Plus', provider: 'zhipu', brandName: 'CogView' },
  
  // Wanxiang (Alibaba)
  { id: 'wanxiang-2.1', name: '2.1', version: '2.1', provider: 'alibaba', brandName: 'Wanxiang' },
  { id: 'tongyi-wanxiang', name: 'Tongyi', version: 'Tongyi', provider: 'alibaba', brandName: 'Wanxiang' },
  
  // ERNIE-ViLG (Baidu)
  { id: 'ernie-vilg-2.0', name: '2.0', version: '2.0', provider: 'baidu', brandName: 'ERNIE-ViLG' },
  { id: 'wenxin-yige', name: 'Yige', version: 'Yige', provider: 'baidu', brandName: 'Wenxin' },
  
  // Kolors (Kuaishou)
  { id: 'kolors', name: 'Kolors', version: 'v1', provider: 'kuaishou', brandName: 'Kolors' },
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
