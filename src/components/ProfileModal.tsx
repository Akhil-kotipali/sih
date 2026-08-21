import React, { useState } from 'react';
import { UserProfile, LearningPreferences } from '../types';
import { updateProfile, logoutUser, deleteUserAccount } from '../services/authService';
import { exportAllUserData } from '../services/storageService';
import {
  User,
  Mail,
  Lock,
  Globe,
  Clock,
  BookOpen,
  Sparkles,
  Download,
  Trash2,
  LogOut,
  X,
  Check,
  AlertTriangle,
  Layers,
  Brain,
  ShieldCheck,
} from 'lucide-react';
import { SUPPORTED_UI_LANGUAGES, SUPPORTED_LEARNING_LANGUAGES } from '../services/i18n';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onLoggedOut: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
  onLoggedOut,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'data' | 'danger'>('profile');
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');

  const [preferences, setPreferences] = useState<LearningPreferences>({
    ...user.preferences,
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await updateProfile({
        name,
        bio,
        preferences,
      });

      if (updated) {
        onUserUpdated(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (e) {
      console.error('Failed to update profile:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = () => {
    const data = exportAllUserData(user.id);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `learnpath_export_${user.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete') return;
    const ok = await deleteUserAccount();
    if (ok) {
      onLoggedOut();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-slate-900 p-6 sm:p-7 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 text-indigo-300 font-extrabold text-lg flex items-center justify-center">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
          {[
            { id: 'profile', label: 'Profile Info', icon: User },
            { id: 'preferences', label: 'Learning Preferences', icon: BookOpen },
            { id: 'data', label: 'Data & Export', icon: Download },
            { id: 'danger', label: 'Account & Security', icon: AlertTriangle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="p-6 sm:p-8">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-500 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1">Email is associated with your account ownership.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Short Bio / Learning Focus</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Preparing for medical board exams / learning full-stack web development / studying organic chemistry."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                {saveSuccess ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Profile updated successfully!
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'preferences' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">UI Language</label>
                  <select
                    value={preferences.uiLanguage}
                    onChange={(e) => setPreferences({ ...preferences, uiLanguage: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white"
                  >
                    {SUPPORTED_UI_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name} ({l.nativeName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Learning & AI Language</label>
                  <select
                    value={preferences.learningLanguage}
                    onChange={(e) => setPreferences({ ...preferences, learningLanguage: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white"
                  >
                    {SUPPORTED_LEARNING_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name} ({l.nativeName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Current Mastery Level</label>
                  <select
                    value={preferences.learningLevel}
                    onChange={(e) => setPreferences({ ...preferences, learningLevel: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white"
                  >
                    <option value="Beginner">Beginner (Foundations & Vocabulary)</option>
                    <option value="Intermediate">Intermediate (Problem Solving & Patterns)</option>
                    <option value="Advanced">Advanced (Deep Theory & Edge Cases)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Daily Study Target</label>
                  <select
                    value={preferences.dailyStudyMinutes}
                    onChange={(e) => setPreferences({ ...preferences, dailyStudyMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white"
                  >
                    <option value={10}>10 Minutes / Day</option>
                    <option value={20}>20 Minutes / Day</option>
                    <option value={30}>30 Minutes / Day</option>
                    <option value={60}>1 Hour / Day</option>
                    <option value={120}>2 Hours / Day</option>
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
                      onClick={() => setPreferences({ ...preferences, explanationStyle: style.id as any })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        preferences.explanationStyle === style.id
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold'
                          : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-semibold">{style.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{style.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                {saveSuccess ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Preferences saved!
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3.5">
                <Download className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Export All Learning Data</h4>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Download a clean, portable JSON archive containing your goals, structured roadmaps, diagnostic assessment sessions, verified competency mastery scores, and bookmarked resources.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="mt-3 px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download JSON Archive
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Sign Out of LearnPath</h4>
                  <p className="text-xs text-slate-500 mt-0.5">End your current session on this device.</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await logoutUser();
                    onLoggedOut();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                <h4 className="font-bold text-sm text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" /> Delete Account & Learning History
                </h4>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                  Permanently deletes your account, goals, roadmaps, assessment records, and bookmarks. This action is irreversible.
                </p>

                <div className="mt-3 pt-3 border-t border-rose-200/60 flex items-center gap-3">
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder='Type "DELETE" to confirm'
                    className="px-3 py-1.5 rounded-lg border border-rose-300 text-xs bg-white text-rose-950 font-mono w-48"
                  />
                  <button
                    type="button"
                    disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                    onClick={handleDeleteAccount}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Delete Account Permanently
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
