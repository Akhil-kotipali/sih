import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { getActiveSession, logoutUser } from './services/authService';
import { loadCurrentUser, saveCurrentUser } from './services/storageService';
import { DashboardScreen } from './components/DashboardScreen';
import { PracticeScreen } from './components/PracticeScreen';
import { RoadmapScreen } from './components/RoadmapScreen';
import { LiveResourcesSearch } from './components/LiveResourcesSearch';
import { AIMentorScreen } from './components/AIMentorScreen';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
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
  Settings,
  User as UserIcon,
  LogOut,
  Sparkles,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', icon: Home },
  { name: 'Practice', icon: Edit3, badge: 'Diagnostic' },
  { name: 'Roadmap', icon: Map, badge: 'Tracks' },
  { name: 'Resources', icon: Search, badge: 'Live' },
  { name: 'AI Mentor', icon: Bot },
];

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeNav, setActiveNav] = useState<string>('Dashboard');
  const [practiceTopic, setPracticeTopic] = useState<string>('Matrix Transformations & Eigenvalues');
  const [practiceSubjectId, setPracticeSubjectId] = useState<string>('Mathematics');
  const [resourceSearchQuery, setResourceSearchQuery] = useState<string>('Linear Algebra Matrix Invariants');
  const [roadmapSubject, setRoadmapSubject] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const [mentorContext, setMentorContext] = useState<{
    topic?: string;
    weakDimensions?: string[];
    masteryScore?: number;
  } | null>(null);

  // Initialize session on mount
  useEffect(() => {
    const session = getActiveSession();
    if (session?.user) {
      setUser(session.user);
    } else {
      const storedUser = loadCurrentUser();
      if (storedUser) {
        setUser(storedUser);
      } else {
        setAuthModalOpen(true);
      }
    }
  }, []);

  // Global shortcut for settings (Ctrl+Shift+K / Cmd+Shift+K / Ctrl+, / Cmd+,)
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

  const handleNavigate = (
    navName: string,
    extra?: {
      topic?: string;
      subjectId?: string;
      weakDimensions?: string[];
      masteryScore?: number;
    }
  ) => {
    let target = navName;
    if (navName === 'My Roadmap' || navName === 'Subjects') target = 'Roadmap';
    if (navName === 'Live Resources') target = 'Resources';

    setActiveNav(target);
    setSidebarOpen(false);

    if (target === 'Practice' && extra?.topic) {
      setPracticeTopic(extra.topic);
      if (extra.subjectId) setPracticeSubjectId(extra.subjectId);
    }
    if (target === 'Roadmap' && extra?.subjectId) {
      setRoadmapSubject(extra.subjectId);
    }
    if (target === 'Resources' && extra?.topic) {
      setResourceSearchQuery(extra.topic);
    }
    if (target === 'AI Mentor' && (extra?.topic || extra?.weakDimensions)) {
      setMentorContext({
        topic: extra.topic,
        weakDimensions: extra.weakDimensions,
        masteryScore: extra.masteryScore,
      });
    }
  };

  const handleUpdateUser = (updated: UserProfile) => {
    setUser(updated);
    saveCurrentUser(updated);
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setProfileModalOpen(false);
    setAuthModalOpen(true);
  };

  // If no user is logged in, present the mandatory AuthModal
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] text-slate-900 flex items-center justify-center p-4">
        <AuthModal
          isOpen={true}
          isMandatory={true}
          onAuthenticated={(authenticatedUser) => {
            setUser(authenticatedUser);
            setAuthModalOpen(false);
          }}
        />
      </div>
    );
  }

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
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-tight">
                  LearnPath
                </span>
                <span className="text-[11px] text-slate-400 font-semibold tracking-wide">
                  Adaptive Learning Platform
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 md:hidden cursor-pointer"
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
                  className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition cursor-pointer ${
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
                      className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                        isCurrent
                          ? 'bg-indigo-500 text-indigo-100'
                          : 'bg-indigo-50 text-indigo-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: User Card + Settings */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          {/* User Profile Capsule */}
          <div
            onClick={() => setProfileModalOpen(true)}
            className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition">
                  {user.name}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {user.preferences?.learningLevel || 'Level 1'} · {user.stats?.xp || 0} XP
                </div>
              </div>
            </div>

            <UserIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>AI & Platform Settings</span>
          </button>
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
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 md:hidden cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                {activeNav}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => handleNavigate('Resources', { topic: 'Differential Calculus & Rates' })}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 text-xs font-bold text-slate-700 bg-white cursor-pointer transition shadow-2xs"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              Live Resources
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-xl border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 bg-white cursor-pointer transition shadow-2xs"
              title="AI & System Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center cursor-pointer hover:bg-indigo-100 transition shadow-2xs"
              title="Account & Profile"
            >
              {user.name.charAt(0).toUpperCase()}
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
              onNavigateToResources={(top) => handleNavigate('Resources', { topic: top })}
              onNavigateToMentor={(top, weakDims, mastery) =>
                handleNavigate('AI Mentor', {
                  topic: top,
                  weakDimensions: weakDims,
                  masteryScore: mastery,
                })
              }
              onNavigateToRoadmap={(sid) =>
                handleNavigate('Roadmap', { subjectId: sid })
              }
              onUpdateUser={handleUpdateUser}
            />
          )}

          {activeNav === 'Roadmap' && (
            <RoadmapScreen
              user={user}
              initialSubject={roadmapSubject}
              onLaunchAssessment={(top, sid) =>
                handleNavigate('Practice', { topic: top, subjectId: sid })
              }
              onLaunchResourceSearch={(top) =>
                handleNavigate('Resources', { topic: top })
              }
              onLaunchMentor={(top) =>
                handleNavigate('AI Mentor', { topic: top })
              }
            />
          )}

          {activeNav === 'Resources' && (
            <LiveResourcesSearch
              user={user}
              initialQuery={resourceSearchQuery}
              onLaunchPracticeTopic={(top) =>
                handleNavigate('Practice', { topic: top })
              }
              onLaunchMentor={(top) =>
                handleNavigate('AI Mentor', { topic: top })
              }
            />
          )}

          {activeNav === 'AI Mentor' && (
            <AIMentorScreen
              user={user}
              initialContext={mentorContext}
              onLaunchPractice={(top) => handleNavigate('Practice', { topic: top })}
            />
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        onUserUpdated={handleUpdateUser}
        onLoggedOut={handleLogout}
      />
    </div>
  );
}
