import { createClient } from '@supabase/supabase-js'

// Supabase server-side
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, user_id } = req.body
  if (!prompt || !user_id) return res.status(400).json({ error: 'Missing prompt or user_id' })

  // 1️⃣ Fetch user credits
  const { data, error } = await supabase
    .from('credits')
    .select('credits')
    .eq('user_id', user_id)
    .single()

  if (error || !data) return res.status(500).json({ error: 'Failed to fetch credits' })
  if (data.credits < 1) return res.status(400).json({ error: 'Not enough credits' })

  try {
    // 2️⃣ Call Gemini 2.5 Flash API
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta2/models/gemini-2.5-flash:generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: { text: prompt },
        temperature: 0.7,
        maxOutputTokens: 1000
      })
    })

    const text = await r.text() // read as text first
    if (!r.ok) return res.status(500).json({ error: 'Gemini API error: ' + text })

    let result
    try {
      result = JSON.parse(text)
    } catch {
      return res.status(500).json({ error: 'Gemini returned invalid JSON: ' + text })
    }

    // 3️⃣ Deduct 1 credit
    await supabase
      .from('credits')
      .update({ credits: data.credits - 1 })
      .eq('user_id', user_id)

    // 4️⃣ Return HTML output
    const htmlOutput = result?.candidates?.[0]?.content || '<p>No output</p>'
    res.status(200).json({ html: htmlOutput })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Generation failed' })
  }
}
