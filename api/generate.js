import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt, previousCode, user_id } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });
  if (!user_id) return res.status(400).json({ error: "Missing user_id" });

  try {
    // 1️⃣ Fetch user credits
    let { data, error } = await supabase
      .from('credits')
      .select('credits')
      .eq('user_id', user_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase fetch error:', error);
      return res.status(500).json({ error: 'Supabase fetch error: ' + error.message });
    }

    // 2️⃣ Initialize credits if missing
    let credits = data?.credits ?? 0;
    if (!data) {
      await supabase.from('credits').insert({ user_id, credits: 5 });
      credits = 5;
    }

    if (credits < 1) return res.status(400).json({ error: "Not enough credits" });

    // 3️⃣ Prepare prompt for AI
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    let requestPrompt = "";

    if (previousCode) {
      requestPrompt = `
You are an AI code builder agent. You have the following existing code:
${previousCode}

The user wants to update or add features according to:
"${prompt}"

Rules:
1. Generate or update code in any language/framework.
2. Wrap code in proper markdown blocks (\`\`\`html\`\`\`, \`\`\`css\`\`\`, etc.).
3. Only return code with inline comments if needed.
4. Update or add only the needed code.
`;
    } else {
      requestPrompt = `
You are an AI code builder agent.
Generate a FULL working project for this request:
"${prompt}"

Rules:
1. Generate code in any language/framework.
2. Wrap code in proper markdown blocks.
3. Only return code with inline comments if needed.
4. For web apps, HTML must be complete (<html>, <head>, <body>).
`;
    }

    // 4️⃣ Generate code
    const result = await model.generateContent(requestPrompt);
    const fullOutput = await result.response.text();

    if (!fullOutput || fullOutput.trim() === "") {
      return res.status(500).json({ error: "AI returned empty output" });
    }

    // 5️⃣ Update previous code with new blocks
    let updatedCode = previousCode || "";
    if (previousCode) {
      const regex = /```(\w+)[\s\S]*?```/g;
      let match;
      while ((match = regex.exec(fullOutput)) !== null) {
        const codeBlock = match[0].replace(/```(\w+)/, '').replace(/```/, '').trim();
        updatedCode += "\n\n" + codeBlock;
      }
    } else {
      updatedCode = fullOutput;
    }

    // 6️⃣ Deduct 1 credit
    await supabase
      .from('credits')
      .update({ credits: credits - 1 })
      .eq('user_id', user_id);

    // 7️⃣ Return code + remaining credits
    res.status(200).json({ output: updatedCode, credits: credits - 1 });

  } catch (err) {
    console.error("AI request failed:", err);
    res.status(500).json({ error: "AI request failed" });
  }
}
