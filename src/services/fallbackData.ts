/**
 * Domain-Agnostic Fallback Data & Question Generator for LearnPath
 * Dynamically synthesizes high-yield diagnostic assessments across all 7 question types
 * and structured curricula for any domain (Science, Humanities, Languages, Engineering, Medicine, Law, Math, etc.).
 */

import { AssessmentQuestion, QuestionType, RoadmapData, RoadmapPhase } from '../types';

export function getFallbackBatch(
  topic: string,
  selectedTypes: QuestionType[],
  batchNumber: number
): AssessmentQuestion[] {
  const cleanTopic = topic.trim() || 'Core Foundations';
  const list: AssessmentQuestion[] = [];

  // 1. MCQ
  if (selectedTypes.includes('mcq')) {
    list.push({
      id: `fb_mcq_${batchNumber}_1`,
      type: 'mcq',
      question: `Which of the following best characterizes the foundational principle of ${cleanTopic}?`,
      topic: cleanTopic,
      difficulty: 'easy',
      dimension: 'concept',
      points: 10,
      options: [
        `Establishing structured invariants and systematic principles to model and solve domain problems`,
        `Relying purely on trial-and-error without theoretical or empirical validation`,
        `Ignoring boundary conditions, edge cases, and governing definitions`,
        `Treating all components as completely decoupled with zero shared state or interaction`,
      ],
      correctAnswer: 0,
      explanation: `${cleanTopic} builds upon explicit governing principles, structured invariants, and rigorous validation.`,
    });

    list.push({
      id: `fb_mcq_${batchNumber}_2`,
      type: 'mcq',
      question: `When analyzing complex scenarios or edge cases in ${cleanTopic}, what is the primary diagnostic focus?`,
      topic: cleanTopic,
      difficulty: 'medium',
      dimension: 'problem_solving',
      points: 10,
      options: [
        `Ignoring edge conditions until a complete failure occurs`,
        `Evaluating boundary state transitions, error propagation, and resource/constraint trade-offs`,
        `Assuming optimal conditions always hold in every practical setting`,
        `Eliminating all abstraction layers regardless of problem scale`,
      ],
      correctAnswer: 1,
      explanation: `Systematic problem-solving in ${cleanTopic} requires evaluating edge constraints, invariant preservation, and trade-offs.`,
    });
  }

  // 2. True / False
  if (selectedTypes.includes('true_false')) {
    list.push({
      id: `fb_tf_${batchNumber}_1`,
      type: 'true_false',
      question: `In ${cleanTopic}, thoroughly verifying boundary constraints and fundamental definitions is essential for avoiding catastrophic errors.`,
      topic: cleanTopic,
      difficulty: 'easy',
      dimension: 'concept',
      points: 10,
      correctAnswer: true,
      explanation: `Defensive reasoning and boundary verification are critical for correctness in ${cleanTopic}.`,
    });

    list.push({
      id: `fb_tf_${batchNumber}_2`,
      type: 'true_false',
      question: `In ${cleanTopic}, theoretical abstractions can completely ignore practical constraints and environmental trade-offs without consequence.`,
      topic: cleanTopic,
      difficulty: 'medium',
      dimension: 'application',
      points: 10,
      correctAnswer: false,
      explanation: `Applied mastery requires aligning high-level models with real-world constraints, limits, and environmental variables.`,
    });
  }

  // 3. Fill in the Blank
  if (selectedTypes.includes('fill_blank')) {
    list.push({
      id: `fb_fib_${batchNumber}_1`,
      type: 'fill_blank',
      question: `Complete the fundamental definition for ${cleanTopic}:`,
      topic: cleanTopic,
      difficulty: 'easy',
      dimension: 'concept',
      points: 10,
      template: `The systematic process of analyzing and decomposing ${cleanTopic} into measurable parts is known as {{blank}}.`,
      correctAnswers: ['analysis', 'decomposition', 'critical analysis', 'systematic analysis'],
      hint: 'A standard term for breaking down complex topics into constituents.',
      explanation: `Analysis and decomposition form the basis for deep comprehension and problem solving.`,
    });
  }

  // 4. Code / Problem Input
  if (selectedTypes.includes('code_input')) {
    const isProgramming = /(python|javascript|typescript|java|c\+\+|rust|sql|golang|coding|programming)/i.test(cleanTopic);
    list.push({
      id: `fb_code_${batchNumber}_1`,
      type: 'code_input',
      language: isProgramming ? 'python' : 'pseudocode',
      question: `Draft a clear procedure or implementation demonstrating the core operational step in ${cleanTopic}:`,
      topic: cleanTopic,
      difficulty: 'medium',
      dimension: 'implementation',
      points: 15,
      starterCode: isProgramming
        ? `# Solve the primary workflow for ${cleanTopic}\ndef solve(input_data):\n    # TODO: Implement step-by-step logic\n    pass\n`
        : `// Outline the step-by-step algorithm or procedure for ${cleanTopic}\nfunction process(context) {\n    // Define invariant and steps\n}\n`,
      expectedOutputOrPattern: `Valid structured execution respecting constraints of ${cleanTopic}`,
      evaluationCriteria: [
        'Handles initial state and empty inputs correctly',
        'Maintains invariant consistency throughout execution',
        'Returns or produces expected outcome with minimal overhead',
      ],
      explanation: `A correct solution structures input handling, iterates through the problem states, and guards against edge cases.`,
    });
  }

  // 5. Debugging / Error-Finding
  if (selectedTypes.includes('debugging')) {
    list.push({
      id: `fb_debug_${batchNumber}_1`,
      type: 'debugging',
      language: 'pseudocode',
      question: `Identify and correct the subtle logical flaw in this workflow for ${cleanTopic}:`,
      topic: cleanTopic,
      difficulty: 'medium',
      dimension: 'debugging',
      points: 15,
      buggyCode: `function execute_${cleanTopic.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}(items) {\n    let result = [];\n    for (let i = 0; i <= items.length; i++) {\n        result.push(items[i]);\n    }\n    return result;\n}`,
      bugDescriptionPrompt: `The loop condition i <= items.length accesses an out-of-bounds index on the final iteration.`,
      bugType: 'off_by_one',
      fixedCodeSnippet: `function execute_${cleanTopic.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}(items) {\n    let result = [];\n    for (let i = 0; i < items.length; i++) {\n        result.push(items[i]);\n    }\n    return result;\n}`,
      explanationOfBug: `Using <= instead of < results in an off-by-one index error on zero-indexed arrays/sequences.`,
      explanation: `Zero-indexed collections must be bounded by i < items.length to prevent index out of range exceptions.`,
      evaluationCriteria: [
        'Correctly changes loop condition to strictly less than length (i < items.length)',
        'Preserves output formatting and return statement',
      ],
    });
  }

  // 6. Arrange Steps
  if (selectedTypes.includes('arrange_steps')) {
    list.push({
      id: `fb_arr_${batchNumber}_1`,
      type: 'arrange_steps',
      question: `Arrange the logical stages for executing a complete analysis in ${cleanTopic}:`,
      topic: cleanTopic,
      difficulty: 'medium',
      dimension: 'algorithmic_thinking',
      points: 15,
      contextTitle: `Standard Execution Sequence for ${cleanTopic}`,
      shuffledSteps: [
        { id: 's1', text: '1. Formulate problem statement and identify governing constraints' },
        { id: 's2', text: '2. Deconstruct the problem into core components and choose methodology' },
        { id: 's3', text: '3. Execute step-by-step resolution while verifying intermediate invariants' },
        { id: 's4', text: '4. Validate edge cases, review results, and confirm final correctness' },
      ],
      correctOrderIds: ['s1', 's2', 's3', 's4'],
      explanation: `Systematic problem resolution always proceeds from initial problem formulation to deconstruction, execution, and boundary validation.`,
    });
  }

  // 7. Conceptual Explanation
  if (selectedTypes.includes('explanation')) {
    list.push({
      id: `fb_exp_${batchNumber}_1`,
      type: 'explanation',
      question: `Explain the core conceptual mechanism of ${cleanTopic} from first principles. How do its parts interact to produce the desired outcome?`,
      topic: cleanTopic,
      difficulty: 'medium',
      dimension: 'concept',
      points: 15,
      rubricKeywords: ['mechanism', 'principles', 'interaction', 'constraints', 'outcome'],
      idealAnswerSummary: `A rigorous explanation should articulate the fundamental premise of ${cleanTopic}, specify key constituent elements, explain their interactions, and highlight practical constraints or trade-offs.`,
      minWordCount: 25,
      explanation: `Deep mastery involves explaining not just what happens, but why each component is necessary and how invariants are preserved.`,
    });
  }

  return list;
}

export function getFallbackRoadmap(subjectOrGoal: string, targetLevel: string = 'Mastery'): RoadmapData {
  const title = subjectOrGoal.trim() || 'Personalized Learning Track';
  return {
    tagline: `Comprehensive step-by-step learning journey for ${title}`,
    subject: title,
    phases: [
      {
        title: 'Phase 1 — Foundations & Core Principles',
        emoji: '🌱',
        description: `Establish bedrock mental models, definitions, and essential vocabulary for ${title}.`,
        topics: [
          {
            id: `p1_t1`,
            title: `${title}: Fundamental Definitions & Concepts`,
            status: 'available',
            estimatedMinutes: 30,
            competencyFocus: ['Foundational Concepts', 'Core Vocabulary'],
          },
          {
            id: `p1_t2`,
            title: `${title}: Governing Invariants & Primary Frameworks`,
            status: 'locked',
            estimatedMinutes: 45,
            competencyFocus: ['Systematic Reasoning'],
          },
          {
            id: `p1_t3`,
            title: `${title}: Essential Tools, Notations & Methods`,
            status: 'locked',
            estimatedMinutes: 40,
            competencyFocus: ['Methodology', 'Application'],
          },
        ],
      },
      {
        title: 'Phase 2 — Core Mechanics & Applied Problem Solving',
        emoji: '🌿',
        description: `Deepen practical execution, handle common edge cases, and solve representative challenges.`,
        topics: [
          {
            id: `p2_t1`,
            title: `${title}: Intermediate Problem Solving & Standard Patterns`,
            status: 'locked',
            estimatedMinutes: 50,
            competencyFocus: ['Problem Solving', 'Pattern Recognition'],
          },
          {
            id: `p2_t2`,
            title: `${title}: Boundary Conditions & Error Analysis`,
            status: 'locked',
            estimatedMinutes: 45,
            competencyFocus: ['Debugging & Root Cause', 'Edge Cases'],
          },
          {
            id: `p2_t3`,
            title: `${title}: Comparative Analysis & Trade-offs`,
            status: 'locked',
            estimatedMinutes: 40,
            competencyFocus: ['Critical Evaluation'],
          },
        ],
      },
      {
        title: 'Phase 3 — Advanced Synthesis & Real-World Mastery',
        emoji: '🌳',
        description: `Tackle complex multi-variable scenarios, capstone projects, and exam/industry standards.`,
        topics: [
          {
            id: `p3_t1`,
            title: `${title}: Advanced Case Studies & Capstone Synthesis`,
            status: 'locked',
            estimatedMinutes: 60,
            competencyFocus: ['Advanced Synthesis', 'Independent Execution'],
          },
          {
            id: `p3_t2`,
            title: `${title}: Optimization, Strategy & Domain Best Practices`,
            status: 'locked',
            estimatedMinutes: 60,
            competencyFocus: ['Strategic Mastery'],
          },
        ],
      },
    ],
  };
}
