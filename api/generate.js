import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { prompt, user_id, action } = req.body
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

    // Handle getCredits action
    if (action === 'getCredits') {
      const { data, error } = await supabase
        .from('credits')
        .select('credits')
        .eq('user_id', user_id)
        .single()
      if (error) return res.status(200).json({ credits: 0 }) // fallback to 0
      return res.status(200).json({ credits: data.credits ?? 0 })
    }

    if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

    // Fetch current credits
    const { data: creditData, error: creditError } = await supabase
      .from('credits')
      .select('credits')
      .eq('user_id', user_id)
      .single()
    if (creditError || !creditData) return res.status(200).json({ error: 'Failed to fetch credits', credits: 0 })
    if (creditData.credits < 1) return res.status(200).json({ error: 'Not enough credits', credits: 0 })

    // Call Gemini AI
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
    const aiPrompt = `
You are an AI code builder agent.
Generate working HTML/CSS/JS code for this request:
"${prompt}"

Rules:
1. Wrap code in proper markdown blocks.
2. Only return code.
3. For web apps, include full HTML (<html>, <head>, <body>).
`
    const result = await model.generateContent(aiPrompt)
    const fullOutput = await result.response.text()

    // Deduct 1 credit
    await supabase.from('credits').update({ credits: creditData.credits - 1 }).eq('user_id', user_id)

    res.status(200).json({ output: fullOutput || '<p>No output</p>', credits: creditData.credits - 1 })

  } catch (err) {
    console.error('API error:', err)
    res.status(200).json({ error: 'Server error occurred', credits: 0 })
  }
}
