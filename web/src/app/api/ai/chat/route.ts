import { NextRequest } from "next/server";
import { XAI_API_URL, FAST_MODEL, FALLBACK_MODEL, REVISION_MODEL } from "@/lib/aiModels";

// Server-side AI proxy: the xAI key lives here (Vercel env), never in the
// browser. Clients authenticate with their Firebase ID token.

export const maxDuration = 60;

// Firebase WEB API key - public by design, used only to verify ID tokens
const FIREBASE_API_KEY = "AIzaSyAl9Dn4Q_Aj7FULt2cGKeaOOH7oQ5AjI8w";

const ALLOWED_MODELS = new Set([FAST_MODEL, FALLBACK_MODEL, REVISION_MODEL]);

async function verifyFirebaseToken(idToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data.users) && data.users.length > 0;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Prefer the private key; fall back to the legacy public one so nothing
  // breaks before XAI_API_KEY is added to the Vercel env
  const apiKey = process.env.XAI_API_KEY || process.env.NEXT_PUBLIC_XAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI service not configured" }, { status: 500 });
  }

  const idToken = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!idToken || !(await verifyFirebaseToken(idToken))) {
    return Response.json({ error: "Unauthorized - please sign in again" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const model = typeof body.model === "string" && ALLOWED_MODELS.has(body.model) ? body.model : FAST_MODEL;
  const temperature = typeof body.temperature === "number" ? Math.min(Math.max(body.temperature, 0), 2) : 0.7;
  const maxTokens = typeof body.maxTokens === "number" ? Math.min(Math.max(Math.floor(body.maxTokens), 1), 20000) : undefined;
  const stream = body.stream === true;

  const upstream = await fetch(XAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: body.messages,
      temperature,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...(stream ? { stream: true } : {}),
    }),
  });

  if (!upstream.ok) {
    const errorData = await upstream.json().catch(() => ({}));
    return Response.json(
      { error: errorData.error?.message || errorData.error || `AI error: ${upstream.status}` },
      { status: upstream.status }
    );
  }

  if (stream && upstream.body) {
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  const data = await upstream.json();
  return Response.json(data);
}
