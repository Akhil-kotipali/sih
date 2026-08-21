import React, { useState } from 'react';
import { UserProfile } from '../types';
import { saveCurrentUser } from '../services/storageService';
import {
  Layers,
  Plus,
  Trash2,
  BookOpen,
  Play,
  Search,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface SubjectsScreenProps {
  user: UserProfile;
  onNavigateToPractice: (topic: string, subjectId: string) => void;
  onNavigateToResources: (topic: string) => void;
  onUpdateUser: (updated: UserProfile) => void;
}

export const SubjectsScreen: React.FC<SubjectsScreenProps> = ({
  user,
  onNavigateToPractice,
  onNavigateToResources,
  onUpdateUser,
}) => {
  const [newSubjectTitle, setNewSubjectTitle] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleAddSubject = () => {
    const title = newSubjectTitle.trim();
    if (!title) return;

    const id = title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
    if (user.shortGoals.includes(id)) return;

    const updated: UserProfile = {
      ...user,
      shortGoals: [...user.shortGoals, id],
      shortGoalLabels: { ...user.shortGoalLabels, [id]: title },
      stats: {
        ...user.stats,
        subjectProgress: { ...user.stats.subjectProgress, [id]: 0 },
      },
    };

    saveCurrentUser(updated);
    onUpdateUser(updated);
    setNewSubjectTitle('');
    setShowAddDialog(false);
  };

  const handleRemoveSubject = (id: string) => {
    if (user.shortGoals.length <= 1) return; // preserve at least one
    const updated: UserProfile = {
      ...user,
      shortGoals: user.shortGoals.filter((g) => g !== id),
    };
    saveCurrentUser(updated);
    onUpdateUser(updated);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-1">
            <Layers className="w-3.5 h-3.5" />
            Curriculum & Goal Manager
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Enrolled Subjects & Goals ({user.shortGoals.length})
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Semester courses, certifications, and target subjects tracked in your daily plan.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Subject / Goal
        </button>
      </div>

      {/* Add Dialog */}
      {showAddDialog && (
        <div className="p-5 rounded-2xl bg-indigo-50/70 border-2 border-indigo-200 space-y-3">
          <div className="font-bold text-sm text-indigo-950">Add a new course or target goal</div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newSubjectTitle}
              onChange={(e) => setNewSubjectTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
              placeholder="e.g. Compiler Design, AWS Cloud Practitioner, System Design..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-indigo-300 text-sm outline-none focus:border-indigo-600"
            />
            <button
              type="button"
              onClick={handleAddSubject}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs"
            >
              Add to Plan
            </button>
            <button
              type="button"
              onClick={() => setShowAddDialog(false)}
              className="px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Grid of Subjects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {user.shortGoals.map((id) => {
          const label = user.shortGoalLabels[id] || id;
          const progress = user.stats.subjectProgress[id] || 25;

          return (
            <div
              key={id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 p-5 shadow-xs transition flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-sm">
                    <BookOpen className="w-5 h-5" />
                  </div>

                  {user.shortGoals.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(id)}
                      className="text-slate-300 hover:text-rose-600 p-1 transition"
                      title="Remove subject"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <h3 className="font-bold text-base text-slate-900 leading-snug">{label}</h3>
                <p className="text-xs text-slate-500">Core Engineering Target</p>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">Completion</span>
                  <span className="font-bold text-indigo-600">{progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigateToResources(label)}
                    className="p-2 rounded-xl border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Search className="w-3 h-3" /> Resources
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigateToPractice(label, id)}
                    className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-2xs"
                  >
                    <Play className="w-3 h-3 fill-white" /> Practice
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
