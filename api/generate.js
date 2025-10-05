import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export default async function handler(req, res) {
  console.log('=== /api/generate called ===')
  console.log('Request body:', req.body)

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', credits: 0 })

    const { prompt, user_id, action } = req.body
    if (!user_id) return res.status(400).json({ error: 'Missing user_id', credits: 0 })

    // Handle getCredits
    if (action === 'getCredits') {
      try {
        const { data, error } = await supabase.from('credits').select('credits').eq('user_id', user_id).single()
        console.log('getCredits result:', { data, error })
        return res.status(200).json({ credits: data?.credits ?? 0 })
      } catch (err) {
        console.error('Supabase getCredits error:', err)
        return res.status(200).json({ credits: 0 })
      }
    }

    // Ensure prompt exists
    if (!prompt) return res.status(400).json({ error: 'Missing prompt', credits: 0 })

    // Fetch user credits
    let credits = 0
    try {
      const { data, error } = await supabase.from('credits').select('credits').eq('user_id', user_id).single()
      if (error || !data) return res.status(200).json({ error: 'Failed to fetch credits', credits: 0 })
      credits = data.credits
      if (credits < 1) return res.status(200).json({ error: 'Not enough credits', credits: 0 })
    } catch (err) {
      console.error('Supabase fetch credits error:', err)
      return res.status(200).json({ error: 'Failed to fetch credits', credits: 0 })
    }

    // Call Gemini AI
    let output = '<p>No output</p>'
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
      const aiPrompt = `
You are an AI code builder agent.
Generate working HTML/CSS/JS code for this request:
"${prompt}"

Rules:
1. Wrap code in proper markdown blocks.
2. Only return code.
3. Include full HTML (<html>, <head>, <body>).
`
      console.log('Sending prompt to Gemini...')
      const result = await model.generateContent(aiPrompt)
      output = await result.response.text()
      if (!output || output.trim() === '') output = '<p>No output</p>'
    } catch (gemErr) {
      console.error('Gemini API error:', gemErr)
      return res.status(200).json({ error: 'AI generation failed', credits })
    }

    // Deduct 1 credit
    try {
      await supabase.from('credits').update({ credits: credits - 1 }).eq('user_id', user_id)
    } catch (err) {
      console.error('Supabase update credits error:', err)
    }

    res.status(200).json({ output, credits: credits - 1 })

  } catch (err) {
    console.error('API top-level error:', err)
    res.status(200).json({ error: 'Server error occurred', credits: 0 })
  }
}
