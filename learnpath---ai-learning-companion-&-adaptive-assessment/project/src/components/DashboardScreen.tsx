import React, { useState } from 'react';
import { UserProfile } from '../types';
import { callAI } from '../services/aiService';
import { loadAISettings, saveCurrentUser, syncAllToPostgres } from '../services/storageService';
import {
  BookOpen,
  Target,
  Flame,
  Star,
  ChevronRight,
  Bot,
  Send,
  Sparkles,
  Check,
  Play,
  Layers,
  ArrowRight,
  TrendingUp,
  Search,
  Database,
  RefreshCw,
} from 'lucide-react';

interface DashboardScreenProps {
  user: UserProfile;
  onNavigate: (tabName: string, extra?: { topic?: string; subjectId?: string }) => void;
  onUpdateUser: (updated: UserProfile) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  onNavigate,
  onUpdateUser,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleQuickSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncAllToPostgres();
      setSyncFeedback(res.success ? 'Synced to PostgreSQL' : 'Local Storage active (fallback)');
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch {
      setSyncFeedback('Local Storage fallback active');
      setTimeout(() => setSyncFeedback(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };
  const [dailyPlan, setDailyPlan] = useState([
    {
      id: 'p1',
      title: `${user.shortGoalLabels[user.shortGoals[0]] || 'DSA'} — Concept Revision`,
      time: '7:00 – 7:45 AM',
      tag: 'Short-term',
      status: 'done',
    },
    {
      id: 'p2',
      title: `${user.shortGoalLabels[user.shortGoals[1]] || 'Operating Systems'} — Practice Assessment`,
      time: '5:00 – 6:15 PM',
      tag: 'Practice',
      status: 'inprogress',
    },
    {
      id: 'p3',
      title: 'Placement Prep — 2 Algorithmic Questions (Timed)',
      time: '6:30 – 7:30 PM',
      tag: 'Long-term',
      status: 'pending',
    },
    {
      id: 'p4',
      title: 'System Design & Daily Summary Wrap-Up',
      time: '9:00 – 9:30 PM',
      tag: 'Wrap-up',
      status: 'pending',
    },
  ]);

  // AI Mentor Chat
  const [mentorInput, setMentorInput] = useState('');
  const [mentorLog, setMentorLog] = useState<{ who: 'user' | 'bot'; text: string }[]>([
    {
      who: 'bot',
      text: `Hi ${user.name.split(' ')[0]}! Ready to conquer today's study goals? I can explain tricky concepts or launch an adaptive assessment for you.`,
    },
  ]);
  const [mentorLoading, setMentorLoading] = useState(false);

  const toggleTask = (id: string) => {
    const order = ['pending', 'inprogress', 'done'];
    setDailyPlan((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const curIdx = order.indexOf(t.status);
        const next = order[(curIdx + 1) % order.length];
        return { ...t, status: next };
      })
    );
  };

  const handleSendMentor = async () => {
    const text = mentorInput.trim();
    if (!text || mentorLoading) return;

    const newLog = [...mentorLog, { who: 'user' as const, text }];
    setMentorLog(newLog);
    setMentorInput('');
    setMentorLoading(true);

    try {
      const aiSettings = loadAISettings();
      const prompt = `Student Name: ${user.name}. Short goals: ${user.shortGoals.map((g) => user.shortGoalLabels[g] || g).join(', ')}.
Student asked: "${text}"`;

      const res = await callAI(aiSettings.systemPrompts.mentor, prompt, { maxTokens: 400 });
      setMentorLog([...newLog, { who: 'bot', text: res.text || 'Keep practicing regularly!' }]);
    } catch {
      setMentorLog([
        ...newLog,
        {
          who: 'bot',
          text: `Great question! Focus on breaking down ${text} into core invariants and test cases. Try taking an adaptive assessment in the Practice tab.`,
        },
      ]);
    } finally {
      setMentorLoading(false);
    }
  };

  const primarySubjectId = user.shortGoals[0] || 'dsa';
  const primarySubjectTitle = user.shortGoalLabels[primarySubjectId] || 'Data Structures & Algorithms';
  const primaryProgress = user.stats.subjectProgress[primarySubjectId] || 65;

  const level = Math.max(1, Math.floor(user.stats.xp / 450) + 1);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-xs font-semibold text-indigo-300">
            <Sparkles className="w-3.5 h-3.5" />
            Adaptive Learning Companion Active
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Good morning, {user.name.split(' ')[0]} 👋
          </h1>
          <p className="text-indigo-200 text-sm max-w-xl">
            You're making great progress in <span className="text-white font-bold">{primarySubjectTitle}</span>. Let's conquer today's study milestones.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 z-10">
          <button
            type="button"
            onClick={handleQuickSync}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Sync local state with PostgreSQL database store"
          >
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : syncFeedback || 'Sync DB'}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('Practice', { topic: 'Binary Search Trees', subjectId: primarySubjectId })}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            Start Practice Assessment
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Topics Mastered</div>
            <div className="text-xl font-extrabold text-slate-900">{user.stats.topicsLearned}</div>
            <div className="text-[11px] text-emerald-600 font-bold mt-0.5">+3 this week</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Study Streak</div>
            <div className="text-xl font-extrabold text-slate-900">{user.stats.streak} Days</div>
            <div className="text-[11px] text-emerald-600 font-bold mt-0.5">Active streak 🔥</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total XP</div>
            <div className="text-xl font-extrabold text-slate-900">{user.stats.xp.toLocaleString()}</div>
            <div className="text-[11px] text-indigo-600 font-bold mt-0.5">+150 XP today</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Star className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Player Level</div>
            <div className="text-xl font-extrabold text-slate-900">Level {level}</div>
            <div className="text-[11px] text-slate-500 font-bold mt-0.5">Advanced Student</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Continue Learning + Daily Plan + AI Mentor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Continue Learning & Enrolled Subjects */}
        <div className="lg:col-span-2 space-y-6">
          {/* Continue Learning Widget */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Continue Learning
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('My Roadmap')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                View Full Roadmap <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                  Current Semester Focus
                </span>
                <h3 className="text-base font-bold text-slate-900">{primarySubjectTitle}</h3>
                <div className="flex items-center gap-3 pt-1">
                  <div className="w-36 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${primaryProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-700">{primaryProgress}% Complete</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('Practice', { topic: primarySubjectTitle, subjectId: primarySubjectId })}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 shrink-0"
              >
                Launch Assessment <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Subjects Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Your Enrolled Subjects</h2>
              <button
                type="button"
                onClick={() => onNavigate('Subjects')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Manage Subjects <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {user.shortGoals.slice(0, 4).map((id) => {
                const label = user.shortGoalLabels[id] || id;
                const progress = user.stats.subjectProgress[id] || 35;
                return (
                  <div
                    key={id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 bg-white transition space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{label}</div>
                        <div className="text-xs text-slate-500">Semester Core Course</div>
                      </div>
                      <span className="text-xs font-extrabold text-indigo-600">{progress}%</span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigate('Live Resources', { topic: label })}
                        className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                      >
                        <Search className="w-3 h-3" /> Live Resources
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('Practice', { topic: label, subjectId: id })}
                        className="text-[11px] font-bold text-indigo-600 hover:underline"
                      >
                        Practice Topic →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Daily Plan & AI Mentor Widget */}
        <div className="space-y-6">
          {/* AI Mentor Fast Chat */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-indigo-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">AI Mentor</h3>
                  <p className="text-[11px] text-indigo-300">Live Engineering Tutor</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {mentorLog.map((m, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl text-xs leading-relaxed ${
                    m.who === 'user'
                      ? 'bg-indigo-600 text-white ml-6'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700 mr-4'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {mentorLoading && (
                <div className="p-3 rounded-xl text-xs bg-slate-800 text-slate-400 italic animate-pulse">
                  AI Mentor is typing...
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={mentorInput}
                onChange={(e) => setMentorInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMentor()}
                placeholder="Ask your mentor anything..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={handleSendMentor}
                disabled={mentorLoading || !mentorInput.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Daily Schedule Plan */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Today's Study Plan</h3>
              <span className="text-[11px] font-semibold text-slate-400">Click circle to toggle</span>
            </div>

            <div className="space-y-2.5">
              {dailyPlan.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3 transition"
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition cursor-pointer ${
                      task.status === 'done'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : task.status === 'inprogress'
                        ? 'bg-indigo-100 border-indigo-600 text-indigo-700'
                        : 'bg-white border-slate-300 text-transparent'
                    }`}
                  >
                    {task.status === 'done' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    {task.status === 'inprogress' && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-xs font-bold leading-tight ${
                        task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{task.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
