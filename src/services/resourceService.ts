/**
 * Domain-Agnostic Live Resource Search & Recommendation Service
 * Curates authoritative, publicly accessible learning materials across all educational fields,
 * supporting language filtering, duration filtering, user feedback, and bookmarking.
 */

import { LiveResource, ResourceFilterOptions, ResourceType } from '../types';
import {
  loadBookmarkedResources,
  loadUserResourceFeedback,
  saveUserResourceFeedback,
  toggleBookmarkResource,
  loadAISettings,
} from './storageService';
import { callAI } from './aiService';

export interface EducationalHub {
  name: string;
  category: ResourceType | 'all';
  icon: string;
  badge: string;
  color: string;
  description: string;
  domains: string[]; // 'all' or specific domains
  buildUrl: (query: string, lang?: string) => string;
}

export const UNIVERSAL_EDUCATIONAL_HUBS: EducationalHub[] = [
  {
    name: 'Khan Academy',
    category: 'interactive',
    icon: 'graduation-cap',
    badge: 'Free Mastery Lessons',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    description: 'Foundational lessons in Math, Science, Humanities, and Computing',
    domains: ['all'],
    buildUrl: (q) => `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(q)}`,
  },
  {
    name: 'YouTube Education',
    category: 'video',
    icon: 'video',
    badge: 'Video Lectures & Walkthroughs',
    color: 'text-red-700 bg-red-50 border-red-200',
    description: 'Global lectures, animated explanations, and practical walkthroughs',
    domains: ['all'],
    buildUrl: (q, lang) =>
      `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' lecture tutorial ' + (lang && lang !== 'en' ? lang : ''))}`,
  },
  {
    name: 'MIT OpenCourseWare',
    category: 'lecture',
    icon: 'book-open',
    badge: 'University Syllabi & Notes',
    color: 'text-amber-800 bg-amber-50 border-amber-200',
    description: 'Full course notes, problem sets, and exams from MIT faculty',
    domains: ['all'],
    buildUrl: (q) => `https://ocw.mit.edu/search/?q=${encodeURIComponent(q)}`,
  },
  {
    name: 'OpenStax / Textbooks',
    category: 'book',
    icon: 'book',
    badge: 'Peer-Reviewed Open Books',
    color: 'text-blue-800 bg-blue-50 border-blue-200',
    description: 'Free peer-reviewed college textbooks in science, math, business & social science',
    domains: ['all'],
    buildUrl: (q) => `https://openstax.org/search?q=${encodeURIComponent(q)}`,
  },
  {
    name: 'SWAYAM / NPTEL',
    category: 'course',
    icon: 'award',
    badge: 'IIT / University Courses',
    color: 'text-orange-700 bg-orange-50 border-orange-200',
    description: 'Indian university and institute accredited video lectures and transcripts',
    domains: ['all'],
    buildUrl: (q) => `https://nptel.ac.in/courses?q=${encodeURIComponent(q)}`,
  },
  {
    name: 'Coursera / edX',
    category: 'course',
    icon: 'award',
    badge: 'Structured Guided Courses',
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    description: 'University certified programs and specialization courses',
    domains: ['all'],
    buildUrl: (q) => `https://www.coursera.org/search?query=${encodeURIComponent(q)}`,
  },
  {
    name: 'Wikipedia Reference',
    category: 'article',
    icon: 'file-text',
    badge: 'Conceptual Encyclopedia',
    color: 'text-slate-800 bg-slate-100 border-slate-300',
    description: 'Comprehensive references, history, derivations, and cross-disciplinary links',
    domains: ['all'],
    buildUrl: (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
  },
];

export const PLATFORM_SEARCH_HUBS = UNIVERSAL_EDUCATIONAL_HUBS;

export async function searchLiveResources(options: ResourceFilterOptions): Promise<{
  resources: LiveResource[];
  isLiveGrounding: boolean;
  hubLinks: { name: string; url: string; badge: string; color: string; description: string }[];
}> {
  const query = (options.query || options.topic || 'Foundational Principles').trim();
  const selectedCategory = options.category || 'all';
  const selectedLanguage = options.language || 'English';

  // 1. Generate Hub Quick Launch Links
  const hubLinks = UNIVERSAL_EDUCATIONAL_HUBS.map((hub) => ({
    name: hub.name,
    url: hub.buildUrl(query, selectedLanguage),
    badge: hub.badge,
    color: hub.color,
    description: hub.description,
  }));

  let rawList: LiveResource[] = [];
  let isLive = false;

  // 2. Try server-side live resource grounding
  try {
    const res = await fetch('/api/resources/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        topic: options.topic,
        subject: options.subject,
        category: selectedCategory,
        language: selectedLanguage,
        difficulty: options.difficulty,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        rawList = data.results;
        isLive = true;
      }
    }
  } catch (err) {
    console.warn('Server resource grounding fallback triggered:', err);
  }

  // 3. Client AI grounding fallback if server endpoint unavailable & client key exists
  if (rawList.length === 0) {
    const settings = loadAISettings();
    if (settings.keys.gemini || settings.keys.anthropic || settings.keys.groq) {
      try {
        const prompt = `Search and curate 6 authoritative, real-world educational resources for topic: "${query}".
Language requested: "${selectedLanguage}".
Category: "${selectedCategory}".
Difficulty: "${options.difficulty || 'All'}".

Format strictly as JSON array of objects:
[
  {
    "title": "Precise Resource Title",
    "source": "Platform Name (e.g., Khan Academy, MIT OCW, YouTube Education, OpenStax, Wikipedia)",
    "type": "video" | "article" | "interactive" | "practice" | "documentation" | "book" | "course" | "lecture",
    "url": "Valid authoritative URL",
    "description": "2 concise sentences explaining what the learner will gain.",
    "difficulty": "Beginner" | "Intermediate" | "Advanced",
    "duration": "e.g. 15 min read or 35 min video",
    "durationMinutes": 20,
    "language": "${selectedLanguage}",
    "isFree": true,
    "tags": ["tag1", "tag2"]
  }
]`;
        const aiRes = await callAI(settings.systemPrompts.resources, prompt, { jsonMode: true });
        const parsed = JSON.parse(aiRes.text.replace(/```json/gi, '').replace(/```/g, '').trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          rawList = parsed;
          isLive = true;
        }
      } catch (e) {
        console.warn('Client AI resource search failed, using synthesized library:', e);
      }
    }
  }

  // 4. Synthesized fallback if no API
  if (rawList.length === 0) {
    rawList = generateDomainSynthesizedResources(query, options.subject, selectedLanguage);
  }

  // 5. Hydrate with User Feedback & Bookmarks + Apply Multi-dimensional Filters
  const bookmarks = loadBookmarkedResources() || [];
  const bookmarkedUrls = new Set(bookmarks.map((b) => b.url).filter(Boolean));
  const feedbackMap = loadUserResourceFeedback() || {};

  const hydrated = rawList
    .map((r, idx) => {
      const key = r.id || r.url || `res_${idx}`;
      const feedback: any = feedbackMap[key] || feedbackMap[r.url] || {};
      return {
        ...r,
        id: r.id || `res_${idx}_${Date.now()}`,
        isBookmarked: bookmarkedUrls.has(r.url) || Boolean(r.isBookmarked),
        isCompleted: Boolean(feedback.isCompleted),
        userRating: feedback.userRating || null,
        isHidden: Boolean(feedback.isHidden),
        isFree: r.isFree !== false,
      };
    })
    .filter((r) => !r.isHidden); // Exclude hidden items

  // Apply filters
  let filtered = hydrated;

  if (selectedCategory && selectedCategory !== 'all') {
    filtered = filtered.filter((r) => r.type === selectedCategory);
  }

  if (options.difficulty && options.difficulty !== 'all') {
    filtered = filtered.filter((r) => !r.difficulty || r.difficulty.toLowerCase() === options.difficulty?.toLowerCase());
  }

  if (options.duration && options.duration !== 'all') {
    filtered = filtered.filter((r) => {
      const mins = r.durationMinutes || extractMinutesFromDuration(r.duration);
      if (!mins) return true;
      if (options.duration === 'under_5') return mins < 5;
      if (options.duration === '5_15') return mins >= 5 && mins <= 15;
      if (options.duration === '15_30') return mins > 15 && mins <= 30;
      if (options.duration === '30_60') return mins > 30 && mins <= 60;
      if (options.duration === 'over_60') return mins > 60;
      return true;
    });
  }

  if (options.freeOnly) {
    filtered = filtered.filter((r) => r.isFree !== false);
  }

  // Deduplicate by URL
  const seenUrls = new Set<string>();
  const deduplicated: LiveResource[] = [];
  for (const item of filtered) {
    if (item.url && seenUrls.has(item.url)) continue;
    if (item.url) seenUrls.add(item.url);
    deduplicated.push(item);
  }

  return {
    resources: deduplicated,
    isLiveGrounding: isLive,
    hubLinks,
  };
}

function extractMinutesFromDuration(durationStr?: string): number | null {
  if (!durationStr) return null;
  const match = durationStr.match(/(\d+)\s*(?:min|m|hr|hour)/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (/hr|hour/i.test(durationStr)) return num * 60;
  return num;
}

export function generateDomainSynthesizedResources(
  query: string,
  subject?: string,
  language: string = 'English'
): LiveResource[] {
  const term = query || subject || 'Core Principles';

  return [
    {
      id: `syn_1_${encodeURIComponent(term)}`,
      title: `${term}: Complete Conceptual Overview & Mental Models`,
      source: 'Khan Academy / Open Education',
      type: 'interactive',
      url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(term)}`,
      description: `Comprehensive foundational guide breaking down governing definitions, real-world intuition, and practice checks.`,
      difficulty: 'Beginner',
      duration: '20 min interactive',
      durationMinutes: 20,
      language,
      isFree: true,
      tags: [term, 'Foundations', 'Intuition'],
    },
    {
      id: `syn_2_${encodeURIComponent(term)}`,
      title: `${term}: Visual Step-by-Step Masterclass & Derivations`,
      source: 'YouTube Education',
      type: 'video',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(term + ' full tutorial lecture')}`,
      description: `Engaging animated walkthrough explaining core mechanics, typical misunderstandings, and worked examples.`,
      difficulty: 'Intermediate',
      duration: '35 min video',
      durationMinutes: 35,
      language,
      isFree: true,
      tags: [term, 'Video', 'Visual'],
    },
    {
      id: `syn_3_${encodeURIComponent(term)}`,
      title: `University Lecture Series & Problem Sets on ${term}`,
      source: 'MIT OpenCourseWare',
      type: 'lecture',
      url: `https://ocw.mit.edu/search/?q=${encodeURIComponent(term)}`,
      description: `Rigorous academic lecture notes, assignments, and exam review problems from leading university faculty.`,
      difficulty: 'Advanced',
      duration: '50 min lecture',
      durationMinutes: 50,
      language,
      isFree: true,
      tags: [term, 'Academic', 'Rigorous'],
    },
    {
      id: `syn_4_${encodeURIComponent(term)}`,
      title: `${term} Open Textbook Chapter & Reference Guide`,
      source: 'OpenStax Peer-Reviewed Textbooks',
      type: 'book',
      url: `https://openstax.org/search?q=${encodeURIComponent(term)}`,
      description: `Authoritative textbook reading covering mathematical derivations, case analyses, and chapter review questions.`,
      difficulty: 'Intermediate',
      duration: '25 min read',
      durationMinutes: 25,
      language,
      isFree: true,
      tags: [term, 'Reading', 'Textbook'],
    },
    {
      id: `syn_5_${encodeURIComponent(term)}`,
      title: `Hands-on Drills & Practice Problems for ${term}`,
      source: 'Practice & Drill Hub',
      type: 'practice',
      url: `https://www.google.com/search?q=${encodeURIComponent(term + ' practice problems exercises with solutions')}`,
      description: `Targeted problem sets with instant step-by-step verification to test invariant retention and application.`,
      difficulty: 'Intermediate',
      duration: '30 min session',
      durationMinutes: 30,
      language,
      isFree: true,
      tags: [term, 'Practice', 'Hands-on'],
    },
    {
      id: `syn_6_${encodeURIComponent(term)}`,
      title: `Encyclopedia Reference & Cross-Disciplinary Context for ${term}`,
      source: 'Wikipedia Encyclopedia',
      type: 'article',
      url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(term)}`,
      description: `In-depth historical context, foundational theorems, formal notations, and primary literature citations.`,
      difficulty: 'Beginner',
      duration: '15 min read',
      durationMinutes: 15,
      language,
      isFree: true,
      tags: [term, 'Reference', 'Theory'],
    },
  ];
}

// User Feedback actions
export { toggleBookmarkResource };

export function markResourceCompleted(resourceId: string, url: string, completed: boolean = true): void {
  saveUserResourceFeedback(resourceId, url, { isCompleted: completed });
}

export function rateResourceHelpfulness(
  resourceId: string,
  url: string,
  rating: 'helpful' | 'not_helpful' | null
): void {
  saveUserResourceFeedback(resourceId, url, { userRating: rating });
}

export function hideResource(resourceId: string, url: string): void {
  saveUserResourceFeedback(resourceId, url, { isHidden: true });
}
