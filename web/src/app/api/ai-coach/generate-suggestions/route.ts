import { NextRequest, NextResponse } from "next/server";
import { XAI_API_URL, FAST_MODEL, FALLBACK_MODEL } from "@/lib/ai";

type SuggestionType = "today" | "tomorrow" | "week";

interface Suggestion {
  type: string;
  content: string;
  targetDate: string;
  weekStartDate?: string;
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const formatDateISO = (date: Date) => date.toISOString().split("T")[0];

function buildPrompt(suggestionType: SuggestionType, todayName: string, tomorrowName: string): string {
  if (suggestionType === "today") {
    return `You are a CrossFit coach giving brief daily motivation for TODAY (${todayName}).

In 2-3 short sentences (under 45 seconds reading time):
- Give an energizing mindset focus for training today
- One quick recovery or mental tip

Be direct and motivating. No workout specifics or diet advice.`;
  }
  if (suggestionType === "tomorrow") {
    return `You are a CrossFit coach reflecting on the past few days of training and looking ahead to TOMORROW (${tomorrowName}).

In 3-4 short sentences (under 45 seconds reading time), focus on:
- Acknowledge what muscles/areas might be sore from recent training
- Suggest recovery techniques for tonight (foam rolling, stretching, sleep)
- Brief mental prep thought for tomorrow

NO workout advice, NO diet advice. Just recovery and reflection.`;
  }
  return `You are a CrossFit coach reflecting on last week's training and setting intentions for this week.

In 3-4 short sentences (under 45 seconds reading time), write like:
- "Last week we probably hit [general CrossFit focus areas]. I hope this week we continue building on [skill/strength area]."
- Mention potential soreness areas and recovery focus
- One hopeful goal or improvement to work toward

NO specific workout advice, NO diet advice. Just reflection and recovery focus. Workouts are hidden so keep it general.`;
}

async function callModel(model: string, prompt: string, apiKey: string): Promise<Response> {
  return fetch(XAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a supportive CrossFit coach focused on recovery, mindset, and reflection. Keep responses brief (under 45 seconds reading). No workout programming or diet advice." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 200
    })
  });
}

async function generateSuggestions(types: SuggestionType[], apiKey: string): Promise<Suggestion[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayName = dayNames[today.getDay()];

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowName = dayNames[tomorrow.getDay()];

  // Get start of week (Sunday)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const generateOne = async (suggestionType: SuggestionType): Promise<Suggestion> => {
    const prompt = buildPrompt(suggestionType, todayName, tomorrowName);

    let response = await callModel(FAST_MODEL, prompt, apiKey);
    if (!response.ok && (response.status === 400 || response.status === 404) && FAST_MODEL !== FALLBACK_MODEL) {
      response = await callModel(FALLBACK_MODEL, prompt, apiKey);
    }
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return {
      type: suggestionType,
      content,
      targetDate: suggestionType === "week" ? formatDateISO(weekStart) : formatDateISO(suggestionType === "today" ? today : tomorrow),
      weekStartDate: suggestionType === "week" ? formatDateISO(weekStart) : undefined
    };
  };

  // Generate all requested suggestions in parallel for speed
  return Promise.all(types.map(generateOne));
}

function typesFor(effectiveType: string): SuggestionType[] {
  // "daily" = today + tomorrow (for daily cron)
  // "all" = today + tomorrow + week (for Sunday cron or manual refresh)
  const types: SuggestionType[] = [];
  if (["all", "daily", "today"].includes(effectiveType)) types.push("today");
  if (["all", "daily", "tomorrow"].includes(effectiveType)) types.push("tomorrow");
  if (["all", "week"].includes(effectiveType)) types.push("week");
  return types;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type, secret } = body;

    // Verify the cron secret for automated calls (from Vercel cron)
    const cronSecret = process.env.CRON_SECRET;
    const isCronJob = secret === cronSecret && cronSecret;

    // For cron jobs without explicit type, determine what to generate based on day
    let effectiveType = type;
    if (!effectiveType || effectiveType === "cron") {
      // Daily at 1 AM: Generate today and tomorrow
      // On Sundays: Also generate week
      const isSunday = new Date().getDay() === 0;
      effectiveType = isSunday ? "all" : "daily";
    }

    if (!effectiveType || !["today", "tomorrow", "week", "all", "daily"].includes(effectiveType)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_XAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    const results = await generateSuggestions(typesFor(effectiveType), apiKey);

    return NextResponse.json({
      success: true,
      suggestions: results,
      generatedAt: new Date().toISOString(),
      isCronJob
    });
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}

// GET endpoint - used by Vercel cron jobs
export async function GET(request: NextRequest) {
  // Check for cron secret in header (Vercel sends this)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Allow if it's a valid cron request or no secret is configured (dev mode)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.NEXT_PUBLIC_XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  // Determine what to generate based on day of week
  const isSunday = new Date().getDay() === 0;
  const effectiveType = isSunday ? "all" : "daily";

  try {
    const results = await generateSuggestions(typesFor(effectiveType), apiKey);

    return NextResponse.json({
      success: true,
      suggestions: results,
      generatedAt: new Date().toISOString(),
      isCronJob: true,
      effectiveType
    });
  } catch (error) {
    console.error("Error generating suggestions (cron):", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
