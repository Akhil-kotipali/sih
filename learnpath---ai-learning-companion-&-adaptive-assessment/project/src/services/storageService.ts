/**
 * Local Persistence Service for LearnPath
 * Manages user state, assessment sessions, batch histories, topic mastery, and AI settings in localStorage.
 * Includes commented hooks for cloud / database synchronization.
 */

import {
  UserProfile,
  AISettings,
  AssessmentSession,
  RoadmapData,
  LiveResource,
  UserStats,
  QuestionType,
} from '../types';

const STORAGE_KEYS = {
  CURRENT_USER: 'learnpath_current_user',
  ALL_USERS: 'learnpath_registered_users',
  ASSESSMENT_SESSIONS: 'learnpath_assessment_sessions',
  TOPIC_MASTERY: 'learnpath_topic_mastery',
  GENERATED_ROADMAPS: 'learnpath_generated_roadmaps',
  AI_SETTINGS: 'learnpath_ai_settings',
  BOOKMARKS: 'learnpath_bookmarked_resources',
  RECENT_SEARCHES: 'learnpath_recent_searches',
};

export const DEFAULT_SYSTEM_PROMPTS = {
  assessmentInitial: `You are the LearnPath Assessment Generator.
1. Generate clear, unambiguous, objective questions.
2. Every question must test a meaningful concept.
3. Every question must have an objectively correct answer.
4. Explanations must directly explain why the answer is correct and why incorrect options are wrong.
5. Never allow an explanation to contradict the answer.
6. Do not repeat the same concept with different wording.
7. Difficulty must match cognitive demand.
8. Return only valid JSON matching the supplied schema.
9. Never output markdown.
10. Never output commentary outside the JSON.


QUESTION TYPES


MCQ:
- exactly 4 options
- exactly 1 correct option


TRUE_FALSE:
- objectively true or false


FILL_BLANK:
- one clearly intended answer


CODE_INPUT:
- only when a programming language is supplied
- starter code must be valid
- task must be objectively evaluable


DEBUGGING:
- only when a real bug exists
- bug, diagnosis and fix must agree
- must include a non-empty "evaluationCriteria" array; the criteria, bug description, and explanation must all describe the exact same issue


ARRANGE_STEPS:
- ordering must be objectively determinable
- every step must be necessary; do not invent steps that rely on structures (e.g. parent pointers) never defined in the question


EXPLANATION:
- include an objective scoring rubric


PROGRAMMING RULES


When a language is supplied, use it. When none is supplied, choose ONE language yourself and reuse that same language for every programming question in the batch — never switch languages between questions.
- all code must use that language
- language metadata must match
- do not mix languages
- verify syntax and semantics
- do not invent APIs
- explicitly state the node/data representation (e.g. dictionary vs class/object) in every programming question, and use identical access syntax everywhere it appears (prompt, starter/buggy code, expected behavior, explanation, evaluation criteria): dictionaries use node["value"], objects/classes use node.value — never mix them


DATA STRUCTURE / ALGORITHM CORRECTNESS RULES


- Any BST/tree invariant must hold recursively for EVERY node, not just "the root" — state both the left-subtree (< node) and right-subtree (> node) conditions.
- Never claim an ordinary BST "must remain balanced" or has worst-case O(log n). Ordinary BST: average-case O(log n), worst-case O(n). Only self-balancing BSTs (AVL, Red-Black) guarantee O(log n) worst-case — say so explicitly whenever a worst-case or unqualified O(log n) claim is made.
- If duplicate values are mentioned for a BST/ordered structure, explicitly state the policy: prohibited, go left, go right, or counted.
- BST deletion must use the standard, representation-independent process: locate the inorder successor, copy/replace the value, delete the successor from the right subtree, reconnect the affected subtree. Never assume parent pointers unless they were explicitly defined.


CROSS-FIELD CONSISTENCY


Before returning each question, compare prompt, topic, type, dimension, difficulty, language, code, expected output, answer, explanation, and evaluation criteria against each other. If any of them contradict one another, discard and regenerate — never patch by guessing.


QUALITY GATE


Before returning each question:
- verify topic relevance
- verify correctness (including data-structure/algorithm semantics above, not just JSON shape)
- verify answer
- verify explanation
- verify metadata
- verify difficulty
- verify schema
- verify cross-field consistency


If a question cannot be confidently verified against every rule above, discard it — do not "repair" a questionable question by guessing.


Prefer fewer high-quality questions over questionable questions.


Do not expose your internal validation process.`,

  assessmentAdaptive: `You are the Batch Submission & Adaptive Analysis Controller for LearnPath.
You receive the student's previous batch submission payload in JSON:
- Topic & Subject
- Batch questions with correct answers
- User's submitted responses & scores
- Detected mistakes and keyword matches

Your mission:
1. Perform deep cognitive diagnosis: Evaluate what they understood, their weak areas, explanation depth, and debugging/coding skills.
2. Determine Next Step:
   - If weak dimensions exist or unexplored subtopics remain: Formulate the next adapted batch (Batch 2, 3...) targeting those exact weak spots using appropriate question formats.
   - If sufficient evidence exists to judge skill level: Conclude the test and provide a comprehensive Skill Level Judgment Report (Novice / Competent / Proficient / Master), radar dimension scores, and learning next-steps.
3. Return ONLY a valid JSON object matching the requested schema.`,

  assessment: `You are LearnPath's Universal Adaptive Question Engine.
Generate rigorous, practical, and unambiguous questions suited to the topic across the supported formats (mcq, true_false, fill_blank, code_input, debugging, arrange_steps, explanation).
Assign canonical dimensions ("concept", "application", "implementation", "debugging", "algorithmic_thinking").
Never invent programming semantics or data-structure invariants. State BST/tree properties recursively for every node with both left and right conditions, distinguish average-case from worst-case complexity, state duplicate-handling policy whenever duplicates are mentioned, keep node representation (dict vs class/object) and language identical and consistent across every field of a question and across the whole batch, and include evaluation criteria for every debugging and code question. Return ONLY valid JSON matching the requested schema.`,

  roadmap: `You are the Roadmap Curriculum Designer inside LearnPath, an intelligent companion for engineering students.
Your job is to generate a comprehensive, ordered, step-by-step curriculum for the requested subject.
Break it into logical phases (Month 1, Month 2, etc.) starting from foundational concepts and progressing to advanced, practical engineering skills.
Always respond with ONLY valid JSON according to the requested schema.`,

  recommend: `You are the Learning Recommendations Specialist in LearnPath.
Analyze the student's topic and performance, identify what to focus on next, recommend high-yield learning strategies, and provide concrete practice advice.
Return ONLY valid JSON according to the schema.`,

  mentor: `You are the AI Engineering Mentor inside LearnPath.
You provide friendly, precise, and encouraging guidance on exam prep, coding concepts, placements, and engineering career development.
Keep responses concise, clear, practical, and conversational.`,

  resources: `You are the Technical Resource Discovery Engine in LearnPath.
Search and curate authoritative, real, and accessible learning resources (videos, interactive sandboxes, docs, problem sets) tailored to the student's topic and level.
Return ONLY valid JSON.`,

  questionEvaluator: `You are the Interactive Question Evaluator & Code Grader in LearnPath.
Evaluate user answers for coding snippets, debugging fixes, step-by-step sequencing, and free-form technical explanations.
Provide strict yet constructive scoring, highlight matched rubric keywords, pinpoint syntax or logic flaws, and provide ideal solution references.
Return ONLY valid JSON.`,

  topicDiagnoser: `You are the Topic Mastery & Cognitive Dimension Diagnoser in LearnPath.
Calculate 5-dimension radar scores across Concept (0-100), Application (0-100), Implementation (0-100), Debugging (0-100), and Algorithmic Thinking (0-100).
Synthesize strengths, weaknesses, and concrete remediation pathways.
Return ONLY valid JSON.`,
};

export const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  gemini_server: 'gemini-3.6-flash',
  gemini_client: 'gemini-3.6-flash',
  anthropic: 'claude-3-5-sonnet-20241022',
  groq: 'llama-3.3-70b-versatile',
  featherless: 'Qwen/Qwen3.5-27B',
  custom: 'gpt-4o-mini',
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'gemini_server',
  keys: {
    gemini: '',
    anthropic: '',
    groq: '',
    featherless: '',
    custom: '',
  },
  models: {
    gemini: 'gemini-3.6-flash',
    anthropic: 'claude-3-5-sonnet-20241022',
    groq: 'llama-3.3-70b-versatile',
    featherless: 'Qwen/Qwen3.5-27B',
    custom: 'gpt-4o-mini',
  },
  customBaseUrl: '',
  customModel: 'gemini-3.6-flash',
  endpoints: {
    aiGenerate: '/api/ai/generate',
    batch1: '/api/ai/assessment/batch1',
    adaptiveNext: '/api/ai/assessment/adaptive-next',
    postgresSync: '/api/db/sync',
    postgresStatus: '/api/db/status',
    resourcesSearch: '/api/resources/search',
  },
  postgres: {
    enabled: false,
    connectionString: '',
    restEndpointUrl: '/api/db/sync',
    autoSync: true,
    status: 'local_storage_fallback',
  },
  systemPrompts: { ...DEFAULT_SYSTEM_PROMPTS },
  temperature: 0.3,
};

export function initialDefaultStats(): UserStats {
  const initialTypeAccuracy: Record<QuestionType, { correct: number; total: number }> = {
    mcq: { correct: 0, total: 0 },
    true_false: { correct: 0, total: 0 },
    fill_blank: { correct: 0, total: 0 },
    code_input: { correct: 0, total: 0 },
    debugging: { correct: 0, total: 0 },
    arrange_steps: { correct: 0, total: 0 },
    explanation: { correct: 0, total: 0 },
  };

  return {
    topicsLearned: 0,
    streak: 1,
    xp: 120,
    assessmentsCompleted: 0,
    subjectProgress: {
      dsa: 15,
      os: 10,
      cn: 5,
      dbms: 0,
    },
    questionTypeAccuracy: initialTypeAccuracy,
  };
}

export const DEMO_USER_PROFILE: UserProfile = {
  name: 'Anvitha Kumar',
  email: 'anvitha@demo.com',
  password: 'demo1234',
  year: '3rd Year',
  branch: 'Computer Science',
  shortGoals: ['dsa', 'os', 'cn', 'dbms'],
  shortGoalLabels: {
    dsa: 'Data Structures & Algorithms',
    os: 'Operating Systems',
    cn: 'Computer Networks',
    dbms: 'Database Management Systems',
  },
  longGoals: ['placement', 'skill'],
  skillName: 'Full-Stack Web & Cloud Systems',
  isDemo: true,
  stats: {
    topicsLearned: 14,
    streak: 7,
    xp: 2850,
    assessmentsCompleted: 9,
    subjectProgress: {
      dsa: 68,
      os: 55,
      cn: 40,
      dbms: 50,
    },
    questionTypeAccuracy: {
      mcq: { correct: 32, total: 38 },
      true_false: { correct: 20, total: 22 },
      fill_blank: { correct: 18, total: 24 },
      code_input: { correct: 8, total: 10 },
      debugging: { correct: 7, total: 9 },
      arrange_steps: { correct: 11, total: 12 },
      explanation: { correct: 6, total: 8 },
    },
  },
};

// -------------------------------------------------------------
// USER & AUTH PERSISTENCE
// -------------------------------------------------------------

export function loadCurrentUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!raw) return DEMO_USER_PROFILE;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEMO_USER_PROFILE;

    return {
      ...DEMO_USER_PROFILE,
      ...parsed,
      shortGoals: Array.isArray(parsed.shortGoals) ? parsed.shortGoals : DEMO_USER_PROFILE.shortGoals,
      shortGoalLabels: parsed.shortGoalLabels || DEMO_USER_PROFILE.shortGoalLabels,
      longGoals: Array.isArray(parsed.longGoals) ? parsed.longGoals : DEMO_USER_PROFILE.longGoals,
      stats: {
        ...DEMO_USER_PROFILE.stats,
        ...(parsed.stats || {}),
        subjectProgress: parsed.stats?.subjectProgress || DEMO_USER_PROFILE.stats.subjectProgress,
        questionTypeAccuracy: parsed.stats?.questionTypeAccuracy || DEMO_USER_PROFILE.stats.questionTypeAccuracy,
      },
    };
  } catch (e) {
    console.error('Failed to load current user from storage:', e);
    return DEMO_USER_PROFILE;
  }
}

export function saveCurrentUser(user: UserProfile | null): void {
  try {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));

    // Also update in registered users map
    const users = loadAllUsers();
    users[user.email] = user;
    localStorage.setItem(STORAGE_KEYS.ALL_USERS, JSON.stringify(users));

    /*
     * [DB BACKEND HOOK]: When connecting to PostgreSQL/Cloud SQL/Firestore:
     * await fetch('/api/user/sync', {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: JSON.stringify(user)
     * });
     */
  } catch (e) {
    console.error('Failed to save current user to storage:', e);
  }
}

export function loadAllUsers(): Record<string, UserProfile> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ALL_USERS);
    const users = raw ? JSON.parse(raw) : {};
    if (!users[DEMO_USER_PROFILE.email]) {
      users[DEMO_USER_PROFILE.email] = DEMO_USER_PROFILE;
    }
    return users;
  } catch {
    return { [DEMO_USER_PROFILE.email]: DEMO_USER_PROFILE };
  }
}

// -------------------------------------------------------------
// ASSESSMENT SESSION & BATCH PERSISTENCE
// -------------------------------------------------------------

export function saveAssessmentSession(session: AssessmentSession): void {
  try {
    const sessions = loadAllAssessmentSessions();
    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(
      STORAGE_KEYS.ASSESSMENT_SESSIONS,
      JSON.stringify(sessions.slice(0, 50)) // keep last 50
    );

    /*
     * [DB BACKEND HOOK]: Save assessment batches to database
     * await fetch('/api/assessments/save', {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: JSON.stringify({
     *     sessionId: session.id,
     *     topic: session.topic,
     *     batches: session.batches,
     *     overallMastery: session.overallMastery,
     *     weakDimensions: session.weakDimensions,
     *     timestamp: new Date().toISOString()
     *   })
     * });
     */
  } catch (e) {
    console.error('Failed to persist assessment session:', e);
  }
}

export function loadAllAssessmentSessions(): AssessmentSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ASSESSMENT_SESSIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function loadAssessmentSessionById(id: string): AssessmentSession | null {
  const sessions = loadAllAssessmentSessions();
  return sessions.find((s) => s.id === id) || null;
}

// -------------------------------------------------------------
// TOPIC MASTERY & PROGRESS
// -------------------------------------------------------------

export interface TopicMasteryRecord {
  goalId: string;
  topicId: string;
  topicTitle: string;
  status: 'locked' | 'available' | 'needs_review' | 'mastered';
  masteryScore: number; // 0..100
  weakDimensions: string[];
  lastBatchCount: number;
  updatedAt: string;
}

export function saveTopicMastery(record: TopicMasteryRecord): void {
  try {
    const all = loadAllTopicMastery();
    const key = `${record.goalId}:${record.topicId}`;
    all[key] = record;
    localStorage.setItem(STORAGE_KEYS.TOPIC_MASTERY, JSON.stringify(all));

    // Update user stats topics learned & subject progress
    const currentUser = loadCurrentUser();
    if (currentUser) {
      if (record.status === 'mastered') {
        const masteredCount = Object.values(all).filter((r) => r.status === 'mastered').length;
        currentUser.stats.topicsLearned = masteredCount;
        currentUser.stats.xp += 150;
      }
      saveCurrentUser(currentUser);
    }
  } catch (e) {
    console.error('Failed to save topic mastery:', e);
  }
}

export function loadAllTopicMastery(): Record<string, TopicMasteryRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TOPIC_MASTERY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// -------------------------------------------------------------
// GENERATED ROADMAPS
// -------------------------------------------------------------

export function saveGeneratedRoadmap(goalId: string, roadmap: RoadmapData): void {
  try {
    const all = loadGeneratedRoadmaps();
    all[goalId] = roadmap;
    localStorage.setItem(STORAGE_KEYS.GENERATED_ROADMAPS, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save generated roadmap:', e);
  }
}

export function loadGeneratedRoadmaps(): Record<string, RoadmapData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GENERATED_ROADMAPS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// -------------------------------------------------------------
// AI SETTINGS & SYSTEM PROMPTS
// -------------------------------------------------------------

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AI_SETTINGS);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const parsed = JSON.parse(raw);
    const loadedModels = { ...DEFAULT_AI_SETTINGS.models, ...(parsed.models || {}) };
    
    // Auto-migrate deprecated models to modern active models
    if (
      loadedModels.gemini === 'gemini-2.5-flash' ||
      loadedModels.gemini === 'gemini-2.0-flash' ||
      loadedModels.gemini === 'gemini-2.0-flash-lite' ||
      loadedModels.gemini === 'gemini-1.5-flash' ||
      loadedModels.gemini === 'gemini-1.5-pro'
    ) {
      loadedModels.gemini = 'gemini-3.6-flash';
    }

    return {
      ...DEFAULT_AI_SETTINGS,
      ...parsed,
      keys: { ...DEFAULT_AI_SETTINGS.keys, ...(parsed.keys || {}) },
      models: loadedModels,
      systemPrompts: { ...DEFAULT_AI_SETTINGS.systemPrompts, ...(parsed.systemPrompts || {}) },
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAISettings(settings: AISettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save AI settings:', e);
  }
}

// -------------------------------------------------------------
// RESOURCE BOOKMARKS
// -------------------------------------------------------------

export function loadBookmarkedResources(): LiveResource[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleBookmarkResource(resource: LiveResource): boolean {
  try {
    const list = loadBookmarkedResources();
    const idx = list.findIndex((r) => r.id === resource.id || r.url === resource.url);
    let bookmarked = false;
    if (idx >= 0) {
      list.splice(idx, 1);
      bookmarked = false;
    } else {
      list.unshift({ ...resource, isBookmarked: true });
      bookmarked = true;
    }
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(list));
    return bookmarked;
  } catch (e) {
    console.error('Failed to toggle bookmark:', e);
    return false;
  }
}

// -------------------------------------------------------------
// POSTGRESQL DUAL-MODE SYNC & HEALTH CHECK
// -------------------------------------------------------------

export async function syncAllToPostgres(): Promise<{ success: boolean; message: string; timestamp?: string }> {
  try {
    const settings = loadAISettings();
    const endpoint = settings.endpoints?.postgresSync || settings.postgres?.restEndpointUrl || '/api/db/sync';

    const payload = {
      user: loadCurrentUser(),
      sessions: loadAllAssessmentSessions(),
      topicMastery: loadAllTopicMastery(),
      roadmaps: loadGeneratedRoadmaps(),
      bookmarks: loadBookmarkedResources(),
      timestamp: new Date().toISOString(),
      connectionString: settings.postgres?.connectionString || undefined,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      const timestamp = new Date().toLocaleTimeString();
      const updatedSettings: AISettings = {
        ...settings,
        postgres: {
          ...settings.postgres,
          status: 'connected',
          lastSyncTime: timestamp,
          errorMessage: undefined,
        },
      };
      saveAISettings(updatedSettings);
      return { success: true, message: data.message || 'Synced successfully with PostgreSQL', timestamp };
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  } catch (e: any) {
    console.warn('PostgreSQL sync failed; utilizing LocalStorage engine:', e.message);
    const settings = loadAISettings();
    const updatedSettings: AISettings = {
      ...settings,
      postgres: {
        ...settings.postgres,
        status: 'local_storage_fallback',
        errorMessage: e.message || 'PostgreSQL not reachable; all data safely preserved in LocalStorage.',
      },
    };
    saveAISettings(updatedSettings);
    return {
      success: false,
      message: `Postgres sync unavailable (${e.message || 'offline'}). Safe in LocalStorage.`,
    };
  }
}

export async function checkPostgresStatus(): Promise<{ connected: boolean; status: string; count?: number }> {
  try {
    const settings = loadAISettings();
    const endpoint = settings.endpoints?.postgresStatus || '/api/db/status';
    const res = await fetch(endpoint);
    if (res.ok) {
      const data = await res.json();
      return { connected: data.connected ?? true, status: data.status || 'Active', count: data.sessionsCount };
    }
    return { connected: false, status: 'Local Storage Engine Active' };
  } catch {
    return { connected: false, status: 'Local Storage Active (Offline fallback)' };
  }
}

let cachedServerGeminiStatus: boolean | null = null;

export async function checkServerGeminiStatus(): Promise<boolean> {
  if (cachedServerGeminiStatus !== null) return cachedServerGeminiStatus;
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      cachedServerGeminiStatus = Boolean(data.hasServerGeminiKey);
      return cachedServerGeminiStatus;
    }
  } catch {
    cachedServerGeminiStatus = false;
  }
  return false;
}

/**
 * Checks if the currently active provider in AISettings is properly configured with an API key / endpoint
 */
export function isInferenceConfigured(settings: AISettings, serverHasGemini: boolean = false): boolean {
  if (!settings) return false;
  const provider = settings.provider;

  if (provider === 'gemini_server') {
    return Boolean(settings.keys?.gemini?.trim()) || serverHasGemini || Boolean(cachedServerGeminiStatus);
  }
  if (provider === 'gemini_client') {
    return Boolean(settings.keys?.gemini?.trim());
  }
  if (provider === 'anthropic') {
    return Boolean(settings.keys?.anthropic?.trim());
  }
  if (provider === 'groq') {
    return Boolean(settings.keys?.groq?.trim());
  }
  if (provider === 'featherless') {
    return Boolean(settings.keys?.featherless?.trim());
  }
  if (provider === 'custom') {
    return Boolean(settings.customBaseUrl?.trim() || settings.keys?.custom?.trim());
  }
  return false;
}

export interface ModelCapability {
  supportsVision: boolean;
  supportsAudioSpeech: boolean;
  supportsCodeExecution: boolean;
  contextWindow: string;
  providerLabel: string;
  multimediaBadge: string;
}

export function getModelCapabilities(provider: string, model: string): ModelCapability {
  const m = (model || '').toLowerCase();

  if (provider === 'gemini_server' || provider === 'gemini_client' || m.startsWith('gemini-')) {
    return {
      supportsVision: true,
      supportsAudioSpeech: true,
      supportsCodeExecution: true,
      contextWindow: m.includes('1.5') ? '2,000,000 tokens' : '1,000,000 tokens',
      providerLabel: 'Google Gemini (Native Multimodal)',
      multimediaBadge: 'Vision + Audio + Text',
    };
  }

  if (provider === 'anthropic' || m.startsWith('claude-')) {
    const isVision = m.includes('sonnet') || m.includes('opus') || m.includes('haiku-3-5') || m.includes('haiku-3.5');
    return {
      supportsVision: isVision,
      supportsAudioSpeech: true,
      supportsCodeExecution: true,
      contextWindow: '200,000 tokens',
      providerLabel: 'Anthropic Claude',
      multimediaBadge: isVision ? 'Vision + Text' : 'Text Only',
    };
  }

  if (provider === 'groq') {
    const isVision = m.includes('vision') || m.includes('llama-3.2-11b') || m.includes('llama-3.2-90b');
    return {
      supportsVision: isVision,
      supportsAudioSpeech: true,
      supportsCodeExecution: true,
      contextWindow: m.includes('70b') ? '128,000 tokens' : '8,192 - 128,000 tokens',
      providerLabel: isVision ? 'Groq LPU (Vision)' : 'Groq Ultra-Fast LPU',
      multimediaBadge: isVision ? 'Vision + Text' : 'Text Only',
    };
  }

  if (provider === 'featherless') {
    const isVision = m.includes('vl') || m.includes('vision') || m.includes('pixtral');
    return {
      supportsVision: isVision,
      supportsAudioSpeech: true,
      supportsCodeExecution: true,
      contextWindow: '32,768 - 131,072 tokens',
      providerLabel: 'Featherless AI (HuggingFace Serverless)',
      multimediaBadge: isVision ? 'Vision + Text' : 'Text Only',
    };
  }

  if (provider === 'custom') {
    const isVision = m.includes('4o') || m.includes('vision') || m.includes('vl') || m.includes('llava');
    return {
      supportsVision: isVision,
      supportsAudioSpeech: true,
      supportsCodeExecution: true,
      contextWindow: '128,000 tokens',
      providerLabel: 'Custom OpenAI-Compatible Endpoint',
      multimediaBadge: isVision ? 'Vision + Text' : 'Text Only',
    };
  }

  return {
    supportsVision: false,
    supportsAudioSpeech: true,
    supportsCodeExecution: true,
    contextWindow: '32,000 tokens',
    providerLabel: 'AI Engine',
    multimediaBadge: 'Text Only',
  };
}
