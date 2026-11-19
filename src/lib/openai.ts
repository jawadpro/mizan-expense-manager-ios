import "server-only";

// A small OpenAI client: one Chat Completions call with a JSON schema answer. No SDK, so nothing extra to install.
// The key lives only in the server's environment (OPENAI_API_KEY) and is never sent to the browser.

export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

export const openaiConfig = () => {
  const key = process.env.OPENAI_API_KEY?.trim() || null;
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  // For an OpenAI-compatible gateway; most installs leave it unset.
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  return { key, model, baseUrl };
};

export class OpenAIError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

/** Reasoning models (gpt-5 family, o-series) take a reasoning effort; older chat models reject it. */
const isReasoningModel = (m: string) => /^(gpt-5|o\d)/.test(m);

export async function chatJson(opts: {
  system: string;
  user: string;
  schema: { name: string; strict: boolean; schema: object };
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ content: string; model: string; usage: { input: number; output: number } }> {
  const { key, model, baseUrl } = openaiConfig();
  if (!key) throw new OpenAIError("AI suggestions aren't set up: OPENAI_API_KEY is missing on the server", 503);

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_schema", json_schema: opts.schema },
    max_completion_tokens: opts.maxTokens ?? 4000,
  };
  if (isReasoningModel(model)) body.reasoning_effort = "low";

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
      cache: "no-store",
    });
  } catch {
    throw new OpenAIError("Couldn't reach OpenAI. Try again in a moment.");
  }

  const data = (await res.json().catch(() => null)) as {
    error?: { message?: string; code?: string };
    model?: string;
    choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null;

  if (!res.ok) {
    // Never echo the key; OpenAI's own message is safe to show (it masks keys itself).
    if (res.status === 401) throw new OpenAIError("OpenAI rejected the API key. Check OPENAI_API_KEY on the server.", 502);
    if (res.status === 429) throw new OpenAIError(data?.error?.code === "insufficient_quota" ? "The OpenAI account is out of credit." : "OpenAI is busy. Try again in a minute.", 429);
    throw new OpenAIError(`OpenAI error: ${data?.error?.message?.slice(0, 200) ?? res.status}`);
  }

  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new OpenAIError(choice?.message?.refusal ? "OpenAI declined to answer." : "OpenAI sent back an empty answer. Try again.");
  return {
    content,
    model: data?.model ?? model,
    usage: { input: data?.usage?.prompt_tokens ?? 0, output: data?.usage?.completion_tokens ?? 0 },
  };
}
