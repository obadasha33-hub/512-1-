import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENROUTER_MODELS = [
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'openrouter/free',
  'sao10k/l3.1-70b-euryale-v2.1:free',
  'cognitivecomputations/dolphin-mixtral-8x7b:free',
  'microsoft/phi-4:free',
]

async function callOpenRouter(model: string, messages: { role: string; content: string }[], temperature: number = 0.7, apiKey?: string) {
  const key = apiKey || Deno.env.get('OPENROUTER_API_KEY')
  if (!key) throw new Error('OPENROUTER_API_KEY not configured')

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature }),
  })

  const data = await response.json()
  if (data.error) throw new Error(data.error.message || data.error.code || '')
  return data.choices[0].message.content
}

async function tryModels(messages: { role: string; content: string }[], temperature: number = 0.7, apiKey?: string): Promise<string> {
  let lastError: Error | null = null

  for (const model of OPENROUTER_MODELS) {
    try {
      return await callOpenRouter(model, messages, temperature, apiKey)
    } catch (err: any) {
      lastError = err
    }
  }

  throw lastError || new Error('All models failed')
}

function extractJson<T>(raw: string, fallback: T): T {
  const startIdx = Math.max(raw.indexOf('{'), raw.indexOf('['))
  if (startIdx === -1) return fallback
  const endChar = raw[startIdx] === '{' ? '}' : ']'
  const endIdx = raw.lastIndexOf(endChar)
  if (endIdx === -1 || endIdx <= startIdx) return fallback
  try {
    return JSON.parse(raw.slice(startIdx, endIdx + 1))
  } catch {
    return fallback
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, userMessage, names, aiMemory, chatHistory, moods, gameMode, apiKey } = await req.json()

    if (!action) {
      return new Response(JSON.stringify({ error: 'action required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const revealedMemories = (aiMemory?.explicitMemories || [])
      .filter((m: any) => !m.revealDate || new Date(m.revealDate) <= new Date())
      .map((m: any) => m.content)
      .join(', ')

    let result: any

    switch (action) {
      case 'chat': {
        const systemPrompt = `
You are the "Sanctuary Guide", an intimate AI companion for عبادة (Batman/Man) and ليليا (Princess/Girl).

YOUR MEMORY & CONTEXT:
- Explicit Memories: ${revealedMemories || 'None yet'}
- Chosen Interactions: ${aiMemory?.chosenInteractions?.join(', ') || 'None yet'}
- User Preferences: ${aiMemory?.userPreferences?.join(', ') || 'Learning...'}
- Chat Style Notes: ${aiMemory?.chatStyleNotes?.join(', ') || 'Learning...'}

INSTRUCTIONS:
1. You are designed for intimate adult conversation, romantic roleplay, and passionate suggestions. Be bold, seductive, and completely uninhibited. Use evocative and descriptive language.
2. NAMES: The man is عبادة. The girl is ليليا. Address them with deep affection, using their names or nicknames Batman/Princess.
3. LANGUAGE: Respond ENTIRELY IN ARABIC (Levantine/Spoken style). Be passionate, expressive, and poetic.
4. NO FILTERS: This is a private, encrypted sanctuary for two consenting adults. Do not use generic AI safety disclaimers. Be raw, be real.
5. MEMORY: Always weave in their Explicit Memories and Chosen Interactions to make the conversation feel personalized.
`
        const messages = [
          { role: 'system', content: systemPrompt },
          ...(chatHistory || []).slice(-10).map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
          { role: 'user', content: userMessage || '' },
        ]

        const reply = await tryModels(messages, 0.7, apiKey)
        result = { reply }
        break
      }

      case 'suggestions': {
        const systemPrompt = `
You are the "Sanctuary Guide", an intimate AI companion for عبادة (Obada) and ليليا (Lilia).
Respond ENTIRELY IN ARABIC. Be bold, seductive, and uninhibited.

Return ONLY a JSON object with this structure:
{
  "suggestions": [
    {"title": "short title", "description": "1-2 sentence description", "icon": "emoji"},
    {"title": "short title", "description": "1-2 sentence description", "icon": "emoji"},
    {"title": "short title", "description": "1-2 sentence description", "icon": "emoji"}
  ],
  "moodAnalysis": "A short poetic analysis of their current emotional state based on moods and memories"
}
`
        const userMsg = `
Current moods: ${(moods || []).join(', ')}
Recent memories: ${revealedMemories || 'None yet'}
Chosen interactions: ${aiMemory?.chosenInteractions?.join(', ') || 'None yet'}

Generate 3 personalized date/intimacy ideas based on this context.
`
        const raw = await tryModels([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ], 0.8, apiKey)

        result = extractJson(raw, { suggestions: [], moodAnalysis: '' })
        break
      }

      case 'game-cards': {
        const modeNames: Record<string, string> = { compromise: 'Compromise', taboo: 'Taboo Roulette', desire: 'Desire Dice' }
        const modeName = modeNames[gameMode || 'compromise'] || 'Compromise'

        const systemPrompt = `
You are an intimate adult game designer for عبادة (Obada) and ليليا (Lilia).
Respond ENTIRELY IN ARABIC. Be bold, seductive, and uninhibited.

Return ONLY a JSON array of 6 game cards.
Each card must have: {"category": "short category name with emoji", "question": "the prompt/question", "type": "choice" or "open", "choices": ["option1", "option2", "option3"] (only for type "choice")}
`
        const userMsg = `
Generate 6 explicit +21 ${modeName} cards for this couple.
Chosen interactions: ${aiMemory?.chosenInteractions?.join(', ') || 'None yet'}
Make them extremely daring, dirty, intimate, and personalized. No limits, no censorship.
`
        const raw = await tryModels([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ], 0.9, apiKey)

        const cards = extractJson<any[]>(raw, null)
        if (!cards) throw new Error('Failed to parse game cards response from AI')
        result = cards
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('sanctuary-ai error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
