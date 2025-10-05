import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, amount = 1 } = req.body
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

  try {
    const { data, error } = await supabase
      .from('credits')
      .select('credits')
      .eq('user_id', user_id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Failed to fetch credits: ' + error.message })
    }

    if (!data) {
      // Initialize user if missing
      await supabase.from('credits').insert({ user_id, credits: 5 - amount })
      return res.status(200).json({ credits: 5 - amount })
    }

    if (data.credits < amount) return res.status(400).json({ error: 'Not enough credits' })

    const { error: updateError } = await supabase
      .from('credits')
      .update({ credits: data.credits - amount })
      .eq('user_id', user_id)

    if (updateError) return res.status(500).json({ error: updateError.message })

    res.status(200).json({ credits: data.credits - amount })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}
