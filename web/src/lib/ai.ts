// Centralized xAI/Grok client for all Oddo features.
//
// Speed strategy:
// - Default to grok-4-fast-non-reasoning: responses start in ~1s instead of the
//   long thinking delay of grok-4-latest. Override with NEXT_PUBLIC_XAI_MODEL.
// - Stream responses wherever the UI can render text incrementally.
// - If the configured fast model is rejected by the API (e.g. renamed), retry
//   once with FALLBACK_MODEL so the coach never goes down.

export const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

// Fast model for chat/coaching text (and vision - grok-4-fast is multimodal)
export const FAST_MODEL = process.env.NEXT_PUBLIC_XAI_MODEL || "grok-4-fast-non-reasoning";
export const FALLBACK_MODEL = process.env.NEXT_PUBLIC_XAI_FALLBACK_MODEL || "grok-4-latest";

export function getApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_XAI_API_KEY;
}

type MessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: MessageContent;
}

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Streaming callback - receives each new chunk of text as it arrives. */
  onDelta?: (textSoFar: string, delta: string) => void;
  signal?: AbortSignal;
}

async function requestCompletion(
  model: string,
  { messages, temperature = 0.7, maxTokens, onDelta, signal }: ChatOptions,
  apiKey: string
): Promise<{ ok: boolean; status: number; text: string; errorMessage?: string }> {
  const response = await fetch(XAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...(onDelta ? { stream: true } : {}),
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      ok: false,
      status: response.status,
      text: "",
      errorMessage: errorData.error?.message || errorData.error || `API error: ${response.status}`,
    };
  }

  // Non-streaming path
  if (!onDelta) {
    const data = await response.json();
    return { ok: true, status: response.status, text: data.choices?.[0]?.message?.content || "" };
  }

  // Streaming path - parse SSE chunks
  const reader = response.body?.getReader();
  if (!reader) {
    return { ok: false, status: response.status, text: "", errorMessage: "Streaming not supported" };
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          onDelta(fullText, delta);
        }
      } catch {
        // Ignore malformed SSE lines
      }
    }
  }

  return { ok: true, status: response.status, text: fullText };
}

/**
 * Run a chat completion against the fast model, falling back to the slower
 * model only if the fast model is rejected (bad model name / no access).
 * Returns the full response text. Throws on unrecoverable errors.
 */
export async function chatCompletion(options: ChatOptions): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("AI service not configured. Please add NEXT_PUBLIC_XAI_API_KEY to your environment.");
  }

  const result = await requestCompletion(FAST_MODEL, options, apiKey);
  if (result.ok) return result.text;

  // 400/404 usually means the model name isn't available - retry on fallback
  if ((result.status === 400 || result.status === 404) && FAST_MODEL !== FALLBACK_MODEL) {
    const retry = await requestCompletion(FALLBACK_MODEL, options, apiKey);
    if (retry.ok) return retry.text;
    throw new Error(retry.errorMessage || "AI request failed");
  }

  throw new Error(result.errorMessage || "AI request failed");
}
