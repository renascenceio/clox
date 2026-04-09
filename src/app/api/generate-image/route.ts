import { generateImage } from 'ai'

export async function POST(request: Request) {
  try {
    const { prompt, model = 'google-image-generation' } = await request.json()

    if (!prompt || !prompt.trim()) {
      return Response.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    console.log('[v0] Generating image with model:', model, 'prompt:', prompt)

    // Use AI SDK's generateImage for Gemini image generation
    const image = await generateImage({
      model: model,
      prompt: prompt,
      size: '1024x1024',
      quality: 'hd',
    })

    console.log('[v0] Image generated successfully:', image.url)

    return Response.json({
      success: true,
      url: image.url,
      prompt: prompt,
      model: model,
    })
  } catch (error) {
    console.error('[v0] Image generation error:', error)
    return Response.json(
      { 
        error: error instanceof Error ? error.message : 'Image generation failed',
        success: false 
      },
      { status: 500 }
    )
  }
}
