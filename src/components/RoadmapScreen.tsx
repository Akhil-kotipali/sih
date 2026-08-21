import React, { useState, useEffect } from 'react';
import { UserProfile, RoadmapData, LearningGoal, RoadmapTopic } from '../types';
import { generateRoadmapAI } from '../services/aiService';
import {
  loadGeneratedRoadmaps,
  saveGeneratedRoadmap,
  loadAllTopicMastery,
  loadLearningGoals,
  saveLearningGoal,
  deleteLearningGoal,
} from '../services/storageService';
import {
  Map,
  Lock,
  CheckCircle2,
  AlertCircle,
  Play,
  Search,
  ExternalLink,
  Sparkles,
  Zap,
  Plus,
  Trash2,
  Layers,
  Bot,
  Target,
  GraduationCap,
  BookOpen,
  Compass,
  ArrowRight,
  Clock,
  Check,
} from 'lucide-react';

interface RoadmapScreenProps {
  user: UserProfile;
  initialSubject?: string;
  onLaunchAssessment: (topic: string, subjectId: string) => void;
  onLaunchResourceSearch: (topic: string) => void;
  onLaunchMentor?: (topic: string) => void;
}

export const RoadmapScreen: React.FC<RoadmapScreenProps> = ({
  user,
  initialSubject,
  onLaunchAssessment,
  onLaunchResourceSearch,
  onLaunchMentor,
}) => {
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [roadmaps, setRoadmaps] = useState<Record<string, RoadmapData>>({});
  const [activeSubject, setActiveSubject] = useState<string>('');
  const [masteryMap, setMasteryMap] = useState<Record<string, any>>({});

  const [isGenerating, setIsGenerating] = useState(false);
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [newDomainInput, setNewDomainInput] = useState('');
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user data
  useEffect(() => {
    if (!user?.id) return;
    const userGoals = loadLearningGoals(user.id);
    const userRoadmaps = loadGeneratedRoadmaps(user.id);
    const userMastery = loadAllTopicMastery(user.id);

    setGoals(userGoals);
    setRoadmaps(userRoadmaps);
    setMasteryMap(userMastery);

    if (initialSubject && (userGoals.some(g => g.subject === initialSubject || g.title === initialSubject) || userRoadmaps[initialSubject])) {
      setActiveSubject(initialSubject);
    } else if (userGoals.length > 0) {
      setActiveSubject(userGoals[0].subject || userGoals[0].title);
    } else {
      const keys = Object.keys(userRoadmaps);
      if (keys.length > 0) {
        setActiveSubject(keys[0]);
      }
    }
  }, [user?.id, initialSubject]);

  const currentRoadmap: RoadmapData | undefined = roadmaps[activeSubject];

  const handleGenerateRoadmap = async (subject: string, domain?: string) => {
    if (!subject.trim()) return;
    setError(null);
    setIsGenerating(true);

    try {
      const roadmap = await generateRoadmapAI(subject.trim());
      saveGeneratedRoadmap(subject.trim(), roadmap, user.id);

      // Also ensure a LearningGoal exists for this subject
      let existingGoal = goals.find((g) => g.subject === subject || g.title === subject);
      if (!existingGoal) {
        const newGoal: LearningGoal = {
          id: `goal_${Date.now()}`,
          userId: user.id,
          title: subject.trim(),
          subject: domain || subject.trim(),
          description: roadmap.tagline || `Mastery path for ${subject.trim()}`,
          targetDate: new Date(Date.now() + 30 * 86400000).toISOString(),
          dailyMinutes: user.preferences?.dailyStudyMinutes || 20,
          currentLevel: user.preferences?.learningLevel || 'Beginner',
          targetLevel: 'Mastery',
          status: 'in_progress',
          topicsTotal: roadmap.months.reduce((acc, m) => acc + (m.topics?.length || 0), 0) || 6,
          topicsCompleted: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveLearningGoal(newGoal);
        setGoals((prev) => [...prev, newGoal]);
      }

      setRoadmaps((prev) => ({ ...prev, [subject.trim()]: roadmap }));
      setActiveSubject(subject.trim());
      setNewSubjectInput('');
      setNewDomainInput('');
      setShowNewGoalModal(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate curriculum. Please check your API key in Settings.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteGoal = (goalId: string, subject: string) => {
    if (confirm(`Are you sure you want to remove the curriculum for "${subject}"?`)) {
      deleteLearningGoal(user.id, goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      const updated = { ...roadmaps };
      delete updated[subject];
      setRoadmaps(updated);
      const remainingKeys = Object.keys(updated);
      if (remainingKeys.length > 0) {
        setActiveSubject(remainingKeys[0]);
      } else {
        setActiveSubject('');
      }
    }
  };

  const domainStarters = [
    { title: 'Linear Algebra', domain: 'Mathematics', desc: 'Vector spaces, eigenvalues, matrix transformations' },
    { title: 'Organic Chemistry', domain: 'Chemistry', desc: 'Reaction mechanisms, functional groups, synthesis' },
    { title: 'Constitutional Law', domain: 'Law', desc: 'Judicial review, commerce clause, separation of powers' },
    { title: 'Corporate Finance', domain: 'Finance & Business', desc: 'DCF valuation, capital budgeting, WACC' },
    { title: 'Cellular & Molecular Biology', domain: 'Biology / MCAT', desc: 'Cell signaling, genetics, metabolism' },
    { title: 'Systems Architecture & Go', domain: 'Computer Science', desc: 'Concurrency, microservices, distributed systems' },
    { title: 'Spanish for Professionals (B2)', domain: 'Languages', desc: 'Advanced grammar, vocabulary, subjunctive mood' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-xs font-semibold text-indigo-300 mb-3">
              <Map className="w-3.5 h-3.5" />
              Adaptive Curricula & Goals
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Personalized Learning Roadmaps
            </h1>
            <p className="text-sm text-indigo-200 mt-1 max-w-2xl">
              Structured, phase-by-phase learning plans for any discipline. Track topic mastery, run diagnostic assessments, and access targeted resources.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewGoalModal(true)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Goal or Curriculum
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Sidebar: Subject/Goal Selector */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Your Curricula ({goals.length || Object.keys(roadmaps).length})
            </h3>
          </div>

          <div className="space-y-2">
            {goals.map((g) => {
              const isSelected = activeSubject === g.subject || activeSubject === g.title;
              return (
                <div
                  key={g.id}
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between group cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-2xs font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                  onClick={() => setActiveSubject(g.subject || g.title)}
                >
                  <div className="truncate pr-2">
                    <div className="text-xs font-bold truncate">{g.title}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{g.subject}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGoal(g.id, g.subject || g.title);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                    title="Delete Goal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Additional roadmaps not tied to explicit goal cards */}
            {Object.keys(roadmaps)
              .filter((k) => !goals.some((g) => g.subject === k || g.title === k))
              .map((subjectKey) => {
                const isSelected = activeSubject === subjectKey;
                return (
                  <div
                    key={subjectKey}
                    className={`p-3.5 rounded-2xl border transition flex items-center justify-between group cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-2xs font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                    onClick={() => setActiveSubject(subjectKey)}
                  >
                    <div className="text-xs font-bold truncate">{subjectKey}</div>
                  </div>
                );
              })}

            <button
              type="button"
              onClick={() => setShowNewGoalModal(true)}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-slate-500 hover:text-indigo-600 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create New Track
            </button>
          </div>
        </div>

        {/* Right 3 Columns: Active Roadmap Curriculum View */}
        <div className="lg:col-span-3 space-y-6">
          {currentRoadmap ? (
            <div className="space-y-6">
              {/* Roadmap Header Card */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {activeSubject}
                  </div>
                  <button
                    type="button"
                    onClick={() => onLaunchAssessment(activeSubject, activeSubject)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" /> Full Diagnostic Assessment
                  </button>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">{activeSubject} Mastery Track</h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {currentRoadmap.tagline || `Structured step-by-step curriculum for ${activeSubject}.`}
                </p>
              </div>

              {/* Phases / Months */}
              <div className="space-y-6">
                {(currentRoadmap.months || (currentRoadmap as any).phases || []).map(
                  (phase: any, phaseIdx: number) => (
                    <div
                      key={phase.title || phaseIdx}
                      className="p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl p-2 rounded-2xl bg-indigo-50 border border-indigo-100">
                          {phase.emoji || '🌱'}
                        </span>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">{phase.title}</h3>
                          {phase.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{phase.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Topics inside Phase */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {phase.topics?.map((topic: RoadmapTopic) => {
                          const topicMastery = masteryMap[topic.title] || masteryMap[topic.id];
                          const isMastered =
                            topic.status === 'mastered' || topicMastery?.status === 'mastered';
                          const isAvailable =
                            isMastered || topic.status === 'available' || topicMastery?.status === 'in_progress';

                          return (
                            <div
                              key={topic.id || topic.title}
                              className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
                                isMastered
                                  ? 'bg-emerald-50/40 border-emerald-200'
                                  : isAvailable
                                  ? 'bg-white border-slate-300 hover:border-indigo-400 hover:shadow-2xs'
                                  : 'bg-slate-50/70 border-slate-200 opacity-70'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-xs font-bold text-slate-900">{topic.title}</div>
                                  {topic.estimatedMinutes && (
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                      <Clock className="w-3 h-3" /> {topic.estimatedMinutes} mins
                                    </div>
                                  )}
                                </div>

                                {isMastered ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                                    <Check className="w-3 h-3" /> Mastered
                                  </span>
                                ) : !isAvailable ? (
                                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold shrink-0">
                                    Ready
                                  </span>
                                )}
                              </div>

                              {/* Topic Actions */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 text-xs">
                                <button
                                  type="button"
                                  onClick={() => onLaunchAssessment(topic.title, activeSubject)}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                                >
                                  <Play className="w-3 h-3" /> Practice
                                </button>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onLaunchResourceSearch(topic.title)}
                                    className="text-slate-400 hover:text-indigo-600 p-1 cursor-pointer"
                                    title="Search Learning Resources"
                                  >
                                    <Search className="w-3.5 h-3.5" />
                                  </button>
                                  {onLaunchMentor && (
                                    <button
                                      type="button"
                                      onClick={() => onLaunchMentor(topic.title)}
                                      className="text-slate-400 hover:text-violet-600 p-1 cursor-pointer"
                                      title="Ask AI Mentor"
                                    >
                                      <Bot className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-2xs">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
                <Compass className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No Roadmap Selected</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Select a track from the left or create a new curriculum for any subject, exam, or field.
              </p>
              <button
                type="button"
                onClick={() => setShowNewGoalModal(true)}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Create a Learning Roadmap →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Goal / Curriculum Modal */}
      {showNewGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Create New Learning Track</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewGoalModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerateRoadmap(newSubjectInput, newDomainInput);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject or Topic</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newSubjectInput}
                  onChange={(e) => setNewSubjectInput(e.target.value)}
                  placeholder="e.g. Econometrics, Organic Chemistry, French B1, Rust Systems..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Broader Academic Domain (Optional)</label>
                <input
                  type="text"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  placeholder="e.g. Economics, Chemistry, Languages, Computer Science..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Or select a popular template:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {domainStarters.map((s) => (
                    <button
                      key={s.title}
                      type="button"
                      onClick={() => handleGenerateRoadmap(s.title, s.domain)}
                      className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-left transition cursor-pointer"
                    >
                      <div className="text-xs font-bold text-slate-900">{s.title}</div>
                      <div className="text-[10px] text-slate-500">{s.domain}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewGoalModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? 'Synthesizing Curriculum...' : 'Generate Roadmap →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
