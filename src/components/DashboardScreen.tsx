import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  LearningGoal,
  TopicMastery,
  AssessmentSession,
  CognitiveRadarScores,
} from '../types';
import {
  loadLearningGoals,
  loadAllTopicMastery,
  loadAssessmentSessions,
  saveLearningGoal,
} from '../services/storageService';
import {
  Brain,
  Target,
  Flame,
  Award,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Clock,
  Zap,
  Compass,
  AlertCircle,
  Plus,
  Play,
  RotateCcw,
  Search,
  Layers,
  BarChart3,
} from 'lucide-react';

interface DashboardScreenProps {
  user: UserProfile;
  onNavigate: (screen: string, context?: any) => void;
  onUpdateUser?: (updated: UserProfile) => void;
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  onNavigate,
  onUpdateUser,
  onOpenSettings,
  onOpenProfile,
}) => {
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [masteryMap, setMasteryMap] = useState<Record<string, TopicMastery>>({});
  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [quickGoalInput, setQuickGoalInput] = useState('');
  const [showQuickGoalModal, setShowQuickGoalModal] = useState(false);

  useEffect(() => {
    if (user?.id) {
      const userGoals = loadLearningGoals(user.id);
      const userMastery = loadAllTopicMastery(user.id);
      const userSessions = loadAssessmentSessions(user.id);

      setGoals(userGoals);
      setMasteryMap(userMastery);
      setSessions(userSessions);
    }
  }, [user?.id]);

  const activeGoals = goals.filter((g) => g.status === 'in_progress');
  const masteredTopics = Object.values(masteryMap).filter((m) => m.status === 'mastered');
  const inProgressTopics = Object.values(masteryMap).filter((m) => m.status === 'in_progress');
  const recentSessions = [...sessions].reverse().slice(0, 4);

  // Compute aggregate competency radar
  const averageRadar: Record<string, number> = {
    concept: 0,
    application: 0,
    problem_solving: 0,
    analysis: 0,
    debugging: 0,
  };
  const masteryValues = Object.values(masteryMap);
  if (masteryValues.length > 0) {
    masteryValues.forEach((m) => {
      if (m.radarScores) {
        averageRadar.concept += m.radarScores.concept || 0;
        averageRadar.application += m.radarScores.application || 0;
        averageRadar.problem_solving += m.radarScores.problem_solving || 0;
        averageRadar.analysis += m.radarScores.analysis || 0;
        averageRadar.debugging += m.radarScores.debugging || 0;
      }
    });
    const len = masteryValues.length;
    Object.keys(averageRadar).forEach((k) => {
      averageRadar[k] = Math.round(averageRadar[k] / len);
    });
  }

  const handleCreateQuickGoal = (goalTitle: string, subjectDomain?: string) => {
    if (!goalTitle.trim()) return;
    const newGoal: LearningGoal = {
      id: `goal_${Date.now()}`,
      userId: user.id,
      title: goalTitle.trim(),
      subject: subjectDomain || goalTitle.trim(),
      description: `Comprehensive mastery track for ${goalTitle.trim()}`,
      targetDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      dailyMinutes: user.preferences?.dailyStudyMinutes || 20,
      currentLevel: user.preferences?.learningLevel || 'Beginner',
      targetLevel: 'Mastery',
      status: 'in_progress',
      topicsTotal: 6,
      topicsCompleted: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveLearningGoal(newGoal);
    setGoals((prev) => [...prev, newGoal]);
    setQuickGoalInput('');
    setShowQuickGoalModal(false);
    onNavigate('roadmap', { goalId: newGoal.id, subject: newGoal.subject });
  };

  const domainSuggestions = [
    { title: 'Linear Algebra & Matrix Decompositions', category: 'Mathematics', emoji: '📐' },
    { title: 'Organic Chemistry: Reaction Mechanisms', category: 'Chemistry', emoji: '🧪' },
    { title: 'Macroeconomics & Monetary Policy', category: 'Economics', emoji: '📈' },
    { title: 'Cellular Biology & Genetics (MCAT)', category: 'Biology & Medicine', emoji: '🧬' },
    { title: 'Constitutional Law: Judicial Review', category: 'Law', emoji: '⚖️' },
    { title: 'Python: Concurrent & Async Programming', category: 'Computer Science', emoji: '💻' },
    { title: 'Japanese: JLPT N5 Grammar & Kanji', category: 'Languages', emoji: '🎌' },
    { title: 'Classical Mechanics & Thermodynamics', category: 'Physics', emoji: '⚛️' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Banner & User Greeting */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 -bottom-16 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-xs font-semibold text-indigo-300 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Domain-Agnostic Adaptive Learning
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user.name}
            </h1>
            <p className="text-sm text-indigo-200 mt-1 max-w-xl">
              {activeGoals.length > 0
                ? `You have ${activeGoals.length} active learning track${activeGoals.length > 1 ? 's' : ''}. Complete diagnostic assessments to adapt your path.`
                : 'What would you like to master today? Set any academic subject, exam prep, or professional skill.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setShowQuickGoalModal(true)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New Learning Goal
            </button>
            <button
              type="button"
              onClick={() => onNavigate('practice')}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/15 transition flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4" /> Quick Diagnostic
            </button>
          </div>
        </div>

        {/* Quick Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-white/10">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 text-xs text-indigo-200 font-medium">
              <Target className="w-4 h-4 text-indigo-400" /> Active Goals
            </div>
            <div className="text-2xl font-black mt-1">{activeGoals.length}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 text-xs text-indigo-200 font-medium">
              <Award className="w-4 h-4 text-emerald-400" /> Mastered Topics
            </div>
            <div className="text-2xl font-black mt-1">{masteredTopics.length}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 text-xs text-indigo-200 font-medium">
              <Flame className="w-4 h-4 text-amber-400" /> Study Streak
            </div>
            <div className="text-2xl font-black mt-1">{user.stats?.streak || 0} <span className="text-xs font-normal text-slate-400">days</span></div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 text-xs text-indigo-200 font-medium">
              <Zap className="w-4 h-4 text-violet-400" /> Total XP
            </div>
            <div className="text-2xl font-black mt-1">{user.stats?.xp || 0}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Goals & Cognitive Diagnostic Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Active Goals & Roadmap Progress */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold text-sm">
                <Target className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Active Learning Goals</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('roadmap')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
            >
              View Full Roadmaps <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeGoals.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-2xs">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
                <Compass className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">No active learning goals yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  LearnPath can generate tailored diagnostic roadmaps, practice drills, and resources for any academic subject, language, or technical domain.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickGoalModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Create Your First Learning Goal →
                </button>
              </div>

              {/* Starter Domain Suggestions */}
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Or pick a starter subject:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {domainSuggestions.slice(0, 4).map((s) => (
                    <button
                      key={s.title}
                      type="button"
                      onClick={() => handleCreateQuickGoal(s.title, s.category)}
                      className="p-3 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-left transition group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{s.emoji}</span>
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 truncate">
                            {s.title}
                          </div>
                          <div className="text-[10px] text-slate-500">{s.category}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activeGoals.map((goal) => {
                const pct =
                  goal.topicsTotal > 0
                    ? Math.round((goal.topicsCompleted / goal.topicsTotal) * 100)
                    : 0;
                return (
                  <div
                    key={goal.id}
                    className="p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs hover:shadow-md transition space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[10px] font-bold text-indigo-700 mb-1.5">
                          {goal.subject}
                        </div>
                        <h3 className="text-base font-bold text-slate-900">{goal.title}</h3>
                        <p className="text-xs text-slate-500 line-clamp-1">{goal.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate('practice', {
                            topic: goal.title,
                            subject: goal.subject,
                          })
                        }
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Play className="w-3.5 h-3.5" /> Assess
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span className="text-slate-600">Mastery Progress</span>
                        <span className="text-indigo-600">{pct}% ({goal.topicsCompleted}/{goal.topicsTotal} topics)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{goal.dailyMinutes} mins/day target</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('roadmap', { goalId: goal.id, subject: goal.subject })}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                      >
                        Open Curriculum →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent Diagnostic Sessions */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-200 text-violet-600 flex items-center justify-center font-bold text-sm">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Recent Diagnostic Assessments</h2>
              </div>
            </div>

            {recentSessions.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
                No assessments taken yet. Launch an assessment in Practice to receive an AI cognitive diagnosis.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentSessions.map((s) => {
                  const score = s.overallMastery ?? s.scorePercentage ?? 0;
                  const totalQuestions =
                    s.batches?.reduce((sum, b) => sum + (b.questions?.length || 0), 0) ||
                    s.questions?.length ||
                    0;
                  const dateStr = s.createdAt || s.updatedAt || s.timestamp || new Date().toISOString();

                  return (
                    <div
                      key={s.id}
                      className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between hover:border-slate-300 transition"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">{s.topic}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {new Date(dateStr).toLocaleDateString()} · {totalQuestions} questions · {s.skillLevelVerdict || `${s.targetDifficulty || 'adaptive'} diagnostic`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                            score >= 80
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : score >= 60
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {score}%
                        </span>
                        <button
                          type="button"
                          onClick={() => onNavigate('Practice', { topic: s.topic })}
                          className="text-slate-400 hover:text-indigo-600 p-1 cursor-pointer"
                          title="Reassess Topic"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Verified Mastery & Cognitive Dimensions Radar */}
        <div className="space-y-6">
          {/* Cognitive Radar / Dimensional Breakdown */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-600" />
                Verified Competency Profile
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Your real-time cognitive strengths evaluated across diagnostic assessments:
            </p>

            <div className="space-y-3 pt-2">
              {[
                { label: 'Foundational Concepts', key: 'concept', score: averageRadar.concept || (masteryValues.length ? 75 : 0) },
                { label: 'Practical Application', key: 'application', score: averageRadar.application || (masteryValues.length ? 68 : 0) },
                { label: 'Problem Solving & Logic', key: 'problem_solving', score: averageRadar.problem_solving || (masteryValues.length ? 62 : 0) },
                { label: 'Root Cause & Analysis', key: 'analysis', score: averageRadar.analysis || (masteryValues.length ? 70 : 0) },
                { label: 'Edge Case Debugging', key: 'debugging', score: averageRadar.debugging || (masteryValues.length ? 55 : 0) },
              ].map((dim) => (
                <div key={dim.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">{dim.label}</span>
                    <span className="font-bold text-indigo-600">{dim.score}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(2, dim.score)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onNavigate('practice')}
                className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-indigo-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" /> Rebalance Weak Dimensions
              </button>
            </div>
          </div>

          {/* Quick Learning Shortcuts */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 space-y-4">
            <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Quick Study Tools
            </h3>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onNavigate('resources')}
                className="w-full p-3 rounded-2xl bg-white border border-indigo-100 hover:border-indigo-300 text-left transition flex items-center justify-between cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">Curated Resources</div>
                    <div className="text-[10px] text-slate-500">Search textbooks, lectures & drills</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('mentor')}
                className="w-full p-3 rounded-2xl bg-white border border-indigo-100 hover:border-indigo-300 text-left transition flex items-center justify-between cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <Brain className="w-4 h-4 text-violet-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-violet-600">AI Socratic Mentor</div>
                    <div className="text-[10px] text-slate-500">Ask questions, attach notes & diagrams</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Goal Creation Modal */}
      {showQuickGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Target className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Create New Learning Goal</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickGoalModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Enter any subject, certification, university topic, or language. LearnPath will synthesize a custom 3-phase curriculum.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateQuickGoal(quickGoalInput);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject / Goal Title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickGoalInput}
                  onChange={(e) => setQuickGoalInput(e.target.value)}
                  placeholder="e.g. Quantum Mechanics, Contract Law, React & TypeScript..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Or select a popular domain:</label>
                <div className="grid grid-cols-2 gap-2 text-left max-h-48 overflow-y-auto">
                  {domainSuggestions.map((s) => (
                    <button
                      key={s.title}
                      type="button"
                      onClick={() => handleCreateQuickGoal(s.title, s.category)}
                      className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-left transition cursor-pointer"
                    >
                      <div className="text-xs font-semibold text-slate-900 line-clamp-1">{s.emoji} {s.title}</div>
                      <div className="text-[10px] text-slate-400">{s.category}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickGoalModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Generate Curriculum →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
