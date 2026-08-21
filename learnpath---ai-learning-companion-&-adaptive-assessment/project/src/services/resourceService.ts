/**
 * Live Resource Search & Discovery Service
 * Fetches real-time learning materials, connects to verified hubs, and supports AI web search grounding.
 */

import { LiveResource } from '../types';
import { loadAISettings, loadBookmarkedResources } from './storageService';
import { callAI } from './aiService';

export interface SearchOptions {
  query: string;
  topic?: string;
  category?: 'all' | 'video' | 'documentation' | 'interactive' | 'practice' | 'article';
  difficulty?: string;
}

export const PLATFORM_SEARCH_HUBS = [
  {
    name: 'YouTube',
    category: 'video',
    icon: 'video',
    badge: 'Video Lessons',
    color: 'text-red-600 bg-red-50 border-red-200',
    buildUrl: (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' full tutorial engineering')}`,
  },
  {
    name: 'GeeksforGeeks',
    category: 'article',
    icon: 'book-open',
    badge: 'CS Articles',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    buildUrl: (q: string) => `https://www.geeksforgeeks.org/search/?q=${encodeURIComponent(q)}`,
  },
  {
    name: 'DevDocs / MDN',
    category: 'documentation',
    icon: 'file-text',
    badge: 'Official Specs',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    buildUrl: (q: string) => `https://devdocs.io/#q=${encodeURIComponent(q)}`,
  },
  {
    name: 'NPTEL / Swayam',
    category: 'video',
    icon: 'graduation-cap',
    badge: 'IIT / IISc Lectures',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    buildUrl: (q: string) => `https://nptel.ac.in/courses?q=${encodeURIComponent(q)}`,
  },
  {
    name: 'LeetCode / Practice',
    category: 'practice',
    icon: 'code',
    badge: 'Problem Sets',
    color: 'text-orange-700 bg-orange-50 border-orange-200',
    buildUrl: (q: string) => `https://leetcode.com/problemset/all/?search=${encodeURIComponent(q)}`,
  },
  {
    name: 'Coursera / edX',
    category: 'interactive',
    icon: 'award',
    badge: 'Guided Courses',
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    buildUrl: (q: string) => `https://www.coursera.org/search?query=${encodeURIComponent(q)}`,
  },
  {
    name: 'GitHub Awesome Lists',
    category: 'documentation',
    icon: 'github',
    badge: 'Curated Repos',
    color: 'text-slate-800 bg-slate-100 border-slate-300',
    buildUrl: (q: string) => `https://github.com/search?q=${encodeURIComponent('awesome ' + q)}`,
  },
];

export async function searchLiveResources(options: SearchOptions): Promise<{
  resources: LiveResource[];
  isLiveGrounding: boolean;
  hubLinks: { name: string; url: string; badge: string; color: string }[];
}> {
  const query = options.query.trim();
  const category = options.category || 'all';

  // 1. Generate direct hub launch links
  const hubLinks = PLATFORM_SEARCH_HUBS.map((hub) => ({
    name: hub.name,
    url: hub.buildUrl(query),
    badge: hub.badge,
    color: hub.color,
  }));

  // 2. Try server-side live resource grounding
  try {
    const res = await fetch('/api/resources/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topic: options.topic, category }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        const bookmarks = loadBookmarkedResources() || [];
        const bookmarkedUrls = new Set((bookmarks || []).map((b) => b?.url).filter(Boolean));

        const hydrated = (data.results || []).map((r: any, idx: number) => ({
          id: r?.id || `live_res_${idx}_${Date.now()}`,
          title: r?.title || query,
          source: r?.source || 'Curated Hub',
          type: r?.type || 'article',
          url: r?.url || hubLinks[0]?.url || '#',
          description: r?.description || '',
          difficulty: r?.difficulty || 'Intermediate',
          duration: r?.duration || '20 min',
          tags: Array.isArray(r?.tags) ? r.tags : [options.topic || query],
          isBookmarked: bookmarkedUrls.has(r?.url),
        }));

        return {
          resources: hydrated,
          isLiveGrounding: true,
          hubLinks,
        };
      }
    }
  } catch (err) {
    console.warn('Server resource search fallback triggered:', err);
  }

  // 3. Client-side AI grounding if API keys configured
  const settings = loadAISettings();
  if (settings.keys.gemini || settings.keys.anthropic || settings.keys.groq) {
    try {
      const prompt = `Search and curate 6 specific, high-quality technical resources for: "${query}".
Category filter: "${category}".
Format as a clean JSON array:
[
  {
    "title": "Clear Title",
    "source": "Platform Name",
    "type": "video" | "article" | "interactive" | "practice" | "documentation",
    "url": "Valid reference URL",
    "description": "2-sentence practical summary",
    "difficulty": "Beginner" | "Intermediate" | "Advanced",
    "duration": "e.g. 30 mins",
    "tags": ["tag1", "tag2"]
  }
]`;

      const aiRes = await callAI(settings.systemPrompts.resources, prompt, {
        jsonMode: true,
        maxTokens: 1200,
      });

      const parsed = JSON.parse(aiRes.text.replace(/```json/gi, '').replace(/```/g, '').trim());
      if (Array.isArray(parsed) && parsed.length > 0) {
        const bookmarks = loadBookmarkedResources() || [];
        const bookmarkedUrls = new Set((bookmarks || []).map((b) => b?.url).filter(Boolean));

        return {
          resources: (parsed || []).map((r, i) => ({
            ...r,
            id: r?.id || `ai_res_${i}_${Date.now()}`,
            isBookmarked: bookmarkedUrls.has(r?.url),
          })),
          isLiveGrounding: true,
          hubLinks,
        };
      }
    } catch (e) {
      console.warn('Client AI resource search failed, using curated synthesis:', e);
    }
  }

  // 4. Robust Curated Synthesis
  const bookmarks = loadBookmarkedResources() || [];
  const bookmarkedUrls = new Set((bookmarks || []).map((b) => b?.url).filter(Boolean));
  const fallback = (generateSynthesizedResources(query, options.topic, category) || []).map((r) => ({
    ...r,
    isBookmarked: bookmarkedUrls.has(r?.url),
  }));

  return {
    resources: fallback,
    isLiveGrounding: false,
    hubLinks,
  };
}

function generateSynthesizedResources(
  query: string,
  topic?: string,
  category?: string
): LiveResource[] {
  const term = topic || query || 'Engineering Foundations';

  const base: LiveResource[] = [
    {
      id: `syn_1_${term}`,
      title: `${term} — Complete Deep Dive & Visualized Architecture`,
      source: 'GeeksforGeeks',
      type: 'article',
      url: `https://www.geeksforgeeks.org/search/?q=${encodeURIComponent(term)}`,
      description: `Comprehensive conceptual breakdown with time complexity diagrams, structural invariances, and real code snippets.`,
      difficulty: 'Beginner',
      duration: '15 min read',
      tags: [term, 'Core Concept', 'Theory'],
    },
    {
      id: `syn_2_${term}`,
      title: `${term} — Step-by-Step Video Masterclass`,
      source: 'YouTube Education',
      type: 'video',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(term + ' tutorial lecture')}`,
      description: `Engaging animated walkthrough explaining mechanics, edge cases, and standard interview problems.`,
      difficulty: 'Intermediate',
      duration: '42 mins video',
      tags: [term, 'Video', 'Visual'],
    },
    {
      id: `syn_3_${term}`,
      title: `${term} Practice Problems & Competitive Coding Sets`,
      source: 'LeetCode / Practice Hub',
      type: 'practice',
      url: `https://leetcode.com/problemset/all/?search=${encodeURIComponent(term)}`,
      description: `Hands-on problems ranging from easy fundamentals to hard company interview challenges.`,
      difficulty: 'Intermediate',
      duration: '45 mins session',
      tags: [term, 'Hands-on', 'Practice'],
    },
    {
      id: `syn_4_${term}`,
      title: `${term} Official Technical Specification & Standards`,
      source: 'DevDocs / MDN',
      type: 'documentation',
      url: `https://devdocs.io/#q=${encodeURIComponent(term)}`,
      description: `Authoritative reference manual detailing API interfaces, standard library primitives, and runtime behavior.`,
      difficulty: 'Advanced',
      duration: 'Reference doc',
      tags: [term, 'Documentation', 'Reference'],
    },
    {
      id: `syn_5_${term}`,
      title: `IIT / IISc In-Depth Lecture Notes on ${term}`,
      source: 'NPTEL Swayam',
      type: 'video',
      url: `https://nptel.ac.in/courses?q=${encodeURIComponent(term)}`,
      description: `Rigorous academic lecture series from top Indian engineering institutes with mathematical proofs and assignments.`,
      difficulty: 'Advanced',
      duration: '55 mins lecture',
      tags: [term, 'Academic', 'GATE / Exam'],
    },
    {
      id: `syn_6_${term}`,
      title: `Curated Awesome Guide & Open-Source Projects for ${term}`,
      source: 'GitHub Awesome Lists',
      type: 'interactive',
      url: `https://github.com/search?q=${encodeURIComponent('awesome ' + term)}`,
      description: `Community-maintained compendium of repos, interactive playgrounds, cheatsheets, and production tools.`,
      difficulty: 'Intermediate',
      duration: 'Open Exploration',
      tags: [term, 'Open Source', 'Projects'],
    },
  ];

  if (category && category !== 'all') {
    return base.filter((r) => r.type === category);
  }
  return base;
}
