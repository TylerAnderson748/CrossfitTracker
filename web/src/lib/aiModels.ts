// Model configuration shared by the browser client and server routes.
// Keep this file dependency-free (no firebase imports) so API routes can
// import it without dragging client SDKs into the server bundle.

export const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

// Fast model for chat/coaching text (and vision - grok-4-fast is multimodal)
export const FAST_MODEL = process.env.NEXT_PUBLIC_XAI_MODEL || "grok-4-fast-non-reasoning";
export const FALLBACK_MODEL = process.env.NEXT_PUBLIC_XAI_FALLBACK_MODEL || "grok-4-latest";
// Stronger (reasoning) model for plan revisions - patching an existing table
// correctly needs more care than speed; override with NEXT_PUBLIC_XAI_REVISION_MODEL
export const REVISION_MODEL = process.env.NEXT_PUBLIC_XAI_REVISION_MODEL || FALLBACK_MODEL;
// Week generation: fast-reasoning tier - deliberation without the full
// reasoning model's latency (a plan runs many calls per block, and the
// critic pipeline catches what a lighter writer misses)
export const PLAN_MODEL = process.env.NEXT_PUBLIC_XAI_PLAN_MODEL || "grok-4-fast-reasoning";
