import React, { useState, useEffect } from 'react';
import { UserProfile, RoadmapData } from '../types';
import { generateRoadmapAI } from '../services/aiService';
import {
  loadGeneratedRoadmaps,
  saveGeneratedRoadmap,
  loadAllTopicMastery,
} from '../services/storageService';
import {
  Map,
  Lock,
  CheckCircle2,
  AlertCircle,
  Play,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
} from 'lucide-react';

interface RoadmapScreenProps {
  user: UserProfile;
  onLaunchAssessment: (topic: string, subjectId: string) => void;
  onLaunchResourceSearch: (topic: string) => void;
}

// Curated foundation roadmaps
const CURATED_ROADMAPS: Record<string, RoadmapData> = {
  dsa: {
    tagline: 'Foundations of Data Structures, Algorithms, and Interview Patterns',
    months: [
      {
        title: 'Month 1 — Foundational DSA & Arrays',
        emoji: '🌱',
        topics: [
          { id: 'dsa_m1_1', title: 'Arrays & Dynamic Arrays', status: 'mastered', masteryScore: 90 },
          { id: 'dsa_m1_2', title: 'Two Pointers & Sliding Window', status: 'available', masteryScore: 70 },
          { id: 'dsa_m1_3', title: 'Hash Tables & Set Operations', status: 'locked' },
          { id: 'dsa_m1_4', title: 'Recursion & Backtracking', status: 'locked' },
          { id: 'dsa_m1_5', title: 'Sorting & Binary Search', status: 'locked' },
        ],
      },
      {
        title: 'Month 2 — Non-Linear Data Structures',
        emoji: '🌿',
        topics: [
          { id: 'dsa_m2_1', title: 'Singly & Doubly Linked Lists', status: 'locked' },
          { id: 'dsa_m2_2', title: 'Stacks & Monotonic Queues', status: 'locked' },
          { id: 'dsa_m2_3', title: 'Binary Trees & BST Traversals', status: 'locked' },
          { id: 'dsa_m2_4', title: 'Min/Max Heaps & Priority Queues', status: 'locked' },
          { id: 'dsa_m2_5', title: 'Greedy Algorithms', status: 'locked' },
        ],
      },
      {
        title: 'Month 3 — Advanced Graphs & Dynamic Programming',
        emoji: '🌳',
        topics: [
          { id: 'dsa_m3_1', title: 'Graph BFS, DFS & Topological Sort', status: 'locked' },
          { id: 'dsa_m3_2', title: 'Shortest Path (Dijkstra & Bellman-Ford)', status: 'locked' },
          { id: 'dsa_m3_3', title: '1D & 2D Dynamic Programming Patterns', status: 'locked' },
          { id: 'dsa_m3_4', title: 'Tries & Bit Manipulation', status: 'locked' },
        ],
      },
    ],
  },
  os: {
    tagline: 'Operating System Architecture, Concurrency, and Kernel Subsystems',
    months: [
      {
        title: 'Month 1 — Processes & CPU Scheduling',
        emoji: '🌱',
        topics: [
          { id: 'os_m1_1', title: 'Process Lifecycle & PCB', status: 'mastered', masteryScore: 85 },
          { id: 'os_m1_2', title: 'CPU Scheduling Algorithms (FCFS, SJF, RR)', status: 'available' },
          { id: 'os_m1_3', title: 'Threads & POSIX Concurrency', status: 'locked' },
          { id: 'os_m1_4', title: 'Deadlock Conditions & Banker’s Algorithm', status: 'locked' },
        ],
      },
      {
        title: 'Month 2 — Memory & Storage Subsystems',
        emoji: '🌿',
        topics: [
          { id: 'os_m2_1', title: 'Paging, Segmentation & TLB', status: 'locked' },
          { id: 'os_m2_2', title: 'Virtual Memory & Page Replacement', status: 'locked' },
          { id: 'os_m2_3', title: 'File Systems & Inode Architecture', status: 'locked' },
          { id: 'os_m2_4', title: 'Device Management & I/O Scheduling', status: 'locked' },
        ],
      },
    ],
  },
  placement: {
    tagline: 'Technical Interview Preparation, System Design & Aptitude Mastery',
    months: [
      {
        title: 'Phase 1 — Coding Rounds & Core CS Revision',
        emoji: '🎯',
        topics: [
          { id: 'pl_m1_1', title: 'DSA High-Frequency Interview Problems', status: 'mastered', masteryScore: 92 },
          { id: 'pl_m1_2', title: 'Operating Systems & DBMS Core Interview Questions', status: 'available' },
          { id: 'pl_m1_3', title: 'Computer Networks & HTTP Protocol Deep Dive', status: 'locked' },
        ],
      },
      {
        title: 'Phase 2 — System Design & Behavioral Rounds',
        emoji: '💼',
        topics: [
          { id: 'pl_m2_1', title: 'Low-Level Object-Oriented Design', status: 'locked' },
          { id: 'pl_m2_2', title: 'High-Level System Design (Caching, Load Balancing)', status: 'locked' },
          { id: 'pl_m2_3', title: 'STAR Method & Behavioral Mock Interviews', status: 'locked' },
        ],
      },
    ],
  },
};

export const RoadmapScreen: React.FC<RoadmapScreenProps> = ({
  user,
  onLaunchAssessment,
  onLaunchResourceSearch,
}) => {
  const shortGoals = user.shortGoals.length > 0 ? user.shortGoals : ['dsa'];
  const [activeTab, setActiveTab] = useState<string>(shortGoals[0]);
  const [roadmaps, setRoadmaps] = useState<Record<string, RoadmapData>>(CURATED_ROADMAPS);
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({
    '0': true,
    '1': true,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [topicMasteryMap, setTopicMasteryMap] = useState<Record<string, any>>({});
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadGeneratedRoadmaps();
    setRoadmaps((prev) => ({ ...prev, ...saved }));
    setTopicMasteryMap(loadAllTopicMastery());
  }, []);

  const activeTitle = user.shortGoalLabels[activeTab] || activeTab;
  let activeRoadmap = roadmaps[activeTab];

  // Auto-generate if roadmap doesn't exist
  useEffect(() => {
    if (!activeRoadmap && !isGenerating) {
      handleGenerateRoadmap(activeTab, activeTitle);
    }
  }, [activeTab]);

  const handleGenerateRoadmap = async (id: string, title: string) => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const generated = await generateRoadmapAI(title);
      setRoadmaps((prev) => {
        const updated = { ...prev, [id]: generated };
        saveGeneratedRoadmap(id, generated);
        return updated;
      });
    } catch (e: any) {
      console.error('Failed to generate roadmap:', e);
      setGenerationError(
        e?.message || 'AI Inference failed to generate this roadmap. Configure your API key in Settings (Ctrl+Shift+K).'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleMonth = (mIdx: number) => {
    setOpenMonths((prev) => ({ ...prev, [mIdx]: !prev[mIdx] }));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-1">
              <Map className="w-3.5 h-3.5" />
              Curriculum Mastery & Progress Engine
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Personalized Engineering Roadmaps
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Take assessments on any topic to unlock sequential milestones and track domain mastery.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2">
          {(shortGoals || []).map((id) => {
            const label = user.shortGoalLabels?.[id] || id;
            const isSelected = activeTab === id;
            return (
              <button
                type="button"
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition shrink-0 cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                }`}
              >
                {label}
              </button>
            );
          })}

          {(user.longGoals || []).map((id) => {
            const label = id === 'skill' ? user.skillName || 'Skill Prep' : id.toUpperCase() + ' Prep';
            const isSelected = activeTab === id;
            return (
              <button
                type="button"
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition shrink-0 cursor-pointer ${
                  isSelected
                    ? 'border-purple-600 bg-purple-600 text-white shadow-xs'
                    : 'border-slate-200 bg-purple-50 text-purple-800 hover:border-purple-300'
                }`}
              >
                ⭐ {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error state */}
      {generationError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-900 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="text-xs">
              <span className="font-bold block text-sm">Roadmap Synthesis Failed</span>
              <span className="text-rose-700">{generationError}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleGenerateRoadmap(activeTab, activeTitle)}
            className="text-xs font-bold text-rose-700 hover:text-rose-900 px-3 py-1.5 bg-rose-100 rounded-xl cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isGenerating && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
          <div className="w-8 h-8 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            Generating In-Depth Curriculum for "{activeTitle}"...
          </h3>
          <p className="text-xs text-slate-400">Synthesizing milestones and key topics</p>
        </div>
      )}

      {/* Active Roadmap Timeline */}
      {activeRoadmap && !isGenerating && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 font-medium">
            💡 {activeRoadmap.tagline}
          </div>

          <div className="space-y-4">
            {(activeRoadmap.months || []).map((month, mIdx) => {
              const isOpen = openMonths[mIdx] !== false;
              const topics = month?.topics || [];
              const masteredCount = topics.filter(
                (t) =>
                  t?.status === 'mastered' ||
                  topicMasteryMap[`${activeTab}:${(t?.title || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}`]?.status === 'mastered'
              ).length;
              const monthPct = Math.round((masteredCount / Math.max(1, topics.length)) * 100);

              return (
                <div
                  key={mIdx}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => toggleMonth(mIdx)}
                    className="w-full p-4 sm:p-5 bg-slate-50 hover:bg-slate-100/80 transition flex items-center justify-between gap-3 text-left cursor-pointer border-b border-slate-200/60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{month.emoji || '🌱'}</span>
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                          {month.title}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {masteredCount} of {topics.length} topics mastered
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full"
                            style={{ width: `${monthPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700">{monthPct}%</span>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 sm:p-6 divide-y divide-slate-100 space-y-3">
                      {(topics || []).map((t, tIdx) => {
                        const masteryRecord =
                          topicMasteryMap[`${activeTab}:${(t?.title || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}`];
                        const isMastered = t.status === 'mastered' || masteryRecord?.status === 'mastered';
                        const isLocked = t.status === 'locked' && !isMastered;

                        return (
                          <div
                            key={t.id || tIdx}
                            className={`pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isLocked ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {isMastered ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Mastered ({masteryRecord?.masteryScore || 85}%)
                                  </span>
                                ) : isLocked ? (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center gap-1">
                                    <Lock className="w-3 h-3" /> Locked
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> Ready for Assessment
                                  </span>
                                )}
                              </div>
                              <div className="font-bold text-sm text-slate-900">{t.title}</div>
                            </div>

                            <div className="flex items-center gap-2 pt-1 sm:pt-0">
                              <button
                                type="button"
                                onClick={() => onLaunchResourceSearch(t.title)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 text-xs font-semibold flex items-center gap-1"
                              >
                                <Search className="w-3.5 h-3.5" /> Resources
                              </button>

                              <button
                                type="button"
                                onClick={() => onLaunchAssessment(t.title, activeTab)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition ${
                                  isMastered
                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                              >
                                <Play className="w-3 h-3 fill-current" />
                                {isMastered ? 'Retake Test' : 'Take Assessment'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
