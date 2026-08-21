/**
 * Fallback and Curated Data for LearnPath
 * Provides rich offline question banks across all 7 question types and structured roadmaps.
 */

import { AssessmentQuestion, QuestionType, RoadmapData } from '../types';

export function getFallbackBatch(
  topic: string,
  selectedTypes: QuestionType[],
  batchNumber: number
): AssessmentQuestion[] {
  const normalized = topic.toLowerCase();
  const list: AssessmentQuestion[] = [];

  // Determine specific topic context
  const isDSA = normalized.includes('array') || normalized.includes('dsa') || normalized.includes('tree') || normalized.includes('graph') || normalized.includes('pointer');
  const isOS = normalized.includes('os') || normalized.includes('process') || normalized.includes('thread') || normalized.includes('memory') || normalized.includes('deadlock');
  const isNetworks = normalized.includes('network') || normalized.includes('tcp') || normalized.includes('ip') || normalized.includes('osi') || normalized.includes('http');
  const isDBMS = normalized.includes('sql') || normalized.includes('dbms') || normalized.includes('database') || normalized.includes('acid') || normalized.includes('index');

  // 1. MCQ
  if (selectedTypes.includes('mcq')) {
    if (isDSA) {
      list.push({
        id: `fb_mcq_${batchNumber}_1`,
        type: 'mcq',
        question: `What is the average time complexity of searching an element in a balanced Binary Search Tree (BST)?`,
        topic,
        difficulty: 'easy',
        dimension: 'concept',
        points: 10,
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        correctAnswer: 1,
        explanation: 'In a balanced BST, each comparison halves the search space, yielding O(log n) time complexity.',
      });
      list.push({
        id: `fb_mcq_${batchNumber}_2`,
        type: 'mcq',
        question: `Which data structure is primarily used to perform Breadth-First Search (BFS) on a graph?`,
        topic,
        difficulty: 'medium',
        dimension: 'algorithmic_thinking',
        points: 10,
        options: ['Stack', 'Queue', 'Priority Queue', 'Hash Map'],
        correctAnswer: 1,
        explanation: 'BFS explores vertices level-by-level, which requires FIFO ordering provided by a Queue.',
      });
    } else if (isOS) {
      list.push({
        id: `fb_mcq_${batchNumber}_1`,
        type: 'mcq',
        question: `Which of the following is NOT one of Coffman's four conditions for deadlock?`,
        topic,
        difficulty: 'easy',
        dimension: 'concept',
        points: 10,
        options: ['Mutual Exclusion', 'Hold and Wait', 'Preemption allowed', 'Circular Wait'],
        correctAnswer: 2,
        explanation: 'No Preemption is a necessary condition for deadlock; allowing preemption prevents deadlocks.',
      });
    } else {
      list.push({
        id: `fb_mcq_${batchNumber}_1`,
        type: 'mcq',
        question: `What is the core principle behind ${topic}?`,
        topic,
        difficulty: 'easy',
        dimension: 'concept',
        points: 10,
        options: [
          'Decomposing complex problems into manageable modular components',
          'Executing all operations in a single blocking thread',
          'Eliminating all abstractions and high-level interfaces',
          'Ignoring state validation and boundary constraints',
        ],
        correctAnswer: 0,
        explanation: `${topic} leverages systematic modularity and clear abstractions to solve complex domain challenges.`,
      });
    }
  }

  // 2. True / False
  if (selectedTypes.includes('true_false')) {
    if (isDSA) {
      list.push({
        id: `fb_tf_${batchNumber}_1`,
        type: 'true_false',
        question: `In a min-heap, the root node always contains the minimum element in the entire tree.`,
        topic,
        difficulty: 'easy',
        dimension: 'concept',
        points: 10,
        correctAnswer: true,
        explanation: 'By definition of the min-heap property, every parent node has a value less than or equal to its children.',
      });
    } else if (isNetworks) {
      list.push({
        id: `fb_tf_${batchNumber}_1`,
        type: 'true_false',
        question: `UDP provides guaranteed packet delivery, flow control, and automatic retransmission.`,
        topic,
        difficulty: 'easy',
        dimension: 'concept',
        points: 10,
        correctAnswer: false,
        explanation: 'UDP is a connectionless, best-effort protocol. TCP provides reliability and flow control.',
      });
    } else {
      list.push({
        id: `fb_tf_${batchNumber}_1`,
        type: 'true_false',
        question: `Thorough boundary validation and edge-case handling is essential when implementing ${topic}.`,
        topic,
        difficulty: 'easy',
        dimension: 'concept',
        points: 10,
        correctAnswer: true,
        explanation: 'Robust systems require proactive defensive programming and edge-case coverage.',
      });
    }
  }

  // 3. Fill in the Blank
  if (selectedTypes.includes('fill_blank')) {
    if (isDSA) {
      list.push({
        id: `fb_fib_${batchNumber}_1`,
        type: 'fill_blank',
        question: `Complete the time complexity description for Hash Table lookups:`,
        topic,
        difficulty: 'medium',
        dimension: 'concept',
        points: 10,
        template: `Under ideal conditions with a uniform hash function, average lookup time in a hash table is {{blank}}.`,
        correctAnswers: ['O(1)', 'constant', 'O(1) time', 'constant time'],
        hint: 'Use Big-O notation like O(1) or name the complexity.',
        explanation: 'A good hash function distributes keys evenly across buckets, giving O(1) average lookup.',
      });
    } else if (isDBMS) {
      list.push({
        id: `fb_fib_${batchNumber}_1`,
        type: 'fill_blank',
        question: `Complete the ACID transaction definition:`,
        topic,
        difficulty: 'medium',
        dimension: 'concept',
        points: 10,
        template: `In ACID properties, the letter 'A' stands for {{blank}}, meaning all operations succeed or none do.`,
        correctAnswers: ['Atomicity', 'atomic', 'atomicity'],
        hint: 'Starts with letter A (all-or-nothing property).',
        explanation: 'Atomicity ensures that transactions are treated as single indivisible units of work.',
      });
    } else {
      list.push({
        id: `fb_fib_${batchNumber}_1`,
        type: 'fill_blank',
        question: `Fill in the key terminology for ${topic}:`,
        topic,
        difficulty: 'medium',
        dimension: 'concept',
        points: 10,
        template: `A fundamental property of ${topic} is {{blank}} which guarantees consistency and correctness.`,
        correctAnswers: ['invariance', 'correctness', 'modularity', 'abstraction', 'efficiency'],
        hint: 'A core property of robust engineering systems.',
        explanation: `${topic} relies on structural invariance and clear architectural contracts.`,
      });
    }
  }

  // 4. Code Input (No compiler)
  if (selectedTypes.includes('code_input')) {
    if (isDSA) {
      list.push({
        id: `fb_code_${batchNumber}_1`,
        type: 'code_input',
        question: `Write the core logic to reverse an array in-place using the two-pointer technique:`,
        topic,
        difficulty: 'medium',
        dimension: 'implementation',
        points: 15,
        language: 'python',
        starterCode: `def reverse_array(arr: list) -> list:\n    left = 0\n    right = len(arr) - 1\n    # Your logic here:\n    \n    return arr`,
        expectedOutputOrPattern: 'while left < right: arr[left], arr[right] = arr[right], arr[left]; left += 1; right -= 1',
        evaluationCriteria: ['Uses while left < right', 'Swaps elements in-place', 'Increments left and decrements right'],
        explanation: 'The two-pointer technique operates in O(n) time and O(1) auxiliary space by swapping opposite elements until pointers meet.',
      });
    } else {
      list.push({
        id: `fb_code_${batchNumber}_1`,
        type: 'code_input',
        question: `Implement a helper function for ${topic} that validates the input parameters:`,
        topic,
        difficulty: 'medium',
        dimension: 'implementation',
        points: 15,
        language: 'javascript',
        starterCode: `function validateInput(payload) {\n  // 1. Check if payload is defined and non-null\n  // 2. Validate payload.id and payload.timestamp\n  \n  return true;\n}`,
        evaluationCriteria: ['Checks for null or undefined', 'Validates required attributes', 'Returns boolean indicator'],
        explanation: 'Input validation guards against runtime crashes and enforces precondition contracts.',
      });
    }
  }

  // 5. Debugging
  if (selectedTypes.includes('debugging')) {
    list.push({
      id: `fb_debug_${batchNumber}_1`,
      type: 'debugging',
      question: `Find and describe the bug in this binary search implementation:`,
      topic,
      difficulty: 'medium',
      dimension: 'debugging',
      points: 15,
      language: 'python',
      buggyCode: `def binary_search(arr, target):\n    low = 0\n    high = len(arr)  # BUG HERE\n    while low < high:\n        mid = (low + high) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            low = mid    # POTENTIAL INFINITE LOOP\n        else:\n            high = mid - 1\n    return -1`,
      bugDescriptionPrompt: 'What is the off-by-one or infinite loop bug, and how would you fix it?',
      bugType: 'off_by_one',
      fixedCodeSnippet: `def binary_search(arr, target):\n    low = 0\n    high = len(arr) - 1\n    while low <= high:\n        mid = (low + high) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            low = mid + 1\n        else:\n            high = mid - 1\n    return -1`,
      explanationOfBug: 'When arr[mid] < target, low must be updated to mid + 1, not mid, otherwise an infinite loop occurs when low + 1 == high.',
      evaluationCriteria: [
        'Identifies that "low = mid" (not "low = mid + 1") causes the infinite loop',
        'Fix advances low past mid to shrink the search window',
        'Explanation references the same off-by-one root cause as the fix',
      ],
      explanation: 'When arr[mid] < target, updating low to mid causes an infinite loop when low + 1 == high because mid rounds down and low never advances.',
    });
  }

  // 6. Arrange the Steps
  if (selectedTypes.includes('arrange_steps')) {
    if (isDSA) {
      list.push({
        id: `fb_arr_${batchNumber}_1`,
        type: 'arrange_steps',
        question: `Arrange the chronological execution steps of Quick Sort partition algorithm:`,
        topic,
        difficulty: 'medium',
        dimension: 'algorithmic_thinking',
        points: 15,
        contextTitle: 'QuickSort Lomuto Partition Algorithm',
        shuffledSteps: [
          { id: 's1', text: 'Choose the pivot element (e.g. last element of array)' },
          { id: 's2', text: 'Initialize index i pointing before the low boundary' },
          { id: 's3', text: 'Iterate pointer j from low to high - 1' },
          { id: 's4', text: 'If arr[j] <= pivot, increment i and swap arr[i] with arr[j]' },
          { id: 's5', text: 'Swap arr[i + 1] with arr[high] to place pivot at correct index' },
        ],
        correctOrderIds: ['s1', 's2', 's3', 's4', 's5'],
        explanation: 'QuickSort Lomuto partition places elements smaller than the pivot to the left, then inserts the pivot into its final sorted position.',
      });
    } else {
      list.push({
        id: `fb_arr_${batchNumber}_1`,
        type: 'arrange_steps',
        question: `Order the engineering lifecycle steps for implementing a new feature in ${topic}:`,
        topic,
        difficulty: 'medium',
        dimension: 'algorithmic_thinking',
        points: 15,
        contextTitle: 'Engineering Workflow Sequence',
        shuffledSteps: [
          { id: 's1', text: 'Analyze requirements and identify boundary constraints' },
          { id: 's2', text: 'Design interface contracts and choose optimal data structures' },
          { id: 's3', text: 'Write unit tests and test suites for edge cases' },
          { id: 's4', text: 'Implement core domain logic and error handlers' },
          { id: 's5', text: 'Profile performance, refactor, and review code' },
        ],
        correctOrderIds: ['s1', 's2', 's3', 's4', 's5'],
        explanation: 'Following systematic requirement analysis -> contract design -> test definition -> implementation -> optimization ensures resilient software.',
      });
    }
  }

  // 7. Explanations
  if (selectedTypes.includes('explanation')) {
    list.push({
      id: `fb_exp_${batchNumber}_1`,
      type: 'explanation',
      question: `In 2-3 clear sentences, explain how ${topic} achieves efficiency or reliability in real software applications:`,
      topic,
      difficulty: 'medium',
      dimension: 'concept',
      points: 15,
      rubricKeywords: ['efficiency', 'time complexity', 'trade-off', 'modularity', 'resource'],
      idealAnswerSummary: `${topic} optimizes computation and resource utilization through structured algorithms and memory locality, balancing execution speed against space complexity.`,
      minWordCount: 20,
      explanation: 'A strong conceptual explanation identifies the fundamental mechanism, resource trade-offs, and practical advantages in production systems.',
    });
  }

  return list;
}

export function getFallbackRoadmap(subjectTitle: string): RoadmapData {
  return {
    tagline: `Comprehensive mastery roadmap for ${subjectTitle}`,
    months: [
      {
        title: 'Month 1 — Core Foundations & Syntax',
        emoji: '🌱',
        topics: [
          { id: 'm1_t1', title: `${subjectTitle} Fundamentals & Setup`, status: 'available' },
          { id: 'm1_t2', title: 'Data Types & Flow Control', status: 'locked' },
          { id: 'm1_t3', title: 'Modular Architecture & Functions', status: 'locked' },
          { id: 'm1_t4', title: 'Error Handling & Invariant Assertions', status: 'locked' },
        ],
      },
      {
        title: 'Month 2 — Intermediate Patterns & System Design',
        emoji: '🌿',
        topics: [
          { id: 'm2_t1', title: 'Object & Memory Models', status: 'locked' },
          { id: 'm2_t2', title: 'Algorithms & Complexity Profiling', status: 'locked' },
          { id: 'm2_t3', title: 'Asynchronous Workflows & Concurrency', status: 'locked' },
          { id: 'm2_t4', title: 'Testing & Mocking Frameworks', status: 'locked' },
        ],
      },
      {
        title: 'Month 3 — Production Systems & Capstone',
        emoji: '🌳',
        topics: [
          { id: 'm3_t1', title: 'Microservices & API Integration', status: 'locked' },
          { id: 'm3_t2', title: 'Database Optimization & Indexing', status: 'locked' },
          { id: 'm3_t3', title: 'Security Best Practices & Auditing', status: 'locked' },
          { id: 'm3_t4', title: 'End-to-End Capstone Project', status: 'locked' },
        ],
      },
    ],
  };
}
