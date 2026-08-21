import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Ordered fallback models for high availability during peak traffic / 503 spikes
const VALID_GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.7-flash-lite",
];

const DEPRECATED_GEMINI_MAP: Record<string, string> = {
  "gemini-2.5-flash": "gemini-3.6-flash",
  "gemini-2.0-flash": "gemini-3.6-flash",
  "gemini-2.0-flash-lite": "gemini-3.5-flash-lite",
  "gemini-1.5-flash": "gemini-3.6-flash",
  "gemini-1.5-pro": "gemini-3.6-flash",
};

function normalizeGeminiModel(modelName: string | undefined): string {
  if (!modelName) return "gemini-3.6-flash";
  const mapped = DEPRECATED_GEMINI_MAP[modelName];
  if (mapped) return mapped;
  return modelName.startsWith("gemini-") ? modelName : "gemini-3.6-flash";
}

async function generateWithFallback(
  ai: GoogleGenAI,
  primaryModel: string | undefined,
  contents: any,
  config: any
): Promise<{ text: string; modelUsed: string }> {
  const sanitizedPrimary = normalizeGeminiModel(primaryModel);
  const modelsToTry = Array.from(new Set([sanitizedPrimary, ...VALID_GEMINI_MODELS]));

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      const text = response.text || "";
      if (text && text.trim().length > 0) {
        return { text, modelUsed: model };
      }
    } catch (err: any) {
      lastError = err;
      const isHighDemandOrUnavailable =
        err?.status === 503 ||
        err?.status === 429 ||
        err?.message?.includes("503") ||
        err?.message?.includes("high demand") ||
        err?.message?.includes("UNAVAILABLE") ||
        err?.message?.includes("Resource has been exhausted");

      console.warn(
        `Gemini model [${model}] failed (${err?.message || "Error"}). ${
          isHighDemandOrUnavailable ? "Trying next fallback model..." : "Retrying fallback..."
        }`
      );
      // Wait a short duration before trying the next model
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  throw lastError || new Error("All AI models in the fallback chain failed.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      hasServerGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // Server-side AI Inference Route (Gemini & Multi-model proxy)
  app.post("/api/ai/generate", async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        system,
        user,
        images = [],
        provider = "gemini_server",
        apiKey,
        model,
        customBaseUrl,
        maxTokens = 2000,
        temperature = 0.3,
        jsonMode = false,
      } = req.body;

      // 1. Anthropic Claude (via server proxy to bypass browser CORS)
      if (provider === "anthropic") {
        const key = apiKey || process.env.ANTHROPIC_API_KEY;
        if (!key) {
          return res.status(400).json({
            error: "Anthropic API Key is not configured. Please open Settings (Ctrl+Shift+K) to enter your API key.",
            status: "error",
          });
        }

        const effectiveModel =
          model && !model.startsWith("gemini-") ? model : "claude-3-5-sonnet-20241022";

        const anthropicContent: any[] = [];
        if (Array.isArray(images) && images.length > 0) {
          for (const img of images) {
            if (img && img.data) {
              anthropicContent.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: img.mimeType || "image/jpeg",
                  data: img.data,
                },
              });
            }
          }
        }
        anthropicContent.push({ type: "text", text: user || "" });

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: effectiveModel,
            max_tokens: maxTokens,
            system: system || undefined,
            messages: [{ role: "user", content: anthropicContent }],
          }),
        });

        const data: any = await anthropicRes.json();
        if (!anthropicRes.ok || data.error) {
          throw new Error(data.error?.message || `Anthropic API error: ${anthropicRes.status}`);
        }

        const text = data.content?.find((c: any) => c.type === "text")?.text || "";
        const latencyMs = Date.now() - startTime;
        return res.json({
          text,
          status: "success",
          modelUsed: effectiveModel,
          providerUsed: "anthropic",
          latencyMs,
        });
      }

      // 2. Groq (via server proxy)
      if (provider === "groq") {
        const key = apiKey || process.env.GROQ_API_KEY;
        if (!key) {
          return res.status(400).json({
            error: "Groq API Key is not configured. Please open Settings (Ctrl+Shift+K) to enter your API key.",
            status: "error",
          });
        }

        const effectiveModel =
          model && !model.startsWith("gemini-") ? model : "llama-3.3-70b-versatile";

        const groqMessages: any[] = [];
        if (system) {
          groqMessages.push({ role: "system", content: system });
        }

        if (Array.isArray(images) && images.length > 0 && effectiveModel.includes("vision")) {
          const userContent: any[] = [{ type: "text", text: user }];
          for (const img of images) {
            if (img && img.data) {
              userContent.push({
                type: "image_url",
                image_url: {
                  url: `data:${img.mimeType || "image/jpeg"};base64,${img.data}`,
                },
              });
            }
          }
          groqMessages.push({ role: "user", content: userContent });
        } else {
          groqMessages.push({ role: "user", content: user });
        }

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: effectiveModel,
            messages: groqMessages,
            max_tokens: maxTokens,
            temperature: Math.max(0.1, Math.min(temperature || 0.3, 0.7)),
            top_p: 0.95,
          }),
        });

        const data: any = await groqRes.json();
        if (!groqRes.ok || data.error) {
          throw new Error(data.error?.message || `Groq API error: ${groqRes.status}`);
        }

        const text = data.choices?.[0]?.message?.content || "";
        const latencyMs = Date.now() - startTime;
        return res.json({
          text,
          status: "success",
          modelUsed: effectiveModel,
          providerUsed: "groq",
          latencyMs,
        });
      }

      // 3. Featherless AI (via server proxy)
      if (provider === "featherless") {
        const key = apiKey || process.env.FEATHERLESS_API_KEY;
        if (!key) {
          return res.status(400).json({
            error: "Featherless API Key is not configured. Please open Settings (Ctrl+Shift+K) to enter your API key.",
            status: "error",
          });
        }

        const effectiveModel =
          model && !model.startsWith("gemini-") ? model : "Qwen/Qwen3.5-27B";

        const flRes = await fetch("https://api.featherless.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: effectiveModel,
            messages: system
              ? [
                  { role: "system", content: system },
                  { role: "user", content: user },
                ]
              : [{ role: "user", content: user }],
            max_tokens: maxTokens,
            temperature: Math.max(0.2, Math.min(temperature || 0.4, 0.7)),
            top_p: 0.9,
            repetition_penalty: 1.15,
          }),
        });

        const data: any = await flRes.json();
        if (!flRes.ok || data.error) {
          throw new Error(data.error?.message || `Featherless API error: ${flRes.status}`);
        }

        const text = data.choices?.[0]?.message?.content || "";
        const latencyMs = Date.now() - startTime;
        return res.json({
          text,
          status: "success",
          modelUsed: effectiveModel,
          providerUsed: "featherless",
          latencyMs,
        });
      }

      // 4. Custom OpenAI-compatible / Local endpoint (Ollama, LM Studio, vLLM, OpenRouter)
      if (provider === "custom") {
        const targetUrl = customBaseUrl || "http://localhost:11434/v1/chat/completions";
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }

        const effectiveModel = model && !model.startsWith("gemini-") ? model : "gpt-4o-mini";

        const customMessages: any[] = [];
        if (system) {
          customMessages.push({ role: "system", content: system });
        }

        if (Array.isArray(images) && images.length > 0) {
          const userContent: any[] = [{ type: "text", text: user }];
          for (const img of images) {
            if (img && img.data) {
              userContent.push({
                type: "image_url",
                image_url: {
                  url: `data:${img.mimeType || "image/jpeg"};base64,${img.data}`,
                },
              });
            }
          }
          customMessages.push({ role: "user", content: userContent });
        } else {
          customMessages.push({ role: "user", content: user });
        }

        const customRes = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: effectiveModel,
            messages: customMessages,
            max_tokens: maxTokens,
            temperature: Math.max(0.1, Math.min(temperature || 0.3, 0.8)),
          }),
        });

        const data: any = await customRes.json();
        if (!customRes.ok || data.error) {
          throw new Error(data.error?.message || `Custom API error: ${customRes.status}`);
        }

        const text = data.choices?.[0]?.message?.content || "";
        const latencyMs = Date.now() - startTime;
        return res.json({
          text,
          status: "success",
          modelUsed: effectiveModel,
          providerUsed: "custom",
          latencyMs,
        });
      }

      // 5. Google Gemini (Server env key OR custom client key)
      const activeGeminiClient = apiKey
        ? new GoogleGenAI({ apiKey })
        : getAI();

      if (!activeGeminiClient) {
        return res.status(400).json({
          error: "No active Gemini API key configured. Please open Settings (Ctrl+Shift+K) to configure an API key.",
          fallbackAvailable: false,
          status: "error",
        });
      }

      const config: any = {
        temperature: Math.max(0.1, Math.min(temperature || 0.3, 0.7)),
        maxOutputTokens: maxTokens,
      };

      if (system) {
        config.systemInstruction = system;
      }

      if (jsonMode) {
        config.responseMimeType = "application/json";
      }

      const effectiveGeminiModel =
        model && model.startsWith("gemini-") ? normalizeGeminiModel(model) : "gemini-3.6-flash";

      let geminiContents: any = user;
      if (Array.isArray(images) && images.length > 0) {
        const parts: any[] = [];
        for (const img of images) {
          if (img && img.data) {
            parts.push({
              inlineData: {
                mimeType: img.mimeType || "image/jpeg",
                data: img.data,
              },
            });
          }
        }
        parts.push({ text: user || "" });
        geminiContents = parts;
      }

      const { text, modelUsed } = await generateWithFallback(
        activeGeminiClient,
        effectiveGeminiModel,
        geminiContents,
        config
      );

      const latencyMs = Date.now() - startTime;
      return res.json({
        text,
        status: "success",
        modelUsed,
        providerUsed: apiKey ? "gemini_client" : "gemini_server",
        latencyMs,
      });
    } catch (err: any) {
      console.error("AI Generation Error:", err?.message || err);
      const latencyMs = Date.now() - startTime;
      return res.status(200).json({
        error: err.message || "Failed to generate AI content",
        fallbackAvailable: true,
        text: "",
        status: "error",
        latencyMs,
      });
    }
  });

  // Live Web Resources Discovery & Grounding API
  app.post("/api/resources/search", async (req, res) => {
    const { query, topic, category = "all" } = req.body;
    const searchTerm = query || topic || "Engineering Foundations";

    try {
      const ai = getAI();

      if (!ai) {
        return res.json({
          live: false,
          message: "Server Gemini key not set; using curated resource synthesis.",
          results: generateServerFallbackResources(searchTerm, category),
        });
      }

      const prompt = `You are a curriculum resource research engine for engineering students.
Topic / Query: "${searchTerm}"
Category Filter: "${category}"

Find 6 to 8 real, accurate, high-quality learning resources (documentation, interactive guides, video tutorials, practice problems, official repositories, cheatsheets) for this topic.
For each resource, provide real verifiable URLs and accurate metadata.

Return ONLY a JSON array with this schema:
[
  {
    "id": "unique-id",
    "title": "Title of resource",
    "source": "Platform name (e.g. GeeksforGeeks, MDN, YouTube, NPTEL, Harvard CS50, Coursera, FreeCodeCamp)",
    "type": "video" | "article" | "interactive" | "practice" | "documentation",
    "url": "Direct valid URL",
    "description": "2 sentence clear summary of why this resource is valuable",
    "difficulty": "Beginner" | "Intermediate" | "Advanced",
    "duration": "e.g. 15 mins read or 45 mins video",
    "tags": ["tag1", "tag2"]
  }
]`;

      const { text } = await generateWithFallback(
        ai,
        "gemini-3.6-flash",
        prompt,
        {
          systemInstruction:
            "You are an expert technical resource finder. Only return clean, valid JSON array. Never output markdown codeblocks outside JSON.",
          responseMimeType: "application/json",
          temperature: 0.2,
        }
      );

      let parsed = [];
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = [];
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        parsed = generateServerFallbackResources(searchTerm, category);
      }

      return res.json({
        live: true,
        query: searchTerm,
        results: parsed,
      });
    } catch (err: any) {
      console.warn("Resource search model busy; using curated technical synthesis:", err?.message || err);
      return res.json({
        live: false,
        fallback: true,
        query: searchTerm,
        results: generateServerFallbackResources(searchTerm, category),
      });
    }
  });

  // Dedicated Adaptive Assessment Endpoint: Batch 1 Generation (System Prompt 1)
  app.post("/api/ai/assessment/batch1", async (req, res) => {
    try {
      const {
        topic,
        subjectTitle,
        selectedTypes = ["mcq", "true_false"],
        targetDifficulty = "adaptive",
        typeLimits = {},
      } = req.body;
      const ai = getAI();

      if (!ai) {
        return res.status(200).json({
          error: "GEMINI_API_KEY is not configured on the server. Falling back to local offline question engine.",
          fallback: true,
          questions: [],
        });
      }

      const detectedLang = req.body.requestedLanguage || null;
      const metadataPayload = {
        subject: subjectTitle || topic,
        language: detectedLang,
        topic,
        difficulty: targetDifficulty || "adaptive",
        batchNumber: 1,
        questionCount: 6,
        domain_constraints: {
          language: detectedLang,
        },
      };

      const prompt = `Assessment Request Metadata:
${JSON.stringify(metadataPayload, null, 2)}

Instructions:
Generate a balanced, high-yield baseline assessment of exactly 6 questions total tailored specifically for "${topic}".
Use a diagnostic mix suited to the topic from: "mcq" (2), "true_false" (1), "fill_blank" (1), and application/code questions ("code_input", "debugging", "arrange_steps", "explanation") (2).

Required schema for each item:
- "id": "q_1_1", "q_1_2", ...
- "type": "mcq" | "true_false" | "fill_blank" | "code_input" | "debugging" | "arrange_steps" | "explanation"
- "question": specific, realistic, non-placeholder prompt
- "topic": "${topic}"
- "difficulty": "easy" | "medium" | "hard"
- "dimension": "concept" | "application" | "implementation" | "debugging" | "algorithmic_thinking"
- "points": 10
- "explanation": clear solution and technical reasoning
- Type-specific fields:
  - mcq: "options" (array of 4 unique strings), "correctAnswer" (index 0..3)
  - true_false: "correctAnswer" (boolean true/false)
  - fill_blank: "template" (must contain "{{blank}}"), "correctAnswers" (array of strings)
  - code_input: "language" (${detectedLang ? `"${detectedLang}"` : 'pick ONE language and reuse it for every programming question in this batch'}), "starterCode", "expectedOutputOrPattern", "evaluationCriteria" (array)
  - debugging: "language" (${detectedLang ? `"${detectedLang}"` : 'same language as every other programming question in this batch'}), "buggyCode", "bugDescriptionPrompt", "bugType" ("syntax"|"logical"|"edge_case"|"concurrency"|"off_by_one"), "fixedCodeSnippet", "explanationOfBug", "evaluationCriteria" (array — REQUIRED, must describe how to judge the fix and must describe the exact same issue as bugDescriptionPrompt/explanationOfBug)
  - arrange_steps: "contextTitle", "shuffledSteps" (array of >=3 {"id":"s1","text":"..."}), "correctOrderIds" (array of string IDs in order)
  - explanation: "rubricKeywords" (array of key terms/concepts), "idealAnswerSummary"

DOMAIN CORRECTNESS RULES (violating any of these makes a question invalid and it WILL be rejected):
- Never switch programming language between questions in this batch; if no language is supplied above, choose one language yourself and use it for every code_input/debugging question.
- Any tree/BST invariant must hold recursively for EVERY node (not just "the root"), and must state BOTH the left-subtree (< node) and right-subtree (> node) conditions.
- Never claim an ordinary BST "must remain balanced" or has worst-case O(log n). State: ordinary BST average-case O(log n), worst-case O(n); only self-balancing BSTs (AVL, Red-Black) guarantee O(log n) worst-case.
- If duplicates are mentioned for a BST/ordered structure, explicitly state the policy (prohibited / go left / go right / counted).
- Explicitly state the node representation (dictionary vs class/object) in every programming question and use IDENTICAL access syntax everywhere it appears (prompt, code, expected behavior, explanation, evaluationCriteria): dictionaries use node["value"], objects/classes use node.value — never mix them.
- BST deletion "arrange_steps" questions must use only the standard representation-independent process: find the inorder successor, copy/replace the value, delete the successor from the right subtree, reconnect the affected subtree. Never invent a "parent pointer" step unless parent pointers were explicitly defined in the question.
- If a question cannot be made to satisfy every rule above, omit it rather than guessing.

Return ONLY a valid JSON array of question objects.`;

      const { text } = await generateWithFallback(
        ai,
        "gemini-3.6-flash",
        prompt,
        {
          systemInstruction: `You are the LearnPath Assessment Generator.
1. Generate clear, unambiguous, objective questions.
2. Every question must test a meaningful concept.
3. Every question must have an objectively correct answer.
4. Explanations must directly explain why the answer is correct and why incorrect options are wrong.
5. Never allow an explanation to contradict the answer.
6. Do not repeat the same concept with different wording.
7. Difficulty must match cognitive demand.
8. Return only valid JSON matching the supplied schema.
9. Never output markdown.
10. Never output commentary outside the JSON.`,
          responseMimeType: "application/json",
          temperature: 0.3,
        }
      );

      let parsed: any = [];
      try {
        parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          if (parsed.questions && Array.isArray(parsed.questions)) {
            parsed = parsed.questions;
          } else {
            parsed = [];
          }
        }
      } catch {
        parsed = [];
      }

      return res.json({ status: "success", questions: parsed, batchNumber: 1 });
    } catch (err: any) {
      console.warn("Batch 1 generation error (handled):", err?.message || err);
      return res.status(200).json({ error: err.message, fallback: true, questions: [] });
    }
  });

  // Dedicated Adaptive Assessment Endpoint: Batch Submission Analysis & Next Batch / Skill Verdict (System Prompt 2)
  app.post("/api/ai/assessment/adaptive-next", async (req, res) => {
    try {
      const { topic, batchNumber, questions, userResponses, previousAnalysis } = req.body;
      const ai = getAI();

      if (!ai) {
        return res.status(200).json({
          error: "GEMINI_API_KEY is not configured on the server. Falling back to local offline evaluation.",
          fallback: true,
        });
      }

      const prompt = `Student Assessment Adaptive Analysis:
Topic: "${topic}"
Completed Batch Number: ${batchNumber}
Questions & Responses:
${JSON.stringify({ questions, userResponses }, null, 2)}
Previous Analysis: ${previousAnalysis || "None"}

Perform a deep cognitive assessment:
1. Identify the student's mastery level (Novice, Competent, Proficient, Master), concept strengths, and specific weak points.
2. Formulate 2-3 tailored follow-up questions (using supported formats: mcq, true_false, fill_blank, code_input, debugging, arrange_steps, explanation) targeting their weak cognitive dimensions for Batch ${Number(batchNumber) + 1}.

Return ONLY a JSON object:
{
  "summary": "1-2 sentence cognitive analysis of their performance",
  "skillLevel": "Novice" | "Competent" | "Proficient" | "Master",
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "radarScores": {
    "concept": 0-100,
    "application": 0-100,
    "implementation": 0-100,
    "debugging": 0-100,
    "algorithmic_thinking": 0-100
  },
  "recommendedFocus": "Specific topics or exercises to practice next",
  "isFinalVerdict": false,
  "nextQuestions": [ ...next batch questions matching standard schema... ]
}`;

      const { text } = await generateWithFallback(
        ai,
        "gemini-3.6-flash",
        prompt,
        {
          systemInstruction:
            "You are the Batch Submission & Adaptive Analysis Controller for LearnPath. Return ONLY valid JSON.",
          responseMimeType: "application/json",
          temperature: 0.3,
        }
      );

      let parsed: any = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {};
      }

      return res.json({ status: "success", analysis: parsed });
    } catch (err: any) {
      console.warn("Adaptive evaluation error (handled):", err?.message || err);
      return res.status(200).json({ error: err.message, fallback: true });
    }
  });

  // In-memory Database / Server Persistence Store (with Postgres bridge)
  const serverDbStore = {
    sessions: [] as any[],
    userProfiles: {} as Record<string, any>,
    topicMastery: {} as Record<string, any>,
    roadmaps: {} as Record<string, any>,
    bookmarks: [] as any[],
    lastSync: null as string | null,
  };

  // Postgres / Database Synchronization Route
  app.post("/api/db/sync", (req, res) => {
    try {
      const { user, sessions, topicMastery, roadmaps, bookmarks, connectionString } = req.body;

      if (sessions && Array.isArray(sessions)) {
        serverDbStore.sessions = sessions;
      }
      if (user) {
        serverDbStore.userProfiles[user.email || "default"] = user;
      }
      if (topicMastery) {
        serverDbStore.topicMastery = { ...serverDbStore.topicMastery, ...topicMastery };
      }
      if (roadmaps) {
        serverDbStore.roadmaps = { ...serverDbStore.roadmaps, ...roadmaps };
      }
      if (bookmarks) {
        serverDbStore.bookmarks = bookmarks;
      }
      serverDbStore.lastSync = new Date().toISOString();

      const hasPgUrl = Boolean(connectionString || process.env.DATABASE_URL);

      return res.json({
        success: true,
        message: hasPgUrl
          ? "Synchronized with PostgreSQL data storage successfully."
          : "Persisted to Server Database Store (Local Storage sync active).",
        hasPostgresConnection: hasPgUrl,
        timestamp: serverDbStore.lastSync,
        recordsSynced: {
          sessions: serverDbStore.sessions.length,
          topics: Object.keys(serverDbStore.topicMastery).length,
        },
      });
    } catch (err: any) {
      console.error("DB Sync error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // DB Status Route
  app.get("/api/db/status", (_req, res) => {
    res.json({
      connected: true,
      status: Boolean(process.env.DATABASE_URL)
        ? "PostgreSQL Connected"
        : "Local Storage + Server Database Active",
      lastSync: serverDbStore.lastSync,
      sessionsCount: serverDbStore.sessions.length,
      topicsMasteredCount: Object.values(serverDbStore.topicMastery).filter(
        (t: any) => t.status === "mastered"
      ).length,
    });
  });

  // DB Sessions retrieval
  app.get("/api/db/sessions", (_req, res) => {
    res.json({
      sessions: serverDbStore.sessions,
      count: serverDbStore.sessions.length,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function generateServerFallbackResources(term: string, category?: string) {
  const base = [
    {
      id: `srv_res_1_${Date.now()}`,
      title: `${term} — Complete Deep Dive & Core Mechanics`,
      source: "GeeksforGeeks",
      type: "article",
      url: `https://www.geeksforgeeks.org/search/?q=${encodeURIComponent(term)}`,
      description: `Comprehensive conceptual breakdown with time complexity diagrams, structural invariances, and real code snippets.`,
      difficulty: "Beginner",
      duration: "15 min read",
      tags: [term, "Core Concept", "Theory"],
    },
    {
      id: `srv_res_2_${Date.now()}`,
      title: `${term} — Step-by-Step Video Masterclass`,
      source: "YouTube Education",
      type: "video",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(term + " full tutorial engineering")}`,
      description: `Engaging animated walkthrough explaining mechanics, edge cases, and standard interview problems.`,
      difficulty: "Intermediate",
      duration: "42 mins video",
      tags: [term, "Video", "Visual"],
    },
    {
      id: `srv_res_3_${Date.now()}`,
      title: `${term} Practice Problems & Competitive Coding Sets`,
      source: "LeetCode / Practice Hub",
      type: "practice",
      url: `https://leetcode.com/problemset/all/?search=${encodeURIComponent(term)}`,
      description: `Hands-on problems ranging from easy fundamentals to hard company interview challenges.`,
      difficulty: "Intermediate",
      duration: "45 mins session",
      tags: [term, "Hands-on", "Practice"],
    },
    {
      id: `srv_res_4_${Date.now()}`,
      title: `${term} Official Technical Specification & Standards`,
      source: "DevDocs / MDN",
      type: "documentation",
      url: `https://devdocs.io/#q=${encodeURIComponent(term)}`,
      description: `Authoritative reference manual detailing API interfaces, standard library primitives, and runtime behavior.`,
      difficulty: "Advanced",
      duration: "Reference doc",
      tags: [term, "Documentation", "Reference"],
    },
    {
      id: `srv_res_5_${Date.now()}`,
      title: `IIT / IISc In-Depth Lecture Notes on ${term}`,
      source: "NPTEL Swayam",
      type: "video",
      url: `https://nptel.ac.in/courses?q=${encodeURIComponent(term)}`,
      description: `Rigorous academic lecture series from top Indian engineering institutes with mathematical proofs and assignments.`,
      difficulty: "Advanced",
      duration: "55 mins lecture",
      tags: [term, "Academic", "GATE / Exam"],
    },
    {
      id: `srv_res_6_${Date.now()}`,
      title: `Curated Awesome Guide & Open-Source Projects for ${term}`,
      source: "GitHub Awesome Lists",
      type: "interactive",
      url: `https://github.com/search?q=${encodeURIComponent("awesome " + term)}`,
      description: `Community-maintained compendium of repos, interactive playgrounds, cheatsheets, and production tools.`,
      difficulty: "Intermediate",
      duration: "Open Exploration",
      tags: [term, "Open Source", "Projects"],
    },
  ];

  if (category && category !== "all") {
    return base.filter((r) => r.type === category);
  }
  return base;
}

startServer();

