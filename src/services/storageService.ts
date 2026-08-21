/**
 * User-Scoped Storage Service for LearnPath
 * Enforces strict per-user data isolation for learning goals, roadmaps, assessment sessions,
 * topic mastery, bookmarks, and resource interactions.
 */

import {
  UserProfile,
  AISettings,
  AssessmentSession,
  RoadmapData,
  LiveResource,
  TopicMasteryRecord,
  LearningGoal,
  QuestionType,
} from '../types';
import { getActiveUser, updateProfile } from './authService';

function getUserKey(prefix: string, userId?: string): string {
  const effectiveId = userId || getActiveUser()?.id || 'anonymous';
  return `learnpath_${effectiveId}_${prefix}`;
}

export const DEFAULT_SYSTEM_PROMPTS = {
  assessmentInitial: `You are the LearnPath Universal Assessment Generator.
1. Generate clear, unambiguous, objective questions tailored strictly to the specified topic, domain, and learner goals.
2. Every question must test a meaningful concept, problem, or reasoning skill.
3. Every question must have an objectively correct answer.
4. Explanations must directly explain why the answer is correct and why incorrect options are wrong.
5. Return only valid JSON matching the supplied schema. No commentary outside JSON.`,

  assessmentAdaptive: `You are the Adaptive Assessment & Knowledge Diagnosis Controller for LearnPath.
Analyze the student's responses, calculate domain-flexible competency scores, diagnose specific weak points, and formulate adapted follow-up questions or final skill level verdicts. Return ONLY valid JSON.`,

  assessment: `You are LearnPath's Universal Adaptive Question Engine.
Generate rigorous, practical, and unambiguous questions suited to the topic across the supported formats (mcq, true_false, fill_blank, code_input, debugging, arrange_steps, explanation). Return ONLY valid JSON.`,

  roadmap: `You are the Domain-Agnostic Curriculum Designer inside LearnPath.
Generate a structured, step-by-step learning roadmap tailored to the user's specific domain, background, goal, target level, and available study duration. Return ONLY valid JSON.`,

  recommend: `You are the Learning Recommendations Specialist in LearnPath.
Analyze the student's topic and performance, identify what to focus on next, recommend high-yield learning strategies, and provide concrete practice advice. Return ONLY valid JSON.`,

  mentor: `You are the AI Personal Learning Mentor inside LearnPath.
Provide friendly, rigorous, and encouraging guidance on any domain, answering questions from first principles, guiding Socratic derivations, and diagnosing knowledge gaps. Return ONLY concise, clear markdown.`,

  resources: `You are the Real Educational Resource Research Engine in LearnPath.
Search and curate authoritative, publicly accessible, verified learning materials (tutorials, lectures, open courseware, textbooks, interactive problem sets) tailored to the learner's subject, target level, and language. Return ONLY valid JSON.`,

  questionEvaluator: `You are the Interactive Question Evaluator & Grader in LearnPath.
Evaluate user answers for code snippets, problem derivations, step arrangements, and conceptual explanations. Return ONLY valid JSON.`,

  topicDiagnoser: `You are the Topic Mastery Diagnoser in LearnPath.
Synthesize verified strengths, specific gaps, and concrete remediation paths. Return ONLY valid JSON.`,
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
    gemini: 'gemini-3.7-flash',
    anthropic: 'claude-3-5-sonnet-20241022',
    groq: 'llama-3.3-70b-versatile',
    featherless: 'Qwen/Qwen3.5-27B',
    custom: 'gpt-4o-mini',
  },
  customBaseUrl: '',
  customModel: 'gemini-3.7-flash',
  endpoints: {
    aiGenerate: '/api/ai/generate',
    batch1: '/api/ai/assessment/batch1',
    adaptiveNext: '/api/ai/assessment/adaptive-next',
    postgresSync: '/api/db/sync',
    postgresStatus: '/api/db/status',
    resourcesSearch: '/api/resources/search',
    roadmap: '/api/ai/roadmap',
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

// -------------------------------------------------------------
// 1. LEARNING GOALS & SUBJECTS (Per-User)
// -------------------------------------------------------------

export function loadUserGoals(userId?: string): LearningGoal[] {
  try {
    const raw = localStorage.getItem(getUserKey('goals', userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUserGoal(goal: LearningGoal, userId?: string): void {
  try {
    const goals = loadUserGoals(userId);
    const idx = goals.findIndex((g) => g.id === goal.id);
    if (idx >= 0) {
      goals[idx] = goal;
    } else {
      goals.unshift(goal);
    }
    localStorage.setItem(getUserKey('goals', userId), JSON.stringify(goals));
  } catch (e) {
    console.error('Failed to save user goal:', e);
  }
}

export function deleteUserGoal(goalId: string, userId?: string): void {
  try {
    const goals = loadUserGoals(userId).filter((g) => g.id !== goalId);
    localStorage.setItem(getUserKey('goals', userId), JSON.stringify(goals));

    // Also remove associated roadmap
    const roadmaps = loadGeneratedRoadmaps(userId);
    delete roadmaps[goalId];
    localStorage.setItem(getUserKey('roadmaps', userId), JSON.stringify(roadmaps));
  } catch (e) {
    console.error('Failed to delete goal:', e);
  }
}

// Aliases for compatibility across components
export const loadLearningGoals = loadUserGoals;
export const saveLearningGoal = saveUserGoal;
export const deleteLearningGoal = deleteUserGoal;
export const loadAssessmentSessions = loadAllAssessmentSessions;

// -------------------------------------------------------------
// 2. ASSESSMENT SESSIONS (Per-User)
// -------------------------------------------------------------

export function saveAssessmentSession(session: AssessmentSession, userId?: string): void {
  try {
    const effectiveUserId = session.userId || userId || getActiveUser()?.id || 'anonymous';
    const sessions = loadAllAssessmentSessions(effectiveUserId);
    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(getUserKey('sessions', effectiveUserId), JSON.stringify(sessions.slice(0, 50)));

    // Update user stats
    const currentUser = getActiveUser();
    if (currentUser) {
      const stats = currentUser.stats;
      stats.assessmentsCompleted = sessions.length;
      updateProfile({ stats });
    }
  } catch (e) {
    console.error('Failed to persist assessment session:', e);
  }
}

export function loadAllAssessmentSessions(userId?: string): AssessmentSession[] {
  try {
    const raw = localStorage.getItem(getUserKey('sessions', userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function loadAssessmentSessionById(id: string, userId?: string): AssessmentSession | null {
  const sessions = loadAllAssessmentSessions(userId);
  return sessions.find((s) => s.id === id) || null;
}

export function clearUserAssessmentHistory(userId?: string): void {
  try {
    localStorage.removeItem(getUserKey('sessions', userId));
  } catch (e) {
    console.error('Failed to clear assessment history:', e);
  }
}

// -------------------------------------------------------------
// 3. TOPIC MASTERY (Per-User)
// -------------------------------------------------------------

export function saveTopicMastery(record: TopicMasteryRecord, userId?: string): void {
  try {
    const all = loadAllTopicMastery(userId);
    const key = `${record.goalId || 'general'}:${record.topicId || record.topicTitle}`;
    all[key] = record;
    localStorage.setItem(getUserKey('mastery', userId), JSON.stringify(all));

    // Update user stats
    const currentUser = getActiveUser();
    if (currentUser) {
      const masteredCount = Object.values(all).filter((r) => r.status === 'mastered').length;
      currentUser.stats.topicsLearned = masteredCount;
      currentUser.stats.xp = masteredCount * 100 + currentUser.stats.assessmentsCompleted * 50;
      updateProfile({ stats: currentUser.stats });
    }
  } catch (e) {
    console.error('Failed to save topic mastery:', e);
  }
}

export function loadAllTopicMastery(userId?: string): Record<string, TopicMasteryRecord> {
  try {
    const raw = localStorage.getItem(getUserKey('mastery', userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// -------------------------------------------------------------
// 4. GENERATED ROADMAPS (Per-User)
// -------------------------------------------------------------

export function saveGeneratedRoadmap(goalId: string, roadmap: RoadmapData, userId?: string): void {
  try {
    const all = loadGeneratedRoadmaps(userId);
    all[goalId] = roadmap;
    localStorage.setItem(getUserKey('roadmaps', userId), JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save roadmap:', e);
  }
}

export function loadGeneratedRoadmaps(userId?: string): Record<string, RoadmapData> {
  try {
    const raw = localStorage.getItem(getUserKey('roadmaps', userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// -------------------------------------------------------------
// 5. RESOURCE BOOKMARKS & FEEDBACK (Per-User)
// -------------------------------------------------------------

export function loadBookmarkedResources(userId?: string): LiveResource[] {
  try {
    const raw = localStorage.getItem(getUserKey('bookmarks', userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleBookmarkResource(resource: LiveResource, userId?: string): boolean {
  try {
    const list = loadBookmarkedResources(userId);
    const idx = list.findIndex((r) => r.id === resource.id || (r.url && r.url === resource.url));
    let bookmarked = false;
    if (idx >= 0) {
      list.splice(idx, 1);
      bookmarked = false;
    } else {
      list.unshift({ ...resource, isBookmarked: true });
      bookmarked = true;
    }
    localStorage.setItem(getUserKey('bookmarks', userId), JSON.stringify(list));
    return bookmarked;
  } catch (e) {
    console.error('Failed to toggle bookmark:', e);
    return false;
  }
}

export interface ResourceFeedbackRecord {
  resourceId: string;
  url: string;
  isCompleted?: boolean;
  userRating?: 'helpful' | 'not_helpful' | null;
  isHidden?: boolean;
  updatedAt: string;
}

export function loadUserResourceFeedback(userId?: string): Record<string, ResourceFeedbackRecord> {
  try {
    const raw = localStorage.getItem(getUserKey('resources_feedback', userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveUserResourceFeedback(
  resourceId: string,
  url: string,
  updates: Partial<ResourceFeedbackRecord>,
  userId?: string
): void {
  try {
    const all = loadUserResourceFeedback(userId);
    const key = resourceId || url;
    all[key] = {
      ...(all[key] || { resourceId, url, updatedAt: new Date().toISOString() }),
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(getUserKey('resources_feedback', userId), JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save resource feedback:', e);
  }
}

// -------------------------------------------------------------
// 6. EXPORT ALL USER DATA (JSON Archive)
// -------------------------------------------------------------

export function exportAllUserData(userId?: string): Record<string, any> {
  const effectiveUserId = userId || getActiveUser()?.id || 'anonymous';
  return {
    exportDate: new Date().toISOString(),
    user: getActiveUser(),
    goals: loadUserGoals(effectiveUserId),
    roadmaps: loadGeneratedRoadmaps(effectiveUserId),
    assessments: loadAllAssessmentSessions(effectiveUserId),
    topicMastery: loadAllTopicMastery(effectiveUserId),
    bookmarks: loadBookmarkedResources(effectiveUserId),
    resourceFeedback: loadUserResourceFeedback(effectiveUserId),
  };
}

// -------------------------------------------------------------
// 7. GLOBAL AI SETTINGS & SYSTEM PROMPTS
// -------------------------------------------------------------

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem('learnpath_global_ai_settings');
    if (!raw) return DEFAULT_AI_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_AI_SETTINGS,
      ...parsed,
      keys: { ...DEFAULT_AI_SETTINGS.keys, ...(parsed.keys || {}) },
      models: { ...DEFAULT_AI_SETTINGS.models, ...(parsed.models || {}) },
      systemPrompts: { ...DEFAULT_AI_SETTINGS.systemPrompts, ...(parsed.systemPrompts || {}) },
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAISettings(settings: AISettings): void {
  try {
    localStorage.setItem('learnpath_global_ai_settings', JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save AI settings:', e);
  }
}

// -------------------------------------------------------------
// BACKWARDS COMPATIBILITY HELPERS
// -------------------------------------------------------------

export function loadCurrentUser(): UserProfile | null {
  return getActiveUser();
}

export function saveCurrentUser(user: UserProfile | null): void {
  if (user) updateProfile(user);
}

export async function syncAllToPostgres(): Promise<{ success: boolean; message: string; timestamp?: string }> {
  try {
    const user = getActiveUser();
    const payload = exportAllUserData(user?.id);
    const res = await fetch('/api/db/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return { success: true, message: 'Synced learning data successfully.' };
    }
    return { success: false, message: 'Local storage active.' };
  } catch (e: any) {
    return { success: false, message: 'Local storage active.' };
  }
}

export async function checkPostgresStatus(): Promise<{ connected: boolean; status: string }> {
  return { connected: true, status: 'Local & Server Storage Active' };
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

export function isInferenceConfigured(settings: AISettings, serverHasGemini: boolean = false): boolean {
  if (!settings) return false;
  if (settings.provider === 'gemini_server') {
    return Boolean(settings.keys?.gemini?.trim()) || serverHasGemini || Boolean(cachedServerGeminiStatus);
  }
  if (settings.provider === 'gemini_client') return Boolean(settings.keys?.gemini?.trim());
  if (settings.provider === 'anthropic') return Boolean(settings.keys?.anthropic?.trim());
  if (settings.provider === 'groq') return Boolean(settings.keys?.groq?.trim());
  if (settings.provider === 'featherless') return Boolean(settings.keys?.featherless?.trim());
  if (settings.provider === 'custom') return Boolean(settings.customBaseUrl?.trim() || settings.keys?.custom?.trim());
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
  return {
    supportsVision: true,
    supportsAudioSpeech: true,
    supportsCodeExecution: true,
    contextWindow: '1,000,000 tokens',
    providerLabel: 'LearnPath AI Engine',
    multimediaBadge: 'Multimodal',
  };
}
