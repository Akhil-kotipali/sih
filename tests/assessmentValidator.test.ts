/**
 * Unit Test Suite for Universal Assessment Validation Layer
 * Run with: npx tsx tests/assessmentValidator.test.ts
 */

import {
  validateAssessmentQuestion,
  validateAssessmentBatch,
  formatRegenerationPrompt,
  detectProgrammingLanguage,
  checkCodeLanguageContradiction,
  checkBSTInvariantCompleteness,
  checkComplexityClaimConsistency,
  checkDuplicatePolicyStated,
  checkNodeRepresentationConsistency,
  checkBSTDeletionStepsValidity,
  SUPPORTED_QUESTION_TYPES,
  CANONICAL_COGNITIVE_DIMENSIONS,
} from '../src/services/assessmentValidator';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`, detail || '');
    failed++;
  }
}

console.log('\n--- Running Universal Assessment Validator Unit Tests ---\n');

// 1. Valid Canonical Cognitive Dimensions
CANONICAL_COGNITIVE_DIMENSIONS.forEach((dim) => {
  const result = validateAssessmentQuestion({
    id: `q_${dim}`,
    type: 'mcq',
    question: 'What is the time complexity of binary search?',
    topic: 'Algorithms',
    difficulty: 'medium',
    dimension: dim,
    points: 10,
    explanation: 'Binary search halves the search space each step.',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n^2)'],
    correctAnswer: 1,
  });
  assert(result.isValid, `Accepts canonical dimension "${dim}"`);
});

// 2. Reject Invalid/Legacy Cognitive Dimensions
const invalidDimensions = ['algorithmic', 'alg', 'memory', 'speed', 'general'];
invalidDimensions.forEach((dim) => {
  const result = validateAssessmentQuestion({
    id: `q_invalid_dim_${dim}`,
    type: 'mcq',
    question: 'What is the time complexity of quick sort?',
    topic: 'Algorithms',
    difficulty: 'medium',
    dimension: dim,
    points: 10,
    explanation: 'Quick sort partitions elements around a pivot.',
    options: ['O(1)', 'O(log n)', 'O(n log n)', 'O(n^2)'],
    correctAnswer: 2,
  });
  assert(!result.isValid, `Rejects non-canonical dimension "${dim}"`);
  assert(
    result.errors.some((e) => e.field === 'dimension'),
    `Provides dimension error message for "${dim}"`
  );
});

// 3. Reject Placeholder Prompts
const placeholderPrompts = [
  'Assessment Question 1',
  'question 2',
  'placeholder',
  'sample question',
  'test question',
  'dummy prompt',
  'todo',
  'Lorem ipsum dolor sit amet',
];
placeholderPrompts.forEach((prompt) => {
  const result = validateAssessmentQuestion({
    id: 'q_placeholder',
    type: 'mcq',
    question: prompt,
    topic: 'Java Foundations',
    difficulty: 'easy',
    dimension: 'concept',
    points: 10,
    explanation: 'Valid explanation here.',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
  });
  assert(!result.isValid, `Rejects placeholder prompt: "${prompt}"`);
  assert(
    result.errors.some((e) => e.field === 'question'),
    `Flags question error for placeholder prompt: "${prompt}"`
  );
});

// 4. Cross-Language Contradiction Checks
const javaCodeWithPythonMetadata = `
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}
`;
const contradiction1 = checkCodeLanguageContradiction(javaCodeWithPythonMetadata, 'python');
assert(
  contradiction1 !== null,
  'Detects Java code contradiction when declared language is "python"'
);

const pythonCodeWithJavaMetadata = `
def calculate_sum(nums):
    total = 0
    for n in nums:
        total += n
    return total
`;
const contradiction2 = checkCodeLanguageContradiction(pythonCodeWithJavaMetadata, 'java');
assert(
  contradiction2 !== null,
  'Detects Python code contradiction when declared language is "java"'
);

// 5. Code Question Language Mismatch with Context
const langMismatchResult = validateAssessmentQuestion(
  {
    id: 'q_lang_mismatch',
    type: 'code_input',
    question: 'Write a function to reverse a list in Java.',
    topic: 'Java Collections',
    difficulty: 'medium',
    dimension: 'implementation',
    points: 15,
    language: 'python', // Mismatched!
    starterCode: 'def reverse_list(lst):\n    pass\n',
    expectedOutputOrPattern: '[3, 2, 1]',
    evaluationCriteria: ['Correct loop', 'Returns list'],
    explanation: 'Use Collections.reverse() or standard two-pointer swap in Java.',
  },
  { topic: 'Java Collections', requestedLanguage: 'java' }
);
assert(!langMismatchResult.isValid, 'Rejects code_input where metadata language does not match requested language');
assert(
  langMismatchResult.errors.some((e) => e.field === 'language'),
  'Flags language field error for mismatched requestedLanguage'
);

// 6. MCQ Integrity Validation
const duplicateOptionsResult = validateAssessmentQuestion({
  id: 'q_mcq_dup',
  type: 'mcq',
  question: 'Which method starts a thread in Java?',
  topic: 'Java Concurrency',
  difficulty: 'easy',
  dimension: 'concept',
  points: 10,
  options: ['start()', 'run()', 'start()', 'init()'], // duplicate!
  correctAnswer: 0,
  explanation: 'start() creates a new thread call stack and invokes run().',
});
assert(!duplicateOptionsResult.isValid, 'Rejects MCQ with duplicate options');

const invalidIndexResult = validateAssessmentQuestion({
  id: 'q_mcq_idx',
  type: 'mcq',
  question: 'What is the keyword for constant in Java?',
  topic: 'Java Basics',
  difficulty: 'easy',
  dimension: 'concept',
  points: 10,
  options: ['const', 'final', 'static', 'immutable'],
  correctAnswer: 4, // Out of bounds (0..3)
  explanation: 'The "final" keyword prevents reassignment.',
});
assert(!invalidIndexResult.isValid, 'Rejects MCQ with correctAnswer index out of bounds');

// 7. True/False Validation
const invalidTFResult = validateAssessmentQuestion({
  id: 'q_tf_invalid',
  type: 'true_false',
  question: 'Java is purely interpreted without bytecode.',
  topic: 'Java Architecture',
  difficulty: 'easy',
  dimension: 'concept',
  points: 10,
  correctAnswer: 'maybe', // not boolean
  explanation: 'Java compiles source code to bytecode which is executed on the JVM.',
});
assert(!invalidTFResult.isValid, 'Rejects True/False question with non-boolean correctAnswer');

// 8. Fill in Blank Validation
const missingBlankResult = validateAssessmentQuestion({
  id: 'q_fb_invalid',
  type: 'fill_blank',
  question: 'Fill in the missing keyword.',
  topic: 'Python',
  difficulty: 'easy',
  dimension: 'implementation',
  points: 10,
  template: 'def my_function(): pass', // missing {{blank}} token!
  correctAnswers: ['def'],
  explanation: 'Functions in Python are defined with "def".',
});
assert(!missingBlankResult.isValid, 'Rejects Fill in Blank missing {{blank}} token');

// 9. Debugging Validation (No Actual Bug Fixed)
const identicalDebuggingResult = validateAssessmentQuestion({
  id: 'q_debug_same',
  type: 'debugging',
  question: 'Fix the bug in this function:',
  topic: 'Python Loops',
  difficulty: 'easy',
  dimension: 'debugging',
  points: 15,
  language: 'python',
  buggyCode: 'x = 10\nprint(x)',
  fixedCodeSnippet: 'x = 10\nprint(x)', // Identical!
  bugDescriptionPrompt: 'What is the issue with this code?',
  bugType: 'logical',
  explanationOfBug: 'No bug was actually fixed.',
  explanation: 'Identical snippets do not represent a valid debugging challenge.',
});
assert(!identicalDebuggingResult.isValid, 'Rejects Debugging question where buggyCode === fixedCodeSnippet');

// 10. Arrange Steps Validation
const invalidStepIdsResult = validateAssessmentQuestion({
  id: 'q_arr_invalid',
  type: 'arrange_steps',
  question: 'Order the steps of binary search:',
  topic: 'Algorithms',
  difficulty: 'medium',
  dimension: 'algorithmic_thinking',
  points: 15,
  contextTitle: 'Binary Search Sequence',
  shuffledSteps: [
    { id: 's1', text: 'Set low = 0, high = len - 1' },
    { id: 's2', text: 'Compute mid = (low + high) // 2' },
    { id: 's3', text: 'Compare arr[mid] with target' },
  ],
  correctOrderIds: ['s1', 's2', 's99'], // s99 does not exist!
  explanation: 'Steps must follow correct sequence.',
});
assert(!invalidStepIdsResult.isValid, 'Rejects Arrange Steps with unknown step IDs in correctOrderIds');

// 11. Batch Validation & Regeneration Prompt Formatting
const mixedBatch = [
  {
    id: 'q1_valid',
    type: 'mcq',
    question: 'Which collection does not allow duplicate elements in Java?',
    topic: 'Java Collections',
    difficulty: 'easy',
    dimension: 'concept',
    points: 10,
    options: ['List', 'Set', 'Queue', 'Map'],
    correctAnswer: 1,
    explanation: 'Set contract prohibits duplicate elements.',
  },
  {
    id: 'q2_invalid',
    type: 'mcq',
    question: 'Assessment Question 2', // placeholder
    topic: 'Java Collections',
    difficulty: 'easy',
    dimension: 'algorithmic', // invalid dimension
    points: 10,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
    explanation: 'Explanation here.',
  },
];

const batchReport = validateAssessmentBatch(mixedBatch, {
  topic: 'Java Collections',
  requestedLanguage: 'java',
});

assert(!batchReport.isValid, 'Batch report flags invalid batch');
assert(batchReport.validCount === 1, 'Batch report accurately separates 1 valid question');
assert(batchReport.invalidCount === 1, 'Batch report accurately separates 1 invalid question');

const regenPrompt = formatRegenerationPrompt(batchReport.invalidQuestions, {
  topic: 'Java Collections',
  requestedLanguage: 'java',
  batchNumber: 1,
});

assert(
  regenPrompt.includes('algorithmic_thinking'),
  'Regeneration prompt explicitly mentions algorithmic_thinking rule'
);
assert(
  regenPrompt.includes('q2_invalid'),
  'Regeneration prompt includes the specific failed question identifier'
);

// 12. Dynamic Language Detection
assert(detectProgrammingLanguage('Java Multithreading') === 'java', 'Detects "java" from topic');
assert(detectProgrammingLanguage('FastAPI Backend Development') === 'python', 'Detects "python" from FastAPI topic');
assert(detectProgrammingLanguage('React Custom Hooks') === 'javascript', 'Detects "javascript" from React topic');
assert(detectProgrammingLanguage('Rust Memory Ownership') === 'rust', 'Detects "rust" from topic');
assert(detectProgrammingLanguage('Operating System Process Scheduling') === undefined, 'Returns undefined for agnostic topic');

// 13. DOMAIN VALIDATION — Binary Search Trees Audit Regression Suite
// Replicates the exact failure patterns reported for "Binary Search Trees" Batch 1
// (Q1 incomplete invariant, Q2 complexity contradiction, Q4 representation mismatch
// + language switch, Q5 unstated duplicate policy, Q6 invented parent pointer).
console.log('\n--- Domain Validation: Binary Search Trees Audit Regression ---\n');

// 13a. Q1 — BST MCQ correct answer states invariant relative to "the root" only
// and omits the right-subtree condition. Must be rejected on BOTH grounds.
const bstQ1 = validateAssessmentQuestion(
  {
    id: 'bst_q1',
    type: 'mcq',
    question: 'What is the defining property of a Binary Search Tree?',
    topic: 'Binary Search Trees',
    difficulty: 'easy',
    dimension: 'concept',
    points: 10,
    options: [
      'For each node, the left subtree contains values less than the root, and the right subtree contains all other values',
      'Every node must have exactly two children',
      'The tree must always be perfectly balanced',
      'Nodes are visited strictly in insertion order',
    ],
    correctAnswer: 0,
    explanation: 'The left subtree is less than the root; this defines BST ordering.',
  },
  { topic: 'Binary Search Trees' }
);
assert(!bstQ1.isValid, 'Q1: Rejects BST MCQ with incomplete invariant (missing right-subtree condition)');
assert(
  bstQ1.errors.some((e) => /right-subtree condition/i.test(e.message)),
  'Q1: Error explains the missing right-subtree condition'
);

const bstIncompleteInvariantDirect = checkBSTInvariantCompleteness(
  'the left subtree is less than the root and the right subtree is greater than the root'
);
assert(
  bstIncompleteInvariantDirect !== null,
  'checkBSTInvariantCompleteness: Flags invariant stated relative to only "the root" instead of every node'
);
const bstCompleteInvariantDirect = checkBSTInvariantCompleteness(
  'for every node, the left subtree contains values less than the node and the right subtree contains values greater than the node, recursively'
);
assert(
  bstCompleteInvariantDirect === null,
  'checkBSTInvariantCompleteness: Accepts a complete, recursively-stated invariant with both conditions'
);

// 13b. Q2 — Claims an ordinary BST "must remain balanced" for O(log n) performance
const bstQ2 = validateAssessmentQuestion(
  {
    id: 'bst_q2',
    type: 'true_false',
    question: 'A Binary Search Tree must remain balanced to achieve O(log n) search performance.',
    topic: 'Binary Search Trees',
    difficulty: 'medium',
    dimension: 'concept',
    points: 10,
    correctAnswer: true,
    explanation: 'A BST must remain balanced to guarantee O(log n) search performance.',
  },
  { topic: 'Binary Search Trees' }
);
assert(!bstQ2.isValid, 'Q2: Rejects the claim that an ordinary BST "must remain balanced" for O(log n)');
assert(
  bstQ2.errors.some((e) => /must remain balanced/i.test(e.message)),
  'Q2: Error explains the balanced-BST contradiction'
);

const complexityOk = checkComplexityClaimConsistency(
  'the average time complexity of search in a bst is o(log n); worst case is o(n) for an unbalanced tree'
);
assert(complexityOk === null, 'checkComplexityClaimConsistency: Accepts a properly qualified average/worst-case claim');
const complexityBad = checkComplexityClaimConsistency(
  'a binary search tree has worst-case o(log n) search time'
);
assert(
  complexityBad !== null,
  'checkComplexityClaimConsistency: Rejects worst-case O(log n) claim without a self-balancing structure named'
);

// 13c. Q4 — Debugging question declares a dictionary-based node but uses dot access
// AND switches language away from the batch's established Python.
const bstQ3python = {
  id: 'bst_q3',
  type: 'code_input',
  question: 'Implement BST insertion using a class-based node structure.',
  topic: 'Binary Search Trees',
  difficulty: 'medium',
  dimension: 'implementation',
  points: 15,
  language: 'python',
  starterCode:
    'class Node:\n    def __init__(self, value):\n        self.value = value\n        self.left = None\n        self.right = None\n\ndef insert(root, value):\n    pass',
  expectedOutputOrPattern: 'Returns updated tree root with value inserted at correct position',
  evaluationCriteria: ['Uses root.left / root.right traversal', 'Handles empty tree (root is None)'],
  explanation: 'Standard recursive BST insertion using a class-based node with .left/.right/.value attributes.',
};
const bstQ4javaDict = {
  id: 'bst_q4',
  type: 'debugging',
  question:
    'This BST search function uses a dictionary-based node structure ({"value":..., "left":..., "right":...}). Find the bug.',
  topic: 'Binary Search Trees',
  difficulty: 'medium',
  dimension: 'debugging',
  points: 15,
  language: 'java',
  buggyCode:
    'public boolean search(Map<String,Object> root, int target) {\n    if (root == null) return false;\n    if ((int) root.get("value") == target) return true;\n    return search((Map<String,Object>) root.get("left"), target);\n}',
  bugDescriptionPrompt:
    'The function never searches the right subtree when the target is greater than the current node value.',
  bugType: 'logical',
  fixedCodeSnippet:
    'public boolean search(Map<String,Object> root, int target) {\n    if (root == null) return false;\n    if ((int) root.get("value") == target) return true;\n    if (target < (int) root.get("value")) return search((Map<String,Object>) root.get("left"), target);\n    return search((Map<String,Object>) root.get("right"), target);\n}',
  explanationOfBug: 'The original code always recursed left, never checking the right subtree when needed.',
  explanation: 'The original code always recursed left, never checking the right subtree when needed.',
  evaluationCriteria: ['Uses root.value to compare (dictionary-based node)', 'Recurses into root.left or root.right based on comparison'],
};

const reprDirect = checkNodeRepresentationConsistency(
  'dictionary-based node structure ... root.value to compare (dictionary-based node)'
);
assert(reprDirect !== null, 'checkNodeRepresentationConsistency: Flags dict-declared node using dot access');
const reprOkDirect = checkNodeRepresentationConsistency(
  'dictionary-based node structure ... root["value"] to compare (dictionary-based node)'
);
assert(reprOkDirect === null, 'checkNodeRepresentationConsistency: Accepts dict-declared node using bracket access');

const bstQ4Standalone = validateAssessmentQuestion(bstQ4javaDict, { topic: 'Binary Search Trees' });
assert(
  !bstQ4Standalone.isValid && bstQ4Standalone.errors.some((e) => /dictionary-based node structure/i.test(e.message)),
  'Q4: Rejects debugging question using dot access on a declared dictionary-based node'
);

const bstBatchWithQ4 = validateAssessmentBatch([bstQ3python, bstQ4javaDict], { topic: 'Binary Search Trees' });
assert(!bstBatchWithQ4.isValid, 'Q4 batch: Overall batch is invalid');
const bstQ4InBatch = bstBatchWithQ4.invalidQuestions.find((iq) => iq.raw?.id === 'bst_q4');
assert(!!bstQ4InBatch, 'Q4 batch: Q4 specifically appears among invalid questions');
assert(
  !!bstQ4InBatch && bstQ4InBatch.errors.some((e) => e.field === 'language'),
  'Q4 batch: Flags language switch (java) against batch-established language (python) even though topic has no language keyword'
);
assert(
  !!bstQ4InBatch && bstQ4InBatch.errors.some((e) => /dictionary-based node structure/i.test(e.message)),
  'Q4 batch: Also flags the dictionary/dot-access representation mismatch'
);

// 13d. Q5 — Duplicate values mentioned without ever stating the handling policy
const bstQ5 = validateAssessmentQuestion(
  {
    id: 'bst_q5',
    type: 'mcq',
    question: 'When inserting a duplicate value into a BST, what happens?',
    topic: 'Binary Search Trees',
    difficulty: 'medium',
    dimension: 'concept',
    points: 10,
    options: [
      'The duplicate value is inserted somewhere in the tree',
      'An exception is always thrown by every BST implementation',
      'The tree automatically rebalances',
      'The value is converted to a string',
    ],
    correctAnswer: 0,
    explanation: 'Duplicate values in a BST are handled according to some rule.',
  },
  { topic: 'Binary Search Trees' }
);
assert(!bstQ5.isValid, 'Q5: Rejects a duplicate-value question that never states the duplicate-handling policy');
assert(
  bstQ5.errors.some((e) => /duplicate-handling policy/i.test(e.message)),
  'Q5: Error explains the missing duplicate policy'
);

const dupOk = checkDuplicatePolicyStated('duplicate values are not allowed in this bst; inserts of existing values are ignored');
assert(dupOk === null, 'checkDuplicatePolicyStated: Accepts a question that explicitly states "not allowed"');
const dupBad = checkDuplicatePolicyStated('duplicate values may occur in this bst');
assert(dupBad !== null, 'checkDuplicatePolicyStated: Rejects a question mentioning duplicates with no stated policy');

// 13e. Q6 — Arrange-steps BST deletion invents an undefined "parent pointer" step
// and omits the required inorder-successor process.
const bstQ6 = validateAssessmentQuestion(
  {
    id: 'bst_q6',
    type: 'arrange_steps',
    question: 'Arrange the steps to delete a node with two children from a Binary Search Tree.',
    topic: 'Binary Search Trees',
    difficulty: 'hard',
    dimension: 'algorithmic_thinking',
    points: 15,
    contextTitle: 'BST Node Deletion (Two Children)',
    shuffledSteps: [
      { id: 's1', text: 'Locate the node to delete by traversing the tree' },
      { id: 's2', text: "Use the parent pointer of the target node to detach it" },
      { id: 's3', text: "Set the parent's child reference to null" },
      { id: 's4', text: 'Free the memory of the deleted node' },
    ],
    correctOrderIds: ['s1', 's2', 's3', 's4'],
    explanation: 'Deletion requires detaching the node from its parent.',
  },
  { topic: 'Binary Search Trees' }
);
assert(!bstQ6.isValid, 'Q6: Rejects BST deletion steps that invent an undefined "parent pointer"');
assert(
  bstQ6.errors.some((e) => /parent pointer/i.test(e.message)),
  'Q6: Error explains the undefined parent-pointer assumption'
);

const deletionOk = checkBSTDeletionStepsValidity(
  [
    'Find the inorder successor (smallest value in the right subtree)',
    'Copy the successor value into the node being deleted',
    'Delete the successor node from the right subtree',
    'Reconnect the right subtree to its updated child pointer',
  ],
  'Binary Search Tree deletion of a node with two children'
);
assert(deletionOk === null, 'checkBSTDeletionStepsValidity: Accepts the standard representation-independent deletion process');

// 13f. Regression guard — a fully correct BST batch must pass cleanly (no false positives)
const goodBSTBatch = validateAssessmentBatch(
  [
    {
      id: 'good_1',
      type: 'mcq',
      question: 'Which statement correctly defines the Binary Search Tree property?',
      topic: 'Binary Search Trees',
      difficulty: 'easy',
      dimension: 'concept',
      points: 10,
      options: [
        'For every node, all values in its left subtree are less than the node value, and all values in its right subtree are greater than the node value, recursively for every node',
        'Every node must have exactly two children',
        'The tree height must always equal log2(n)',
        'Nodes are stored in a hash map keyed by value',
      ],
      correctAnswer: 0,
      explanation: 'This BST invariant holds recursively for every node: left subtree < node < right subtree.',
    },
    {
      id: 'good_2',
      type: 'true_false',
      question: 'An ordinary (unbalanced) Binary Search Tree has O(n) worst-case search time.',
      topic: 'Binary Search Trees',
      difficulty: 'medium',
      dimension: 'concept',
      points: 10,
      correctAnswer: true,
      explanation:
        'An ordinary BST has average-case O(log n) but worst-case O(n) if it degenerates into a linked list; only self-balancing BSTs like AVL guarantee O(log n) worst-case.',
    },
    {
      id: 'good_3',
      type: 'code_input',
      question:
        'Implement BST search using a class-based node structure with .value/.left/.right attributes. Duplicate values are not allowed (ignore inserts of existing values).',
      topic: 'Binary Search Trees',
      difficulty: 'medium',
      dimension: 'implementation',
      points: 15,
      language: 'python',
      starterCode:
        'class Node:\n    def __init__(self, value):\n        self.value = value\n        self.left = None\n        self.right = None\n\ndef search(root, target):\n    pass',
      expectedOutputOrPattern: 'Returns True if target exists in tree, else False',
      evaluationCriteria: ['Uses root.value, root.left, root.right for traversal', 'Handles empty tree (root is None)', 'Returns boolean'],
      explanation: 'Standard recursive BST search comparing target against root.value and recursing into root.left or root.right.',
    },
    {
      id: 'good_4',
      type: 'arrange_steps',
      question: 'Arrange the steps to delete a node with two children from a Binary Search Tree.',
      topic: 'Binary Search Trees',
      difficulty: 'hard',
      dimension: 'algorithmic_thinking',
      points: 15,
      contextTitle: 'BST Node Deletion (Two Children)',
      shuffledSteps: [
        { id: 's1', text: 'Locate the node to delete by traversing the tree' },
        { id: 's2', text: 'Find the inorder successor (smallest value in the right subtree)' },
        { id: 's3', text: 'Copy the successor value into the node being deleted' },
        { id: 's4', text: 'Delete the successor node from the right subtree' },
        { id: 's5', text: "Reconnect the right subtree to its updated child pointer" },
      ],
      correctOrderIds: ['s1', 's2', 's3', 's4', 's5'],
      explanation: 'This is the standard representation-independent BST two-children deletion process.',
    },
  ],
  { topic: 'Binary Search Trees' }
);
assert(goodBSTBatch.isValid, 'Well-formed BST batch (correct invariant, complexity, representation, deletion steps) passes cleanly');
assert(goodBSTBatch.invalidCount === 0, 'Well-formed BST batch produces zero false-positive rejections');

console.log(`\n========================================`);
console.log(`Tests Finished: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
