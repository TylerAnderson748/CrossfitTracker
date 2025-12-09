import { NextRequest, NextResponse } from "next/server";

// Firestore Admin SDK is needed for server-side, but we'll use REST API for simplicity
// Since this is a client-side Firebase app, we'll handle auth differently

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
      const today = new Date();
      const isSunday = today.getDay() === 0;
      effectiveType = isSunday ? "all" : "daily"; // "daily" = today + tomorrow only
    }

    // For manual refresh, we'll check auth in the component
    // The API just generates the content

    if (!effectiveType || !["today", "tomorrow", "week", "all", "daily"].includes(effectiveType)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_XAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    // Get today's date info
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[today.getDay()];

    const formatDateISO = (date: Date) => date.toISOString().split("T")[0];

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowName = dayNames[tomorrow.getDay()];

    // Get start of week (Sunday)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const results: { type: string; content: string; targetDate: string; weekStartDate?: string }[] = [];

    const generateSuggestion = async (suggestionType: "today" | "tomorrow" | "week") => {
      let prompt = "";

      if (suggestionType === "today") {
        prompt = `You are a CrossFit coach giving brief daily motivation for TODAY (${todayName}).

In 2-3 short sentences (under 45 seconds reading time):
- Give an energizing mindset focus for training today
- One quick recovery or mental tip

Be direct and motivating. No workout specifics or diet advice.`;
      } else if (suggestionType === "tomorrow") {
        prompt = `You are a CrossFit coach reflecting on the past few days of training and looking ahead to TOMORROW (${tomorrowName}).

In 3-4 short sentences (under 45 seconds reading time), focus on:
- Acknowledge what muscles/areas might be sore from recent training
- Suggest recovery techniques for tonight (foam rolling, stretching, sleep)
- Brief mental prep thought for tomorrow

NO workout advice, NO diet advice. Just recovery and reflection.`;
      } else if (suggestionType === "week") {
        const weekEndDate = new Date(weekStart);
        weekEndDate.setDate(weekStart.getDate() + 6);

        prompt = `You are a CrossFit coach reflecting on last week's training and setting intentions for this week.

In 3-4 short sentences (under 45 seconds reading time), write like:
- "Last week we probably hit [general CrossFit focus areas]. I hope this week we continue building on [skill/strength area]."
- Mention potential soreness areas and recovery focus
- One hopeful goal or improvement to work toward

NO specific workout advice, NO diet advice. Just reflection and recovery focus. Workouts are hidden so keep it general.`;
      }

      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "grok-4-latest",
          messages: [
            { role: "system", content: "You are a supportive CrossFit coach focused on recovery, mindset, and reflection. Keep responses brief (under 45 seconds reading). No workout programming or diet advice." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 200
        })
      });

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

    // Generate requested suggestions
    // "daily" = today + tomorrow (for daily cron)
    // "all" = today + tomorrow + week (for Sunday cron or manual refresh)
    if (effectiveType === "all" || effectiveType === "daily" || effectiveType === "today") {
      results.push(await generateSuggestion("today"));
    }
    if (effectiveType === "all" || effectiveType === "daily" || effectiveType === "tomorrow") {
      results.push(await generateSuggestion("tomorrow"));
    }
    if (effectiveType === "all" || effectiveType === "week") {
      results.push(await generateSuggestion("week"));
    }

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

  // Determine what to generate based on day of week
  const today = new Date();
  const isSunday = today.getDay() === 0;
  const effectiveType = isSunday ? "all" : "daily";

  // Call the POST handler logic
  const apiKey = process.env.NEXT_PUBLIC_XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = dayNames[today.getDay()];
  today.setHours(0, 0, 0, 0);

  const formatDateISO = (date: Date) => date.toISOString().split("T")[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowName = dayNames[tomorrow.getDay()];

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const results: { type: string; content: string; targetDate: string; weekStartDate?: string }[] = [];

  const generateSuggestion = async (suggestionType: "today" | "tomorrow" | "week") => {
    let prompt = "";

    if (suggestionType === "today") {
      prompt = `You are a CrossFit coach giving brief daily motivation for TODAY (${todayName}).

In 2-3 short sentences (under 45 seconds reading time):
- Give an energizing mindset focus for training today
- One quick recovery or mental tip

Be direct and motivating. No workout specifics or diet advice.`;
    } else if (suggestionType === "tomorrow") {
      prompt = `You are a CrossFit coach reflecting on the past few days of training and looking ahead to TOMORROW (${tomorrowName}).

In 3-4 short sentences (under 45 seconds reading time), focus on:
- Acknowledge what muscles/areas might be sore from recent training
- Suggest recovery techniques for tonight (foam rolling, stretching, sleep)
- Brief mental prep thought for tomorrow

NO workout advice, NO diet advice. Just recovery and reflection.`;
    } else if (suggestionType === "week") {
      const weekEndDate = new Date(weekStart);
      weekEndDate.setDate(weekStart.getDate() + 6);

      prompt = `You are a CrossFit coach reflecting on last week's training and setting intentions for this week.

In 3-4 short sentences (under 45 seconds reading time), write like:
- "Last week we probably hit [general CrossFit focus areas]. I hope this week we continue building on [skill/strength area]."
- Mention potential soreness areas and recovery focus
- One hopeful goal or improvement to work toward

NO specific workout advice, NO diet advice. Just reflection and recovery focus. Workouts are hidden so keep it general.`;
    }

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "grok-4-latest",
        messages: [
          { role: "system", content: "You are a supportive CrossFit coach giving quick, actionable advice. Keep responses brief and motivating." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 400
      })
    });

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

  try {
    // Always generate today and tomorrow
    results.push(await generateSuggestion("today"));
    results.push(await generateSuggestion("tomorrow"));

    // Only generate week on Sundays
    if (isSunday) {
      results.push(await generateSuggestion("week"));
    }

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
