import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'})
  const { prompt, user_id } = req.body
  if(!prompt || !user_id) return res.status(400).json({error:'Missing prompt or user_id'})

  const { data, error } = await supabase.from('credits').select('credits').eq('user_id',user_id).single()
  if(error || !data) return res.status(500).json({error:'Failed to fetch credits'})
  if(data.credits<1) return res.status(400).json({error:'Not enough credits'})

  try{
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generate',{
      method:'POST',
      headers:{
        'Authorization':`Bearer ${process.env.GEMINI_API_KEY}`,
        'Content-Type':'application/json'
      },
      body: JSON.stringify({prompt:{text:prompt},temperature:0.7,maxOutputTokens:1000})
    })
    const result = await r.json()
    await supabase.from('credits').update({credits:data.credits-1}).eq('user_id',user_id)
    res.status(200).json({html:result?.candidates?.[0]?.content||'<p>No output</p>'})
  }catch(err){
    res.status(500).json({error:err.message||'Generation failed'})
  }
}
