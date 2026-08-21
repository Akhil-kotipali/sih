import React, { Component, ReactNode, ErrorInfo } from 'react';
import {
  MCQQuestion,
  TrueFalseQuestion,
  FillBlankQuestion,
  CodeInputQuestion,
  DebuggingQuestion,
  ArrangeStepsQuestion,
  ExplanationQuestion,
  AssessmentQuestion,
  QuestionSubmission,
} from '../../types';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Code2,
  Bug,
  MoveUp,
  MoveDown,
  Sparkles,
  Info,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';

interface WidgetProps<T extends AssessmentQuestion> {
  question: T;
  userResponse: any;
  onChange: (value: any) => void;
  submission?: QuestionSubmission;
  isSubmitted?: boolean;
}

/**
 * Defensive string extractor preventing React Child Object or undefined runtime errors
 */
export function safeText(val: any, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    if (typeof val.text === 'string') return val.text;
    if (typeof val.question === 'string') return val.question;
    if (typeof val.title === 'string') return val.title;
    if (typeof val.content === 'string') return val.content;
    if (typeof val.value === 'string') return val.value;
    if (typeof val.label === 'string') return val.label;
    if (typeof val.description === 'string') return val.description;
    if (typeof val.step === 'string') return val.step;
    if (typeof val.prompt === 'string') return val.prompt;
    try {
      return JSON.stringify(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

// -------------------------------------------------------------
// 1. MCQ WIDGET (Max 10 per batch)
// Gracefully handles: malformed options, out-of-bounds answer index
// -------------------------------------------------------------
export const MCQWidget: React.FC<WidgetProps<MCQQuestion>> = ({
  question,
  userResponse,
  onChange,
  submission,
  isSubmitted,
}) => {
  // Normalize options array defensively
  let rawOptions: any[] = [];
  if (Array.isArray(question?.options)) {
    rawOptions = question.options;
  } else if (typeof question?.options === 'object' && question?.options !== null) {
    rawOptions = Object.values(question.options);
  }

  // Ensure non-empty string labels
  const optionsList = rawOptions.map((opt, i) => safeText(opt, `Option ${String.fromCharCode(65 + i)}`));

  // Fallback if options list is completely empty
  if (optionsList.length === 0) {
    optionsList.push('Option A', 'Option B', 'Option C', 'Option D');
  }

  // Normalize correct answer index safely
  const rawCorrect = Number(question?.correctAnswer);
  const safeCorrectAnswer =
    !isNaN(rawCorrect) && Number.isInteger(rawCorrect) && rawCorrect >= 0 && rawCorrect < optionsList.length
      ? rawCorrect
      : 0;

  const selectedIndex = typeof userResponse === 'number' && userResponse >= 0 && userResponse < optionsList.length
    ? userResponse
    : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5">
        {optionsList.map((optLabel, idx) => {
          const isSelected = selectedIndex === idx;
          const isCorrectAnswer = isSubmitted && safeCorrectAnswer === idx;
          const isWrongSelection = isSubmitted && isSelected && safeCorrectAnswer !== idx;

          let cardStyle = 'border-slate-200 hover:border-indigo-300 bg-white';
          if (isSelected && !isSubmitted) {
            cardStyle = 'border-indigo-600 bg-indigo-50/70 shadow-xs';
          } else if (isCorrectAnswer) {
            cardStyle = 'border-emerald-600 bg-emerald-50 text-emerald-950';
          } else if (isWrongSelection) {
            cardStyle = 'border-rose-500 bg-rose-50 text-rose-950';
          }

          return (
            <button
              type="button"
              key={idx}
              disabled={isSubmitted}
              onClick={() => onChange(idx)}
              className={`w-full text-left p-3.5 rounded-xl border-1.5 transition flex items-start gap-3 cursor-pointer disabled:cursor-default ${cardStyle}`}
            >
              <div
                className={`w-6 h-6 rounded-full border-1.5 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition ${
                  isSelected && !isSubmitted
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : isCorrectAnswer
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : isWrongSelection
                    ? 'border-rose-500 bg-rose-500 text-white'
                    : 'border-slate-300 text-slate-600 bg-slate-50'
                }`}
              >
                {String.fromCharCode(65 + idx)}
              </div>
              <span className="text-sm font-medium leading-relaxed flex-1">{optLabel}</span>
              {isSubmitted && isCorrectAnswer && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              )}
              {isSubmitted && isWrongSelection && (
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 2. TRUE / FALSE WIDGET (Max 10 per batch)
// Gracefully handles: malformed boolean answer values
// -------------------------------------------------------------
export const TrueFalseWidget: React.FC<WidgetProps<TrueFalseQuestion>> = ({
  question,
  userResponse,
  onChange,
  submission,
  isSubmitted,
}) => {
  const selected = typeof userResponse === 'boolean' ? userResponse : null;
  const safeCorrect = typeof question?.correctAnswer === 'boolean'
    ? question.correctAnswer
    : String(question?.correctAnswer).toLowerCase() === 'true';

  return (
    <div className="grid grid-cols-2 gap-3.5">
      {[true, false].map((val) => {
        const isSelected = selected === val;
        const isCorrect = isSubmitted && safeCorrect === val;
        const isWrong = isSubmitted && isSelected && safeCorrect !== val;

        let style = 'border-slate-200 hover:border-indigo-300 bg-white';
        if (isSelected && !isSubmitted) {
          style = 'border-indigo-600 bg-indigo-50/70 shadow-xs';
        } else if (isCorrect) {
          style = 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold';
        } else if (isWrong) {
          style = 'border-rose-500 bg-rose-50 text-rose-950 font-bold';
        }

        return (
          <button
            type="button"
            key={String(val)}
            disabled={isSubmitted}
            onClick={() => onChange(val)}
            className={`p-4 rounded-xl border-1.5 transition flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-default font-semibold text-base ${style}`}
          >
            {val ? (
              <CheckCircle2 className={`w-5 h-5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
            ) : (
              <XCircle className={`w-5 h-5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
            )}
            <span>{val ? 'True' : 'False'}</span>
          </button>
        );
      })}
    </div>
  );
};

// -------------------------------------------------------------
// 3. FILL IN THE BLANK WIDGET (Max 10 per batch)
// Gracefully handles: template without {{blank}}, missing correct answers
// -------------------------------------------------------------
export const FillBlankWidget: React.FC<WidgetProps<FillBlankQuestion>> = ({
  question,
  userResponse,
  onChange,
  submission,
  isSubmitted,
}) => {
  const [showHint, setShowHint] = React.useState(false);
  const textValue = String(userResponse || '');
  let templateStr = safeText(question?.template, 'Answer: {{blank}}');
  if (!templateStr.includes('{{blank}}')) {
    templateStr = `${templateStr} {{blank}}`;
  }

  // Split template by {{blank}}
  const parts = templateStr.split('{{blank}}');
  const correctAnswersList = Array.isArray(question?.correctAnswers)
    ? question.correctAnswers.map((a) => safeText(a)).filter(Boolean)
    : [safeText((question as any)?.correctAnswer, 'correct answer')];

  if (correctAnswersList.length === 0) {
    correctAnswersList.push('correct answer');
  }

  return (
    <div className="space-y-4">
      <div className="p-4.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed font-medium text-sm">
        {parts.map((part, idx) => (
          <React.Fragment key={idx}>
            <span>{safeText(part)}</span>
            {idx < parts.length - 1 && (
              <input
                type="text"
                disabled={isSubmitted}
                value={textValue}
                placeholder="type your answer here"
                onChange={(e) => onChange(e.target.value)}
                className={`mx-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border-2 outline-none transition inline-block min-w-[160px] max-w-[240px] text-center ${
                  isSubmitted
                    ? submission?.isCorrect
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-rose-500 bg-rose-50 text-rose-900'
                    : 'border-indigo-300 bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        {question?.hint ? (
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="flex items-center gap-1 text-indigo-600 hover:underline font-semibold cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            {showHint ? 'Hide Hint' : 'Show Hint'}
          </button>
        ) : <div />}
        <span>Press Tab to navigate</span>
      </div>

      {showHint && question?.hint && (
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{safeText(question.hint)}</span>
        </div>
      )}

      {isSubmitted && !submission?.isCorrect && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs">
          <span className="font-bold">Accepted Answer:</span> {correctAnswersList.join(' or ')}
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// 4. CODE INPUT WIDGET (No compiler — 2 to 3 max per batch)
// Gracefully handles: missing starterCode, missing language, missing expected output
// -------------------------------------------------------------
export const CodeInputWidget: React.FC<WidgetProps<CodeInputQuestion>> = ({
  question,
  userResponse,
  onChange,
  submission,
  isSubmitted,
}) => {
  const language = safeText(question?.language, 'code').toLowerCase();
  const defaultStarter = safeText(
    question?.starterCode,
    language === 'python'
      ? '# Implement your solution\ndef solution():\n    pass\n'
      : '// Implement your solution\nfunction solution() {\n    \n}\n'
  );

  const code = typeof userResponse === 'string' ? userResponse : defaultStarter;

  const handleReset = () => {
    onChange(defaultStarter);
  };

  const criteriaList = Array.isArray(question?.evaluationCriteria)
    ? question.evaluationCriteria.map((c) => safeText(c)).filter(Boolean)
    : [];

  const expectedOutput = safeText(question?.expectedOutputOrPattern);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
          <Code2 className="w-4 h-4 text-indigo-600" />
          <span>Language: <span className="uppercase text-indigo-600">{language}</span></span>
          <span className="text-slate-400">· Structural & Logic Evaluation</span>
        </div>
        {!isSubmitted && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Template
          </button>
        )}
      </div>

      <div className="relative rounded-xl overflow-hidden border-2 border-slate-800 bg-slate-950 shadow-inner">
        <div className="bg-slate-900 px-4 py-2 flex items-center justify-between text-xs text-slate-400 border-b border-slate-800">
          <span className="font-mono">
            solution.{language === 'python' ? 'py' : language === 'java' ? 'java' : language === 'cpp' ? 'cpp' : language === 'rust' ? 'rs' : 'js'}
          </span>
          <span>Tab = 4 spaces</span>
        </div>

        <textarea
          rows={8}
          disabled={isSubmitted}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          placeholder="// Write your implementation logic here..."
          className="w-full p-4 font-mono text-sm leading-relaxed text-emerald-300 bg-slate-950 outline-none resize-y selection:bg-indigo-900 selection:text-white"
          spellCheck={false}
        />
      </div>

      {expectedOutput && (
        <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
          <span className="font-bold text-slate-900">Expected Behavior / Output:</span>
          <code className="font-mono bg-white px-2 py-0.5 rounded border border-slate-300 text-indigo-800">
            {expectedOutput}
          </code>
        </div>
      )}

      {criteriaList.length > 0 && (
        <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs space-y-1.5">
          <div className="font-bold text-indigo-900 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Evaluation Criteria (Checked by AI):
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-indigo-800/90 pl-1">
            {criteriaList.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// 5. DEBUGGING WIDGET (Max 3 per batch)
// Gracefully handles: missing buggyCode, missing language, missing fixedCode
// -------------------------------------------------------------
export const DebuggingWidget: React.FC<WidgetProps<DebuggingQuestion>> = ({
  question,
  userResponse,
  onChange,
  submission,
  isSubmitted,
}) => {
  const fixText = String(userResponse || '');
  const language = safeText(question?.language, 'code');
  const buggyCode = safeText(question?.buggyCode, '// Buggy code snippet\n');
  const bugType = safeText(question?.bugType, 'Logical');
  const bugPrompt = safeText(question?.bugDescriptionPrompt, 'Explain the bug and provide the corrected code:');
  const fixedCode = safeText(question?.fixedCodeSnippet);
  const bugExplanation = safeText(question?.explanationOfBug || question?.explanation);

  return (
    <div className="space-y-4">
      {/* Buggy Code Box */}
      <div className="rounded-xl overflow-hidden border border-rose-300 bg-slate-950">
        <div className="bg-rose-950/80 px-3.5 py-1.5 text-xs font-semibold text-rose-300 flex items-center justify-between border-b border-rose-900">
          <span className="flex items-center gap-1.5">
            <Bug className="w-3.5 h-3.5 text-rose-400" />
            Contains Faulty Bug ({bugType})
          </span>
          <span className="text-[11px] uppercase">{language}</span>
        </div>
        <pre className="p-4 font-mono text-xs leading-relaxed text-rose-200 overflow-x-auto">
          {buggyCode}
        </pre>
      </div>

      {/* Student Diagnosis Input */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-700">
          {bugPrompt}
        </label>
        <textarea
          rows={4}
          disabled={isSubmitted}
          value={fixText}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Describe why it fails and provide your corrected code..."
          className="w-full p-3 rounded-xl border border-slate-300 font-sans text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 bg-white"
        />
      </div>

      {isSubmitted && fixedCode && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1.5 text-emerald-950">
          <div className="font-bold flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Fixed Reference Solution:
          </div>
          <pre className="font-mono bg-emerald-950 text-emerald-200 p-2.5 rounded-lg overflow-x-auto text-[12px]">
            {fixedCode}
          </pre>
          {bugExplanation && <p className="text-emerald-800 text-[11px]">{bugExplanation}</p>}
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// 6. ARRANGE THE STEPS WIDGET (Max 5 per batch)
// Gracefully handles: malformed shuffledSteps, mismatched order IDs
// -------------------------------------------------------------
export const ArrangeStepsWidget: React.FC<WidgetProps<ArrangeStepsQuestion>> = ({
  question,
  userResponse,
  onChange,
  submission,
  isSubmitted,
}) => {
  // Normalize shuffledSteps list defensively
  const rawSteps = Array.isArray(question?.shuffledSteps) ? question.shuffledSteps : [];
  const normalizedSteps: Array<{ id: string; text: string }> = rawSteps.length > 0
    ? rawSteps.map((s: any, idx: number) => ({
        id: safeText(s?.id, `s${idx + 1}`),
        text: safeText(s?.text || s?.step || s, `Step ${idx + 1}`),
      }))
    : [
        { id: 's1', text: 'Initialize data structures' },
        { id: 's2', text: 'Execute core algorithm iteration' },
        { id: 's3', text: 'Return or finalize result' },
      ];

  const stepMap = React.useMemo(() => {
    const map = new Map<string, string>();
    normalizedSteps.forEach((s) => {
      map.set(s.id, s.text);
    });
    return map;
  }, [normalizedSteps]);

  const defaultOrder = normalizedSteps.map((s) => s.id);
  const initialOrder = Array.isArray(userResponse) && userResponse.length === defaultOrder.length
    ? userResponse
    : defaultOrder;

  const [currentOrder, setCurrentOrder] = React.useState<string[]>(initialOrder);

  React.useEffect(() => {
    if (Array.isArray(userResponse) && userResponse.length === defaultOrder.length) {
      setCurrentOrder(userResponse);
    }
  }, [userResponse, defaultOrder.length]);

  const move = (idx: number, direction: 'up' | 'down') => {
    if (isSubmitted) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return;

    const copy = [...currentOrder];
    const temp = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = temp;

    setCurrentOrder(copy);
    onChange(copy);
  };

  const correctOrderIds = Array.isArray(question?.correctOrderIds)
    ? question.correctOrderIds.map((id) => safeText(id))
    : defaultOrder;

  return (
    <div className="space-y-3">
      {question?.contextTitle && (
        <div className="text-xs font-semibold text-slate-500">
          Context: <span className="text-slate-800">{safeText(question.contextTitle)}</span>
        </div>
      )}

      <div className="space-y-2">
        {currentOrder.map((stepId, idx) => {
          const text = stepMap.get(stepId) || safeText(stepId, `Step ${idx + 1}`);
          const isCorrectPosition = isSubmitted && correctOrderIds[idx] === stepId;

          let itemStyle = 'border-slate-200 bg-white hover:border-slate-300';
          if (isSubmitted) {
            itemStyle = isCorrectPosition
              ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
              : 'border-rose-300 bg-rose-50 text-rose-950';
          }

          return (
            <div
              key={stepId || idx}
              className={`p-3 rounded-xl border-1.5 flex items-center justify-between gap-3 transition shadow-2xs ${itemStyle}`}
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="text-sm font-medium leading-snug">{safeText(text)}</span>
              </div>

              {!isSubmitted && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => move(idx, 'up')}
                    className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
                  >
                    <MoveUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === currentOrder.length - 1}
                    onClick={() => move(idx, 'down')}
                    className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
                  >
                    <MoveDown className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 7. EXPLANATION WIDGET (Max 3 per batch)
// Gracefully handles: missing rubric keywords, missing ideal answer
// -------------------------------------------------------------
export const ExplanationWidget: React.FC<WidgetProps<ExplanationQuestion>> = ({
  question,
  userResponse,
  onChange,
  submission,
  isSubmitted,
}) => {
  const text = String(userResponse || '');
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const minWords = typeof question?.minWordCount === 'number' && question.minWordCount > 0 ? question.minWordCount : 15;
  const keywordsList = Array.isArray(question?.rubricKeywords)
    ? question.rubricKeywords.map((k) => safeText(k)).filter(Boolean)
    : [];

  const idealAnswer = safeText(question?.idealAnswerSummary);

  return (
    <div className="space-y-3">
      <textarea
        rows={4}
        disabled={isSubmitted}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your explanation concisely in 2-3 sentences..."
        className="w-full p-3.5 rounded-xl border border-slate-300 font-sans text-sm leading-relaxed outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 bg-white"
      />

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className={wordCount >= minWords ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
          {wordCount} words {wordCount < minWords && `(target: ~${minWords}+ words)`}
        </span>
        <span>Rubric: clarity, key terms, edge cases</span>
      </div>

      {keywordsList.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs font-semibold text-slate-500">Key concepts to touch on:</span>
          {keywordsList.map((kw, i) => {
            const mentioned = text.toLowerCase().includes(kw.toLowerCase());
            return (
              <span
                key={i}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition ${
                  mentioned
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {safeText(kw)}
              </span>
            );
          })}
        </div>
      )}

      {isSubmitted && idealAnswer && (
        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-950 space-y-1">
          <div className="font-bold text-indigo-900">Ideal Summary:</div>
          <p className="leading-relaxed">{idealAnswer}</p>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// QUESTION ERROR BOUNDARY (Protects UI against runtime rendering issues)
// -------------------------------------------------------------
interface ErrorBoundaryProps {
  fallbackTitle?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class QuestionErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Question widget rendering error caught by boundary:', error, errorInfo);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            {this.props.fallbackTitle || 'Question Display Notice'}
          </div>
          <p className="text-amber-700">
            This question could not be displayed properly and was protected by the assessment UI guard.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// -------------------------------------------------------------
// UNIVERSAL QUESTION DISPATCHER (Defensive Router)
// Gracefully handles: missing question, unknown question types
// -------------------------------------------------------------
export const QuestionDispatcher: React.FC<{
  question?: AssessmentQuestion | null;
  userResponse: any;
  onChange: (val: any) => void;
  submission?: QuestionSubmission;
  isSubmitted?: boolean;
}> = (props) => {
  const { question } = props;

  if (!question) {
    return (
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs text-center">
        No active question data available.
      </div>
    );
  }

  return (
    <QuestionErrorBoundary fallbackTitle={`Question Render Guard (${question.type || 'unknown'})`}>
      {(() => {
        switch (question.type) {
          case 'mcq':
            return <MCQWidget {...(props as any)} question={question as MCQQuestion} />;
          case 'true_false':
            return <TrueFalseWidget {...(props as any)} question={question as TrueFalseQuestion} />;
          case 'fill_blank':
            return <FillBlankWidget {...(props as any)} question={question as FillBlankQuestion} />;
          case 'code_input':
            return <CodeInputWidget {...(props as any)} question={question as CodeInputQuestion} />;
          case 'debugging':
            return <DebuggingWidget {...(props as any)} question={question as DebuggingQuestion} />;
          case 'arrange_steps':
            return <ArrangeStepsWidget {...(props as any)} question={question as ArrangeStepsQuestion} />;
          case 'explanation':
            return <ExplanationWidget {...(props as any)} question={question as ExplanationQuestion} />;
          default:
            return (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Unknown Question Type: &quot;{safeText((question as any)?.type, 'unknown')}&quot;
                </div>
                <p className="text-amber-700">
                  This question format is unsupported. You may skip to the next question.
                </p>
              </div>
            );
        }
      })()}
    </QuestionErrorBoundary>
  );
};
