import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { openai, AI_PROMPTS } from '@/lib/openai'
import { ImageAnalysisResult, ImageTag } from '@/types/database'
import { GitHubImageStorage } from '@/lib/github-storage'
import sharp from 'sharp'

interface IngestRequest {
  image_id: string
  source_url?: string
  license?: string
  credit?: string
  location?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: IngestRequest = await request.json()
    const { image_id, source_url, license, credit, location } = body

    // Get image record from database
    const { data: image, error: fetchError } = await supabaseAdmin
      .from('images')
      .select('*')
      .eq('id', image_id)
      .single()

    if (fetchError || !image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Get the image URL for AI analysis
    const imageUrl = image.cdn_url

    try {
      // Get image analyzer prompt from database
      const imageAnalyzerPrompt = await AI_PROMPTS.imageAnalyzer()

      // Analyze image with OpenAI Vision
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: imageAnalyzerPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI Vision')
      }

      // Parse AI response
      let analysisResult: any
      try {
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0])
        } else {
          analysisResult = JSON.parse(content.trim())
        }
        console.log('Parsed AI analysis result:', JSON.stringify(analysisResult, null, 2))
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError)
        console.error('Content:', content)
        return NextResponse.json(
          { error: 'Failed to parse AI analysis results' },
          { status: 500 }
        )
      }

      // Generate embeddings for the caption
      let embeddingVector: number[] | null = null
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: analysisResult.caption,
          dimensions: 768
        })
        embeddingVector = embeddingResponse.data[0].embedding
      } catch (embError) {
        console.error('Failed to generate embeddings:', embError)
        // Continue without embeddings - this is optional
      }

      // Extract image dimensions from the image file
      // Note: In a real implementation, you'd want to get these from the actual image
      // For now, we'll use placeholder values that should be replaced with actual image analysis
      const width = 1920 // Placeholder - should be extracted from image
      const height = 1080 // Placeholder - should be extracted from image
      const aspectRatio = width / height
      const orientation = aspectRatio > 1.3 ? 'landscape' : aspectRatio < 0.8 ? 'portrait' : 'square'

      // Detect faces and text based on AI analysis
      const facesCount = analysisResult.tags_scored?.find((tag: ImageTag) => tag.type === 'people')?.conf > 0.7 ? 1 : 0

      // Use OCR results for accurate text detection
      const hasText = Boolean(
        analysisResult.ocr_text &&
        analysisResult.ocr_text.trim().length > 0 &&
        analysisResult.text_density > 0.01
      )
      console.log('Text detection:', {
        ocr_text: analysisResult.ocr_text,
        text_density: analysisResult.text_density,
        hasText: hasText,
        hasTextType: typeof hasText
      })

      // Extract dominant colors (placeholder)
      const dominantColors = analysisResult.tags_scored
        ?.filter((tag: ImageTag) => tag.type === 'color')
        .map((tag: ImageTag) => tag.name)
        .slice(0, 3) || []

      // Calculate safety score (based on content appropriateness)
      const safetyTag = analysisResult.tags_scored?.find((tag: ImageTag) => tag.type === 'safety')
      const safeScore = safetyTag ? safetyTag.conf : 0.95 // Default to safe

      // Prepare tags array
      const aiTags = analysisResult.top_tags || []

      // Update image record with AI analysis results
      const updateData = {
        width,
        height,
        aspect_ratio: aspectRatio,
        orientation,
        source_url,
        license,
        credit,
        location,
        faces_count: facesCount,
        has_text: hasText,
        dominant_colors: dominantColors,
        safe_score: safeScore,
        ai_caption: analysisResult.caption,
        ai_alt_text: analysisResult.alt_text,
        ai_tags: aiTags,
        ai_tags_scored: analysisResult.tags_scored,
        emb_caption: embeddingVector,
        ocr_text: analysisResult.ocr_text || null,
        text_density: analysisResult.text_density || null,
        ocr_entities: analysisResult.ocr_entities || null,
        signage_conf: analysisResult.signage_conf || null,
        age_groups: analysisResult.age_groups || null,
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await supabaseAdmin
        .from('images')
        .update(updateData)
        .eq('id', image_id)

      if (updateError) {
        console.error('Database update error:', updateError)
        console.error('Update data that failed:', JSON.stringify(updateData, null, 2))
        return NextResponse.json(
          {
            error: 'Failed to save analysis results',
            details: updateError.message,
            code: updateError.code,
            hint: updateError.hint
          },
          { status: 500 }
        )
      }

      // Generate 16:9 variant if it doesn't exist
      let variantUrl = image.variant_16x9_url
      if (!variantUrl) {
        try {
          console.log(`Generating 16:9 variant for image ${image_id}`)

          // Download the original image
          const imageResponse = await fetch(image.cdn_url)
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
          }

          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

          // Get image metadata
          const metadata = await sharp(imageBuffer).metadata()
          const originalWidth = metadata.width!
          const originalHeight = metadata.height!
          const targetAspectRatio = 16 / 9
          const originalAspectRatio = originalWidth / originalHeight

          let cropOptions: any
          if (originalAspectRatio > targetAspectRatio) {
            // Image is wider than 16:9, crop horizontally
            const newWidth = Math.round(originalHeight * targetAspectRatio)
            const left = Math.round((originalWidth - newWidth) / 2)
            cropOptions = { left, top: 0, width: newWidth, height: originalHeight }
          } else {
            // Image is taller than 16:9, crop vertically (default center crop)
            const newHeight = Math.round(originalWidth / targetAspectRatio)
            const top = Math.round((originalHeight - newHeight) / 2) // Default to center
            cropOptions = { left: 0, top, width: originalWidth, height: newHeight }
          }

          // Process image to 1200x675 (16:9)
          const processedBuffer = await sharp(imageBuffer)
            .extract(cropOptions)
            .resize(1200, 675)
            .jpeg({ quality: 90, progressive: true })
            .toBuffer()

          // Upload to GitHub
          const githubStorage = new GitHubImageStorage()
          const githubUrl = await githubStorage.uploadImageVariant(
            processedBuffer,
            image_id,
            '1200x675',
            'Generated 16:9 variant'
          )

          if (githubUrl) {
            variantUrl = githubStorage.getCdnUrl(image_id, '1200x675')

            // Update database with variant info
            const variantKey = `images/variants/1200x675/${image_id}.jpg`
            await supabaseAdmin
              .from('images')
              .update({
                variant_16x9_key: variantKey,
                variant_16x9_url: variantUrl,
                updated_at: new Date().toISOString()
              })
              .eq('id', image_id)
          }

          console.log(`Generated 16:9 variant for image ${image_id}: ${variantUrl}`)
        } catch (variantError) {
          console.error(`Error generating 16:9 variant for image ${image_id}:`, variantError)
          // Continue without variant - not critical for analysis
        }
      }

      // Return analysis results
      const result: ImageAnalysisResult = {
        caption: analysisResult.caption,
        alt_text: analysisResult.alt_text,
        tags_scored: analysisResult.tags_scored,
        top_tags: analysisResult.top_tags,
        width,
        height,
        aspect_ratio: aspectRatio,
        orientation,
        faces_count: facesCount,
        has_text: hasText,
        dominant_colors: dominantColors,
        safe_score: safeScore,
        variant_16x9_url: variantUrl, // Include generated or existing variant URL
        ocr_text: analysisResult.ocr_text || null,
        text_density: analysisResult.text_density || null,
        ocr_entities: analysisResult.ocr_entities || null,
        signage_conf: analysisResult.signage_conf || null,
        age_groups: analysisResult.age_groups || null
      }

      return NextResponse.json(result)

    } catch (aiError) {
      console.error('OpenAI Vision API error:', aiError)
      return NextResponse.json(
        { error: 'Failed to analyze image with AI' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Image ingest API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}