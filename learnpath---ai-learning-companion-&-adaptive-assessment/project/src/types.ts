/**
 * Types & Data Models for LearnPath Assessment & Companion
 */

export type QuestionType =
  | 'mcq'
  | 'true_false'
  | 'fill_blank'
  | 'code_input'
  | 'debugging'
  | 'arrange_steps'
  | 'explanation';

export type CognitiveDimension =
  | 'concept'
  | 'application'
  | 'implementation'
  | 'debugging'
  | 'algorithmic_thinking';

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  question: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  dimension: CognitiveDimension;
  points: number;
  explanation: string;
}

export interface MCQQuestion extends BaseQuestion {
  type: 'mcq';
  options: string[];
  correctAnswer: number; // index 0..3
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: 'true_false';
  correctAnswer: boolean;
}

export interface FillBlankQuestion extends BaseQuestion {
  type: 'fill_blank';
  template: string; // e.g. "In TCP, the connection termination uses a {{blank}} way handshake."
  correctAnswers: string[]; // acceptable normalized answers
  caseSensitive?: boolean;
  hint?: string;
}

export interface CodeInputQuestion extends BaseQuestion {
  type: 'code_input';
  language: string; // e.g. "python", "javascript", "cpp", "java", "sql"
  starterCode: string;
  expectedOutputOrPattern?: string;
  solutionCode?: string;
  evaluationCriteria: string[]; // e.g. ["Uses two pointers", "Handles empty array", "O(n) time"]
}

export interface DebuggingQuestion extends BaseQuestion {
  type: 'debugging';
  language: string;
  buggyCode: string;
  bugDescriptionPrompt: string;
  bugType: 'syntax' | 'logical' | 'edge_case' | 'concurrency' | 'off_by_one';
  fixedCodeSnippet: string;
  explanationOfBug: string;
  evaluationCriteria: string[]; // e.g. ["Identifies the off-by-one condition", "Fix removes the infinite loop"]
}

export interface ArrangeStepsQuestion extends BaseQuestion {
  type: 'arrange_steps';
  shuffledSteps: { id: string; text: string }[];
  correctOrderIds: string[]; // Ordered list of step IDs
  contextTitle: string; // e.g. "Order the steps of Dijkstra's Algorithm"
}

export interface ExplanationQuestion extends BaseQuestion {
  type: 'explanation';
  rubricKeywords: string[]; // Required keywords/concepts to look for
  idealAnswerSummary: string;
  minWordCount?: number;
}

export type AssessmentQuestion =
  | MCQQuestion
  | TrueFalseQuestion
  | FillBlankQuestion
  | CodeInputQuestion
  | DebuggingQuestion
  | ArrangeStepsQuestion
  | ExplanationQuestion;

export interface QuestionTypeConfig {
  type: QuestionType;
  label: string;
  desc: string;
  maxPerBatch: number;
  icon: string;
  color: string;
}

export const QUESTION_TYPE_LIMITS: Record<QuestionType, number> = {
  mcq: 10,
  true_false: 10,
  fill_blank: 10,
  code_input: 3,
  debugging: 3,
  arrange_steps: 5,
  explanation: 3,
};

export interface QuestionSubmission {
  questionId: string;
  questionType: QuestionType;
  userResponse: any; // index | boolean | string | string[] | code string
  isCorrect?: boolean;
  scoreEarned: number;
  maxScore: number;
  aiFeedback?: string;
  gradingDetails?: {
    accuracy?: number; // 0..100
    matchedKeywords?: string[];
    missedKeywords?: string[];
    suggestions?: string[];
  };
}

export interface QuestionValidationError {
  field: string;
  message: string;
  receivedValue?: any;
}

export interface QuestionValidationResult {
  isValid: boolean;
  questionId: string;
  questionType?: QuestionType;
  errors: QuestionValidationError[];
  sanitizedQuestion?: AssessmentQuestion;
}

export interface AssessmentValidationReport {
  isValid: boolean;
  totalQuestions: number;
  validCount: number;
  invalidCount: number;
  validQuestions: AssessmentQuestion[];
  invalidQuestions: { raw: any; errors: QuestionValidationError[]; index: number }[];
  failureSummary: string;
}

export interface ValidationContext {
  topic: string;
  subjectTitle?: string;
  requestedLanguage?: string;
  batchNumber?: number;
  targetDifficulty?: string;
}

export interface AssessmentBatch {
  batchNumber: number;
  questions: AssessmentQuestion[];
  submissions: Record<string, QuestionSubmission>; // questionId -> QuestionSubmission
  submittedAt?: string;
  batchScore?: {
    totalEarned: number;
    totalPossible: number;
    percentage: number;
  };
  aiAnalysis?: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendedFocus: string;
  };
}

export interface AssessmentSession {
  id: string;
  topic: string;
  subjectId: string;
  subjectTitle: string;
  selectedTypes: QuestionType[];
  targetDifficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  systemPromptUsed: string;
  status: 'setup' | 'batch_generating' | 'answering' | 'evaluating' | 'batch_reviewed' | 'completed';
  batches: AssessmentBatch[];
  currentBatchIndex: number;
  overallMastery: number; // 0..100
  weakDimensions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LiveResource {
  id: string;
  title: string;
  source: string;
  type: 'video' | 'article' | 'interactive' | 'practice' | 'documentation' | 'book';
  url: string;
  description: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  duration?: string;
  tags: string[];
  isBookmarked?: boolean;
}

export interface UserStats {
  topicsLearned: number;
  streak: number;
  xp: number;
  assessmentsCompleted: number;
  subjectProgress: Record<string, number>; // subjectId -> percentage 0..100
  questionTypeAccuracy: Record<QuestionType, { correct: number; total: number }>;
}

export interface UserProfile {
  name: string;
  email: string;
  password?: string;
  year: string;
  branch: string;
  shortGoals: string[]; // subject IDs
  shortGoalLabels: Record<string, string>;
  longGoals: string[]; // 'placement', 'gate', 'skill', 'higher', 'startup'
  skillName?: string;
  isDemo?: boolean;
  stats: UserStats;
}

export interface RoadmapTopic {
  id: string;
  title: string;
  status: 'locked' | 'available' | 'needs_review' | 'mastered';
  masteryScore?: number;
  lastAssessed?: string;
}

export interface RoadmapMonth {
  title: string;
  emoji: string;
  topics: RoadmapTopic[];
}

export interface RoadmapData {
  tagline: string;
  months: RoadmapMonth[];
}

export type AIProvider = 'gemini_server' | 'gemini_client' | 'anthropic' | 'groq' | 'featherless' | 'custom';

export interface CustomEndpoints {
  aiGenerate: string;
  batch1: string;
  adaptiveNext: string;
  postgresSync: string;
  postgresStatus: string;
  resourcesSearch: string;
}

export interface PostgresConfig {
  enabled: boolean;
  connectionString: string;
  restEndpointUrl?: string;
  autoSync: boolean;
  lastSyncTime?: string;
  status: 'connected' | 'disconnected' | 'local_storage_fallback' | 'error';
  errorMessage?: string;
}

export interface AISettings {
  provider: AIProvider;
  keys: {
    gemini: string;
    anthropic: string;
    groq: string;
    featherless: string;
    custom: string;
  };
  models: {
    gemini: string;
    anthropic: string;
    groq: string;
    featherless: string;
    custom: string;
  };
  customBaseUrl: string;
  customModel?: string; // Legacy fallback
  endpoints: CustomEndpoints;
  postgres: PostgresConfig;
  systemPrompts: {
    assessmentInitial: string; // System Prompt 1: Beginning of test / Format definitions
    assessmentAdaptive: string; // System Prompt 2: Batch submission & Adaptive mode
    assessment: string; // Universal Adaptive assessment generator
    roadmap: string; // Roadmap Curriculum Designer
    recommend: string; // Learning Recommendations Specialist
    mentor: string; // AI Engineering Mentor
    resources: string; // Technical Resource Discovery Engine
    questionEvaluator: string; // Interactive Question Evaluator & Code Grader
    topicDiagnoser: string; // Topic Mastery & Cognitive Dimension Diagnoser
  };
  temperature: number;
}
