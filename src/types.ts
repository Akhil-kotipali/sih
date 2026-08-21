/**
 * Core Data Models & Types for LearnPath — Domain-Agnostic Learning Platform
 */

// -------------------------------------------------------------
// 1. QUESTION & ASSESSMENT MODELS (7 Supported Types)
// -------------------------------------------------------------

export type QuestionType =
  | 'mcq'
  | 'true_false'
  | 'fill_blank'
  | 'code_input'
  | 'debugging'
  | 'arrange_steps'
  | 'explanation';

/**
 * Domain-flexible Cognitive / Competency Dimensions.
 * Canonical dimensions are supported alongside custom domain-specific competencies.
 */
export type CognitiveDimension =
  | 'concept'
  | 'application'
  | 'implementation'
  | 'debugging'
  | 'algorithmic_thinking'
  | 'problem_solving'
  | 'derivation'
  | 'comprehension'
  | 'analysis';

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  question: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  dimension: CognitiveDimension | string;
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
  template: string; // e.g. "In biology, ATP stands for {{blank}} triphosphate."
  correctAnswers: string[];
  caseSensitive?: boolean;
  hint?: string;
}

export interface CodeInputQuestion extends BaseQuestion {
  type: 'code_input';
  language: string; // e.g. "python", "math_latex", "pseudocode", "sql", "javascript", "cpp"
  starterCode: string;
  expectedOutputOrPattern?: string;
  solutionCode?: string;
  evaluationCriteria: string[];
}

export interface DebuggingQuestion extends BaseQuestion {
  type: 'debugging';
  language: string;
  buggyCode: string;
  bugDescriptionPrompt: string;
  bugType: 'syntax' | 'logical' | 'edge_case' | 'concurrency' | 'off_by_one' | 'formula_error' | 'factual_error';
  fixedCodeSnippet: string;
  explanationOfBug: string;
  evaluationCriteria: string[];
}

export interface ArrangeStepsQuestion extends BaseQuestion {
  type: 'arrange_steps';
  shuffledSteps: { id: string; text: string }[];
  correctOrderIds: string[];
  contextTitle: string;
}

export interface ExplanationQuestion extends BaseQuestion {
  type: 'explanation';
  rubricKeywords: string[];
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
  userResponse: any;
  isCorrect?: boolean;
  scoreEarned: number;
  maxScore: number;
  aiFeedback?: string;
  gradingDetails?: {
    accuracy?: number;
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

// -------------------------------------------------------------
// 2. COMPETENCY & MASTERY MODEL
// -------------------------------------------------------------

export interface Competency {
  id: string;
  name: string;
  mastery: number; // 0..100
  confidence: number; // 0..100
  evidenceCount: number;
  weaknesses: string[];
  strengths: string[];
  lastAssessedAt?: string;
}

export interface TopicMasteryRecord {
  goalId: string;
  topicId: string;
  topicTitle: string;
  status: 'locked' | 'available' | 'needs_review' | 'mastered' | 'in_progress';
  masteryScore: number; // 0..100
  weakDimensions: string[];
  radarScores?: CognitiveRadarScores;
  competencies?: Competency[];
  lastBatchCount: number;
  updatedAt: string;
}

export type TopicMastery = TopicMasteryRecord;

export interface CognitiveRadarScores {
  [dimension: string]: number;
}

export interface AssessmentBatch {
  batchNumber: number;
  questions: AssessmentQuestion[];
  submissions: Record<string, QuestionSubmission>;
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
    dimensionScores?: Record<string, number>;
  };
}

export interface AssessmentSession {
  id: string;
  userId?: string;
  topic: string;
  goalId?: string;
  subjectId?: string;
  subjectTitle: string;
  selectedTypes: QuestionType[];
  targetDifficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  systemPromptUsed?: string;
  status: 'setup' | 'batch_generating' | 'answering' | 'evaluating' | 'batch_reviewed' | 'completed';
  batches: AssessmentBatch[];
  currentBatchIndex: number;
  overallMastery: number; // 0..100
  weakDimensions: string[];
  createdAt: string;
  updatedAt: string;
  // Compatibility helpers
  timestamp?: string;
  questions?: AssessmentQuestion[];
  skillLevelVerdict?: string;
  scorePercentage?: number;
}

// -------------------------------------------------------------
// 3. LEARNING GOALS & SUBJECTS (Completely Dynamic)
// -------------------------------------------------------------

export type GoalStatus = 'active' | 'in_progress' | 'paused' | 'completed' | 'archived';

export interface LearningGoal {
  id: string;
  userId?: string;
  title: string; // e.g. "Prepare for organic chemistry exam" or "Learn Python for backend"
  subject: string; // e.g. "Chemistry", "Computer Science", "Spanish", "Finance"
  currentLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  targetLevel: 'Intermediate' | 'Advanced' | 'Mastery';
  targetDate?: string;
  availableDailyMinutes?: number; // 10, 20, 30, 60, 120
  dailyMinutes?: number;
  preferredLanguage?: string;
  preferredLearningStyle?: 'first_principles' | 'socratic' | 'practical' | 'visual';
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  progressPercent?: number; // 0..100 calculated from mastered topics
  description?: string;
  topicsTotal?: number;
  topicsCompleted?: number;
}

export interface RoadmapTopic {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes?: number;
  status: 'locked' | 'available' | 'needs_review' | 'mastered';
  masteryScore?: number;
  lastAssessed?: string;
  competencyFocus?: string[];
}

export interface RoadmapPhase {
  title: string;
  emoji?: string;
  description?: string;
  topics: RoadmapTopic[];
}

export interface RoadmapData {
  tagline: string;
  goalId?: string;
  subject?: string;
  phases: RoadmapPhase[];
  // Backwards compatibility alias for older code
  months?: RoadmapPhase[];
}

// -------------------------------------------------------------
// 4. REAL RESOURCE RECOMMENDATION MODELS
// -------------------------------------------------------------

export type ResourceType =
  | 'video'
  | 'article'
  | 'interactive'
  | 'practice'
  | 'documentation'
  | 'book'
  | 'course'
  | 'lecture';

export interface LiveResource {
  id: string;
  title: string;
  source: string; // e.g. "Khan Academy", "MIT OpenCourseWare", "MDN", "SWAYAM", "YouTube", "OpenStax"
  type: ResourceType;
  url: string;
  description: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Unknown';
  duration?: string; // e.g. "15 min read", "45 min lecture"
  durationMinutes?: number;
  language?: string; // e.g. "English", "Spanish", "Telugu", "Hindi"
  isFree?: boolean; // defaults to true
  tags: string[];
  isBookmarked?: boolean;
  isCompleted?: boolean;
  userRating?: 'helpful' | 'not_helpful' | null;
  isHidden?: boolean;
}

export interface ResourceFilterOptions {
  query?: string;
  topic?: string;
  subject?: string;
  language?: string;
  category?: 'all' | ResourceType;
  duration?: 'all' | 'under_5' | '5_15' | '15_30' | '30_60' | 'over_60';
  difficulty?: 'all' | 'Beginner' | 'Intermediate' | 'Advanced';
  freeOnly?: boolean;
}

// -------------------------------------------------------------
// 5. USER PROFILE & PREFERENCES (Real Account System)
// -------------------------------------------------------------

export interface LearningPreferences {
  uiLanguage: string; // e.g. 'en', 'es', 'hi', 'te'
  learningLanguage: string; // Language for explanations & AI generated content
  resourceLanguages: string[]; // Preferred resource languages
  learningLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  explanationStyle: 'First Principles' | 'Socratic' | 'Direct & Practical' | 'Visual & Intuitive';
  preferredQuestionDifficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  dailyStudyMinutes: number; // 10, 20, 30, 45, 60, 120
  preferredStudyTime?: 'morning' | 'afternoon' | 'evening' | 'flexible';
  mentorTone: 'encouraging' | 'rigorous' | 'socratic' | 'concise';
  preferredQuestionTypes?: QuestionType[];
}

export interface UserStats {
  topicsLearned: number;
  streak: number;
  xp: number;
  assessmentsCompleted: number;
  lastStudyDate?: string;
  questionTypeAccuracy: Record<QuestionType, { correct: number; total: number }>;
  subjectProgress?: Record<string, number>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  preferences: LearningPreferences;
  stats: UserStats;
  createdAt: string;
  updatedAt: string;
  // Legacy compatibility helpers
  year?: string;
  branch?: string;
  skillName?: string;
  shortGoals?: string[];
  shortGoalLabels?: Record<string, string>;
  longGoals?: string[];
}

export interface AuthSession {
  token: string;
  user: UserProfile;
}

// -------------------------------------------------------------
// 6. AI SETTINGS & SYSTEM PROMPTS
// -------------------------------------------------------------

export type AIProvider = 'gemini_server' | 'gemini_client' | 'anthropic' | 'groq' | 'featherless' | 'custom';

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
  customModel?: string;
  endpoints: {
    aiGenerate: string;
    batch1: string;
    adaptiveNext: string;
    postgresSync: string;
    postgresStatus: string;
    resourcesSearch: string;
    roadmap: string;
  };
  postgres: {
    enabled: boolean;
    connectionString: string;
    restEndpointUrl?: string;
    autoSync: boolean;
    lastSyncTime?: string;
    status: 'connected' | 'disconnected' | 'local_storage_fallback' | 'error';
    errorMessage?: string;
  };
  systemPrompts: {
    assessmentInitial: string;
    assessmentAdaptive: string;
    assessment: string;
    roadmap: string;
    recommend: string;
    mentor: string;
    resources: string;
    questionEvaluator: string;
    topicDiagnoser: string;
  };
  temperature: number;
}
