import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { prompt, user_id, action } = req.body
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

    // 1️⃣ Ensure user credits exist
    let { data, error } = await supabase
      .from('credits')
      .select('credits')
      .eq('user_id', user_id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase fetch error:', error)
      return res.status(500).json({ error: 'Supabase fetch error: ' + error.message })
    }

    if (!data) {
      // Initialize with 5 credits
      await supabase.from('credits').insert({ user_id, credits: 5 })
      data = { credits: 5 }
    }

    let credits = data.credits

    // 2️⃣ Handle "getCredits" action only
    if (action === 'getCredits') {
      return res.status(200).json({ credits })
    }

    // 3️⃣ Handle "useCredit" action only (deduct without generating)
    if (action === 'useCredit') {
      if (credits < 1) return res.status(400).json({ error: 'Not enough credits' })
      await supabase.from('credits').update({ credits: credits - 1 }).eq('user_id', user_id)
      return res.status(200).json({ credits: credits - 1 })
    }

    // 4️⃣ For "generate" action
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' })
    if (credits < 1) return res.status(400).json({ error: 'Not enough credits' })

    // 5️⃣ Call Gemini 2.5 Flash API
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta2/models/gemini-2.5-flash:generate',
      {
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
      }
    )

    const text = await r.text()
    if (!r.ok) {
      console.error('Gemini API returned error:', text)
      return res.status(500).json({ error: 'Gemini API error: ' + text })
    }

    let result
    try { result = JSON.parse(text) } 
    catch {
      console.error('Gemini returned invalid JSON:', text)
      return res.status(500).json({ error: 'Gemini returned invalid JSON: ' + text })
    }

    // 6️⃣ Deduct 1 credit
    await supabase.from('credits').update({ credits: credits - 1 }).eq('user_id', user_id)

    // 7️⃣ Return HTML output + current credits
    res.status(200).json({
      html: result?.candidates?.[0]?.content || '<p>No output</p>',
      credits: credits - 1
    })

  } catch (err) {
    console.error('Server error:', err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}
