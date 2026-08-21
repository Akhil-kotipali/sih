import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import {
  loadCurrentUser,
  saveCurrentUser,
  DEMO_USER_PROFILE,
} from './services/storageService';
import { DashboardScreen } from './components/DashboardScreen';
import { PracticeScreen } from './components/PracticeScreen';
import { RoadmapScreen } from './components/RoadmapScreen';
import { LiveResourcesSearch } from './components/LiveResourcesSearch';
import { SubjectsScreen } from './components/SubjectsScreen';
import { AIMentorScreen } from './components/AIMentorScreen';
import { SettingsModal } from './components/SettingsModal';
import {
  Home,
  Map,
  Layers,
  Bot,
  Edit3,
  Search,
  Menu,
  X,
  BookOpen,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', icon: Home },
  { name: 'Practice', icon: Edit3, badge: 'Adaptive Assessment' },
  { name: 'My Roadmap', icon: Map },
  { name: 'Live Resources', icon: Search, badge: 'Live Grounding' },
  { name: 'Subjects', icon: Layers },
  { name: 'AI Mentor', icon: Bot },
];

export default function App() {
  const [user, setUser] = useState<UserProfile>(DEMO_USER_PROFILE);
  const [activeNav, setActiveNav] = useState<string>('Practice');
  const [practiceTopic, setPracticeTopic] = useState<string>('Binary Search Trees');
  const [practiceSubjectId, setPracticeSubjectId] = useState<string>('dsa');
  const [resourceSearchQuery, setResourceSearchQuery] = useState<string>('Data Structures & Algorithms');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load user from storage on mount
  useEffect(() => {
    const loaded = loadCurrentUser();
    if (loaded) setUser(loaded);
  }, []);

  // Global hidden shortcut: Ctrl+Shift+K / Cmd+Shift+K / Ctrl+, / Cmd+,
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (
        (isCmdOrCtrl && e.shiftKey && (e.key === 'K' || e.key === 'k' || e.key === 'S' || e.key === 's')) ||
        (isCmdOrCtrl && e.key === ',')
      ) {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (navName: string, extra?: { topic?: string; subjectId?: string }) => {
    setActiveNav(navName);
    setSidebarOpen(false);

    if (navName === 'Practice' && extra?.topic) {
      setPracticeTopic(extra.topic);
      if (extra.subjectId) setPracticeSubjectId(extra.subjectId);
    }
    if (navName === 'Live Resources' && extra?.topic) {
      setResourceSearchQuery(extra.topic);
    }
  };

  const handleUpdateUser = (updated: UserProfile) => {
    setUser(updated);
    saveCurrentUser(updated);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-900 flex font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 p-5 flex flex-col justify-between transition-transform duration-200 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-tight">
                  LearnPath
                </span>
                <span className="text-[11px] text-slate-400 font-semibold tracking-wide">
                  Adaptive Learning Companion
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const isCurrent = activeNav === item.name;
              const Icon = item.icon;

              return (
                <button
                  type="button"
                  key={item.name}
                  onClick={() => handleNavigate(item.name)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase ${
                        isCurrent
                          ? 'bg-indigo-500 text-indigo-100'
                          : 'bg-indigo-50 text-indigo-700'
                      }`}
                    >
                      {item.name === 'Practice' ? 'Assess' : 'Live'}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-slate-100">
          {/* User Profile Capsule */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {user.name.charAt(0)}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-slate-900 truncate">{user.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{user.year} · CS</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                {activeNav}
              </span>
              <span className="hidden sm:inline text-xs text-slate-400 ml-2">
                · {user.shortGoalLabels[user.shortGoals[0]] || 'Data Structures'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleNavigate('Live Resources', { topic: 'Data Structures' })}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 text-xs font-bold text-slate-700 bg-white cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              Live Search
            </button>
          </div>
        </header>

        {/* Dynamic Screen View */}
        <main className="p-4 sm:p-8 flex-1">
          {activeNav === 'Dashboard' && (
            <DashboardScreen
              user={user}
              onNavigate={handleNavigate}
              onUpdateUser={handleUpdateUser}
            />
          )}

          {activeNav === 'Practice' && (
            <PracticeScreen
              user={user}
              initialTopic={practiceTopic}
              initialSubjectId={practiceSubjectId}
              onNavigateToResources={(top) => handleNavigate('Live Resources', { topic: top })}
              onUpdateUser={handleUpdateUser}
            />
          )}

          {activeNav === 'My Roadmap' && (
            <RoadmapScreen
              user={user}
              onLaunchAssessment={(top, sid) =>
                handleNavigate('Practice', { topic: top, subjectId: sid })
              }
              onLaunchResourceSearch={(top) =>
                handleNavigate('Live Resources', { topic: top })
              }
            />
          )}

          {activeNav === 'Live Resources' && (
            <LiveResourcesSearch
              initialQuery={resourceSearchQuery}
              onLaunchPracticeTopic={(top) =>
                handleNavigate('Practice', { topic: top })
              }
            />
          )}

          {activeNav === 'Subjects' && (
            <SubjectsScreen
              user={user}
              onNavigateToPractice={(top, sid) =>
                handleNavigate('Practice', { topic: top, subjectId: sid })
              }
              onNavigateToResources={(top) =>
                handleNavigate('Live Resources', { topic: top })
              }
              onUpdateUser={handleUpdateUser}
            />
          )}

          {activeNav === 'AI Mentor' && (
            <AIMentorScreen
              user={user}
              onLaunchPractice={(top) => handleNavigate('Practice', { topic: top })}
            />
          )}
        </main>
      </div>

      {/* Hidden Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
