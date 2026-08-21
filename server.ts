import express from "express";
import path from "path";
import crypto from "crypto";
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
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
];

const DEPRECATED_GEMINI_MAP: Record<string, string> = {
  "gemini-2.5-flash": "gemini-3.7-flash",
  "gemini-2.0-flash": "gemini-3.7-flash",
  "gemini-2.0-flash-lite": "gemini-3.1-flash-lite",
  "gemini-1.5-flash": "gemini-3.7-flash",
  "gemini-1.5-pro": "gemini-3.7-flash",
  "gemini-pro": "gemini-3.7-flash",
};

function normalizeGeminiModel(modelName: string | undefined): string {
  if (!modelName) return "gemini-3.7-flash";
  const mapped = DEPRECATED_GEMINI_MAP[modelName];
  if (mapped) return mapped;
  return modelName.startsWith("gemini-") ? modelName : "gemini-3.7-flash";
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
  let attempt = 0;

  for (const model of modelsToTry) {
    attempt++;
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
      const backoffMs = Math.min(600, 150 * attempt);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  throw lastError || new Error("All AI models in the fallback chain failed.");
}

// -------------------------------------------------------------
// SECURE USER AUTH & IN-MEMORY STATEFUL DATABASE (USER ISOLATED)
// -------------------------------------------------------------

interface StoredUserAccount {
  id: string;
  name: string;
  email: string;
  salt: string;
  passwordHash: string;
  bio?: string;
  avatar?: string;
  preferences: any;
  stats: any;
  createdAt: string;
  updatedAt: string;
}

interface UserDataStore {
  goals: any[];
  roadmaps: Record<string, any>;
  sessions: any[];
  topicMastery: Record<string, any>;
  bookmarks: any[];
  resourceFeedback: Record<string, any>;
  mentorHistory: any[];
}

const registeredUsers = new Map<string, StoredUserAccount>(); // keyed by email
const activeSessions = new Map<string, string>(); // token -> userId
const userDataStores = new Map<string, UserDataStore>(); // userId -> store

function hashPasswordServer(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function getUserStore(userId: string): UserDataStore {
  let store = userDataStores.get(userId);
  if (!store) {
    store = {
      goals: [],
      roadmaps: {},
      sessions: [],
      topicMastery: {},
      bookmarks: [],
      resourceFeedback: {},
      mentorHistory: [],
    };
    userDataStores.set(userId, store);
  }
  return store;
}

function sanitizeUser(user: StoredUserAccount) {
  const { salt, passwordHash, ...rest } = user;
  return rest;
}

function authenticateToken(req: express.Request): StoredUserAccount | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7).trim();
  const userId = activeSessions.get(token);
  if (!userId) return null;

  for (const account of registeredUsers.values()) {
    if (account.id === userId) return account;
  }
  return null;
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
      registeredUserCount: registeredUsers.size,
      activeSessionCount: activeSessions.size,
      timestamp: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------
  // AUTHENTICATION API ROUTES
  // -------------------------------------------------------------

  app.post("/api/auth/register", (req, res) => {
    try {
      const { name, email, password, preferences, bio } = req.body;
      const normalizedEmail = (email || "").trim().toLowerCase();

      if (!name || name.trim().length < 2) {
        return res.status(400).json({ error: "Name must be at least 2 characters." });
      }
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        return res.status(400).json({ error: "A valid email address is required." });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
      }
      if (registeredUsers.has(normalizedEmail)) {
        return res.status(400).json({ error: "An account with this email already exists." });
      }

      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHash = hashPasswordServer(password, salt);
      const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

      const newAccount: StoredUserAccount = {
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        salt,
        passwordHash,
        bio: bio || "",
        preferences: preferences || {
          uiLanguage: "en",
          learningLanguage: "en",
          resourceLanguages: ["en"],
          learningLevel: "Beginner",
          explanationStyle: "First Principles",
          preferredQuestionDifficulty: "adaptive",
          dailyStudyMinutes: 20,
          preferredStudyTime: "flexible",
          mentorTone: "socratic",
        },
        stats: {
          topicsLearned: 0,
          streak: 0,
          xp: 0,
          assessmentsCompleted: 0,
          questionTypeAccuracy: {
            mcq: { correct: 0, total: 0 },
            true_false: { correct: 0, total: 0 },
            fill_blank: { correct: 0, total: 0 },
            code_input: { correct: 0, total: 0 },
            debugging: { correct: 0, total: 0 },
            arrange_steps: { correct: 0, total: 0 },
            explanation: { correct: 0, total: 0 },
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      registeredUsers.set(normalizedEmail, newAccount);
      getUserStore(userId); // initialize user's isolated data store

      const token = `tok_${userId}_${crypto.randomBytes(16).toString("hex")}`;
      activeSessions.set(token, userId);

      return res.json({
        success: true,
        session: {
          token,
          user: sanitizeUser(newAccount),
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = (email || "").trim().toLowerCase();

      if (!normalizedEmail || !password) {
        return res.status(400).json({ error: "Email and password are required." });
      }

      const account = registeredUsers.get(normalizedEmail);
      if (!account) {
        return res.status(401).json({ error: "No account found with this email." });
      }

      const computedHash = hashPasswordServer(password, account.salt);
      if (computedHash !== account.passwordHash) {
        return res.status(401).json({ error: "Incorrect password." });
      }

      const token = `tok_${account.id}_${crypto.randomBytes(16).toString("hex")}`;
      activeSessions.set(token, account.id);

      return res.json({
        success: true,
        session: {
          token,
          user: sanitizeUser(account),
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Login failed" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    const user = authenticateToken(req);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    return res.json({ user: sanitizeUser(user) });
  });

  app.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      activeSessions.delete(token);
    }
    return res.json({ success: true });
  });

  app.put("/api/user/profile", (req, res) => {
    const user = authenticateToken(req);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { name, bio, avatar, preferences, stats } = req.body;
    if (name) user.name = name.trim();
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };
    if (stats) user.stats = { ...user.stats, ...stats };
    user.updatedAt = new Date().toISOString();

    return res.json({ success: true, user: sanitizeUser(user) });
  });

  app.get("/api/user/data", (req, res) => {
    const user = authenticateToken(req);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const store = getUserStore(user.id);
    return res.json({
      exportDate: new Date().toISOString(),
      user: sanitizeUser(user),
      goals: store.goals,
      roadmaps: store.roadmaps,
      sessions: store.sessions,
      topicMastery: store.topicMastery,
      bookmarks: store.bookmarks,
      resourceFeedback: store.resourceFeedback,
    });
  });

  app.delete("/api/user/account", (req, res) => {
    const user = authenticateToken(req);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    userDataStores.delete(user.id);
    registeredUsers.delete(user.email);

    for (const [token, uid] of activeSessions.entries()) {
      if (uid === user.id) activeSessions.delete(token);
    }

    return res.json({ success: true, message: "Account and all data permanently deleted." });
  });

  // -------------------------------------------------------------
  // SERVER-SIDE AI INFERENCE (Gemini & Multi-model proxy)
  // -------------------------------------------------------------

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

      // 1. Anthropic Claude (via server proxy)
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
        if (system) groqMessages.push({ role: "system", content: system });
        groqMessages.push({ role: "user", content: user });

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

      // 3. Featherless AI
      if (provider === "featherless") {
        const key = apiKey || process.env.FEATHERLESS_API_KEY;
        if (!key) {
          return res.status(400).json({
            error: "Featherless API Key is not configured. Please open Settings (Ctrl+Shift+K) to enter your API key.",
            status: "error",
          });
        }

        const effectiveModel = model && !model.startsWith("gemini-") ? model : "Qwen/Qwen3.5-27B";
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

      // 4. Custom OpenAI-compatible endpoint
      if (provider === "custom") {
        const targetUrl = customBaseUrl || "http://localhost:11434/v1/chat/completions";
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

        const effectiveModel = model && !model.startsWith("gemini-") ? model : "gpt-4o-mini";
        const customRes = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: effectiveModel,
            messages: system
              ? [
                  { role: "system", content: system },
                  { role: "user", content: user },
                ]
              : [{ role: "user", content: user }],
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
      const activeGeminiClient = apiKey ? new GoogleGenAI({ apiKey }) : getAI();

      if (!activeGeminiClient) {
        return res.status(400).json({
          error: "No active Gemini API key configured. Please configure an API key.",
          fallbackAvailable: false,
          status: "error",
        });
      }

      const config: any = {
        temperature: Math.max(0.1, Math.min(temperature || 0.3, 0.7)),
        maxOutputTokens: maxTokens,
      };

      if (system) config.systemInstruction = system;
      if (jsonMode) config.responseMimeType = "application/json";

      const effectiveGeminiModel =
        model && model.startsWith("gemini-") ? normalizeGeminiModel(model) : "gemini-3.7-flash";

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

  // -------------------------------------------------------------
  // DOMAIN-AGNOSTIC RESOURCE SEARCH & DISCOVERY
  // -------------------------------------------------------------

  app.post("/api/resources/search", async (req, res) => {
    const { query, topic, subject, category = "all", language = "English", difficulty } = req.body;
    const searchTerm = (query || topic || subject || "Foundational Principles").trim();

    try {
      const ai = getAI();

      if (!ai) {
        return res.json({
          live: false,
          message: "Server Gemini key not set; using educational hub synthesis.",
          results: generateDomainServerFallbackResources(searchTerm, category, language),
        });
      }

      const prompt = `You are a universal educational resource curator.
Topic / Query: "${searchTerm}"
Subject Domain: "${subject || 'General Academic'}"
Category Filter: "${category}"
Language: "${language}"
Target Difficulty: "${difficulty || 'All'}"

Find 6 to 8 authoritative, publicly accessible, real educational resources (open courseware, peer-reviewed textbooks, video lectures, interactive problem sets, encyclopedic references, official standards).
Every URL should point to a genuine educational platform (e.g., Khan Academy, MIT OpenCourseWare, OpenStax, SWAYAM/NPTEL, YouTube Education, Stanford Online, Wikipedia, DevDocs).

Return ONLY a JSON array matching this exact schema:
[
  {
    "id": "res_1",
    "title": "Exact Resource Title",
    "source": "Platform Name",
    "type": "video" | "article" | "interactive" | "practice" | "documentation" | "book" | "course" | "lecture",
    "url": "Authoritative URL",
    "description": "2 clear sentences explaining why this resource is high yield.",
    "difficulty": "Beginner" | "Intermediate" | "Advanced",
    "duration": "e.g. 20 min read or 40 min video",
    "durationMinutes": 20,
    "language": "${language}",
    "isFree": true,
    "tags": ["tag1", "tag2"]
  }
]`;

      const { text } = await generateWithFallback(
        ai,
        "gemini-3.7-flash",
        prompt,
        {
          systemInstruction:
            "You are a universal educational resource finder. Return ONLY a valid JSON array. Never output markdown codeblocks outside JSON.",
          responseMimeType: "application/json",
          temperature: 0.2,
        }
      );

      let parsed: any[] = [];
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = [];
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        parsed = generateDomainServerFallbackResources(searchTerm, category, language);
      }

      return res.json({
        live: true,
        query: searchTerm,
        results: parsed,
      });
    } catch (err: any) {
      console.warn("Resource search fallback triggered:", err?.message || err);
      return res.json({
        live: false,
        fallback: true,
        query: searchTerm,
        results: generateDomainServerFallbackResources(searchTerm, category, language),
      });
    }
  });

  // -------------------------------------------------------------
  // DOMAIN-AGNOSTIC ROADMAP GENERATOR
  // -------------------------------------------------------------

  app.post("/api/ai/roadmap", async (req, res) => {
    try {
      const {
        goalTitle,
        subject,
        currentLevel = "Beginner",
        targetLevel = "Mastery",
        availableDailyMinutes = 30,
        preferredLanguage = "English",
        style = "First Principles",
      } = req.body;

      const ai = getAI();
      const topicName = (goalTitle || subject || "Personalized Study Track").trim();

      if (!ai) {
        return res.json({
          success: true,
          fallback: true,
          roadmap: generateDomainServerFallbackRoadmap(topicName, targetLevel),
        });
      }

      const prompt = `Curriculum Design Request:
Goal/Subject: "${topicName}"
Current Level: "${currentLevel}"
Target Level: "${targetLevel}"
Daily Study Time: ${availableDailyMinutes} minutes
Preferred Language: "${preferredLanguage}"
Explanation Style: "${style}"

Design a high-yield, 3-phase curriculum tailored to this goal for ANY domain (whether Mathematics, Science, Medicine, Languages, Law, Humanities, Engineering, or Custom).

Format strictly as JSON:
{
  "tagline": "Inspiring, precise 1-sentence roadmap tagline",
  "subject": "${topicName}",
  "phases": [
    {
      "title": "Phase 1 — Bedrock Foundations & Core Vocabulary",
      "emoji": "🌱",
      "description": "Short phase objective",
      "topics": [
        {
          "id": "p1_t1",
          "title": "Clear Topic Title",
          "description": "1 sentence topic focus",
          "estimatedMinutes": 30,
          "status": "available",
          "competencyFocus": ["Core Definition", "Systematic Invariants"]
        },
        {
          "id": "p1_t2",
          "title": "Next Topic Title",
          "estimatedMinutes": 45,
          "status": "locked"
        }
      ]
    },
    {
      "title": "Phase 2 — Applied Problem Solving & Edge Cases",
      "emoji": "🌿",
      "description": "Short phase objective",
      "topics": [ ...2 to 4 topics... ]
    },
    {
      "title": "Phase 3 — Advanced Synthesis & Real-World Mastery",
      "emoji": "🌳",
      "description": "Short phase objective",
      "topics": [ ...2 to 3 topics... ]
    }
  ]
}`;

      const { text } = await generateWithFallback(
        ai,
        "gemini-3.7-flash",
        prompt,
        {
          systemInstruction:
            "You are LearnPath's Universal Curriculum Designer. Return ONLY valid JSON matching the schema.",
          responseMimeType: "application/json",
          temperature: 0.3,
        }
      );

      let parsed: any = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = generateDomainServerFallbackRoadmap(topicName, targetLevel);
      }

      return res.json({ success: true, roadmap: parsed });
    } catch (e: any) {
      console.warn("Roadmap AI generation error:", e?.message);
      return res.json({
        success: true,
        fallback: true,
        roadmap: generateDomainServerFallbackRoadmap(req.body.goalTitle || "Learning Track", "Mastery"),
      });
    }
  });

  // -------------------------------------------------------------
  // DOMAIN-AGNOSTIC ASSESSMENT BATCH 1 GENERATION
  // -------------------------------------------------------------

  app.post("/api/ai/assessment/batch1", async (req, res) => {
    try {
      const {
        topic,
        subjectTitle,
        selectedTypes = ["mcq", "true_false", "fill_blank", "explanation"],
        targetDifficulty = "adaptive",
        requestedLanguage = "English",
      } = req.body;

      const ai = getAI();
      const cleanTopic = (topic || subjectTitle || "Core Foundations").trim();

      if (!ai) {
        return res.status(200).json({
          error: "GEMINI_API_KEY is not configured on the server. Falling back to local offline engine.",
          fallback: true,
          questions: [],
        });
      }

      const prompt = `Assessment Request:
Topic: "${cleanTopic}"
Subject: "${subjectTitle || cleanTopic}"
Target Difficulty: "${targetDifficulty}"
Language: "${requestedLanguage}"
Selected Types: ${JSON.stringify(selectedTypes)}

Instructions:
Generate a balanced diagnostic assessment of 4 to 6 questions total tailored specifically for "${cleanTopic}" across any educational domain.
Use appropriate question formats from the selected types:
- "mcq": 4 options, single correct choice (index 0..3)
- "true_false": boolean true/false assertion
- "fill_blank": "template" with "{{blank}}", and "correctAnswers" array
- "code_input": "starterCode", "language", "evaluationCriteria"
- "debugging": "buggyCode", "bugDescriptionPrompt", "bugType", "fixedCodeSnippet", "explanationOfBug", "evaluationCriteria"
- "arrange_steps": "contextTitle", "shuffledSteps" (array of >=3 {"id":"s1","text":"..."}), "correctOrderIds"
- "explanation": "rubricKeywords", "idealAnswerSummary"

Required schema for each item:
- "id": "q_1_1", "q_1_2", ...
- "type": one of the selected types
- "question": specific, unambiguous prompt
- "topic": "${cleanTopic}"
- "difficulty": "easy" | "medium" | "hard"
- "dimension": "concept" | "application" | "problem_solving" | "analysis" | "derivation" | "debugging" | "implementation"
- "points": 10
- "explanation": clear, rigorous explanation of why the correct answer holds

Return ONLY a JSON array of question objects.`;

      const { text } = await generateWithFallback(
        ai,
        "gemini-3.7-flash",
        prompt,
        {
          systemInstruction:
            "You are LearnPath's Universal Assessment Generator. Generate clear, objective, domain-accurate questions. Return ONLY valid JSON.",
          responseMimeType: "application/json",
          temperature: 0.3,
        }
      );

      let parsed: any = [];
      try {
        parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          parsed = parsed.questions || [];
        }
      } catch {
        parsed = [];
      }

      return res.json({ status: "success", questions: parsed, batchNumber: 1 });
    } catch (err: any) {
      console.warn("Batch 1 generation error:", err?.message || err);
      return res.status(200).json({ error: err.message, fallback: true, questions: [] });
    }
  });

  // -------------------------------------------------------------
  // ADAPTIVE NEXT BATCH & DIAGNOSIS
  // -------------------------------------------------------------

  app.post("/api/ai/assessment/adaptive-next", async (req, res) => {
    try {
      const { topic, batchNumber, questions, userResponses, previousAnalysis } = req.body;
      const ai = getAI();

      if (!ai) {
        return res.status(200).json({
          error: "GEMINI_API_KEY is not configured on the server. Falling back to offline evaluation.",
          fallback: true,
        });
      }

      const prompt = `Student Assessment Adaptive Analysis:
Topic: "${topic}"
Completed Batch Number: ${batchNumber}
Questions & Responses:
${JSON.stringify({ questions, userResponses }, null, 2)}
Previous Analysis: ${previousAnalysis || "None"}

Perform a deep cognitive assessment for this domain:
1. Identify the student's verified competency level (Novice, Competent, Proficient, Master), concept strengths, and diagnosed weak points.
2. Formulate 2 tailored follow-up questions targeting their weak areas for Batch ${Number(batchNumber) + 1}.

Return ONLY a JSON object:
{
  "summary": "1-2 sentence cognitive analysis of their performance",
  "skillLevel": "Novice" | "Competent" | "Proficient" | "Master",
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "radarScores": {
    "concept": 0-100,
    "application": 0-100,
    "problem_solving": 0-100,
    "analysis": 0-100,
    "debugging": 0-100
  },
  "recommendedFocus": "Specific topics or drills to practice next",
  "isFinalVerdict": false,
  "nextQuestions": [ ...questions matching schema... ]
}`;

      const { text } = await generateWithFallback(
        ai,
        "gemini-3.7-flash",
        prompt,
        {
          systemInstruction:
            "You are LearnPath's Universal Adaptive Diagnostic Controller. Return ONLY valid JSON.",
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
      console.warn("Adaptive evaluation error:", err?.message || err);
      return res.status(200).json({ error: err.message, fallback: true });
    }
  });

  // -------------------------------------------------------------
  // USER DATA SYNC ROUTE
  // -------------------------------------------------------------

  app.post("/api/db/sync", (req, res) => {
    try {
      const user = authenticateToken(req);
      const { goals, roadmaps, sessions, topicMastery, bookmarks, resourceFeedback } = req.body;

      const userId = user?.id || req.body.user?.id || "anonymous";
      const store = getUserStore(userId);

      if (goals) store.goals = goals;
      if (roadmaps) store.roadmaps = { ...store.roadmaps, ...roadmaps };
      if (sessions) store.sessions = sessions;
      if (topicMastery) store.topicMastery = { ...store.topicMastery, ...topicMastery };
      if (bookmarks) store.bookmarks = bookmarks;
      if (resourceFeedback) store.resourceFeedback = { ...store.resourceFeedback, ...resourceFeedback };

      return res.json({
        success: true,
        message: "Synchronized with learning data store successfully.",
        timestamp: new Date().toISOString(),
        recordsSynced: {
          sessions: store.sessions.length,
          topics: Object.keys(store.topicMastery).length,
          goals: store.goals.length,
        },
      });
    } catch (err: any) {
      console.error("DB Sync error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/db/status", (_req, res) => {
    res.json({
      connected: true,
      status: "Active",
      usersCount: registeredUsers.size,
      activeSessions: activeSessions.size,
    });
  });

  // -------------------------------------------------------------
  // VITE SERVING & FALLBACK
  // -------------------------------------------------------------

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

function generateDomainServerFallbackResources(term: string, category?: string, language: string = "English") {
  const base = [
    {
      id: `srv_res_1_${Date.now()}`,
      title: `${term} — Complete Foundation & Conceptual Models`,
      source: "Khan Academy / Open Education",
      type: "interactive",
      url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(term)}`,
      description: `Comprehensive conceptual breakdown with diagrams, invariant explanations, and practice drills.`,
      difficulty: "Beginner",
      duration: "20 min interactive",
      durationMinutes: 20,
      language,
      isFree: true,
      tags: [term, "Core Concept", "Foundations"],
    },
    {
      id: `srv_res_2_${Date.now()}`,
      title: `${term} — Visual Walkthrough & Video Lessons`,
      source: "YouTube Education",
      type: "video",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(term + " lecture tutorial " + language)}`,
      description: `Step-by-step visual lessons explaining mechanics, common edge cases, and worked solutions.`,
      difficulty: "Intermediate",
      duration: "35 mins video",
      durationMinutes: 35,
      language,
      isFree: true,
      tags: [term, "Video", "Visual"],
    },
    {
      id: `srv_res_3_${Date.now()}`,
      title: `${term} Course Notes & Assignments`,
      source: "MIT OpenCourseWare",
      type: "lecture",
      url: `https://ocw.mit.edu/search/?q=${encodeURIComponent(term)}`,
      description: `Rigorous academic lecture series from top university faculty with proofs and problem sets.`,
      difficulty: "Advanced",
      duration: "50 mins lecture",
      durationMinutes: 50,
      language,
      isFree: true,
      tags: [term, "Academic", "University"],
    },
    {
      id: `srv_res_4_${Date.now()}`,
      title: `${term} Open College Textbook`,
      source: "OpenStax Textbooks",
      type: "book",
      url: `https://openstax.org/search?q=${encodeURIComponent(term)}`,
      description: `Peer-reviewed textbook chapters detailing governing principles, review questions, and worked examples.`,
      difficulty: "Intermediate",
      duration: "30 min read",
      durationMinutes: 30,
      language,
      isFree: true,
      tags: [term, "Textbook", "Reference"],
    },
    {
      id: `srv_res_5_${Date.now()}`,
      title: `Encyclopedic Reference & Foundational Context on ${term}`,
      source: "Wikipedia Reference",
      type: "article",
      url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(term)}`,
      description: `Deep theoretical background, formal definitions, derivations, and historical context.`,
      difficulty: "Beginner",
      duration: "15 min read",
      durationMinutes: 15,
      language,
      isFree: true,
      tags: [term, "Reference", "Theory"],
    },
  ];

  if (category && category !== "all") {
    return base.filter((r) => r.type === category);
  }
  return base;
}

function generateDomainServerFallbackRoadmap(subject: string, targetLevel: string) {
  const title = subject || "Personalized Learning Track";
  return {
    tagline: `Structured curriculum for mastering ${title} (${targetLevel} level)`,
    subject: title,
    phases: [
      {
        title: "Phase 1 — Foundations & Core Principles",
        emoji: "🌱",
        description: `Establish bedrock mental models, definitions, and essential vocabulary for ${title}.`,
        topics: [
          {
            id: "p1_t1",
            title: `${title}: Fundamental Definitions & Concepts`,
            status: "available",
            estimatedMinutes: 30,
            competencyFocus: ["Foundational Concepts"],
          },
          {
            id: "p1_t2",
            title: `${title}: Governing Invariants & Primary Frameworks`,
            status: "locked",
            estimatedMinutes: 45,
            competencyFocus: ["Systematic Reasoning"],
          },
        ],
      },
      {
        title: "Phase 2 — Core Mechanics & Applied Problem Solving",
        emoji: "🌿",
        description: `Deepen practical execution, handle common edge cases, and solve representative challenges.`,
        topics: [
          {
            id: "p2_t1",
            title: `${title}: Intermediate Problem Solving & Standard Patterns`,
            status: "locked",
            estimatedMinutes: 50,
            competencyFocus: ["Problem Solving"],
          },
          {
            id: "p2_t2",
            title: `${title}: Boundary Conditions & Error Analysis`,
            status: "locked",
            estimatedMinutes: 45,
            competencyFocus: ["Debugging & Root Cause"],
          },
        ],
      },
      {
        title: "Phase 3 — Advanced Synthesis & Real-World Mastery",
        emoji: "🌳",
        description: `Tackle complex multi-variable scenarios, capstone projects, and exam/industry standards.`,
        topics: [
          {
            id: "p3_t1",
            title: `${title}: Advanced Case Studies & Capstone Synthesis`,
            status: "locked",
            estimatedMinutes: 60,
            competencyFocus: ["Advanced Synthesis"],
          },
        ],
      },
    ],
  };
}

startServer();
