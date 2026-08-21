import React, { useState, useEffect } from 'react';
import {
  QuestionType,
  QUESTION_TYPE_LIMITS,
  AssessmentSession,
  AssessmentBatch,
  AssessmentQuestion,
  UserProfile,
  QuestionSubmission,
} from '../types';
import {
  generateAssessmentBatch,
  evaluateAssessmentBatch,
  checkInferenceReady,
  extractString,
  StageUpdatePayload,
} from '../services/aiService';
import {
  saveAssessmentSession,
  loadAllAssessmentSessions,
  saveTopicMastery,
  saveCurrentUser,
  loadAISettings,
  isInferenceConfigured,
  checkServerGeminiStatus,
} from '../services/storageService';
import { QuestionDispatcher } from './QuestionWidgets/QuestionWidgets';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Play,
  RotateCcw,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Layers,
  Settings2,
  Code2,
  Bug,
  ListOrdered,
  FileText,
  ToggleLeft,
  Search,
  BookOpen,
  Check,
  Download,
  Copy,
  FileCode,
} from 'lucide-react';

interface PracticeScreenProps {
  user: UserProfile;
  initialTopic?: string;
  initialSubjectId?: string;
  onNavigateToResources?: (topic: string) => void;
  onUpdateUser: (updated: UserProfile) => void;
}

const QUESTION_TYPE_INFO: Record<
  QuestionType,
  { label: string; desc: string; max: number; icon: any; color: string }
> = {
  mcq: {
    label: 'MCQ',
    desc: '4 options, single correct choice',
    max: 10,
    icon: CheckCircle2,
    color: 'border-blue-200 bg-blue-50/50 text-blue-800',
  },
  true_false: {
    label: 'True / False',
    desc: 'Binary conceptual assertions',
    max: 10,
    icon: ToggleLeft,
    color: 'border-emerald-200 bg-emerald-50/50 text-emerald-800',
  },
  fill_blank: {
    label: 'Fill in Blank',
    desc: 'Precise terminology & keywords',
    max: 10,
    icon: HelpCircle,
    color: 'border-amber-200 bg-amber-50/50 text-amber-800',
  },
  code_input: {
    label: 'Code (No Compiler)',
    desc: 'Write structural implementation',
    max: 3,
    icon: Code2,
    color: 'border-purple-200 bg-purple-50/50 text-purple-800',
  },
  debugging: {
    label: 'Debugging',
    desc: 'Spot and correct faulty code',
    max: 3,
    icon: Bug,
    color: 'border-rose-200 bg-rose-50/50 text-rose-800',
  },
  arrange_steps: {
    label: 'Arrange Steps',
    desc: 'Order algorithm & protocol flow',
    max: 5,
    icon: ListOrdered,
    color: 'border-indigo-200 bg-indigo-50/50 text-indigo-800',
  },
  explanation: {
    label: 'Explanations',
    desc: 'Short conceptual mental models',
    max: 3,
    icon: FileText,
    color: 'border-teal-200 bg-teal-50/50 text-teal-800',
  },
};

const ALL_QUESTION_TYPES: QuestionType[] = [
  'mcq',
  'true_false',
  'fill_blank',
  'code_input',
  'debugging',
  'arrange_steps',
  'explanation',
];

export const UNIVERSAL_SUBJECT_PRESETS = [
  {
    subject: 'Java',
    badge: 'Programming',
    topics: ['Exception Handling', 'Multithreading & Concurrency', 'Generics & Type Erasure', 'JVM Memory Model'],
  },
  {
    subject: 'Python',
    badge: 'Programming',
    topics: ['Decorators & Wrappers', 'Generators & Iterators', 'Memory Management & GIL', 'Asyncio & Coroutines'],
  },
  {
    subject: 'C++',
    badge: 'Systems',
    topics: ['Smart Pointers & RAII', 'Move Semantics & Rvalues', 'Templates & Metaprogramming', 'Pointers & Memory Layout'],
  },
  {
    subject: 'Data Structures & Algorithms',
    badge: 'CS Core',
    topics: ['Binary Search & Invariants', 'Graph Traversals (BFS/DFS)', 'Dynamic Programming', 'Heap & Priority Queue'],
  },
  {
    subject: 'Database Management Systems',
    badge: 'Databases',
    topics: ['ACID & Transaction Isolation', 'B-Tree & Hash Indexing', 'SQL Joins & Execution Plans', 'Database Normalization'],
  },
  {
    subject: 'Operating Systems',
    badge: 'Systems',
    topics: ['Process Synchronization & Mutex', 'Virtual Memory & Paging', 'CPU Scheduling Algorithms', 'Deadlock Avoidance'],
  },
  {
    subject: 'Computer Networks',
    badge: 'Networking',
    topics: ['TCP 3-Way Handshake & Teardown', 'DNS & HTTP/3 Protocol', 'Subnetting & CIDR', 'Routing Protocols (BGP/OSPF)'],
  },
  {
    subject: 'Mathematics',
    badge: 'Applied Math',
    topics: ['Quadratic Equations & Roots', 'Matrix Linear Transformations', 'Differential Calculus & Derivatives', 'Probability & Bayes Theorem'],
  },
  {
    subject: 'Physics',
    badge: 'Engineering Science',
    topics: ["Newton's Laws & Friction", 'Thermodynamics & Carnot Cycle', 'Electromagnetic Induction', 'Wave Optics & Interference'],
  },
];

const DEFAULT_TYPE_LIMITS: Record<QuestionType, number> = {
  mcq: 2,
  true_false: 1,
  fill_blank: 1,
  code_input: 1,
  debugging: 1,
  arrange_steps: 1,
  explanation: 1,
};

export const PracticeScreen: React.FC<PracticeScreenProps> = ({
  user,
  initialTopic = '',
  initialSubjectId = '',
  onNavigateToResources,
  onUpdateUser,
}) => {
  // Setup Form State
  const [subjectTitle, setSubjectTitle] = useState(
    initialSubjectId ? user.shortGoalLabels[initialSubjectId] || 'DSA' : 'Data Structures & Algorithms'
  );
  const [topic, setTopic] = useState(initialTopic || 'Binary Search & Two Pointers');
  const [targetDifficulty, setTargetDifficulty] = useState<'easy' | 'medium' | 'hard' | 'adaptive'>('adaptive');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  // Active Session State
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userResponses, setUserResponses] = useState<Record<string, any>>({});
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastProviderUsed, setLastProviderUsed] = useState<string>('');
  const [isFallbackBatch, setIsFallbackBatch] = useState(false);
  const [historySessions, setHistorySessions] = useState<AssessmentSession[]>([]);
  const [inferenceReady, setInferenceReady] = useState<boolean>(true);
  const [inferenceReason, setInferenceReason] = useState<string>('');
  const [startError, setStartError] = useState<string | null>(null);
  const [exportedNotice, setExportedNotice] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<StageUpdatePayload | null>(null);
  const [readyPreview, setReadyPreview] = useState<{
    topic: string;
    subjectTitle: string;
    questionsCount: number;
    estimatedMinutes: number;
    typesUsed: QuestionType[];
    targetDifficulty: string;
    batchNumber: number;
    providerUsed: string;
    isFallback: boolean;
  } | null>(null);

  const handleInstantExportQuiz = (targetSession?: AssessmentSession | null, copyOnly = false) => {
    const activeSess = targetSession || session;
    if (!activeSess) return;

    const currentBatch = activeSess.batches[activeSess.currentBatchIndex] || activeSess.batches[0];
    
    // Format full questions with options and answer keys for testing
    const formattedQuestionsForTesting = (currentBatch?.questions || []).map((q, idx) => {
      const qType = q.type;
      const base: any = {
        questionIndex: idx + 1,
        id: extractString(q.id),
        type: qType,
        prompt: extractString(q.question),
        topic: extractString(q.topic),
        difficulty: q.difficulty,
        dimension: q.dimension,
        points: q.points || 10,
        explanation: extractString(q.explanation),
        userResponse: userResponses[q.id] ?? null,
      };

      if (qType === 'mcq') {
        const mcq = q as any;
        base.options = Array.isArray(mcq.options)
          ? mcq.options.map((opt: any) => extractString(opt))
          : mcq.options;
        base.correctAnswerIndex = mcq.correctAnswer;
        base.correctOptionText = Array.isArray(base.options) ? base.options[mcq.correctAnswer] : undefined;
      } else if (qType === 'true_false') {
        const tf = q as any;
        base.correctAnswer = tf.correctAnswer;
      } else if (qType === 'fill_blank') {
        const fb = q as any;
        base.template = extractString(fb.template);
        base.correctAnswers = Array.isArray(fb.correctAnswers)
          ? fb.correctAnswers.map((a: any) => extractString(a))
          : [extractString(fb.correctAnswer)];
        base.hint = extractString(fb.hint);
      } else if (qType === 'code_input') {
        const ci = q as any;
        base.language = extractString(ci.language);
        base.starterCode = extractString(ci.starterCode);
        base.expectedOutputOrPattern = extractString(ci.expectedOutputOrPattern);
        base.evaluationCriteria = Array.isArray(ci.evaluationCriteria)
          ? ci.evaluationCriteria.map((c: any) => extractString(c))
          : [];
      } else if (qType === 'debugging') {
        const db = q as any;
        base.language = extractString(db.language);
        base.bugType = extractString(db.bugType);
        base.buggyCode = extractString(db.buggyCode);
        base.bugDescriptionPrompt = extractString(db.bugDescriptionPrompt);
        base.fixedCodeSnippet = extractString(db.fixedCodeSnippet);
        base.explanationOfBug = extractString(db.explanationOfBug);
      } else if (qType === 'arrange_steps') {
        const as = q as any;
        base.contextTitle = extractString(as.contextTitle);
        base.shuffledSteps = Array.isArray(as.shuffledSteps)
          ? as.shuffledSteps.map((s: any) => ({
              id: extractString(s?.id),
              text: extractString(s?.text || s?.step || s),
            }))
          : [];
        base.correctOrderIds = as.correctOrderIds;
      } else if (qType === 'explanation') {
        const ex = q as any;
        base.rubricKeywords = Array.isArray(ex.rubricKeywords)
          ? ex.rubricKeywords.map((k: any) => extractString(k))
          : [];
        base.idealAnswerSummary = extractString(ex.idealAnswerSummary);
        base.minWordCount = ex.minWordCount;
      }

      return base;
    });

    const exportData = {
      exportType: 'LEARNPATH_QUIZ_FULL_TEST_SUITE',
      purpose: 'testing_and_qa_verification',
      exportedAt: new Date().toISOString(),
      metadata: {
        sessionId: activeSess.id,
        topic: activeSess.topic,
        subject: activeSess.subjectTitle,
        targetDifficulty: activeSess.targetDifficulty,
        overallMastery: activeSess.overallMastery,
        currentBatchNumber: currentBatch?.batchNumber || 1,
        totalBatches: activeSess.batches.length,
        systemPromptUsed: activeSess.systemPromptUsed,
      },
      fullTestQuestions: formattedQuestionsForTesting,
      currentBatchUserSubmissions: currentBatch?.submissions || userResponses,
      allBatches: activeSess.batches,
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    if (copyOnly) {
      navigator.clipboard.writeText(jsonString);
      setExportedNotice('Full test questions & options JSON copied to clipboard!');
      setTimeout(() => setExportedNotice(null), 3000);
      return;
    }

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedTopic = activeSess.topic.toLowerCase().replace(/[^a-z0-9]/g, '_');
    a.download = `quiz_full_test_${sanitizedTopic}_b${currentBatch?.batchNumber || 1}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExportedNotice(`Exported full test questions & options for Batch ${currentBatch?.batchNumber || 1}!`);
    setTimeout(() => setExportedNotice(null), 3500);
  };

  useEffect(() => {
    setHistorySessions(loadAllAssessmentSessions());
    async function verifyInference() {
      const aiSettings = loadAISettings();
      const serverGemini = await checkServerGeminiStatus();
      const configured = isInferenceConfigured(aiSettings, serverGemini);
      const readiness = await checkInferenceReady(aiSettings);
      setInferenceReady(readiness.ready && configured);
      setInferenceReason(readiness.reason || (configured ? '' : 'API key or inference provider is not configured.'));
    }
    verifyInference();
  }, []);

  // Update prompt default if settings change
  useEffect(() => {
    const aiSettings = loadAISettings();
    setCustomSystemPrompt(aiSettings.systemPrompts.assessment);
  }, []);

  // -------------------------------------------------------------
  // STEP 1: TEST + SYSTEM PROMPT -> GENERATE BATCH 1
  // -------------------------------------------------------------
  const handleStartAssessment = async () => {
    if (!topic.trim()) return;
    setStartError(null);
    setIsLoadingBatch(true);
    setReadyPreview(null);

    const newSession: AssessmentSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      topic: topic.trim(),
      subjectId: initialSubjectId || 'custom',
      subjectTitle: subjectTitle.trim(),
      selectedTypes: ALL_QUESTION_TYPES,
      targetDifficulty,
      systemPromptUsed: customSystemPrompt,
      status: 'batch_generating',
      batches: [],
      currentBatchIndex: 0,
      overallMastery: 0,
      weakDimensions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const generated = await generateAssessmentBatch({
        topic: newSession.topic,
        subjectTitle: newSession.subjectTitle,
        selectedTypes: ALL_QUESTION_TYPES,
        targetDifficulty: newSession.targetDifficulty,
        batchNumber: 1,
        typeLimits: DEFAULT_TYPE_LIMITS,
        systemPromptOverride: customSystemPrompt,
        onStageUpdate: (stage) => setPipelineStage(stage),
      });

      const firstBatch: AssessmentBatch = {
        batchNumber: 1,
        questions: generated.questions,
        submissions: {},
      };

      newSession.batches = [firstBatch];
      newSession.status = 'answering';
      setSession(newSession);
      setCurrentQuestionIndex(0);
      setUserResponses({});
      setLastProviderUsed(generated.providerUsed);
      setIsFallbackBatch(generated.isFallback);

      // Save initial session state
      saveAssessmentSession(newSession);

      // Show the ready transition card
      setReadyPreview({
        topic: newSession.topic,
        subjectTitle: newSession.subjectTitle,
        questionsCount: generated.questions.length,
        estimatedMinutes: Math.max(5, Math.round(generated.questions.length * 1.2)),
        typesUsed: Array.from(new Set(generated.questions.map((q) => q.type))),
        targetDifficulty: newSession.targetDifficulty,
        batchNumber: 1,
        providerUsed: generated.providerUsed,
        isFallback: generated.isFallback,
      });
    } catch (err: any) {
      console.error('Failed to start assessment batch 1:', err);
      setStartError(
        err?.message ||
          'Failed to generate adaptive assessment. Please verify your AI provider and API key in Settings (Shortcut: Ctrl+Shift+K).'
      );
    } finally {
      setIsLoadingBatch(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 3: SUBMIT BATCH 1 -> EVALUATE & SAVE JSON FORMAT
  // -------------------------------------------------------------
  const handleSubmitCurrentBatch = async () => {
    if (!session) return;
    const currentBatch = session.batches[session.currentBatchIndex];
    if (!currentBatch) return;

    setIsSubmitting(true);

    // Build raw submission map
    const initialSubmissions: Record<string, QuestionSubmission> = {};
    currentBatch.questions.forEach((q) => {
      initialSubmissions[q.id] = {
        questionId: q.id,
        questionType: q.type,
        userResponse: userResponses[q.id] ?? null,
        scoreEarned: 0,
        maxScore: q.points || 10,
      };
    });

    try {
      const evaluated = await evaluateAssessmentBatch({
        topic: session.topic,
        batch: currentBatch,
        submissions: initialSubmissions,
      });

      // Update current batch with evaluation
      const updatedBatch: AssessmentBatch = {
        ...currentBatch,
        submissions: evaluated.submissions,
        submittedAt: new Date().toISOString(),
        batchScore: evaluated.batchScore,
        aiAnalysis: evaluated.aiAnalysis,
      };

      const updatedBatches = [...session.batches];
      updatedBatches[session.currentBatchIndex] = updatedBatch;

      // Calculate cumulative mastery across all batches
      const totalEarned = updatedBatches.reduce(
        (sum, b) => sum + (b.batchScore?.totalEarned || 0),
        0
      );
      const totalPossible = updatedBatches.reduce(
        (sum, b) => sum + (b.batchScore?.totalPossible || 0),
        0
      );
      const overallMastery = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

      const updatedSession: AssessmentSession = {
        ...session,
        batches: updatedBatches,
        status: 'batch_reviewed',
        overallMastery,
        weakDimensions: evaluated.aiAnalysis.weaknesses,
        updatedAt: new Date().toISOString(),
      };

      setSession(updatedSession);
      saveAssessmentSession(updatedSession);
      setHistorySessions(loadAllAssessmentSessions());

      // Update user stats
      const updatedUser = { ...user };
      updatedUser.stats.xp += evaluated.batchScore.totalEarned * 5;
      updatedUser.stats.assessmentsCompleted += 1;
      saveCurrentUser(updatedUser);
      onUpdateUser(updatedUser);
    } catch (e) {
      console.error('Failed to submit batch evaluation:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 4: AI ADAPTS NEXT BATCH (BATCH 2, 3, etc.)
  // -------------------------------------------------------------
  const handleGenerateNextAdaptedBatch = async () => {
    if (!session) return;
    setIsLoadingBatch(true);

    const nextBatchNumber = session.batches.length + 1;
    const lastBatch = session.batches[session.batches.length - 1];

    const feedbackContext = `Prior Batch ${lastBatch.batchNumber} scored ${lastBatch.batchScore?.percentage}%. Strengths: ${lastBatch.aiAnalysis?.strengths.join(', ')}. Weaknesses: ${lastBatch.aiAnalysis?.weaknesses.join(', ')}. Focus recommendation: ${lastBatch.aiAnalysis?.recommendedFocus}`;

    try {
      const generated = await generateAssessmentBatch({
        topic: session.topic,
        subjectTitle: session.subjectTitle,
        selectedTypes: session.selectedTypes,
        targetDifficulty: session.targetDifficulty,
        batchNumber: nextBatchNumber,
        typeLimits: DEFAULT_TYPE_LIMITS,
        previousBatchAnalysis: feedbackContext,
        weakDimensions: session.weakDimensions,
        systemPromptOverride: session.systemPromptUsed,
        onStageUpdate: (stage) => setPipelineStage(stage),
      });

      const nextBatch: AssessmentBatch = {
        batchNumber: nextBatchNumber,
        questions: generated.questions,
        submissions: {},
      };

      const updatedSession: AssessmentSession = {
        ...session,
        batches: [...session.batches, nextBatch],
        currentBatchIndex: session.batches.length,
        status: 'answering',
        updatedAt: new Date().toISOString(),
      };

      setSession(updatedSession);
      setCurrentQuestionIndex(0);
      setUserResponses({});
      setLastProviderUsed(generated.providerUsed);
      setIsFallbackBatch(generated.isFallback);
      saveAssessmentSession(updatedSession);
    } catch (e) {
      console.error('Failed to generate adapted batch:', e);
    } finally {
      setIsLoadingBatch(false);
    }
  };

  const handleFinishAssessment = () => {
    if (!session) return;

    // Save topic mastery
    saveTopicMastery({
      goalId: session.subjectId,
      topicId: session.topic.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      topicTitle: session.topic,
      status: session.overallMastery >= 75 ? 'mastered' : 'needs_review',
      masteryScore: session.overallMastery,
      weakDimensions: session.weakDimensions,
      lastBatchCount: session.batches.length,
      updatedAt: new Date().toISOString(),
    });

    setSession(null);
    setHistorySessions(loadAllAssessmentSessions());
  };

  const currentBatch = session ? session.batches[session.currentBatchIndex] : null;
  const currentQuestion: AssessmentQuestion | null =
    currentBatch && currentBatch.questions[currentQuestionIndex]
      ? currentBatch.questions[currentQuestionIndex]
      : null;

  // =============================================================
  // RENDER: DYNAMIC ASSESSMENT PIPELINE LOADING
  // =============================================================
  if (isLoadingBatch) {
    const stage = pipelineStage || {
      stage: 'analyzing',
      message: 'Building your assessment',
      subMessage: `Examining "${topic}"`,
      progressPercent: 25,
    };

    const steps = [
      { id: 'analyzing', label: 'Analyzing topic & curriculum requirements' },
      { id: 'generating', label: 'Selecting diagnostic questions & code scenarios' },
      { id: 'validating', label: 'Validating question quality & deterministic rules' },
      { id: 'calibrating', label: 'Calibrating adaptive difficulty for your profile' },
    ];

    const currentStageIdx =
      stage.stage === 'analyzing'
        ? 0
        : stage.stage === 'generating'
        ? 1
        : stage.stage === 'validating' || stage.stage === 'repairing'
        ? 2
        : 3;

    return (
      <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mb-1 ring-8 ring-indigo-50/50">
          <Sparkles className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider">
            ✦ Building Your Assessment
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {stage.message}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {stage.subMessage || `Tailoring questions for "${topic}"`}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
          <div
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.max(10, Math.min(100, stage.progressPercent))}%` }}
          />
        </div>

        {/* Pipeline Step Checklist */}
        <div className="bg-slate-50/90 rounded-2xl border border-slate-200/80 p-5 text-left space-y-3.5">
          {steps.map((s, idx) => {
            const isDone = currentStageIdx > idx || stage.stage === 'ready';
            const isCurrent = currentStageIdx === idx && stage.stage !== 'ready';

            return (
              <div key={s.id} className="flex items-center gap-3 text-xs sm:text-sm">
                {isDone ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                ) : isCurrent ? (
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-slate-300 bg-white shrink-0" />
                )}
                <span
                  className={`${
                    isDone
                      ? 'text-slate-800 font-semibold'
                      : isCurrent
                      ? 'text-indigo-600 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400 font-medium">
          Deterministic validation pipeline guarantees zero broken questions.
        </p>
      </div>
    );
  }

  // =============================================================
  // RENDER: ASSESSMENT READY TRANSITION SCREEN
  // =============================================================
  if (readyPreview) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Your assessment is ready
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            The assessment engine has built and validated a diagnostic batch.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 space-y-3">
          <div className="flex items-center justify-between text-sm py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Topic</span>
            <span className="font-bold text-slate-900 text-right">{readyPreview.topic}</span>
          </div>
          <div className="flex items-center justify-between text-sm py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Subject</span>
            <span className="font-semibold text-indigo-700">{readyPreview.subjectTitle}</span>
          </div>
          <div className="flex items-center justify-between text-sm py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Questions</span>
            <span className="font-bold text-slate-900 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs">
              {readyPreview.questionsCount} Questions
            </span>
          </div>
          <div className="flex items-center justify-between text-sm py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Estimated time</span>
            <span className="font-medium text-slate-700">~{readyPreview.estimatedMinutes} minutes</span>
          </div>
          <div className="flex items-center justify-between text-sm py-1">
            <span className="text-slate-500 font-medium">Difficulty Strategy</span>
            <span className="font-bold capitalize text-slate-800 flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {readyPreview.targetDifficulty} (Active)
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
            Included Question Formats
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {readyPreview.typesUsed.map((t) => (
              <span
                key={t}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200"
              >
                {QUESTION_TYPE_INFO[t]?.label || t}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setReadyPreview(null)}
          className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          Start Assessment
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // =============================================================
  // RENDER: SETUP SCREEN
  // =============================================================
  if (!session) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Inference Warning Banner if not setup */}
        {!inferenceReady && (
          <div className="bg-amber-500/10 border border-amber-300/80 rounded-2xl p-4 flex items-center justify-between gap-3 text-amber-900 shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold block text-sm">AI Inference Setup Required</span>
                <span className="text-amber-700">
                  {inferenceReason ||
                    'Please configure your API key in Settings (Shortcut: Ctrl+Shift+K or Cmd+Shift+K) to generate live adaptive questions.'}
                </span>
              </div>
            </div>
            <kbd className="px-2.5 py-1 bg-amber-100/80 border border-amber-300 rounded text-xs font-mono font-bold text-amber-900 shrink-0">
              Ctrl+Shift+K
            </kbd>
          </div>
        )}

        {/* Start Error Banner */}
        {startError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-900 shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold block text-sm">Assessment Generation Failed</span>
                <span className="text-rose-700">{startError}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStartError(null)}
              className="text-xs font-bold text-rose-700 hover:text-rose-900 px-2 py-1 bg-rose-100 rounded-lg cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header Hero */}
        <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-md relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-xs font-semibold tracking-wide text-indigo-200">
              <Sparkles className="w-3.5 h-3.5" />
              Inference-Powered Adaptive Assessment Arena
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Adaptive Practice & Multi-Format Mastery
            </h1>
            <p className="text-indigo-200 text-sm leading-relaxed">
              Experience the full 4-stage loop: Customize test & system prompt → AI generates Batch 1 → Submit answers → AI adapts the next batch based on your weak dimensions.
            </p>
          </div>
        </div>

        {/* Configuration Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-600" />
                Step 1: Test Setup & Question Selection
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure topic, question types with batch ceilings, and system prompt.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <Settings2 className="w-3.5 h-3.5" />
              {showPromptEditor ? 'Hide System Prompt' : 'Customize System Prompt'}
            </button>
          </div>

          {/* Universal Subject & Topic Quick-Select Palette */}
          <div className="space-y-2.5 pb-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Choose What You Want to Learn
              </label>
              <span className="text-[11px] font-medium text-slate-400">
                Universal Diagnostic Architecture
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {UNIVERSAL_SUBJECT_PRESETS.map((preset) => {
                const isSelected = subjectTitle.toLowerCase().trim() === preset.subject.toLowerCase().trim();
                return (
                  <button
                    type="button"
                    key={preset.subject}
                    onClick={() => {
                      setSubjectTitle(preset.subject);
                      setTopic(preset.topics[0]);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{preset.subject}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${
                        isSelected ? 'bg-indigo-700/60 text-indigo-100' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {preset.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Subtopic Chips for active subject */}
            {(() => {
              const matched = UNIVERSAL_SUBJECT_PRESETS.find(
                (p) => p.subject.toLowerCase().trim() === subjectTitle.toLowerCase().trim()
              );
              if (!matched) return null;
              return (
                <div className="flex items-center gap-1.5 flex-wrap pt-1 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/60">
                  <span className="text-[11px] font-bold text-indigo-800 shrink-0">
                    {matched.subject} Focus Areas:
                  </span>
                  {matched.topics.map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setTopic(t)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                        topic.toLowerCase().trim() === t.toLowerCase().trim()
                          ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                          : 'bg-white text-indigo-900 border border-indigo-200/80 hover:bg-indigo-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Topic & Subject inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Subject / Domain
              </label>
              <input
                type="text"
                value={subjectTitle}
                onChange={(e) => setSubjectTitle(e.target.value)}
                placeholder="e.g. Data Structures & Algorithms, OS, DBMS..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Practice Topic / Focus Area
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Binary Search, Deadlocks, SQL Joins..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-indigo-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>
          </div>

          {/* All-Inclusive Adaptive Question Formats Overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                All 7 Question Formats Included Automatically
              </label>
              <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                Full-Spectrum Adaptive Blend
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {(Object.keys(QUESTION_TYPE_INFO) as QuestionType[]).map((t) => {
                const info = QUESTION_TYPE_INFO[t];
                const Icon = info.icon;

                return (
                  <div
                    key={t}
                    className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 flex items-start gap-3 transition hover:bg-white hover:border-indigo-200 shadow-2xs"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 truncate">{info.label}</span>
                        <span className="text-[10px] font-semibold text-slate-400">max {info.max}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{info.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Difficulty & Quick Launch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Difficulty Strategy
              </label>
              <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl">
                {(['adaptive', 'easy', 'medium', 'hard'] as const).map((diff) => (
                  <button
                    type="button"
                    key={diff}
                    onClick={() => setTargetDifficulty(diff)}
                    className={`py-1.5 text-xs font-bold rounded-lg capitalize transition ${
                      targetDifficulty === diff
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-5">
              <button
                type="button"
                disabled={isLoadingBatch || !topic.trim()}
                onClick={handleStartAssessment}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoadingBatch ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Generating Batch 1...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Launch Batch 1 Assessment
                  </>
                )}
              </button>
            </div>
          </div>

          {/* System Prompt Customizer */}
          {showPromptEditor && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Assessment Engine System Prompt (Test instructions)
                </label>
                <span className="text-[11px] text-slate-400">Controls AI question tone & generation rules</span>
              </div>
              <textarea
                rows={4}
                value={customSystemPrompt}
                onChange={(e) => setCustomSystemPrompt(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-300 font-mono text-xs text-slate-800 bg-white leading-relaxed outline-none focus:border-indigo-600"
              />
            </div>
          )}
        </div>

        {/* Past Sessions History */}
        {historySessions.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Past Assessment Sessions ({historySessions.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {historySessions.slice(0, 4).map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/50 flex items-start justify-between gap-3 transition"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                      {s.subjectTitle}
                    </div>
                    <div className="font-bold text-sm text-slate-900">{s.topic}</div>
                    <div className="text-xs text-slate-500">
                      {s.batches.length} batch{s.batches.length > 1 ? 'es' : ''} completed · {new Date(s.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <div>
                      <div
                        className={`text-base font-extrabold ${
                          s.overallMastery >= 75
                            ? 'text-emerald-600'
                            : s.overallMastery >= 50
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {s.overallMastery}%
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Mastery</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInstantExportQuiz(s, false)}
                      className="px-2 py-1 rounded-md border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-[10px] font-bold text-amber-800 flex items-center gap-1 transition cursor-pointer"
                      title="Instant Export past quiz JSON (Testing)"
                    >
                      <Download className="w-3 h-3" />
                      <span>Test Export</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =============================================================
  // RENDER: BATCH REVIEW & AI DIAGNOSIS (Step 4)
  // =============================================================
  if (session.status === 'batch_reviewed') {
    const lastBatch = session.batches[session.currentBatchIndex];
    const score = lastBatch.batchScore || { totalEarned: 0, totalPossible: 100, percentage: 0 };
    const analysis = lastBatch.aiAnalysis || {
      summary: 'Batch completed.',
      strengths: [],
      weaknesses: [],
      recommendedFocus: 'Review fundamentals.',
    };

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Score Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs text-center space-y-4">
          <div className="inline-flex p-3.5 rounded-full bg-indigo-50 text-indigo-600">
            <Sparkles className="w-8 h-8" />
          </div>

          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Batch {lastBatch.batchNumber} Evaluation Completed
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {score.percentage >= 75
                ? 'Excellent Conceptual Command!'
                : score.percentage >= 50
                ? 'Good Progress — Refinement Needed'
                : 'Foundational Knowledge Gap Detected'}
            </h2>
            <p className="text-slate-500 text-sm mt-1 max-w-xl mx-auto">
              Topic: <span className="font-bold text-slate-800">{session.topic}</span> ({session.subjectTitle})
            </p>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto pt-2">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-medium">Batch Score</div>
              <div className="text-xl font-extrabold text-indigo-700">{score.percentage}%</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-medium">Points Earned</div>
              <div className="text-xl font-extrabold text-emerald-600">
                {score.totalEarned}/{score.totalPossible}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-medium">Overall Mastery</div>
              <div className="text-xl font-extrabold text-purple-700">{session.overallMastery}%</div>
            </div>
          </div>
        </div>

        {/* AI Diagnostic Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            AI Cognitive Breakdown & Adaptation Strategy
          </h3>

          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-950 text-sm leading-relaxed">
            {analysis.summary}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {analysis.strengths?.length > 0 && (
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Identified Strengths
                </div>
                <ul className="text-xs text-emerald-900/90 space-y-1 list-disc list-inside">
                  {analysis.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.weaknesses?.length > 0 && (
              <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 space-y-2">
                <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" /> Areas Needing Focus
                </div>
                <ul className="text-xs text-rose-900/90 space-y-1 list-disc list-inside">
                  {analysis.weaknesses.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {analysis.recommendedFocus && (
            <div className="text-xs text-slate-600 pt-2 flex items-start gap-2">
              <span className="font-bold text-slate-800 shrink-0">Adaptive Next Step:</span>
              <span>{analysis.recommendedFocus}</span>
            </div>
          )}
        </div>

        {/* Detailed Question Review List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-700" />
            Batch Questions & Solution Review
          </h3>

          <div className="space-y-4">
            {lastBatch.questions.map((q, idx) => {
              const sub = lastBatch.submissions[q.id];
              return (
                <div
                  key={q.id}
                  className={`p-4.5 rounded-xl border-1.5 transition space-y-3 ${
                    sub?.isCorrect
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-rose-200 bg-rose-50/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                        [{q.type.replace('_', ' ')}]
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      {sub?.isCorrect ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Correct (+{sub.scoreEarned} pts)
                        </span>
                      ) : (
                        <span className="text-rose-700 flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> Incorrect ({sub?.scoreEarned || 0}/{q.points || 10} pts)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-sm font-semibold text-slate-900">{q.question}</div>

                  <QuestionDispatcher
                    question={q}
                    userResponse={sub?.userResponse}
                    onChange={() => {}}
                    submission={sub}
                    isSubmitted={true}
                  />

                  {q.explanation && (
                    <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                      <span className="font-bold text-slate-900">Explanation:</span> {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {onNavigateToResources && (
              <button
                type="button"
                onClick={() => onNavigateToResources(session.topic)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 hover:border-indigo-400 bg-white text-xs font-bold text-indigo-700 flex items-center justify-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                Search Live Resources
              </button>
            )}

            {/* Instant Export for Testing */}
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-xl p-1">
              <button
                type="button"
                onClick={() => handleInstantExportQuiz(session, false)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                title="Download full quiz JSON with prompt, options, answer keys, and assertions for testing"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Instant Export Quiz (Test)</span>
              </button>
              <button
                type="button"
                onClick={() => handleInstantExportQuiz(session, true)}
                className="px-2 py-1.5 rounded-lg text-amber-900 hover:bg-amber-100 text-xs font-medium transition cursor-pointer"
                title="Copy quiz JSON to clipboard"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleFinishAssessment}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm"
            >
              Finish & Save Mastery
            </button>

            <button
              type="button"
              disabled={isLoadingBatch}
              onClick={handleGenerateNextAdaptedBatch}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              {isLoadingBatch ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Adapting Batch {lastBatch.batchNumber + 1}...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Adapted Batch {lastBatch.batchNumber + 1}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // RENDER: ACTIVE BATCH ANSWERING ARENA (Step 2 & 3)
  // =============================================================
  if (!currentBatch || !currentQuestion) {
    return <div className="p-10 text-center">Loading batch questions...</div>;
  }

  const answeredCount = Object.keys(userResponses).length;
  const totalInBatch = currentBatch.questions.length;
  const progressPercent = Math.round(((currentQuestionIndex + 1) / totalInBatch) * 100);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Instant Export Toast Notification */}
      {exportedNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs font-bold text-emerald-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportedNotice}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-mono bg-emerald-100/70 px-2 py-0.5 rounded">
            Testing Export
          </span>
        </div>
      )}

      {/* Top Batch Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
            <span>Batch {currentBatch.batchNumber}</span>
            <span>·</span>
            <span>{session.subjectTitle}</span>
            {isFallbackBatch && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                Offline Engine
              </span>
            )}
            {lastProviderUsed && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                {lastProviderUsed}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">{session.topic}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Instant Export For Testing */}
          <div className="flex items-center gap-1.5 bg-amber-50/80 border border-amber-200 rounded-xl p-1">
            <button
              type="button"
              onClick={() => handleInstantExportQuiz(session, false)}
              className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              title="Download full quiz JSON with prompt, options, answer keys, and assertions for testing"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instant Export Quiz</span>
            </button>
            <button
              type="button"
              onClick={() => handleInstantExportQuiz(session, true)}
              className="px-2 py-1.5 rounded-lg text-amber-900 hover:bg-amber-100 text-xs font-medium transition cursor-pointer"
              title="Copy quiz JSON payload to clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-xs font-bold text-slate-600">
              {answeredCount} of {totalInBatch} answered
            </span>
            <div className="w-24 h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Question Stepper Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {currentBatch.questions.map((q, idx) => {
          const isCurrent = idx === currentQuestionIndex;
          const isAnswered = userResponses[q.id] !== undefined && userResponses[q.id] !== '';

          return (
            <button
              type="button"
              key={q.id}
              onClick={() => setCurrentQuestionIndex(idx)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 shrink-0 ${
                isCurrent
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                  : isAnswered
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <span>Q{idx + 1}</span>
              <span className="text-[10px] uppercase opacity-80">({q.type.replace('_', ' ')})</span>
              {isAnswered && !isCurrent && <Check className="w-3 h-3 text-emerald-600" />}
            </button>
          );
        })}
      </div>

      {/* Active Question Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold">
                Question {currentQuestionIndex + 1} of {totalInBatch}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold uppercase">
                {currentQuestion.type.replace('_', ' ')}
              </span>
              <span className="text-xs font-semibold text-slate-400 capitalize">
                · {currentQuestion.dimension} dimension
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug pt-1">
              {extractString(currentQuestion.question)}
            </h3>
          </div>

          <div className="text-right shrink-0">
            <span className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold">
              +{currentQuestion.points || 10} pts
            </span>
          </div>
        </div>

        {/* Interactive Widget for question type */}
        <div className="pt-2">
          <QuestionDispatcher
            question={currentQuestion}
            userResponse={userResponses[currentQuestion.id]}
            onChange={(val) => {
              setUserResponses((prev) => ({ ...prev, [currentQuestion.id]: val }));
            }}
            isSubmitted={false}
          />
        </div>

        {/* Question Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ← Previous
          </button>

          <div className="flex items-center gap-2">
            {currentQuestionIndex < totalInBatch - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalInBatch - 1, prev + 1))}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                Next Question <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitCurrentBatch}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md disabled:bg-slate-400"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Grading Batch...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Submit Batch {currentBatch.batchNumber}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
