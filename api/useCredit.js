import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'})
  const { user_id } = req.body
  if(!user_id) return res.status(400).json({error:'Missing user_id'})

  const { data, error } = await supabase.from('credits').select('credits').eq('user_id',user_id).single()
  if(error || !data) return res.status(500).json({error:'Failed to fetch credits'})
  if(data.credits<1) return res.status(400).json({error:'Not enough credits'})

  const { error:updateError } = await supabase.from('credits').update({credits:data.credits-1}).eq('user_id',user_id)
  if(updateError) return res.status(500).json({error:updateError.message})
  res.status(200).json({credits:data.credits-1})
}
