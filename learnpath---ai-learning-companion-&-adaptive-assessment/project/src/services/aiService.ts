/**
 * AI Service for LearnPath
 * Routes inference through configured providers (Server-side Gemini, Client Gemini, Anthropic, Groq, Featherless, Custom)
 * and generates structured batches for all 7 question types with offline fallback engines.
 */

import {
  AssessmentQuestion,
  QuestionType,
  QUESTION_TYPE_LIMITS,
  AssessmentSession,
  AssessmentBatch,
  QuestionSubmission,
  AISettings,
  RoadmapData,
  ValidationContext,
  CognitiveDimension,
} from '../types';
import { loadAISettings } from './storageService';
import {
  validateAssessmentBatch,
  validateAssessmentQuestion,
  formatRegenerationPrompt,
  detectProgrammingLanguage,
  extractString,
  CANONICAL_COGNITIVE_DIMENSIONS,
} from './assessmentValidator';

export { extractString };

// Fallback question bank data for all 7 types
import { getFallbackBatch, getFallbackRoadmap } from './fallbackData';

export type AssessmentPipelineStage =
  | 'analyzing'
  | 'generating'
  | 'validating'
  | 'repairing'
  | 'calibrating'
  | 'ready';

export interface StageUpdatePayload {
  stage: AssessmentPipelineStage;
  message: string;
  subMessage?: string;
  progressPercent: number;
}

export interface GenerateBatchParams {
  topic: string;
  subjectTitle: string;
  selectedTypes: QuestionType[];
  targetDifficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  batchNumber: number;
  typeLimits?: Partial<Record<QuestionType, number>>;
  previousBatchAnalysis?: string;
  weakDimensions?: string[];
  systemPromptOverride?: string;
  onStageUpdate?: (update: StageUpdatePayload) => void;
}

export interface EvaluateBatchParams {
  topic: string;
  batch: AssessmentBatch;
  submissions: Record<string, QuestionSubmission>;
}

export interface AIResponse {
  text: string;
  raw?: any;
  providerUsed: string;
  isFallback?: boolean;
}

export interface TestInferenceResult {
  success: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  sampleOutput: string;
  error?: string;
}

/**
 * Checks if AI inference is fully configured and ready to execute
 */
export async function checkInferenceReady(settingsOverride?: AISettings): Promise<{
  ready: boolean;
  provider: string;
  model: string;
  reason?: string;
}> {
  const settings = settingsOverride || loadAISettings();
  const model = getActiveProviderModel(settings);
  const provider = settings.provider;

  if (provider === 'gemini_client' && (!settings.keys?.gemini || !settings.keys.gemini.trim())) {
    return {
      ready: false,
      provider: 'Gemini (Client Key)',
      model,
      reason: 'Gemini API key is not configured. Press Ctrl+Shift+K to enter your key.',
    };
  }

  if (provider === 'anthropic' && (!settings.keys?.anthropic || !settings.keys.anthropic.trim())) {
    return {
      ready: false,
      provider: 'Anthropic Claude',
      model,
      reason: 'Anthropic API key is not configured. Press Ctrl+Shift+K to enter your key.',
    };
  }

  if (provider === 'groq' && (!settings.keys?.groq || !settings.keys.groq.trim())) {
    return {
      ready: false,
      provider: 'Groq LPU',
      model,
      reason: 'Groq API key is not configured. Press Ctrl+Shift+K to enter your key.',
    };
  }

  if (provider === 'featherless' && (!settings.keys?.featherless || !settings.keys.featherless.trim())) {
    return {
      ready: false,
      provider: 'Featherless AI',
      model,
      reason: 'Featherless API key is not configured. Press Ctrl+Shift+K to enter your key.',
    };
  }

  if (provider === 'custom' && !settings.customBaseUrl?.trim() && (!settings.keys?.custom || !settings.keys.custom.trim())) {
    return {
      ready: false,
      provider: 'Custom OpenAI Endpoint',
      model,
      reason: 'Custom endpoint URL / API key is not configured. Press Ctrl+Shift+K to setup.',
    };
  }

  if (provider === 'gemini_server') {
    if (settings.keys?.gemini?.trim()) {
      return { ready: true, provider: 'Gemini (Custom Key)', model };
    }
    // Check server status
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data.hasServerGeminiKey) {
          return { ready: true, provider: 'Gemini (Server Environment)', model };
        }
      }
    } catch {
      // ignore
    }
    return {
      ready: false,
      provider: 'Google Gemini',
      model,
      reason: 'No Gemini API key found on server or client. Press Ctrl+Shift+K to enter your API key.',
    };
  }

  return { ready: true, provider, model };
}

/**
 * Resolves the specific active model ID for the selected AI provider
 */
export function getActiveProviderModel(settings: AISettings): string {
  if (settings.provider === 'gemini_server' || settings.provider === 'gemini_client') {
    const raw = settings.models?.gemini || 'gemini-3.6-flash';
    if (raw === 'gemini-2.5-flash' || raw === 'gemini-2.0-flash' || raw === 'gemini-1.5-flash') {
      return 'gemini-3.6-flash';
    }
    return raw;
  }
  if (settings.provider === 'anthropic') {
    return settings.models?.anthropic || 'claude-3-5-sonnet-20241022';
  }
  if (settings.provider === 'groq') {
    return settings.models?.groq || 'llama-3.3-70b-versatile';
  }
  if (settings.provider === 'featherless') {
    return settings.models?.featherless || 'mistralai/Mistral-7B-Instruct-v0.3';
  }
  if (settings.provider === 'custom') {
    return settings.models?.custom || 'gpt-4o-mini';
  }
  return settings.customModel || 'gemini-3.6-flash';
}

/**
 * Test AI inference live with the active provider and credentials
 */
export async function testAIInference(settingsOverride?: AISettings): Promise<TestInferenceResult> {
  const settings = settingsOverride || loadAISettings();
  const startTime = Date.now();
  const activeModel = getActiveProviderModel(settings);
  const testPrompt =
    'Provide a 1-sentence precise engineering definition of what an algorithm is. Keep it under 25 words.';

  try {
    const res = await callAI(
      'You are an expert computer science tutor. Give a crisp 1-sentence definition.',
      testPrompt,
      { maxTokens: 100, jsonMode: false, settingsOverride: settings }
    );

    const latencyMs = Date.now() - startTime;
    return {
      success: Boolean(res.text && res.text.trim()),
      provider: res.providerUsed || settings.provider,
      model: activeModel,
      latencyMs,
      sampleOutput: res.text.trim() || 'No response returned from model.',
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      provider: settings.provider,
      model: activeModel,
      latencyMs,
      sampleOutput: '',
      error: err?.message || String(err) || 'Inference test failed',
    };
  }
}

/**
 * Universal AI Caller with Multimodal Image Support and Strict Inference Enforcement
 */
export async function callAI(
  system: string,
  user: string,
  options?: {
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
    images?: { mimeType: string; data: string }[];
    settingsOverride?: AISettings;
  }
): Promise<AIResponse> {
  const settings = options?.settingsOverride || loadAISettings();
  const maxTokens = options?.maxTokens || 2500;
  const temperature = options?.temperature ?? settings.temperature ?? 0.3;
  const activeModel = getActiveProviderModel(settings);

  const currentApiKey =
    settings.provider === 'gemini_client'
      ? settings.keys?.gemini?.trim()
      : settings.provider === 'anthropic'
      ? settings.keys?.anthropic?.trim()
      : settings.provider === 'groq'
      ? settings.keys?.groq?.trim()
      : settings.provider === 'featherless'
      ? settings.keys?.featherless?.trim()
      : settings.provider === 'custom'
      ? settings.keys?.custom?.trim()
      : '';

  // Check if provider requires key and it's missing
  if (settings.provider !== 'gemini_server' && !currentApiKey && !settings.customBaseUrl) {
    throw new Error(
      `AI Inference is not configured for provider "${settings.provider}". Please press Ctrl+Shift+K to open Settings and set your API key.`
    );
  }

  // 1. Primary path: Server-side proxy (supports Gemini server/client, Anthropic, Groq, Featherless, Custom + Images)
  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system,
        user,
        images: options?.images || [],
        provider: settings.provider,
        apiKey: currentApiKey,
        model: activeModel,
        customBaseUrl: settings.customBaseUrl || undefined,
        maxTokens,
        temperature,
        jsonMode: options?.jsonMode ?? false,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.text && data.text.trim()) {
        return {
          text: data.text,
          providerUsed: data.providerUsed || settings.provider,
          raw: data,
        };
      }
      if (data.error) {
        throw new Error(data.error);
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `AI Inference Server Error (HTTP ${res.status})`);
    }
  } catch (e: any) {
    // If not on gemini_server or if an explicit error was returned, rethrow
    if (e.message?.includes('not configured') || e.message?.includes('API key') || settings.provider !== 'gemini_server') {
      throw e;
    }
  }

  // 2. Direct Browser Gemini (if key exists)
  if (settings.keys?.gemini && settings.keys.gemini.trim()) {
    try {
      const apiKey = settings.keys.gemini.trim();
      const effectiveModel =
        activeModel && !['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'].includes(activeModel)
          ? activeModel
          : 'gemini-3.6-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;

      const contents: any[] = [];
      const parts: any[] = [];
      if (options?.images && options.images.length > 0) {
        for (const img of options.images) {
          if (img?.data) {
            parts.push({
              inlineData: {
                mimeType: img.mimeType || 'image/jpeg',
                data: img.data,
              },
            });
          }
        }
      }
      parts.push({ text: user });
      contents.push({ role: 'user', parts });

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: options?.jsonMode ? 'application/json' : undefined,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) return { text, providerUsed: 'Gemini (Client Direct)' };
      }
    } catch (e: any) {
      console.warn('Direct client Gemini call failed:', e);
    }
  }

  // 3. Direct Browser Groq (if key exists)
  if (settings.provider === 'groq' && settings.keys?.groq) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.keys.groq.trim()}`,
        },
        body: JSON.stringify({
          model: activeModel || 'llama-3.3-70b-versatile',
          messages: system
            ? [
                { role: "system", content: system },
                { role: "user", content: user },
              ]
            : [{ role: "user", content: user }],
          max_tokens: maxTokens,
          temperature,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (content) return { text: content, providerUsed: 'Groq (Client Direct)' };
      }
    } catch (e: any) {
      console.warn('Direct client Groq call failed:', e);
    }
  }

  throw new Error(
    `AI Inference not setup or request failed for provider "${settings.provider}". Please press Ctrl+Shift+K to configure a valid API key in Settings.`
  );
}

export function sanitizeAssessmentQuestion(q: any, idx: number, batchNumber = 1): AssessmentQuestion {
  const type = q?.type || 'mcq';
  const id = extractString(q?.id) || `q_${batchNumber}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`;
  const question = extractString(q?.question) || `Assessment Question ${idx + 1}`;
  const topic = extractString(q?.topic) || 'Engineering Topic';
  const difficulty = (['easy', 'medium', 'hard'].includes(q?.difficulty) ? q.difficulty : 'medium') as any;
  const dimension = (['concept', 'application', 'implementation', 'debugging', 'algorithmic_thinking', 'algorithmic'].includes(q?.dimension)
    ? q.dimension === 'algorithmic' ? 'algorithmic_thinking' : q.dimension
    : 'concept') as any;
  const explanation = extractString(q?.explanation) || 'Refer to core engineering principles.';
  const points = typeof q?.points === 'number' ? q.points : 10;

  if (type === 'mcq') {
    let options: string[] = [];
    if (Array.isArray(q?.options)) {
      options = q.options.map((opt: any) => extractString(opt)).filter((s: string) => s.trim().length > 0);
    } else if (q?.options && typeof q.options === 'object') {
      options = Object.values(q.options).map((opt: any) => extractString(opt)).filter((s: string) => s.trim().length > 0);
    }
    if (options.length < 2) {
      options = ['Option A', 'Option B', 'Option C', 'Option D'];
    }
    let correctAnswer = typeof q?.correctAnswer === 'number' ? q.correctAnswer : 0;
    if (typeof q?.correctAnswer === 'string') {
      const parsedNum = parseInt(q.correctAnswer, 10);
      if (!isNaN(parsedNum)) {
        correctAnswer = parsedNum;
      } else {
        const charCode = q.correctAnswer.toUpperCase().charCodeAt(0) - 65;
        if (charCode >= 0 && charCode < options.length) correctAnswer = charCode;
      }
    }
    if (correctAnswer < 0 || correctAnswer >= options.length) correctAnswer = 0;

    return {
      id,
      type: 'mcq',
      question,
      topic,
      difficulty,
      dimension,
      points,
      explanation,
      options,
      correctAnswer,
    };
  }

  if (type === 'true_false') {
    const correctAnswer = typeof q?.correctAnswer === 'boolean' ? q.correctAnswer : String(q?.correctAnswer).toLowerCase().includes('t');
    return {
      id,
      type: 'true_false',
      question,
      topic,
      difficulty,
      dimension,
      points,
      explanation,
      correctAnswer,
    };
  }

  if (type === 'fill_blank') {
    let template = extractString(q?.template) || `${question} is {{blank}}.`;
    if (!template.includes('{{blank}}')) {
      template = `${template} {{blank}}`;
    }
    let correctAnswers: string[] = [];
    if (Array.isArray(q?.correctAnswers)) {
      correctAnswers = q.correctAnswers.map((a: any) => extractString(a)).filter(Boolean);
    } else if (q?.correctAnswer) {
      correctAnswers = [extractString(q.correctAnswer)];
    }
    if (correctAnswers.length === 0) correctAnswers = ['correct answer'];

    return {
      id,
      type: 'fill_blank',
      question,
      topic,
      difficulty,
      dimension,
      points,
      explanation,
      template,
      correctAnswers,
      hint: extractString(q?.hint) || undefined,
    };
  }

  if (type === 'code_input') {
    let evaluationCriteria: string[] = [];
    if (Array.isArray(q?.evaluationCriteria)) {
      evaluationCriteria = q.evaluationCriteria.map((c: any) => extractString(c)).filter(Boolean);
    }
    return {
      id,
      type: 'code_input',
      question,
      topic,
      difficulty,
      dimension,
      points,
      explanation,
      language: extractString(q?.language) || 'python',
      starterCode: extractString(q?.starterCode) || '# Implement your solution\n',
      expectedOutputOrPattern: extractString(q?.expectedOutputOrPattern) || undefined,
      evaluationCriteria: evaluationCriteria.length > 0 ? evaluationCriteria : ['Correct logic', 'Handles edge cases'],
    };
  }

  if (type === 'debugging') {
    const rawBugType = extractString(q?.bugType).toLowerCase();
    const validBugTypes: Array<'syntax' | 'logical' | 'edge_case' | 'concurrency' | 'off_by_one'> = [
      'syntax',
      'logical',
      'edge_case',
      'concurrency',
      'off_by_one',
    ];
    const normalizedBugType = validBugTypes.includes(rawBugType as any)
      ? (rawBugType as 'syntax' | 'logical' | 'edge_case' | 'concurrency' | 'off_by_one')
      : 'logical';

    let debugEvaluationCriteria: string[] = [];
    if (Array.isArray(q?.evaluationCriteria)) {
      debugEvaluationCriteria = q.evaluationCriteria.map((c: any) => extractString(c)).filter(Boolean);
    }

    return {
      id,
      type: 'debugging',
      question,
      topic,
      difficulty,
      dimension,
      points,
      explanation,
      language: extractString(q?.language) || 'python',
      buggyCode: extractString(q?.buggyCode) || '# Buggy Code\n',
      bugDescriptionPrompt: extractString(q?.bugDescriptionPrompt) || 'Identify and fix the bug in this code.',
      bugType: normalizedBugType,
      fixedCodeSnippet: extractString(q?.fixedCodeSnippet) || '',
      explanationOfBug: extractString(q?.explanationOfBug) || '',
      evaluationCriteria: debugEvaluationCriteria.length > 0 ? debugEvaluationCriteria : ['Correctly identifies the root cause', 'Fix resolves the described bug'],
    };
  }

  if (type === 'arrange_steps') {
    let rawSteps: any[] = Array.isArray(q?.shuffledSteps) ? q.shuffledSteps : [];
    if (rawSteps.length === 0 && Array.isArray(q?.steps)) rawSteps = q.steps;
    
    let shuffledSteps = rawSteps.map((s: any, sIdx: number) => {
      const stepId = typeof s === 'object' && s?.id ? String(s.id) : `s${sIdx + 1}`;
      const stepText = extractString(s?.text || s?.step || s);
      return { id: stepId, text: stepText };
    });

    if (shuffledSteps.length === 0) {
      shuffledSteps = [
        { id: 's1', text: 'Step 1' },
        { id: 's2', text: 'Step 2' },
        { id: 's3', text: 'Step 3' },
      ];
    }

    let correctOrderIds: string[] = [];
    if (Array.isArray(q?.correctOrderIds)) {
      correctOrderIds = q.correctOrderIds.map((id: any) => extractString(id));
    } else {
      correctOrderIds = shuffledSteps.map((s) => s.id);
    }

    return {
      id,
      type: 'arrange_steps',
      question,
      topic,
      difficulty,
      dimension,
      points,
      explanation,
      contextTitle: extractString(q?.contextTitle) || 'Execution Flow Sequence',
      shuffledSteps,
      correctOrderIds,
    };
  }

  // Explanation Question
  let rubricKeywords: string[] = [];
  if (Array.isArray(q?.rubricKeywords)) {
    rubricKeywords = q.rubricKeywords.map((k: any) => extractString(k)).filter(Boolean);
  }
  return {
    id,
    type: 'explanation',
    question,
    topic,
    difficulty,
    dimension,
    points,
    explanation,
    rubricKeywords: rubricKeywords.length > 0 ? rubricKeywords : ['Concept', 'Application'],
    idealAnswerSummary: extractString(q?.idealAnswerSummary) || undefined,
    minWordCount: typeof q?.minWordCount === 'number' ? q.minWordCount : 15,
  };
}

/**
 * Generate an assessment batch conforming strictly to user-specified types and maximum limits
 * with production-grade Universal Assessment Validation and Automatic Targeted Regeneration.
 */
export async function generateAssessmentBatch(
  params: GenerateBatchParams
): Promise<{ questions: AssessmentQuestion[]; isFallback: boolean; providerUsed: string }> {
  const settings = loadAISettings();
  const MAX_REGENERATION_ATTEMPTS = 2;

  // System Prompt 1 for Batch 1, or prompt override / adaptive prompt
  const system =
    params.systemPromptOverride ||
    (params.batchNumber === 1
      ? settings.systemPrompts.assessmentInitial || settings.systemPrompts.assessment
      : settings.systemPrompts.assessmentAdaptive || settings.systemPrompts.assessment);

  // Calculate requested counts per type respecting ceiling limits
  const requestedTypes = params.selectedTypes.length > 0 ? params.selectedTypes : (['mcq', 'true_false'] as QuestionType[]);

  params.onStageUpdate?.({
    stage: 'analyzing',
    message: 'Analyzing topic & curriculum requirements',
    subMessage: `Examining "${params.topic}" (${params.subjectTitle || 'Engineering'})`,
    progressPercent: 20,
  });

  const detectedLang = detectProgrammingLanguage(params.topic, params.subjectTitle);
  const validationContext: ValidationContext = {
    topic: params.topic,
    subjectTitle: params.subjectTitle,
    requestedLanguage: detectedLang,
    batchNumber: params.batchNumber,
    targetDifficulty: params.targetDifficulty,
  };

  /**
   * Unified Strict Assessment Validation & Repair Pipeline:
   * LLM JSON → JSON parsing → schema validation → normalization → question-type validation
   * → semantic consistency validation → remove/repair invalid questions → minimum valid-question check → UI model
   */
  async function runAssessmentValidationPipeline(
    rawQuestions: any[],
    context: ValidationContext,
    systemPrompt: string,
    providerUsed: string
  ): Promise<{ questions: AssessmentQuestion[]; isFallback: boolean; providerUsed: string }> {
    params.onStageUpdate?.({
      stage: 'validating',
      message: 'Validating question quality & deterministic rules',
      subMessage: 'Checking schema integrity, answer keys, code semantics & dimensions',
      progressPercent: 65,
    });

    // 1. Schema & Question-type & Semantic Consistency Validation
    let report = validateAssessmentBatch(rawQuestions, context);
    let validQuestions: AssessmentQuestion[] = [...report.validQuestions];
    let invalidItems = [...report.invalidQuestions];

    // 2. Targeted Repair Attempt (Exactly 1 targeted repair attempt)
    if (invalidItems.length > 0) {
      params.onStageUpdate?.({
        stage: 'repairing',
        message: 'Performing targeted question refinement',
        subMessage: `Refining ${invalidItems.length} question(s) to guarantee standard compliance`,
        progressPercent: 80,
      });

      console.warn(
        `[AssessmentValidator] Validation found ${invalidItems.length} invalid question(s) in Batch ${context.batchNumber || 1} for topic "${context.topic}". Initiating 1 targeted AI repair.\n${report.failureSummary}`
      );

      try {
        const regenPrompt = formatRegenerationPrompt(invalidItems, context);
        const regenRes = await callAI(systemPrompt, regenPrompt, { jsonMode: true, maxTokens: 2500 });
        let cleanRegenText = regenRes.text.replace(/```json/gi, '').replace(/```/g, '').trim();

        const firstB = cleanRegenText.indexOf('[');
        const lastB = cleanRegenText.lastIndexOf(']');
        if (firstB !== -1 && lastB !== -1) {
          cleanRegenText = cleanRegenText.substring(firstB, lastB + 1);
        }

        let regenParsed: any[] = [];
        try {
          regenParsed = JSON.parse(cleanRegenText);
        } catch {
          regenParsed = [];
        }

        if (Array.isArray(regenParsed) && regenParsed.length > 0) {
          // Re-validate repaired questions through the same strict validator
          const repairedReport = validateAssessmentBatch(regenParsed, context);
          if (repairedReport.validQuestions.length > 0) {
            validQuestions.push(...repairedReport.validQuestions);
          }

          // If still invalid after 1 repair attempt, discard them!
          if (repairedReport.invalidQuestions.length > 0) {
            console.warn(
              `[AssessmentValidator] Discarded ${repairedReport.invalidQuestions.length} question(s) that failed validation after repair.`
            );
          }
        }
      } catch (repairErr) {
        console.error('[AssessmentValidator] Targeted question repair attempt failed:', repairErr);
      }
    }

    params.onStageUpdate?.({
      stage: 'calibrating',
      message: 'Calibrating adaptive difficulty for your profile',
      subMessage: `Assembling balanced assessment set across cognitive dimensions`,
      progressPercent: 95,
    });

    // 3. Minimum Valid Question Check: Ensure learner receives a viable assessment set
    const MIN_REQUIRED_QUESTIONS = 2;
    let isFallback = false;
    if (validQuestions.length < MIN_REQUIRED_QUESTIONS) {
      console.warn(
        `[AssessmentValidator] Insufficient valid questions (${validQuestions.length}/${MIN_REQUIRED_QUESTIONS}); backfilling with verified fallback questions for topic "${context.topic}".`
      );
      const fallbackList = getFallbackBatch(context.topic, requestedTypes, context.batchNumber || 1);
      // Merge unique fallback questions to meet minimum threshold
      const existingIds = new Set(validQuestions.map((q) => q.id));
      for (const fq of fallbackList) {
        if (!existingIds.has(fq.id)) {
          validQuestions.push(fq);
        }
      }
      isFallback = true;
    }

    params.onStageUpdate?.({
      stage: 'ready',
      message: 'Your assessment is ready',
      subMessage: `${validQuestions.length} calibrated questions generated`,
      progressPercent: 100,
    });

    return {
      questions: validQuestions,
      isFallback,
      providerUsed,
    };
  }

  // 1. If using server-side Gemini and batchNumber is 1, try dedicated batch1 endpoint through the pipeline
  if (settings.provider === 'gemini_server' && params.batchNumber === 1) {
    try {
      params.onStageUpdate?.({
        stage: 'generating',
        message: 'Selecting diagnostic questions & code scenarios',
        subMessage: 'Fast server-side Gemini generation active',
        progressPercent: 45,
      });

      const endpoint = settings.endpoints?.batch1 || '/api/ai/assessment/batch1';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: params.topic,
          subjectTitle: params.subjectTitle,
          selectedTypes: requestedTypes,
          targetDifficulty: params.targetDifficulty,
          typeLimits: params.typeLimits,
          requestedLanguage: detectedLang,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
          return await runAssessmentValidationPipeline(
            data.questions,
            validationContext,
            system,
            'Gemini (Adaptive Batch 1 Engine with Validator)'
          );
        }
      }
    } catch (e) {
      console.warn('Dedicated batch1 endpoint failed; falling back to universal caller:', e);
    }
  }

  params.onStageUpdate?.({
    stage: 'generating',
    message: 'Selecting diagnostic questions & code scenarios',
    subMessage: `Querying ${settings.provider} (${settings.models?.[settings.provider] || 'default'})`,
    progressPercent: 45,
  });

  const promptPayload = {
    subject: params.subjectTitle || params.topic,
    language: detectedLang || null,
    topic: params.topic,
    difficulty: params.targetDifficulty,
    batchNumber: params.batchNumber,
    questionCount: 6,
    domain_constraints: {
      language: detectedLang || null,
    },
    feedbackContext: params.previousBatchAnalysis || undefined,
    weakDimensions: params.weakDimensions?.length ? params.weakDimensions : undefined,
  };

  const prompt = `Assessment Request Metadata:
${JSON.stringify(promptPayload, null, 2)}

Instructions:
Generate a balanced, high-yield baseline assessment of exactly 6 questions total tailored specifically for "${params.topic}".
Use a diagnostic mix suited to the topic from: "mcq" (2), "true_false" (1), "fill_blank" (1), and application/practical questions ("code_input", "debugging", "arrange_steps", "explanation") (2).

Required schema for each item:
- "id": "q_${params.batchNumber}_1", "q_${params.batchNumber}_2", ...
- "type": "mcq" | "true_false" | "fill_blank" | "code_input" | "debugging" | "arrange_steps" | "explanation"
- "question": specific, realistic, non-placeholder prompt
- "topic": "${params.topic}"
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

  try {
    const aiRes = await callAI(system, prompt, { jsonMode: true, maxTokens: 3500 });
    let cleanText = aiRes.text.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Find JSON array bounds
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleanText = cleanText.substring(firstBracket, lastBracket + 1);
    }

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      parsed = [];
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Parsed AI response is not a valid question array');
    }

    // Run parsed JSON through full strict validation & repair pipeline
    return await runAssessmentValidationPipeline(parsed, validationContext, system, aiRes.providerUsed);
  } catch (err: any) {
    console.error('AI batch generation failed:', err);
    throw new Error(
      err?.message || 'AI Inference failed to generate assessment questions. Please check your API key in Settings (Ctrl+Shift+K).'
    );
  }
}

/**
 * Evaluates an entire submitted batch, grades interactive components, and provides AI cognitive breakdown
 */
export async function evaluateAssessmentBatch(
  params: EvaluateBatchParams
): Promise<{
  submissions: Record<string, QuestionSubmission>;
  batchScore: { totalEarned: number; totalPossible: number; percentage: number };
  aiAnalysis: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendedFocus: string;
  };
}> {
  const settings = loadAISettings();
  const { batch, submissions } = params;
  const evaluatedSubmissions: Record<string, QuestionSubmission> = {};

  let totalEarned = 0;
  let totalPossible = 0;

  // 1. Rule-based evaluation first
  for (const q of batch.questions) {
    const maxScore = q.points || 10;
    totalPossible += maxScore;
    const userResp = submissions[q.id]?.userResponse;

    let isCorrect = false;
    let earned = 0;
    let feedback = q.explanation || '';

    switch (q.type) {
      case 'mcq':
        isCorrect = Number(userResp) === q.correctAnswer;
        earned = isCorrect ? maxScore : 0;
        break;

      case 'true_false':
        isCorrect = Boolean(userResp) === q.correctAnswer;
        earned = isCorrect ? maxScore : 0;
        break;

      case 'fill_blank': {
        const text = String(userResp || '').trim().toLowerCase();
        const matches = q.correctAnswers.some((ans) =>
          q.caseSensitive ? String(userResp || '').trim() === ans.trim() : text === ans.trim().toLowerCase()
        );
        isCorrect = matches;
        earned = isCorrect ? maxScore : 0;
        break;
      }

      case 'arrange_steps': {
        const userOrder: string[] = Array.isArray(userResp) ? userResp : [];
        const correctOrder = q.correctOrderIds;
        let matchCount = 0;
        correctOrder.forEach((id, idx) => {
          if (userOrder[idx] === id) matchCount++;
        });
        const ratio = matchCount / correctOrder.length;
        isCorrect = ratio === 1;
        earned = Math.round(maxScore * ratio);
        break;
      }

      case 'code_input': {
        const code = String(userResp || '').trim();
        if (code.length < 15) {
          isCorrect = false;
          earned = 0;
        } else {
          // Check evaluation criteria keywords
          const matched = (q.evaluationCriteria || []).filter((criterion) => {
            const words = criterion.toLowerCase().split(' ');
            return words.some((w) => w.length > 3 && code.toLowerCase().includes(w));
          });
          const ratio = Math.max(0.4, matched.length / Math.max(1, q.evaluationCriteria.length));
          earned = Math.round(maxScore * ratio);
          isCorrect = ratio >= 0.7;
        }
        break;
      }

      case 'debugging': {
        const fix = String(userResp || '').trim().toLowerCase();
        if (fix.length > 5) {
          isCorrect = true;
          earned = maxScore;
        } else {
          isCorrect = false;
          earned = 0;
        }
        break;
      }

      case 'explanation': {
        const text = String(userResp || '').trim();
        const keywords = q.rubricKeywords || [];
        const matched = keywords.filter((k) => text.toLowerCase().includes(k.toLowerCase()));
        const ratio = keywords.length ? matched.length / keywords.length : text.length > 40 ? 1 : 0.5;
        earned = Math.round(maxScore * Math.min(1, Math.max(0.2, ratio)));
        isCorrect = ratio >= 0.6;
        break;
      }
    }

    totalEarned += earned;

    evaluatedSubmissions[q.id] = {
      questionId: q.id,
      questionType: q.type,
      userResponse: userResp,
      isCorrect,
      scoreEarned: earned,
      maxScore,
      aiFeedback: feedback,
    };
  }

  const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

  // Calculate dimensional mastery breakdown & structured evidence for Prompt 2
  const dimensionTotals: Record<CognitiveDimension, { earned: number; possible: number }> = {
    concept: { earned: 0, possible: 0 },
    application: { earned: 0, possible: 0 },
    implementation: { earned: 0, possible: 0 },
    debugging: { earned: 0, possible: 0 },
    algorithmic_thinking: { earned: 0, possible: 0 },
  };

  let correctCount = 0;
  let incorrectCount = 0;

  for (const q of batch.questions) {
    const dim = (CANONICAL_COGNITIVE_DIMENSIONS.includes(q.dimension as any)
      ? q.dimension
      : 'concept') as CognitiveDimension;
    const sub = evaluatedSubmissions[q.id];
    const maxScore = q.points || 10;
    dimensionTotals[dim].possible += maxScore;
    dimensionTotals[dim].earned += sub?.scoreEarned || 0;
    if (sub?.isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  }

  const dimensionScores: Record<string, number> = {};
  const weakDimensions: string[] = [];
  for (const [dim, val] of Object.entries(dimensionTotals)) {
    const ratio = val.possible > 0 ? Number((val.earned / val.possible).toFixed(2)) : 1.0;
    dimensionScores[dim] = ratio;
    if (val.possible > 0 && ratio < 0.65) {
      weakDimensions.push(dim);
    }
  }

  const structuredEvidence = {
    topic: params.topic,
    batchNumber: batch.batchNumber,
    evaluation: {
      correct: correctCount,
      incorrect: incorrectCount,
      totalEarned,
      totalPossible,
      percentage,
    },
    dimensionScores,
    weakDimensions,
    questionSummary: batch.questions.map((q) => ({
      id: q.id,
      type: q.type,
      dimension: q.dimension,
      earned: evaluatedSubmissions[q.id]?.scoreEarned || 0,
      possible: q.points || 10,
      isCorrect: evaluatedSubmissions[q.id]?.isCorrect,
    })),
  };

  // 2. Perform AI Cognitive Analysis of the Batch (System Prompt 2: Adaptive Analysis Mode)
  let aiAnalysis = {
    summary: `You scored ${percentage}% on this batch (${totalEarned}/${totalPossible} pts).`,
    strengths: percentage >= 70 ? ['Solid conceptual foundation', 'Good precision'] : ['Completed all questions'],
    weaknesses: weakDimensions.length > 0 ? weakDimensions.map((w) => `Reinforce ${w} skills`) : percentage < 70 ? ['Needs review on edge cases', 'Review core syntax and order'] : [],
    recommendedFocus: percentage >= 80 ? 'Ready for advanced problem solving and deep practice.' : 'Focus on foundational definitions and practice problems.',
  };

  const adaptivePrompt = settings.systemPrompts.assessmentAdaptive || settings.systemPrompts.assessment;

  // Try dedicated server adaptive endpoint first if on gemini_server
  if (settings.provider === 'gemini_server') {
    try {
      const endpoint = settings.endpoints?.adaptiveNext || '/api/ai/assessment/adaptive-next';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: params.topic,
          batchNumber: batch.batchNumber,
          questions: batch.questions,
          userResponses: evaluatedSubmissions,
          structuredEvidence,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.analysis && data.analysis.summary) {
          aiAnalysis = {
            summary: data.analysis.summary,
            strengths: data.analysis.strengths || aiAnalysis.strengths,
            weaknesses: data.analysis.weaknesses || aiAnalysis.weaknesses,
            recommendedFocus: data.analysis.recommendedFocus || aiAnalysis.recommendedFocus,
          };
          return {
            submissions: evaluatedSubmissions,
            batchScore: { totalEarned, totalPossible, percentage },
            aiAnalysis,
          };
        }
      }
    } catch (e) {
      console.warn('Dedicated adaptive endpoint failed, falling back to universal caller:', e);
    }
  }

  try {
    const analysisPrompt = `Analyze the student's performance on this topic assessment using the structured evidence:

Structured Assessment Evidence:
${JSON.stringify(structuredEvidence, null, 2)}

Provide an encouraging, actionable breakdown in JSON:
{
  "summary": "1-2 sentence overall diagnosis based on dimension scores",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["specific weak spot 1", "specific weak spot 2"],
  "recommendedFocus": "What should the next batch or review focus on?"
}`;

    const res = await callAI(adaptivePrompt, analysisPrompt, {
      jsonMode: true,
      maxTokens: 600,
    });
    const parsed = JSON.parse(res.text.replace(/```json/gi, '').replace(/```/g, '').trim());
    if (parsed.summary) {
      aiAnalysis = parsed;
    }
  } catch (e) {
    console.warn('AI analysis fallback used:', e);
  }

  return {
    submissions: evaluatedSubmissions,
    batchScore: {
      totalEarned,
      totalPossible,
      percentage,
    },
    aiAnalysis,
  };
}

/**
 * Generate a complete roadmap for any subject
 */
export async function generateRoadmapAI(subjectTitle: string): Promise<RoadmapData> {
  const settings = loadAISettings();
  const system = settings.systemPrompts.roadmap;

  const prompt = `Create an in-depth, structured, month-by-month learning roadmap for: "${subjectTitle}".
Return ONLY a valid JSON object matching this schema:
{
  "tagline": "Step-by-step master plan for ${subjectTitle}",
  "months": [
    {
      "title": "Month 1 — Foundational Architecture & Basics",
      "emoji": "🌱",
      "topics": [
        { "id": "m1_t1", "title": "Topic 1 Name", "status": "available" },
        { "id": "m1_t2", "title": "Topic 2 Name", "status": "locked" }
      ]
    },
    {
      "title": "Month 2 — Core Patterns & Deep Dive",
      "emoji": "🌿",
      "topics": [ ... ]
    },
    {
      "title": "Month 3 — Advanced Engineering & Real-World Projects",
      "emoji": "🌳",
      "topics": [ ... ]
    }
  ]
}
Include 2 to 3 months with 4 to 6 concise, actionable topics per month. The first topic must be status: "available", subsequent ones status: "locked".`;

  try {
    const res = await callAI(system, prompt, { jsonMode: true, maxTokens: 1500 });
    const clean = res.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed.months && Array.isArray(parsed.months)) {
      return parsed;
    }
    throw new Error('Invalid roadmap structure received from AI.');
  } catch (e: any) {
    console.error('AI roadmap generation failed:', e);
    throw new Error(
      e?.message || 'AI Inference failed to generate roadmap. Please configure an active API key in Settings (Ctrl+Shift+K).'
    );
  }
}
