/**
 * Universal Assessment Validation Layer for LearnPath
 * Validates generated assessment questions against requested subject/topic/language dynamically.
 * Independent of the UI, language-agnostic, and production-safe.
 */

import {
  AssessmentQuestion,
  AssessmentValidationReport,
  CognitiveDimension,
  MCQQuestion,
  TrueFalseQuestion,
  FillBlankQuestion,
  CodeInputQuestion,
  DebuggingQuestion,
  ArrangeStepsQuestion,
  ExplanationQuestion,
  QuestionType,
  QuestionValidationError,
  QuestionValidationResult,
  ValidationContext,
} from '../types';

export const SUPPORTED_QUESTION_TYPES: QuestionType[] = [
  'mcq',
  'true_false',
  'fill_blank',
  'code_input',
  'debugging',
  'arrange_steps',
  'explanation',
];

export const CANONICAL_COGNITIVE_DIMENSIONS: CognitiveDimension[] = [
  'concept',
  'application',
  'implementation',
  'debugging',
  'algorithmic_thinking',
];

export const VALID_BUG_TYPES = [
  'syntax',
  'logical',
  'edge_case',
  'concurrency',
  'off_by_one',
] as const;

/**
 * Universal safe string extraction helper preventing React Child object crashes
 */
export function extractString(val: any, fallback = ''): string {
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
    if (typeof val.prompt === 'string') return val.prompt;
    if (typeof val.step === 'string') return val.step;
    try {
      return JSON.stringify(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/**
 * Dynamically detects programming language from topic or subjectTitle.
 * Universal and not hardcoded to any single language.
 */
export function detectProgrammingLanguage(topic = '', subjectTitle = ''): string | undefined {
  const combined = `${topic} ${subjectTitle}`.toLowerCase();

  const languagePatterns: Array<{ lang: string; regex: RegExp }> = [
    { lang: 'java', regex: /\b(java|jvm|spring\s*boot|javafx|maven|gradle)\b/i },
    { lang: 'python', regex: /\b(python|py|django|fastapi|flask|numpy|pandas|pytorch)\b/i },
    { lang: 'javascript', regex: /\b(javascript|js|node(?:\.js)?|react|vue|angular|express(?:\.js)?)\b/i },
    { lang: 'typescript', regex: /\b(typescript|ts|next(?:\.js)?|nest(?:\.js)?)\b/i },
    { lang: 'cpp', regex: /\b(c\+\+|cpp|stl|clang)\b/i },
    { lang: 'c', regex: /\b(c\s+programming|ansi\s+c|embedded\s+c)\b/i },
    { lang: 'csharp', regex: /\b(c#|csharp|\.net|asp\.net)\b/i },
    { lang: 'sql', regex: /\b(sql|postgresql|postgres|mysql|sqlite|oracle\s*sql|rdbms)\b/i },
    { lang: 'go', regex: /\b(golang|go\s+language|goroutine)\b/i },
    { lang: 'rust', regex: /\b(rust|cargo|tokio|rustlang)\b/i },
    { lang: 'kotlin', regex: /\b(kotlin|android\s+kotlin)\b/i },
    { lang: 'swift', regex: /\b(swift|ios\s+swift|swiftui)\b/i },
    { lang: 'php', regex: /\b(php|laravel|symfony)\b/i },
    { lang: 'ruby', regex: /\b(ruby|rails|ruby\s+on\s+rails)\b/i },
    { lang: 'scala', regex: /\b(scala|akka)\b/i },
  ];

  for (const { lang, regex } of languagePatterns) {
    if (regex.test(combined)) {
      return lang;
    }
  }

  return undefined;
}

/**
 * Universal check for cross-language contradiction heuristics in code snippets
 */
export function checkCodeLanguageContradiction(
  code: string,
  declaredLanguage: string
): string | null {
  const normLang = declaredLanguage.toLowerCase().trim();
  const lowerCode = code.toLowerCase();

  if (normLang === 'python') {
    if (
      code.includes('public static void main') ||
      code.includes('System.out.println') ||
      code.includes('public class ') ||
      code.includes('class Solution { public ') ||
      code.includes('#include <') ||
      code.includes('std::') ||
      code.includes('Console.WriteLine') ||
      code.includes('fn main()')
    ) {
      return 'Code snippet contains Java/C++/C# syntax but question language is declared as "python"';
    }
  } else if (normLang === 'java') {
    if (
      /def\s+\w+\s*\(/.test(code) ||
      /elif\s+/.test(code) ||
      code.includes('import sys') ||
      code.includes('print(') && !code.includes('System.out.print') ||
      code.includes('#include <') ||
      code.includes('std::vector') ||
      code.includes('fn main()')
    ) {
      return 'Code snippet contains Python/C++ syntax but question language is declared as "java"';
    }
  } else if (normLang === 'javascript' || normLang === 'typescript') {
    if (
      code.includes('public static void main') ||
      code.includes('System.out.println') ||
      code.includes('#include <') ||
      /def\s+\w+\s*\(/.test(code)
    ) {
      return `Code snippet contains foreign language syntax not matching "${declaredLanguage}"`;
    }
  } else if (normLang === 'cpp' || normLang === 'c') {
    if (
      /def\s+\w+\s*\(/.test(code) ||
      code.includes('System.out.println') ||
      code.includes('Console.WriteLine')
    ) {
      return `Code snippet contains foreign syntax not matching "${declaredLanguage}"`;
    }
  }

  return null;
}

/**
 * -------------------------------------------------------------------------
 * DOMAIN / SEMANTIC VALIDATION HELPERS
 * These go beyond JSON-shape checking and verify that the actual algorithm /
 * data-structure claims made by a question are technically correct.
 * Every function below is intentionally conservative (keyword/pattern based)
 * so it only fires when a question is actually making the claim in question,
 * to avoid false positives on unrelated content.
 * -------------------------------------------------------------------------
 */

/**
 * Detects an incomplete Binary Search Tree invariant statement.
 * A correct BST invariant must hold recursively for EVERY node (not just the
 * root) and must state both the left-subtree (< node) and right-subtree
 * (> node) conditions. Returns an error message, or null if not applicable /
 * the statement is complete.
 */
export function checkBSTInvariantCompleteness(text: string): string | null {
  const t = (text || '').toLowerCase();

  const mentionsBSTShape = /(left subtree|left child)/.test(t) && /(root|node)/.test(t);
  if (!mentionsBSTShape) return null;

  const referencesRootOnly = /(less than|smaller than)\s+(the\s+)?root\b/.test(t) || /(greater than|larger than)\s+(the\s+)?root\b/.test(t);
  const referencesEveryNode = /(every|each|any|all)\s+node/.test(t) || /recursively/.test(t) || /rooted at/.test(t) || /subtree'?s?\s+root/.test(t);
  if (referencesRootOnly && !referencesEveryNode) {
    return 'BST invariant is stated relative to only "the root" instead of holding recursively for every node/subtree — the property must apply to every node, not just the top-level root.';
  }

  const mentionsLeftCondition = /left\s+(subtree|child)[^.;]*(less|smaller)/.test(t) || /(less|smaller)[^.;]*left\s+(subtree|child)/.test(t);
  const mentionsRightCondition = /right\s+(subtree|child)[^.;]*(greater|larger|more)/.test(t) || /(greater|larger)[^.;]*right\s+(subtree|child)/.test(t);
  if (mentionsLeftCondition && !mentionsRightCondition) {
    return 'BST invariant statement defines the left-subtree condition but omits the required right-subtree condition (values greater than the node).';
  }

  return null;
}

/**
 * Detects ambiguous or incorrect BST complexity claims: conflating average
 * and worst case, or claiming an ordinary BST "must remain balanced".
 */
export function checkComplexityClaimConsistency(text: string): string | null {
  const t = (text || '').toLowerCase();
  const mentionsTreeStructure = /\btree\b|\bbst\b|binary search tree/.test(t);
  if (!mentionsTreeStructure) return null;

  const mentionsSelfBalancing = /self[- ]balancing|\bavl\b|red[- ]black/.test(t);

  const claimsMustStayBalanced = /(binary search tree|\bbst\b)[^.;]*must\s+(remain|stay|always\s+be)\s+balanced/.test(t)
    || /must\s+(remain|stay)\s+balanced[^.;]*(binary search tree|\bbst\b)/.test(t);
  if (claimsMustStayBalanced && !mentionsSelfBalancing) {
    return 'Claims an ordinary BST "must remain balanced" for O(log n) performance. Ordinary BSTs are not automatically balanced — only self-balancing BSTs (e.g. AVL, Red-Black) guarantee this via rotations.';
  }

  const claimsWorstCaseLogN = /worst[- ]case[^.;]*o\(log\s*n\)/.test(t) || /o\(log\s*n\)[^.;]*worst[- ]case/.test(t);
  if (claimsWorstCaseLogN && !mentionsSelfBalancing) {
    return 'Claims worst-case O(log n) for a BST without specifying a self-balancing structure. An ordinary BST has worst-case O(n) (e.g. when it degenerates into a linked list).';
  }

  const claimsLogN = /o\(log\s*n\)/.test(t);
  const qualifiesAverage = /average[- ]case|average\s+time|on\s+average/.test(t);
  const qualifiesBalanced = /balanced/.test(t);
  const qualifiesWorstCase = /worst[- ]case/.test(t);
  if (claimsLogN && !qualifiesAverage && !qualifiesBalanced && !mentionsSelfBalancing && !qualifiesWorstCase) {
    return 'States O(log n) complexity for a BST without qualifying whether this is average-case (typical, unbalanced) or requires a balanced/self-balancing structure.';
  }

  return null;
}

/**
 * Any question that mentions "duplicate" values in the context of a BST (or
 * similar ordered structure) must explicitly state the duplicate-handling
 * policy: prohibited, go-left, go-right, or counted.
 */
export function checkDuplicatePolicyStated(text: string): string | null {
  const t = (text || '').toLowerCase();
  if (!/duplicate/.test(t)) return null;

  const statesPolicy =
    /(not\s+allow|disallow|prohibit|reject|no\s+duplicates?|not\s+permitted)/.test(t) ||
    /go(es)?\s+(to\s+)?(the\s+)?left/.test(t) ||
    /go(es)?\s+(to\s+)?(the\s+)?right/.test(t) ||
    /insert(ed)?\s+(to\s+)?(the\s+)?(left|right)/.test(t) ||
    /(count(ed)?|frequency|occurrence)/.test(t);

  if (!statesPolicy) {
    return 'Question involves duplicate values but never states the duplicate-handling policy (must explicitly say whether duplicates are prohibited, go left, go right, or are counted).';
  }
  return null;
}

/**
 * Checks that the declared node representation (dictionary vs class/object)
 * is used consistently across prompt, code, and evaluation criteria.
 * Generic — applies to any tree/linked-structure programming question, not
 * just BSTs.
 */
export function checkNodeRepresentationConsistency(combinedText: string): string | null {
  const t = combinedText || '';
  const lower = t.toLowerCase();

  const declaresDict = /\b(dictionary|dict)\b[^.;]*\b(node|structure)\b|\bnode\b[^.;]*\b(dictionary|dict)-based\b|\bdict-based\s+node\b/.test(lower);
  const declaresObject = /\b(class|object)\b[^.;]*\b(node|structure)\b|\bnode\s+(class|object)\b|\bnode\s+struct\b|\bstruct\s+node\b/.test(lower);

  const usesDotAccess = /\b(root|node|current|curr|temp)\.(value|val|left|right|key|data)\b/.test(t);
  const usesBracketAccess = /\b(root|node|current|curr|temp)\[["']?(value|val|left|right|key|data)["']?\]/i.test(t);

  if (declaresDict && !declaresObject && usesDotAccess) {
    return 'Declares a dictionary-based node structure but code/evaluation criteria use dot-attribute access (e.g. root.value). Dictionaries require bracket access (e.g. root["value"]).';
  }
  if (declaresObject && !declaresDict && usesBracketAccess) {
    return 'Declares an object/class-based node structure but code/evaluation criteria use dictionary-style bracket access (e.g. root["value"]). Objects/classes use dot access (e.g. root.value).';
  }
  return null;
}

/**
 * Validates that a BST-deletion "arrange the steps" question uses a
 * standard, representation-independent deletion process and does not invent
 * structures (like parent pointers) that were never defined.
 */
export function checkBSTDeletionStepsValidity(stepsTexts: string[], questionContext: string): string | null {
  const contextLower = (questionContext || '').toLowerCase();
  const stepsLower = stepsTexts.map((s) => (s || '').toLowerCase());
  const combined = `${contextLower} ${stepsLower.join(' ')}`;

  const isBSTDeletion = /(binary search tree|\bbst\b)/.test(combined) && /delet/.test(combined);
  if (!isBSTDeletion) return null;

  const definesParentPointer = /parent\s+pointer|parent\s+link|parent\s+reference/.test(contextLower);
  const stepsUseParentPointer = stepsLower.some((s) => /parent\s+pointer|parent\s+link/.test(s));
  if (stepsUseParentPointer && !definesParentPointer) {
    return 'Deletion steps rely on a "parent pointer" that was never defined for this node representation — parent pointers cannot be assumed.';
  }

  const allSteps = stepsLower.join(' | ');
  const hasSuccessor = /successor|smallest[^|]*right subtree|minimum[^|]*right subtree/.test(allSteps);
  const hasCopyOrReplace = /\b(copy|replace)\b/.test(allSteps);
  const hasDeleteSuccessor = /\b(delete|remove)\b/.test(allSteps);
  const hasReconnect = /reconnect|update[^|]*(child|pointer|link)|attach|re-?link/.test(allSteps);

  const missing: string[] = [];
  if (!hasSuccessor) missing.push('locating the inorder successor');
  if (!hasCopyOrReplace) missing.push('copying/replacing the node value');
  if (!hasDeleteSuccessor) missing.push('deleting the successor from the right subtree');
  if (!hasReconnect) missing.push('reconnecting the affected subtree');

  if (missing.length > 0) {
    return `BST deletion steps are missing required standard step(s): ${missing.join(', ')}.`;
  }
  return null;
}

/**
 * Checks if a question prompt is a generic or placeholder string
 */
function isPlaceholderPrompt(promptText: string): boolean {
  const trimmed = promptText.trim();
  if (trimmed.length < 5) return true;

  const placeholderRegexes = [
    /^assessment\s+question\s+\d+$/i,
    /^question\s+\d+$/i,
    /^placeholder\s*(question)?\s*\d*$/i,
    /^sample\s+question\s*\d*$/i,
    /^test\s+question\s*\d*$/i,
    /^dummy\s+(question|prompt)\s*\d*$/i,
    /^todo/i,
    /^tbd/i,
    /^lorem\s+ipsum/i,
  ];

  return placeholderRegexes.some((regex) => regex.test(trimmed));
}

/**
 * Validates a single assessment question rigorously
 */
export function validateAssessmentQuestion(
  raw: any,
  context?: ValidationContext
): QuestionValidationResult {
  const errors: QuestionValidationError[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      questionId: 'unknown',
      errors: [{ field: 'root', message: 'Question item is null or not a valid JSON object', receivedValue: raw }],
    };
  }

  // 1. Validate ID
  const rawId = extractString(raw.id || raw.questionId).trim();
  if (!rawId) {
    errors.push({ field: 'id', message: 'Missing or empty question id', receivedValue: raw.id });
  }

  // 2. Validate Type
  const rawType = extractString(raw.type).toLowerCase().trim() as QuestionType;
  if (!SUPPORTED_QUESTION_TYPES.includes(rawType)) {
    errors.push({
      field: 'type',
      message: `Invalid question type: "${raw.type}". Supported types: ${SUPPORTED_QUESTION_TYPES.join(', ')}`,
      receivedValue: raw.type,
    });
  }

  // 3. Validate Prompt / Question Text
  const promptText = extractString(raw.question || raw.prompt || raw.title).trim();
  if (!promptText) {
    errors.push({ field: 'question', message: 'Question prompt text is missing or empty' });
  } else if (isPlaceholderPrompt(promptText)) {
    errors.push({
      field: 'question',
      message: `Placeholder prompt detected: "${promptText}". Must provide a real, specific domain question.`,
      receivedValue: promptText,
    });
  }

  // 4. Validate Topic
  const topicText = extractString(raw.topic || context?.topic).trim();
  if (!topicText) {
    errors.push({ field: 'topic', message: 'Missing question topic metadata' });
  }

  // 5. Validate Difficulty
  const rawDifficulty = extractString(raw.difficulty).toLowerCase().trim();
  const validDifficulties = ['easy', 'medium', 'hard'];
  const difficulty = (validDifficulties.includes(rawDifficulty) ? rawDifficulty : 'medium') as 'easy' | 'medium' | 'hard';
  if (!validDifficulties.includes(rawDifficulty)) {
    errors.push({
      field: 'difficulty',
      message: `Invalid difficulty: "${raw.difficulty}". Must be "easy", "medium", or "hard"`,
      receivedValue: raw.difficulty,
    });
  }

  // 6. Validate Cognitive Dimension
  const rawDimension = extractString(raw.dimension).toLowerCase().trim();
  if (!CANONICAL_COGNITIVE_DIMENSIONS.includes(rawDimension as CognitiveDimension)) {
    errors.push({
      field: 'dimension',
      message: `Invalid dimension: "${raw.dimension}". Must use canonical values: ${CANONICAL_COGNITIVE_DIMENSIONS.join(', ')} (e.g. use "algorithmic_thinking" instead of "algorithmic")`,
      receivedValue: raw.dimension,
    });
  }
  const dimension: CognitiveDimension = CANONICAL_COGNITIVE_DIMENSIONS.includes(rawDimension as CognitiveDimension)
    ? (rawDimension as CognitiveDimension)
    : 'concept';

  // 7. Validate Points
  const rawPoints = Number(raw.points);
  const points = !isNaN(rawPoints) && rawPoints > 0 ? rawPoints : 10;
  if (isNaN(rawPoints) || rawPoints <= 0) {
    errors.push({
      field: 'points',
      message: `Points must be a positive number. Received: "${raw.points}"`,
      receivedValue: raw.points,
    });
  }

  // 8. Validate Explanation
  const explanation = extractString(raw.explanation).trim();
  if (!explanation || explanation.length < 5) {
    errors.push({
      field: 'explanation',
      message: 'Explanation is missing or too brief (must be >= 5 chars)',
      receivedValue: raw.explanation,
    });
  }

  // Target programming language check (Universal)
  const targetLanguage =
    context?.requestedLanguage?.toLowerCase().trim() ||
    detectProgrammingLanguage(context?.topic || '', context?.subjectTitle || '');

  // -------------------------------------------------------------
  // TYPE-SPECIFIC VALIDATIONS
  // -------------------------------------------------------------
  let sanitizedQuestion: AssessmentQuestion | undefined = undefined;

  if (rawType === 'mcq') {
    let optionsList: string[] = [];
    if (Array.isArray(raw.options)) {
      optionsList = raw.options.map((opt: any) => extractString(opt).trim());
    } else if (typeof raw.options === 'object' && raw.options !== null) {
      optionsList = Object.values(raw.options).map((opt: any) => extractString(opt).trim());
    }

    // MCQ must have exactly 4 options
    if (optionsList.length !== 4) {
      errors.push({
        field: 'options',
        message: `MCQ question must have exactly 4 options. Received ${optionsList.length}.`,
        receivedValue: optionsList,
      });
    } else {
      // Check for empty options
      const emptyIdx = optionsList.findIndex((opt) => !opt);
      if (emptyIdx !== -1) {
        errors.push({
          field: 'options',
          message: `Option at index ${emptyIdx} is empty`,
        });
      }

      // Check for duplicate options
      const uniqueOptions = new Set(optionsList.map((opt) => opt.toLowerCase().trim()));
      if (uniqueOptions.size !== optionsList.length) {
        errors.push({
          field: 'options',
          message: 'MCQ options contain duplicates. All 4 options must be distinct.',
          receivedValue: optionsList,
        });
      }
    }

    // Check correctAnswer index
    const correctIdx = Number(raw.correctAnswer ?? raw.correctAnswerIndex ?? raw.correctIndex);
    if (isNaN(correctIdx) || !Number.isInteger(correctIdx) || correctIdx < 0 || correctIdx > 3) {
      errors.push({
        field: 'correctAnswer',
        message: `MCQ correctAnswer index must be an integer between 0 and 3. Received: "${raw.correctAnswer}".`,
        receivedValue: raw.correctAnswer,
      });
    }

    // Domain validation: only the CORRECT option's claim needs to be a fully
    // correct statement (distractors are allowed to be wrong/incomplete).
    if (Number.isInteger(correctIdx) && correctIdx >= 0 && correctIdx < optionsList.length) {
      const correctOptionText = optionsList[correctIdx];
      const domainText = `${promptText} ${correctOptionText}`;
      const invariantErr = checkBSTInvariantCompleteness(domainText);
      if (invariantErr) errors.push({ field: 'options', message: invariantErr, receivedValue: correctOptionText });
      const complexityErr = checkComplexityClaimConsistency(domainText);
      if (complexityErr) errors.push({ field: 'options', message: complexityErr, receivedValue: correctOptionText });
      const dupErr = checkDuplicatePolicyStated(`${promptText} ${correctOptionText} ${explanation}`);
      if (dupErr) errors.push({ field: 'question', message: dupErr });
    }

    if (errors.length === 0) {
      sanitizedQuestion = {
        id: rawId,
        type: 'mcq',
        question: promptText,
        topic: topicText,
        difficulty,
        dimension,
        points,
        explanation,
        options: optionsList,
        correctAnswer: correctIdx,
      } as MCQQuestion;
    }
  } else if (rawType === 'true_false') {
    let tfAnswer: boolean | undefined = undefined;
    if (typeof raw.correctAnswer === 'boolean') {
      tfAnswer = raw.correctAnswer;
    } else if (typeof raw.correctAnswer === 'string') {
      const lower = raw.correctAnswer.toLowerCase().trim();
      if (lower === 'true' || lower === 't') tfAnswer = true;
      if (lower === 'false' || lower === 'f') tfAnswer = false;
    }

    if (tfAnswer === undefined) {
      errors.push({
        field: 'correctAnswer',
        message: `True/False correctAnswer must be a boolean (true or false). Received: "${raw.correctAnswer}".`,
        receivedValue: raw.correctAnswer,
      });
    }

    // Domain validation: the affirmed-correct content is the statement itself
    // when it's TRUE, or the explanation (which states the correct fact) when
    // the statement is deliberately FALSE.
    if (tfAnswer !== undefined) {
      const domainText = tfAnswer ? `${promptText} ${explanation}` : explanation;
      const invariantErr = checkBSTInvariantCompleteness(domainText);
      if (invariantErr) errors.push({ field: 'correctAnswer', message: invariantErr });
      const complexityErr = checkComplexityClaimConsistency(domainText);
      if (complexityErr) errors.push({ field: 'correctAnswer', message: complexityErr });
      const dupErr = checkDuplicatePolicyStated(`${promptText} ${explanation}`);
      if (dupErr) errors.push({ field: 'question', message: dupErr });
    }

    if (errors.length === 0 && tfAnswer !== undefined) {
      sanitizedQuestion = {
        id: rawId,
        type: 'true_false',
        question: promptText,
        topic: topicText,
        difficulty,
        dimension,
        points,
        explanation,
        correctAnswer: tfAnswer,
      } as TrueFalseQuestion;
    }
  } else if (rawType === 'fill_blank') {
    const template = extractString(raw.template).trim();
    if (!template) {
      errors.push({ field: 'template', message: 'Fill in the blank question missing "template" field' });
    } else if (!template.includes('{{blank}}')) {
      errors.push({
        field: 'template',
        message: 'Fill in the blank template must contain the "{{blank}}" placeholder token',
        receivedValue: template,
      });
    } else if (template.trim() === '{{blank}}') {
      errors.push({
        field: 'template',
        message: 'Fill in the blank template cannot be only "{{blank}}"; must include surrounding context sentence.',
        receivedValue: template,
      });
    }

    let correctAnswers: string[] = [];
    if (Array.isArray(raw.correctAnswers)) {
      correctAnswers = raw.correctAnswers.map((a: any) => extractString(a).trim()).filter(Boolean);
    } else if (typeof raw.correctAnswer === 'string' && raw.correctAnswer.trim()) {
      correctAnswers = [raw.correctAnswer.trim()];
    }

    if (correctAnswers.length === 0) {
      errors.push({
        field: 'correctAnswers',
        message: 'Fill in the blank question must provide at least one accepted answer string in "correctAnswers"',
        receivedValue: raw.correctAnswers,
      });
    }

    // Domain validation on the filled-in (correct) sentence and explanation
    if (correctAnswers.length > 0 && template) {
      const filledSentence = template.replace('{{blank}}', correctAnswers[0]);
      const domainText = `${filledSentence} ${explanation}`;
      const invariantErr = checkBSTInvariantCompleteness(domainText);
      if (invariantErr) errors.push({ field: 'correctAnswers', message: invariantErr });
      const complexityErr = checkComplexityClaimConsistency(domainText);
      if (complexityErr) errors.push({ field: 'correctAnswers', message: complexityErr });
      const dupErr = checkDuplicatePolicyStated(`${promptText} ${filledSentence} ${explanation}`);
      if (dupErr) errors.push({ field: 'question', message: dupErr });
    }

    if (errors.length === 0) {
      sanitizedQuestion = {
        id: rawId,
        type: 'fill_blank',
        question: promptText,
        topic: topicText,
        difficulty,
        dimension,
        points,
        explanation,
        template,
        correctAnswers,
        hint: extractString(raw.hint) || undefined,
        caseSensitive: Boolean(raw.caseSensitive),
      } as FillBlankQuestion;
    }
  } else if (rawType === 'code_input') {
    const codeLang = extractString(raw.language || targetLanguage || 'code').trim();
    if (!codeLang) {
      errors.push({ field: 'language', message: 'Code question must specify "language"' });
    } else if (targetLanguage && codeLang.toLowerCase() !== targetLanguage.toLowerCase()) {
      errors.push({
        field: 'language',
        message: `Language metadata "${codeLang}" does not match requested programming language "${targetLanguage}"`,
        receivedValue: codeLang,
      });
    }

    const starterCode = extractString(raw.starterCode).trim();
    if (!starterCode || starterCode.length < 3) {
      errors.push({ field: 'starterCode', message: 'Code question missing valid "starterCode"' });
    } else {
      const contradiction = checkCodeLanguageContradiction(starterCode, codeLang);
      if (contradiction) {
        errors.push({ field: 'starterCode', message: contradiction });
      }
    }

    const expectedOutputOrPattern = extractString(raw.expectedOutputOrPattern).trim();
    if (!expectedOutputOrPattern) {
      errors.push({
        field: 'expectedOutputOrPattern',
        message: 'Code question missing "expectedOutputOrPattern" specification',
      });
    }

    let criteria: string[] = [];
    if (Array.isArray(raw.evaluationCriteria)) {
      criteria = raw.evaluationCriteria.map((c: any) => extractString(c).trim()).filter(Boolean);
    }
    if (criteria.length === 0) {
      errors.push({
        field: 'evaluationCriteria',
        message: 'Code question must specify at least one evaluation criterion',
      });
    }

    // Domain validation: node representation must be consistent between the
    // prompt, starter code, and evaluation criteria; and duplicate handling
    // (if mentioned) must be explicit.
    {
      const combined = `${promptText} ${starterCode} ${criteria.join(' ')} ${explanation}`;
      const reprErr = checkNodeRepresentationConsistency(combined);
      if (reprErr) errors.push({ field: 'starterCode', message: reprErr });
      const dupErr = checkDuplicatePolicyStated(combined);
      if (dupErr) errors.push({ field: 'question', message: dupErr });
    }

    if (errors.length === 0) {
      sanitizedQuestion = {
        id: rawId,
        type: 'code_input',
        question: promptText,
        topic: topicText,
        difficulty,
        dimension,
        points,
        explanation,
        language: codeLang,
        starterCode,
        expectedOutputOrPattern,
        evaluationCriteria: criteria,
        solutionCode: extractString(raw.solutionCode) || undefined,
      } as CodeInputQuestion;
    }
  } else if (rawType === 'debugging') {
    const codeLang = extractString(raw.language || targetLanguage || 'code').trim();
    if (!codeLang) {
      errors.push({ field: 'language', message: 'Debugging question must specify "language"' });
    } else if (targetLanguage && codeLang.toLowerCase() !== targetLanguage.toLowerCase()) {
      errors.push({
        field: 'language',
        message: `Language metadata "${codeLang}" does not match requested programming language "${targetLanguage}"`,
        receivedValue: codeLang,
      });
    }

    const buggyCode = extractString(raw.buggyCode).trim();
    if (!buggyCode || buggyCode.length < 3) {
      errors.push({ field: 'buggyCode', message: 'Debugging question missing valid "buggyCode"' });
    } else {
      const contradiction = checkCodeLanguageContradiction(buggyCode, codeLang);
      if (contradiction) {
        errors.push({ field: 'buggyCode', message: contradiction });
      }
    }

    const bugPrompt = extractString(raw.bugDescriptionPrompt).trim();
    if (!bugPrompt || bugPrompt.length < 5) {
      errors.push({
        field: 'bugDescriptionPrompt',
        message: 'Debugging question missing meaningful "bugDescriptionPrompt"',
        receivedValue: raw.bugDescriptionPrompt,
      });
    }

    const rawBugType = extractString(raw.bugType).toLowerCase().trim();
    if (!VALID_BUG_TYPES.includes(rawBugType as any)) {
      errors.push({
        field: 'bugType',
        message: `Invalid bugType: "${raw.bugType}". Must be one of: ${VALID_BUG_TYPES.join(', ')}`,
        receivedValue: raw.bugType,
      });
    }
    const bugType = (VALID_BUG_TYPES.includes(rawBugType as any) ? rawBugType : 'logical') as any;

    const fixedCode = extractString(raw.fixedCodeSnippet).trim();
    if (!fixedCode || fixedCode.length < 3) {
      errors.push({ field: 'fixedCodeSnippet', message: 'Debugging question missing "fixedCodeSnippet"' });
    } else if (buggyCode && fixedCode && buggyCode === fixedCode) {
      errors.push({
        field: 'fixedCodeSnippet',
        message: '"fixedCodeSnippet" is identical to "buggyCode" (no actual bug fix present)',
      });
    }

    const explanationOfBug = extractString(raw.explanationOfBug || raw.explanation).trim();
    if (!explanationOfBug || explanationOfBug.length < 5) {
      errors.push({ field: 'explanationOfBug', message: 'Debugging question missing "explanationOfBug"' });
    }

    // Debugging questions must include evaluation criteria (Requirement #7)
    let debugCriteria: string[] = [];
    if (Array.isArray(raw.evaluationCriteria)) {
      debugCriteria = raw.evaluationCriteria.map((c: any) => extractString(c).trim()).filter(Boolean);
    }
    if (debugCriteria.length === 0) {
      errors.push({
        field: 'evaluationCriteria',
        message: 'Debugging question must specify at least one evaluation criterion describing how the fix will be judged',
      });
    }

    // Cross-field consistency: bug description, explanation, and criteria
    // must describe the SAME issue (light keyword-overlap heuristic).
    if (bugPrompt && explanationOfBug) {
      const stopwords = new Set(['what', 'this', 'that', 'with', 'from', 'have', 'does', 'code', 'bug', 'the', 'and', 'why', 'how', 'fix', 'issue']);
      const tokenize = (s: string) => s.toLowerCase().match(/[a-z0-9_]{4,}/g)?.filter((w) => !stopwords.has(w)) || [];
      const descTokens = new Set(tokenize(bugPrompt));
      const explTokens = new Set(tokenize(explanationOfBug));
      const overlap = [...descTokens].some((w) => explTokens.has(w));
      if (descTokens.size > 0 && explTokens.size > 0 && !overlap) {
        errors.push({
          field: 'explanationOfBug',
          message: 'bugDescriptionPrompt and explanationOfBug share no common technical terms — they must describe the exact same issue.',
        });
      }
    }

    // Domain validation: node representation & duplicate policy consistency
    {
      const combined = `${promptText} ${buggyCode} ${fixedCode} ${debugCriteria.join(' ')} ${explanationOfBug}`;
      const reprErr = checkNodeRepresentationConsistency(combined);
      if (reprErr) errors.push({ field: 'buggyCode', message: reprErr });
      const dupErr = checkDuplicatePolicyStated(combined);
      if (dupErr) errors.push({ field: 'question', message: dupErr });
    }

    if (errors.length === 0) {
      sanitizedQuestion = {
        id: rawId,
        type: 'debugging',
        question: promptText,
        topic: topicText,
        difficulty,
        dimension,
        points,
        explanation,
        language: codeLang,
        buggyCode,
        bugDescriptionPrompt: bugPrompt,
        bugType,
        fixedCodeSnippet: fixedCode,
        explanationOfBug,
        evaluationCriteria: debugCriteria,
      } as DebuggingQuestion;
    }
  } else if (rawType === 'arrange_steps') {
    const contextTitle = extractString(raw.contextTitle).trim();
    if (!contextTitle) {
      errors.push({ field: 'contextTitle', message: 'Arrange steps question missing "contextTitle"' });
    }

    let shuffledSteps: Array<{ id: string; text: string }> = [];
    if (Array.isArray(raw.shuffledSteps)) {
      shuffledSteps = raw.shuffledSteps.map((s: any, idx: number) => ({
        id: extractString(s?.id || `s${idx + 1}`).trim(),
        text: extractString(s?.text || s?.step || s).trim(),
      }));
    }

    if (shuffledSteps.length < 3) {
      errors.push({
        field: 'shuffledSteps',
        message: `Arrange steps must contain at least 3 steps. Received ${shuffledSteps.length}.`,
        receivedValue: shuffledSteps,
      });
    } else {
      const stepIds = new Set<string>();
      for (let i = 0; i < shuffledSteps.length; i++) {
        const s = shuffledSteps[i];
        if (!s.id) {
          errors.push({ field: 'shuffledSteps', message: `Step at index ${i} has empty ID` });
        } else if (stepIds.has(s.id)) {
          errors.push({ field: 'shuffledSteps', message: `Duplicate step ID "${s.id}" in shuffledSteps` });
        } else {
          stepIds.add(s.id);
        }

        if (!s.text) {
          errors.push({ field: 'shuffledSteps', message: `Step "${s.id}" has empty text` });
        }
      }

      let correctOrderIds: string[] = [];
      if (Array.isArray(raw.correctOrderIds)) {
        correctOrderIds = raw.correctOrderIds.map((id: any) => extractString(id).trim());
      }

      if (correctOrderIds.length !== shuffledSteps.length) {
        errors.push({
          field: 'correctOrderIds',
          message: `correctOrderIds length (${correctOrderIds.length}) does not match shuffledSteps length (${shuffledSteps.length})`,
          receivedValue: correctOrderIds,
        });
      } else {
        const orderIdSet = new Set(correctOrderIds);
        if (orderIdSet.size !== correctOrderIds.length) {
          errors.push({
            field: 'correctOrderIds',
            message: 'correctOrderIds contains duplicate step IDs',
            receivedValue: correctOrderIds,
          });
        }
        for (const id of correctOrderIds) {
          if (!stepIds.has(id)) {
            errors.push({
              field: 'correctOrderIds',
              message: `correctOrderIds contains unknown step ID "${id}" not present in shuffledSteps`,
            });
          }
        }
      }

      // Domain validation: BST deletion sequences must use a standard,
      // representation-independent process (Requirement #6).
      const deletionErr = checkBSTDeletionStepsValidity(
        shuffledSteps.map((s) => s.text),
        `${contextTitle} ${promptText} ${topicText}`
      );
      if (deletionErr) {
        errors.push({ field: 'shuffledSteps', message: deletionErr });
      }
    }

    if (errors.length === 0) {
      sanitizedQuestion = {
        id: rawId,
        type: 'arrange_steps',
        question: promptText,
        topic: topicText,
        difficulty,
        dimension,
        points,
        explanation,
        contextTitle,
        shuffledSteps,
        correctOrderIds: raw.correctOrderIds,
      } as ArrangeStepsQuestion;
    }
  } else if (rawType === 'explanation') {
    let rubricKeywords: string[] = [];
    if (Array.isArray(raw.rubricKeywords)) {
      rubricKeywords = raw.rubricKeywords.map((k: any) => extractString(k).trim()).filter(Boolean);
    }
    if (rubricKeywords.length === 0) {
      errors.push({
        field: 'rubricKeywords',
        message: 'Explanation question must provide at least one rubric keyword in "rubricKeywords"',
      });
    }

    const idealAnswerSummary = extractString(raw.idealAnswerSummary).trim();
    if (!idealAnswerSummary || idealAnswerSummary.length < 10) {
      errors.push({
        field: 'idealAnswerSummary',
        message: 'Explanation question missing meaningful "idealAnswerSummary" (>= 10 chars)',
        receivedValue: raw.idealAnswerSummary,
      });
    }

    // Domain validation on the model answer content
    if (idealAnswerSummary) {
      const domainText = `${promptText} ${idealAnswerSummary} ${explanation}`;
      const invariantErr = checkBSTInvariantCompleteness(domainText);
      if (invariantErr) errors.push({ field: 'idealAnswerSummary', message: invariantErr });
      const complexityErr = checkComplexityClaimConsistency(domainText);
      if (complexityErr) errors.push({ field: 'idealAnswerSummary', message: complexityErr });
      const dupErr = checkDuplicatePolicyStated(domainText);
      if (dupErr) errors.push({ field: 'question', message: dupErr });
    }

    if (errors.length === 0) {
      sanitizedQuestion = {
        id: rawId,
        type: 'explanation',
        question: promptText,
        topic: topicText,
        difficulty,
        dimension,
        points,
        explanation,
        rubricKeywords,
        idealAnswerSummary,
        minWordCount: typeof raw.minWordCount === 'number' && raw.minWordCount > 0 ? raw.minWordCount : 15,
      } as ExplanationQuestion;
    }
  }

  return {
    isValid: errors.length === 0,
    questionId: rawId || 'unknown_id',
    questionType: rawType,
    errors,
    sanitizedQuestion: errors.length === 0 ? sanitizedQuestion : undefined,
  };
}

/**
 * Validates a batch of assessment questions and produces a detailed report
 */
export function validateAssessmentBatch(
  rawQuestions: any[],
  context?: ValidationContext
): AssessmentValidationReport {
  if (!Array.isArray(rawQuestions)) {
    return {
      isValid: false,
      totalQuestions: 0,
      validCount: 0,
      invalidCount: 0,
      validQuestions: [],
      invalidQuestions: [
        {
          raw: rawQuestions,
          errors: [{ field: 'batch', message: 'Received questions payload is not an array' }],
          index: 0,
        },
      ],
      failureSummary: 'Received questions payload is not a valid JSON array.',
    };
  }

  // -------------------------------------------------------------------
  // Requirement #3: Batch-wide programming-language consistency.
  // If no language was explicitly requested/detected from the topic, lock
  // the whole batch to whichever language the FIRST programming question
  // uses, so later questions cannot arbitrarily switch languages.
  // -------------------------------------------------------------------
  let resolvedContext = context;
  const explicitOrDetectedLang =
    context?.requestedLanguage?.toLowerCase().trim() ||
    detectProgrammingLanguage(context?.topic || '', context?.subjectTitle || '');
  if (!explicitOrDetectedLang) {
    const firstProgLang = rawQuestions
      .filter((q) => q && typeof q === 'object')
      .filter((q) => ['code_input', 'debugging'].includes(extractString(q.type).toLowerCase().trim()))
      .map((q) => extractString(q.language).trim())
      .find((lang) => lang.length > 0);
    if (firstProgLang) {
      resolvedContext = { topic: '', ...(context || {}), requestedLanguage: firstProgLang };
    }
  }

  const validQuestions: AssessmentQuestion[] = [];
  const invalidQuestions: Array<{ raw: any; errors: QuestionValidationError[]; index: number }> = [];

  rawQuestions.forEach((q, idx) => {
    const result = validateAssessmentQuestion(q, resolvedContext);
    if (result.isValid && result.sanitizedQuestion) {
      validQuestions.push(result.sanitizedQuestion);
    } else {
      invalidQuestions.push({
        raw: q,
        errors: result.errors,
        index: idx,
      });
    }
  });

  const failureSummary =
    invalidQuestions.length > 0
      ? invalidQuestions
          .map((item) => {
            const qId = item.raw?.id || `Question #${item.index + 1}`;
            const errLines = item.errors.map((e) => `  - [${e.field}] ${e.message}`).join('\n');
            return `${qId}:\n${errLines}`;
          })
          .join('\n\n')
      : 'All questions passed universal validation.';

  return {
    isValid: invalidQuestions.length === 0,
    totalQuestions: rawQuestions.length,
    validCount: validQuestions.length,
    invalidCount: invalidQuestions.length,
    validQuestions,
    invalidQuestions,
    failureSummary,
  };
}

/**
 * Formats a clear, targeted regeneration prompt containing the exact errors for failed questions only
 */
export function formatRegenerationPrompt(
  invalidQuestions: Array<{ raw: any; errors: QuestionValidationError[]; index: number }>,
  context: ValidationContext
): string {
  const errorDescriptions = invalidQuestions
    .map((item, i) => {
      const q = item.raw || {};
      const expectedType = q.type || 'mcq';
      const targetLang = context.requestedLanguage || detectProgrammingLanguage(context.topic, context.subjectTitle) || 'standard';
      const errList = item.errors.map((e) => `- ${e.message}`).join('\n');

      return `Invalid Question #${i + 1} (Original ID: "${q.id || `q_${item.index + 1}`}", Expected Type: "${expectedType}"):
Target Language: ${targetLang}
Target Topic: ${context.topic}
Target Difficulty: ${context.targetDifficulty || 'adaptive'}
Specific Validation Failures:
${errList}

Original Faulty JSON:
${JSON.stringify(q, null, 2)}`;
    })
    .join('\n\n---\n\n');

  return `The following generated questions failed universal production validation.
Regenerate ONLY those ${invalidQuestions.length} replacement questions to fix the exact errors noted below.

Topic: "${context.topic}" (Subject: "${context.subjectTitle || context.topic}")
Target Language: "${context.requestedLanguage || detectProgrammingLanguage(context.topic, context.subjectTitle) || 'None'}"
Batch Number: ${context.batchNumber || 1}

ERRORS TO FIX:
${errorDescriptions}

CRITICAL RULES:
1. Return ONLY a valid JSON array of ${invalidQuestions.length} regenerated question objects.
2. Ensure every field matches the exact schema for its type without any placeholder text or syntax contradictions.
3. For cognitive dimension, use ONLY one of: ["concept", "application", "implementation", "debugging", "algorithmic_thinking"].
4. For programming questions, ensure the "language" metadata exactly matches the requested language and the code contains no foreign syntax.
5. For MCQ, provide exactly 4 unique options with a valid correctAnswer index (0..3).
6. For Fill in Blank, template must contain {{blank}} with non-empty correctAnswers array.
7. For Debugging, ensure buggyCode and fixedCodeSnippet are different, bugType is one of ["syntax", "logical", "edge_case", "concurrency", "off_by_one"], and include a non-empty "evaluationCriteria" array whose criteria describe fixing the SAME bug named in bugDescriptionPrompt and explanationOfBug.
8. For Arrange Steps, ensure shuffledSteps has >= 3 steps and correctOrderIds lists each step ID exactly once.
9. NEVER state a BST/tree invariant relative to only "the root" — it must hold recursively for EVERY node, and must give BOTH the left-subtree (< node) and right-subtree (> node) conditions.
10. NEVER claim an ordinary BST "must remain balanced" or has worst-case O(log n). Ordinary BST: average O(log n), worst-case O(n). Only self-balancing BSTs (AVL, Red-Black) guarantee O(log n) worst-case — say so explicitly whenever O(log n) is claimed.
11. If duplicates are mentioned for a BST/ordered structure, explicitly state the policy: prohibited, go left, go right, or counted.
12. Explicitly state the node representation (dictionary vs class/object) and use IDENTICAL access syntax everywhere: dictionaries use root["value"], objects/classes use root.value. Never mix them.
13. For BST deletion "arrange steps" questions, use the standard representation-independent process only: locate the inorder successor, copy/replace the value, delete the successor from the right subtree, reconnect the affected subtree. Never invent a "parent pointer" step unless parent pointers were explicitly defined in the question.`;
}
