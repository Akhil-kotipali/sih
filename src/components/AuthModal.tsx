import React, { useState } from 'react';
import { UserProfile, AuthSession } from '../types';
import { registerUser, loginUser } from '../services/authService';
import {
  Brain,
  Sparkles,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  GraduationCap,
} from 'lucide-react';
import { SUPPORTED_UI_LANGUAGES, SUPPORTED_LEARNING_LANGUAGES } from '../services/i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onAuthenticated: (user: UserProfile) => void;
  initialMode?: 'login' | 'register';
  isMandatory?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  initialMode = 'login',
  isMandatory = false,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [learningDomain, setLearningDomain] = useState('');
  const [dailyMinutes, setDailyMinutes] = useState(20);
  const [learningLanguage, setLearningLanguage] = useState('en');
  const [uiLanguage, setUiLanguage] = useState('en');
  const [explanationStyle, setExplanationStyle] = useState<'First Principles' | 'Socratic' | 'Direct & Practical' | 'Visual & Intuitive'>('First Principles');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        const res = await registerUser({
          name,
          email,
          password,
          preferences: {
            uiLanguage,
            learningLanguage,
            resourceLanguages: [learningLanguage, 'en'],
            dailyStudyMinutes: dailyMinutes,
            explanationStyle,
          },
        });

        if (res.success && res.session) {
          onAuthenticated(res.session.user);
          if (onClose) onClose();
        } else {
          setError(res.error || 'Registration failed. Please check your information.');
        }
      } else {
        const res = await loginUser({ email, password });
        if (res.success && res.session) {
          onAuthenticated(res.session.user);
          if (onClose) onClose();
        } else {
          setError(res.error || 'Invalid email or password.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-8">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 p-6 sm:p-8 text-white relative">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-xs font-semibold text-indigo-300">
              <Brain className="w-3.5 h-3.5" />
              LearnPath Knowledge Platform
            </div>
            {!isMandatory && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight mt-3">
            {mode === 'register' ? 'Create your learning account' : 'Welcome back'}
          </h2>
          <p className="text-xs sm:text-sm text-indigo-200 mt-1 leading-relaxed">
            {mode === 'register'
              ? 'Set your learning goals, diagnose knowledge gaps, and get personalized curricula in any field.'
              : 'Sign in to access your verified mastery scores, custom roadmaps, and practice history.'}
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-slate-800/80 p-1 mt-5 border border-slate-700">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                mode === 'login' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                mode === 'register' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === 'register' && (
              <p className="text-[11px] text-slate-500 mt-1">Must be at least 6 characters.</p>
            )}
          </div>

          {mode === 'register' && (
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Learning Language</label>
                  <select
                    value={learningLanguage}
                    onChange={(e) => setLearningLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {SUPPORTED_LEARNING_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name} ({l.nativeName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Daily Study Target</label>
                  <select
                    value={dailyMinutes}
                    onChange={(e) => setDailyMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value={10}>10 min / day (Quick)</option>
                    <option value={20}>20 min / day (Balanced)</option>
                    <option value={30}>30 min / day (Focused)</option>
                    <option value={60}>60 min / day (Deep)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Explanation Style</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'First Principles', label: 'First Principles', desc: 'Bedrock axioms & derivations' },
                    { id: 'Socratic', label: 'Socratic Guided', desc: 'Guided inquiry & prompts' },
                    { id: 'Direct & Practical', label: 'Direct & Practical', desc: 'Examples & immediate application' },
                    { id: 'Visual & Intuitive', label: 'Visual & Intuitive', desc: 'Mental models & analogies' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setExplanationStyle(style.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        explanationStyle === style.id
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold'
                          : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-[11px]">{style.label}</div>
                      <div className="text-[10px] text-slate-500">{style.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              'Processing...'
            ) : mode === 'register' ? (
              <>
                Create Account <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Sign In to LearnPath <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
