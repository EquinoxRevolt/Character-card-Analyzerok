// Self-contained, browser-side AI client with streaming SSE support.
import { buildPrompt } from "./systemInstructions";
import { safeParseJSON } from "./utils";

export type EndpointType = "analyze" | "compare" | "group" | "multichar";

export interface RunnerConfig {
  provider: string; 
  apiKey: string;
  model: string | null;
  customBaseUrl?: string | null;
  thinkingMode?: boolean;
  reasoningEffort?: string;
  modules?: any[];
  maxOutputTokens?: number;
  efficientGrading?: boolean;
}

interface ImagePart {
  mimeType: string;
  base64: string;
}

function providerLabel(provider: string): string {
  if (provider === "openai") return "OpenAI";
  if (provider === "custom") return "the custom endpoint";
  if (provider === "gemini") return "Gemini";
  return "OpenRouter";
}

function normalizeModel(model: string | null | undefined, provider: string): string {
  if (!model || !model.trim()) {
    if (provider === "openrouter") return "google/gemini-3.5-flash";
    if (provider === "openai") return "gpt-5.5";
    return "gemini-3.5-flash";
  }
  let m = model.trim();
  if (provider === "openrouter") {
    m = m.toLowerCase();
    if (m.startsWith("gemini-")) m = "google/" + m;
  } else if (provider === "gemini") {
    m = m.replace(/^google\//i, "");
  }
  return m;
}

function chatCompletionsUrl(provider: string, customBaseUrl?: string | null): string {
  if (provider === "custom" && customBaseUrl && customBaseUrl.trim()) {
    const base = customBaseUrl.trim();
    return base.endsWith("/chat/completions")
      ? base
      : base.replace(/\/+$/, "") + "/chat/completions";
  }
  if (provider === "openai") return "https://api.openai.com/v1/chat/completions";
  return "https://openrouter.ai/api/v1/chat/completions";
}

async function callOpenAICompatible(
  endpoint: EndpointType,
  userText: string,
  images: ImagePart[],
  cfg: RunnerConfig,
  systemContent: string
): Promise<string> {
  const url = chatCompletionsUrl(cfg.provider, cfg.customBaseUrl);

  const userContent: any = images.length
    ? [
        { type: "text", text: userText },
        ...images.map((img) => ({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        })),
      ]
    : userText;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey.trim()}`,
    "Content-Type": "application/json",
  };
  if (cfg.provider === "openrouter") {
    headers["HTTP-Referer"] =
      (typeof window !== "undefined" && window.location?.origin) || "https://loresieve.app";
    headers["X-Title"] = "LoreSieve Character Audit";
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: normalizeModel(cfg.model, cfg.provider),
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
      stream: true,
      ...(cfg.provider === "openai" && { response_format: { type: "json_object" } }),
      ...(cfg.thinkingMode && { reasoning_effort: cfg.reasoningEffort || "medium" }),
      ...(cfg.provider === "openai"
        ? { max_completion_tokens: cfg.maxOutputTokens || 16384 }
        : { max_tokens: cfg.maxOutputTokens || 8192 }),
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    if (res.status === 429) {
      throw new Error("Rate limit reached (429). The provider is busy or your quota is used up.");
    }
    if (res.status === 401) {
      throw new Error(`Authorization failed (401). Check your ${providerLabel(cfg.provider)} API key.`);
    }
    throw new Error(`${providerLabel(cfg.provider)} error ${res.status}: ${errText}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!res.body || (!contentType.includes("text/event-stream") && contentType.includes("application/json"))) {
    const json: any = await res.json();
    if (!json.choices?.[0]?.message) {
      throw new Error("The provider returned no usable output.");
    }
    return json.choices[0].message.content || "{}";
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let accumulatedText = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith("data:")) continue;
        const dataStr = line.slice(5).trim();
        if (dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            accumulatedText += delta.content;
          }
        } catch {}
      }
    }
    if (buffer.trim().startsWith("data:")) {
      const dataStr = buffer.trim().slice(5).trim();
      if (dataStr !== "[DONE]") {
        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            accumulatedText += delta.content;
          }
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!accumulatedText.trim()) throw new Error("The provider returned no usable output.");
  return accumulatedText;
}

async function callGemini(
  endpoint: EndpointType,
  userText: string,
  images: ImagePart[],
  cfg: RunnerConfig,
  systemContent: string
): Promise<string> {
  const model = normalizeModel(cfg.model, "gemini");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const parts: any[] = [{ text: userText }];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey.trim() },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemContent }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        maxOutputTokens: cfg.maxOutputTokens || 8192,
        responseMimeType: "application/json",
        ...(cfg.thinkingMode && { thinkingConfig: { thinkingBudget: -1 } }),
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    if (res.status === 429) throw new Error("Rate limit reached (429). Gemini is busy.");
    if ((res.status === 400 || res.status === 403) && /api[_ ]?key/i.test(errText)) {
      throw new Error("Gemini rejected the API key.");
    }
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }

  const json: any = await res.json();
  const text = (json.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p.text || "")
    .join("");
  return text || "{}";
}

const asArray = (v: any): any[] => (Array.isArray(v) ? v : []);
const asObject = (v: any): any => (v && typeof v === "object" ? v : {});

function normalizeAnalysis(d: any): any {
  const data = asObject(d);
  data.observations = asArray(data.observations);
  if (data.visualComparison) {
    data.visualComparison.matches = asArray(data.visualComparison.matches);
    data.visualComparison.mismatches = asArray(data.visualComparison.mismatches);
  }
  return data;
}

function normalizeResult(endpoint: EndpointType, d: any): any {
  if (endpoint === "analyze") return normalizeAnalysis(d);
  if (endpoint === "compare") {
    const data = asObject(d);
    data.original = normalizeAnalysis(data.original);
    data.remake = normalizeAnalysis(data.remake);
    data.comparison = asObject(data.comparison);
    data.comparison.whatImproved = asArray(data.comparison.whatImproved);
    data.comparison.whatRegressed = asArray(data.comparison.whatRegressed);
    data.comparison.verdictScorecard = asObject(data.comparison.verdictScorecard);
    return data;
  }
  if (endpoint === "group") {
    const data = asObject(d);
    data.synergyAnalysis = asObject(data.synergyAnalysis);
    data.synergyAnalysis.redundancyWarnings = asArray(data.synergyAnalysis.redundancyWarnings);
    data.characterBreakdowns = asArray(data.characterBreakdowns);
    data.groupScenarios = asObject(data.groupScenarios);
    return data;
  }
  const data = asObject(d);
  data.characterAssessments = asArray(data.characterAssessments);
  data.worldAndSystemAnalysis = asObject(data.worldAndSystemAnalysis);
  data.worldAndSystemAnalysis.worldBuilding = asObject(data.worldAndSystemAnalysis.worldBuilding);
  data.worldAndSystemAnalysis.systemRulesAdherence = asObject(
    data.worldAndSystemAnalysis.systemRulesAdherence
  );
  data.playScenarios = asObject(data.playScenarios);
  return data;
}

async function run(
  endpoint: EndpointType,
  userText: string,
  images: ImagePart[],
  cfg: RunnerConfig
): Promise<any> {
  if (!cfg.apiKey || !cfg.apiKey.trim()) {
    throw new Error("No API key set. Open Model Settings and paste your key.");
  }
  
  // Generating the actual system prompt rules so the AI doesn't return blank text
  const systemContent = buildPrompt(endpoint, cfg.modules || [], cfg.efficientGrading || false);

  const raw =
    cfg.provider === "gemini"
      ? await callGemini(endpoint, userText, images, cfg, systemContent)
      : await callOpenAICompatible(endpoint, userText, images, cfg, systemContent);
  
  let parsed: any;
  try {
    parsed = safeParseJSON(raw);
  } catch {
    throw new Error("The AI's reply came back incomplete or malformed.");
  }
  return normalizeResult(endpoint, parsed);
}

function analyzerNotesBlock(notes: string | null | undefined): string {
  if (!notes || !notes.trim()) return "";
  return `\n[OOC/ANALYZER NOTES]\nCRITICAL INSTRUCTION: The user provided external context. DO NOT penalize choices justified by these notes:\n"""\n${notes}\n"""`;
}

export function runAnalyze(
  p: { description: string; imageBase64: string | null; imageMimeType: string | null; analyzerNotes: string | null },
  cfg: RunnerConfig
): Promise<any> {
  const userText = `Analyze the following character card instructions.\n\nCHARACTER DESCRIPTION:\n"""\n${p.description}\n"""${analyzerNotesBlock(p.analyzerNotes)}`;
  const images: ImagePart[] = p.imageBase64 && p.imageMimeType ? [{ mimeType: p.imageMimeType, base64: p.imageBase64 }] : [];
  return run("analyze", userText, images, cfg);
}

export function runCompare(
  p: { originalDescription: string; remakeDescription: string },
  cfg: RunnerConfig
): Promise<any> {
  const userText = `ORIGINAL:\n"""\n${p.originalDescription}\n"""\n\nREMAKE:\n"""\n${p.remakeDescription}\n"""`;
  return run("compare", userText, [], cfg);
}

export function runGroup(
  p: { characters: Array<{ name: string; description: string }> },
  cfg: RunnerConfig
): Promise<any> {
  const userText = p.characters.map((c, i) => `CHAR_${i + 1} (${c.name}):\n${c.description}`).join("\n\n------\n\n");
  return run("group", userText, [], cfg);
}

export function runMultichar(
  p: { description: string; analyzerNotes?: string | null },
  cfg: RunnerConfig
): Promise<any> {
  const userText = `MULTI-CHARACTER CARD DATA:\n\n${p.description}${analyzerNotesBlock(p.analyzerNotes)}`;
  return run("multichar", userText, [], cfg);
}

export async function fetchDeepSeekModels(): Promise<string[]> {
  return [];
}
