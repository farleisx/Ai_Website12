import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

  try {
    const { data, error } = await supabase
      .from('credits')
      .select('credits')
      .eq('user_id', user_id)
      .single()

    if (error) return res.status(500).json({ error: 'Failed to fetch credits: ' + error.message })

    // If user row doesn't exist, initialize with 5 credits
    if (!data) {
      await supabase.from('credits').insert({ user_id, credits: 5 })
      return res.status(200).json({ credits: 5 })
    }

    res.status(200).json({ credits: data.credits })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Failed to fetch credits' })
  }
}
