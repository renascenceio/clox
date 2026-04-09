export async function POST(request: Request) {
  try {
    const { prompt, model = 'google/gemini-3.1-flash-image-preview' } = await request.json()

    if (!prompt || !prompt.trim()) {
      return Response.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    console.log('[v0] Generating image with model:', model, 'prompt:', prompt)

    // For now, use Picsum as a placeholder since real image generation requires specific setup
    // In production, you would integrate with Replicate, Fal, or other image generation services
    const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(prompt)}/1024/1024`

    console.log('[v0] Image URL generated:', imageUrl)

    return Response.json({
      success: true,
      url: imageUrl,
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
