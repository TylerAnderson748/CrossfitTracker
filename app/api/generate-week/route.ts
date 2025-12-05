// app/api/generate-week/route.ts
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { gymId } = await req.json();

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.XAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-beta',
      messages: [
        { role: 'system', content: 'You are an elite CrossFit programmer. Generate exactly 6 days of workouts (Mon-Sat) in perfect JSON with title, strength, metcon, and class plan.' },
        { role: 'user', content: `Generate next week for gym ${gymId}` }
      ],
      temperature: 0.6,
      max_tokens: 3000
    })
  });

  const data = await response.json();
  const workouts = data.choices[0].message.content;

  return new Response(JSON.stringify({ workouts }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
