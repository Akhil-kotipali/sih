import React, { useState, useEffect } from 'react';
import { AISettings, AIProvider } from '../types';
import {
  loadAISettings,
  saveAISettings,
  DEFAULT_AI_SETTINGS,
  DEFAULT_SYSTEM_PROMPTS,
  syncAllToPostgres,
  checkPostgresStatus,
} from '../services/storageService';
import { testAIInference, TestInferenceResult } from '../services/aiService';
import {
  Settings,
  X,
  Key,
  Cpu,
  FileCode,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  ShieldCheck,
  Server,
  Globe,
  Database,
  Link2,
  RefreshCw,
  AlertTriangle,
  Eye,
  EyeOff,
  Clipboard,
  Play,
  CheckCircle2,
  Zap,
  Search,
  Copy,
  BookOpen,
  Layers,
  Bot,
  Code2,
  Brain,
  Wand2,
  CheckCheck,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const PROVIDER_OPTIONS: { id: AIProvider; label: string; desc: string; icon: any }[] = [
  {
    id: 'gemini_server',
    label: 'Google Gemini (Server API)',
    desc: 'Uses server GEMINI_API_KEY environment variable or local proxy',
    icon: Server,
  },
  {
    id: 'gemini_client',
    label: 'Google Gemini (Client Direct)',
    desc: 'Direct browser connection using your custom Gemini API key',
    icon: Globe,
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    desc: 'Direct connection to Claude 3.5 Sonnet / Haiku',
    icon: Cpu,
  },
  {
    id: 'groq',
    label: 'Groq (Ultra-Fast)',
    desc: 'Llama 3.3 70B & Mixtral with near-instant token streaming',
    icon: Sparkles,
  },
  {
    id: 'featherless',
    label: 'Featherless AI',
    desc: 'Open-weights model catalog with serverless inference',
    icon: Cpu,
  },
  {
    id: 'custom',
    label: 'Custom OpenAI-Compatible',
    desc: 'Connect to Ollama, LM Studio, vLLM, or OpenRouter endpoint',
    icon: FileCode,
  },
];

const ALL_SYSTEM_PROMPT_CONFIGS: {
  key: keyof AISettings['systemPrompts'];
  id: number;
  name: string;
  category: 'Assessment' | 'Roadmap & Guidance' | 'Interactive Evaluation';
  badge: string;
  badgeColor: string;
  description: string;
  icon: any;
}[] = [
  {
    key: 'assessmentInitial',
    id: 1,
    name: 'Beginning-of-Test Assessment Generator (Batch 1)',
    category: 'Assessment',
    badge: 'System Prompt 1',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description:
      'Compact universal contract for generating baseline assessment questions across any domain or programming language with strict deterministic integrity.',
    icon: FileCode,
  },
  {
    key: 'assessmentAdaptive',
    id: 2,
    name: 'Batch Submission & Adaptive Diagnosis Controller',
    category: 'Assessment',
    badge: 'System Prompt 2',
    badgeColor: 'bg-violet-100 text-violet-800 border-violet-200',
    description:
      'Performs deep cognitive diagnosis on student batch submissions, detects error patterns across 5 dimensions, and either formulates the next adapted batch targeting weak spots or concludes the test with a Skill Level Judgment Report.',
    icon: Brain,
  },
  {
    key: 'assessment',
    id: 3,
    name: 'Universal Adaptive Question Engine',
    category: 'Assessment',
    badge: 'Universal Engine',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description:
      'Universal core system prompt for generating interactive assessment questions with canonical dimensions and verified semantics.',
    icon: Wand2,
  },
  {
    key: 'questionEvaluator',
    id: 4,
    name: 'Interactive Question Evaluator & Code Grader',
    category: 'Interactive Evaluation',
    badge: 'Grader Engine',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description:
      'Evaluates and scores student-submitted code algorithms, debugging patches, step orderings, and free-form conceptual explanations with rubric scoring.',
    icon: Code2,
  },
  {
    key: 'topicDiagnoser',
    id: 5,
    name: 'Topic Mastery & Cognitive Dimension Diagnoser',
    category: 'Interactive Evaluation',
    badge: 'Radar Diagnoser',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    description:
      'Calculates 5-dimension radar scores across Concept, Application, Implementation, Debugging, and Algorithmic Thinking to provide targeted remediation advice.',
    icon: Sparkles,
  },
  {
    key: 'roadmap',
    id: 6,
    name: 'Roadmap Curriculum Designer',
    category: 'Roadmap & Guidance',
    badge: 'Curriculum AI',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    description:
      'Generates progressive, month-by-month engineering curricula and unlocks tailored to user year, branch, and target career paths.',
    icon: Layers,
  },
  {
    key: 'recommend',
    id: 7,
    name: 'Learning Recommendations Specialist',
    category: 'Roadmap & Guidance',
    badge: 'Study Advisor',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    description:
      'Analyzes student strengths and weaknesses to deliver high-yield study advice, memory hooks, and practice problem sets.',
    icon: BookOpen,
  },
  {
    key: 'mentor',
    id: 8,
    name: 'AI Engineering Mentor & Tutor',
    category: 'Roadmap & Guidance',
    badge: 'Mentor Chat',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    description:
      'Conversational AI tutor that clarifies engineering doubts, explains coding invariants, and guides placement/exam prep.',
    icon: Bot,
  },
  {
    key: 'resources',
    id: 9,
    name: 'Technical Resource Discovery Engine',
    category: 'Roadmap & Guidance',
    badge: 'Resource Finder',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    description:
      'Curates authoritative, accessible technical resources (videos, interactive sandboxes, docs, practice problems) for any topic.',
    icon: Globe,
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [activeTab, setActiveTab] = useState<'provider' | 'endpoints' | 'postgres' | 'prompts'>('provider');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSyncingPg, setIsSyncingPg] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; success: boolean } | null>(null);

  // Key Visibility toggles (preventing password manager autofill clutter)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // Inference Testing State
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testAIResult, setTestAIResult] = useState<TestInferenceResult | null>(null);

  // Prompts Tab Search & Category Filter
  const [promptSearch, setPromptSearch] = useState('');
  const [promptCategoryFilter, setPromptCategoryFilter] = useState<'All' | 'Assessment' | 'Roadmap & Guidance' | 'Interactive Evaluation'>('All');
  const [copiedPromptKey, setCopiedPromptKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(loadAISettings());
      setSavedSuccess(false);
      setSyncStatusMsg(null);
      setTestAIResult(null);
      setPromptSearch('');
      setPromptCategoryFilter('All');
      setCopiedPromptKey(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateSettings = (newSettings: AISettings) => {
    setSettings(newSettings);
    // Instant background persistence so user edits are never lost
    saveAISettings(newSettings);
  };

  const toggleShowKey = (keyId: string) => {
    setShowKeys((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const handlePasteKey = async (providerKey: keyof AISettings['keys']) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const clean = text.trim();
        updateSettings({
          ...settings,
          keys: { ...settings.keys, [providerKey]: clean },
        });
      }
    } catch {
      // If clipboard read is blocked
    }
  };

  const handleClearKey = (providerKey: keyof AISettings['keys']) => {
    updateSettings({
      ...settings,
      keys: { ...settings.keys, [providerKey]: '' },
    });
  };

  const handleRunInferenceTest = async () => {
    setIsTestingAI(true);
    setTestAIResult(null);
    try {
      const result = await testAIInference(settings);
      setTestAIResult(result);
    } catch (e: any) {
      setTestAIResult({
        success: false,
        provider: settings.provider,
        model: settings.customModel || 'unknown',
        latencyMs: 0,
        sampleOutput: '',
        error: e?.message || 'Inference test failed',
      });
    } finally {
      setIsTestingAI(false);
    }
  };

  const handleSave = () => {
    saveAISettings(settings);
    setSavedSuccess(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleResetDefaults = () => {
    updateSettings(DEFAULT_AI_SETTINGS);
    setTestAIResult(null);
  };

  const handleCopyPrompt = async (key: keyof AISettings['systemPrompts'], text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPromptKey(key);
      setTimeout(() => setCopiedPromptKey(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleResetSinglePrompt = (key: keyof AISettings['systemPrompts']) => {
    const defaultVal = DEFAULT_SYSTEM_PROMPTS[key] || '';
    updateSettings({
      ...settings,
      systemPrompts: {
        ...settings.systemPrompts,
        [key]: defaultVal,
        ...(key === 'assessmentInitial' ? { assessment: defaultVal } : {}),
      },
    });
  };

  const handleResetAllPrompts = () => {
    updateSettings({
      ...settings,
      systemPrompts: { ...DEFAULT_SYSTEM_PROMPTS },
    });
  };

  const handleTestPostgresSync = async () => {
    setIsSyncingPg(true);
    setSyncStatusMsg(null);
    try {
      const res = await syncAllToPostgres();
      setSyncStatusMsg({ text: res.message, success: res.success });
      setSettings(loadAISettings());
    } catch (e: any) {
      setSyncStatusMsg({ text: e.message || 'Sync failed', success: false });
    } finally {
      setIsSyncingPg(false);
    }
  };

  const filteredPrompts = ALL_SYSTEM_PROMPT_CONFIGS.filter((p) => {
    const matchesCat = promptCategoryFilter === 'All' || p.category === promptCategoryFilter;
    const currentVal = settings.systemPrompts[p.key] || '';
    const matchesSearch =
      !promptSearch.trim() ||
      p.name.toLowerCase().includes(promptSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(promptSearch.toLowerCase()) ||
      p.badge.toLowerCase().includes(promptSearch.toLowerCase()) ||
      currentVal.toLowerCase().includes(promptSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                LearnPath Advanced Settings & Inference
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                  Shortcut Activated · Ctrl+Shift+K
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Manage AI inference keys, multi-model endpoints, persistence, and customize all 9 system prompts.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 px-5 bg-slate-50 gap-2 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('provider')}
            className={`py-3 px-2 border-b-2 transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'provider'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            AI Providers & Keys
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('endpoints')}
            className={`py-3 px-2 border-b-2 transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'endpoints'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            API Endpoints
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('postgres')}
            className={`py-3 px-2 border-b-2 transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'postgres'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            PostgreSQL & Storage
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('prompts')}
            className={`py-3 px-2 border-b-2 transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'prompts'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            System Prompts (All 9 Modules)
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-mono">
              9
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-sm">
          {/* TAB 1: AI PROVIDERS */}
          {activeTab === 'provider' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Active AI Provider
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PROVIDER_OPTIONS.map((opt) => {
                    const isSelected = settings.provider === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => {
                          updateSettings({ ...settings, provider: opt.id });
                          setTestAIResult(null);
                        }}
                        className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/60 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <div>
                          <div className="font-bold text-xs text-slate-900">{opt.label}</div>
                          <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{opt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Provider Fields */}
              <div className="p-4.5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    API Credentials & Model Setup
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Auto-saved to LocalStorage
                  </span>
                </div>

                {settings.provider === 'gemini_server' && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-emerald-950">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Server-side Gemini Active (Default Mode)
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        Routes through your server proxy <code>/api/ai/generate</code> using the container's <code>GEMINI_API_KEY</code> with automated fallback to <code>gemini-3.6-flash</code>, <code>gemini-3.5-flash-lite</code>, and <code>gemini-3.7-flash</code>.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">Preferred Gemini Model</label>
                        {settings.models?.gemini && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, gemini: '' },
                              })
                            }
                            className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            Reset to default
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          id="ai_model_gemini_server_field"
                          name="ai_model_gemini_server_field"
                          type="text"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={settings.models?.gemini ?? ''}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              models: { ...settings.models, gemini: e.target.value },
                            })
                          }
                          placeholder="gemini-3.6-flash"
                          className="w-full pl-3.5 pr-8 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                        />
                        {Boolean(settings.models?.gemini) && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, gemini: '' },
                              })
                            }
                            className="absolute right-2 p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Clear model ID"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500">
                        <span>Presets:</span>
                        {['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'].map((m) => (
                          <button
                            type="button"
                            key={m}
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, gemini: m },
                              })
                            }
                            className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                              (settings.models?.gemini || 'gemini-3.6-flash') === m
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-200/70 hover:bg-indigo-100 hover:text-indigo-700 text-slate-700'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {settings.provider === 'gemini_client' && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Gemini API Key (Google AI Studio)
                        </label>
                        {settings.keys.gemini ? (
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {settings.keys.gemini.length} chars entered
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Required for Client mode</span>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          id="ai_key_gemini_field"
                          name="ai_key_gemini_field"
                          type={showKeys['gemini'] ? 'text' : 'password'}
                          autoComplete="new-password"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={settings.keys.gemini || ''}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              keys: { ...settings.keys, gemini: e.target.value.trim() },
                            })
                          }
                          placeholder="AIzaSy..."
                          className="w-full pl-3.5 pr-20 py-2.5 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                        />
                        <div className="absolute right-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleShowKey('gemini')}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                            title={showKeys['gemini'] ? 'Hide key' : 'Show key'}
                          >
                            {showKeys['gemini'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePasteKey('gemini')}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                            title="Paste from clipboard"
                          >
                            <Clipboard className="w-3.5 h-3.5" />
                          </button>
                          {settings.keys.gemini && (
                            <button
                              type="button"
                              onClick={() => handleClearKey('gemini')}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Clear input"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 underline">aistudio.google.com</a>.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">Gemini Model ID</label>
                        {settings.models?.gemini && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, gemini: '' },
                              })
                            }
                            className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            Reset to default
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          id="ai_model_gemini_client_field"
                          name="ai_model_gemini_client_field"
                          type="text"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={settings.models?.gemini ?? ''}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              models: { ...settings.models, gemini: e.target.value },
                            })
                          }
                          placeholder="gemini-3.6-flash"
                          className="w-full pl-3.5 pr-8 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                        />
                        {Boolean(settings.models?.gemini) && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, gemini: '' },
                              })
                            }
                            className="absolute right-2 p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Clear model ID"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500">
                        <span>Presets:</span>
                        {['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'].map((m) => (
                          <button
                            type="button"
                            key={m}
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, gemini: m },
                              })
                            }
                            className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                              (settings.models?.gemini || 'gemini-3.6-flash') === m
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-200/70 hover:bg-indigo-100 hover:text-indigo-700 text-slate-700'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {settings.provider === 'anthropic' && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Anthropic API Key
                        </label>
                        {settings.keys.anthropic && (
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {settings.keys.anthropic.length} chars entered
                          </span>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          id="ai_key_anthropic_field"
                          name="ai_key_anthropic_field"
                          type={showKeys['anthropic'] ? 'text' : 'password'}
                          autoComplete="new-password"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={settings.keys.anthropic || ''}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              keys: { ...settings.keys, anthropic: e.target.value.trim() },
                            })
                          }
                          placeholder="sk-ant-api..."
                          className="w-full pl-3.5 pr-20 py-2.5 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                        />
                        <div className="absolute right-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleShowKey('anthropic')}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                            title={showKeys['anthropic'] ? 'Hide key' : 'Show key'}
                          >
                            {showKeys['anthropic'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePasteKey('anthropic')}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                            title="Paste from clipboard"
                          >
                            <Clipboard className="w-3.5 h-3.5" />
                          </button>
                          {settings.keys.anthropic && (
                            <button
                              type="button"
                              onClick={() => handleClearKey('anthropic')}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Clear input"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">Claude Model Name</label>
                        {settings.models?.anthropic && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, anthropic: '' },
                              })
                            }
                            className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            Reset to default
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          id="ai_model_anthropic_field"
                          name="ai_model_anthropic_field"
                          type="text"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={settings.models?.anthropic ?? ''}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              models: { ...settings.models, anthropic: e.target.value },
                            })
                          }
                          placeholder="claude-3-5-sonnet-20241022"
                          className="w-full pl-3.5 pr-8 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                        />
                        {Boolean(settings.models?.anthropic) && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, anthropic: '' },
                              })
                            }
                            className="absolute right-2 p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Clear model ID"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500">
                        <span>Presets:</span>
                        {['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'].map((m) => (
                          <button
                            type="button"
                            key={m}
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, anthropic: m },
                              })
                            }
                            className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                              (settings.models?.anthropic || 'claude-3-5-sonnet-20241022') === m
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-200/70 hover:bg-indigo-100 hover:text-indigo-700 text-slate-700'
                            }`}
                          >
                            {m.split('-')[0] + '-' + m.split('-')[1] + '-' + m.split('-')[2]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {settings.provider === 'groq' && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">Groq API Key</label>
                        {settings.keys.groq && (
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {settings.keys.groq.length} chars entered
                          </span>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          id="ai_key_groq_field"
                          name="ai_key_groq_field"
                          type={showKeys['groq'] ? 'text' : 'password'}
                          autoComplete="new-password"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={settings.keys.groq || ''}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              keys: { ...settings.keys, groq: e.target.value.trim() },
                            })
                          }
                          placeholder="gsk_..."
                          className="w-full pl-3.5 pr-20 py-2.5 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                        />
                        <div className="absolute right-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleShowKey('groq')}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                          >
                            {showKeys['groq'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePasteKey('groq')}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                          >
                            <Clipboard className="w-3.5 h-3.5" />
                          </button>
                          {settings.keys.groq && (
                            <button
                              type="button"
                              onClick={() => handleClearKey('groq')}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">Groq Model Name</label>
                        {settings.models?.groq && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, groq: '' },
                              })
                            }
                            className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            Reset to default
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          id="ai_model_groq_field"
                          name="ai_model_groq_field"
                          type="text"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={settings.models?.groq ?? ''}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              models: { ...settings.models, groq: e.target.value },
                            })
                          }
                          placeholder="llama-3.3-70b-versatile"
                          className="w-full pl-3.5 pr-8 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                        />
                        {Boolean(settings.models?.groq) && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, groq: '' },
                              })
                            }
                            className="absolute right-2 p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Clear model ID"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500">
                        <span>Presets:</span>
                        {['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'].map((m) => (
                          <button
                            type="button"
                            key={m}
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, groq: m },
                              })
                            }
                            className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                              (settings.models?.groq || 'llama-3.3-70b-versatile') === m
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-200/70 hover:bg-indigo-100 hover:text-indigo-700 text-slate-700'
                            }`}
                          >
                            {m.split('-')[0] + '-' + m.split('-')[1]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {settings.provider === 'featherless' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Featherless AI Key</label>
                      <div className="relative flex items-center">
                        <input
                          id="ai_key_featherless_field"
                          name="ai_key_featherless_field"
                          type={showKeys['featherless'] ? 'text' : 'password'}
                          autoComplete="new-password"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={settings.keys.featherless || ''}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              keys: { ...settings.keys, featherless: e.target.value.trim() },
                            })
                          }
                          placeholder="fl_..."
                          className="w-full pl-3.5 pr-20 py-2.5 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                        />
                        <div className="absolute right-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleShowKey('featherless')}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                          >
                            {showKeys['featherless'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePasteKey('featherless')}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                          >
                            <Clipboard className="w-3.5 h-3.5" />
                          </button>
                          {settings.keys.featherless && (
                            <button
                              type="button"
                              onClick={() => handleClearKey('featherless')}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">Featherless Model ID</label>
                        {settings.models?.featherless && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, featherless: '' },
                              })
                            }
                            className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            Reset to default
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          id="ai_model_featherless_field"
                          name="ai_model_featherless_field"
                          type="text"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={settings.models?.featherless ?? ''}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              models: { ...settings.models, featherless: e.target.value },
                            })
                          }
                          placeholder="Qwen/Qwen3.5-27B"
                          className="w-full pl-3.5 pr-8 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                        />
                        {Boolean(settings.models?.featherless) && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, featherless: '' },
                              })
                            }
                            className="absolute right-2 p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Clear model ID"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500 flex-wrap">
                        <span>Presets:</span>
                        {[
                          'Qwen/Qwen3.5-27B',
                          'Qwen/Qwen3.5-9B',
                          'Qwen/Qwen3-Coder-30B-A3B-Instruct',
                          'Qwen/Qwen2.5-7B-Instruct',
                          'mistralai/Mistral-7B-Instruct-v0.3',
                        ].map((m) => (
                          <button
                            type="button"
                            key={m}
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, featherless: m },
                              })
                            }
                            className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                              (settings.models?.featherless || 'Qwen/Qwen3.5-27B') === m
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-200/70 hover:bg-indigo-100 hover:text-indigo-700 text-slate-700'
                            }`}
                          >
                            {m.split('/')[1] || m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {settings.provider === 'custom' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Base Endpoint URL</label>
                      <input
                        id="ai_endpoint_custom_field"
                        name="ai_endpoint_custom_field"
                        type="text"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                        value={settings.customBaseUrl || ''}
                        onChange={(e) =>
                          updateSettings({ ...settings, customBaseUrl: e.target.value.trim() })
                        }
                        placeholder="http://localhost:11434/v1/chat/completions"
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">API Key (Optional / Bearer)</label>
                      <div className="relative flex items-center">
                        <input
                          id="ai_key_custom_field"
                          name="ai_key_custom_field"
                          type={showKeys['custom'] ? 'text' : 'password'}
                          autoComplete="new-password"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={settings.keys.custom || ''}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              keys: { ...settings.keys, custom: e.target.value.trim() },
                            })
                          }
                          placeholder="Bearer token or sk-..."
                          className="w-full pl-3.5 pr-20 py-2.5 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                        />
                        <div className="absolute right-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleShowKey('custom')}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                          >
                            {showKeys['custom'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePasteKey('custom')}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                          >
                            <Clipboard className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">Model Name</label>
                        {settings.models?.custom && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, custom: '' },
                              })
                            }
                            className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            Reset to default
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          id="ai_model_custom_field"
                          name="ai_model_custom_field"
                          type="text"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={settings.models?.custom ?? ''}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              models: { ...settings.models, custom: e.target.value },
                            })
                          }
                          placeholder="e.g. gpt-4o-mini, llama3, qwen2.5-coder"
                          className="w-full pl-3.5 pr-8 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                        />
                        {Boolean(settings.models?.custom) && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, custom: '' },
                              })
                            }
                            className="absolute right-2 p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Clear model ID"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500">
                        <span>Presets:</span>
                        {['gpt-4o-mini', 'gpt-4o', 'deepseek-chat', 'llama3:latest'].map((m) => (
                          <button
                            type="button"
                            key={m}
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                models: { ...settings.models, custom: m },
                              })
                            }
                            className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                              (settings.models?.custom || 'gpt-4o-mini') === m
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-200/70 hover:bg-indigo-100 hover:text-indigo-700 text-slate-700'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* LIVE INFERENCE TESTER CARD */}
              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-indigo-600 text-white">
                      <Zap className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-950">Verify AI Inference Live</div>
                      <div className="text-[11px] text-indigo-700">
                        Sends a quick benchmark prompt to verify connectivity, latency & credentials.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isTestingAI}
                    onClick={handleRunInferenceTest}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {isTestingAI ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Test Inference Now
                      </>
                    )}
                  </button>
                </div>

                {testAIResult && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-2 transition ${
                      testAIResult.success
                        ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                        : 'bg-rose-50/90 border-rose-200 text-rose-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold">
                        {testAIResult.success ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Inference Working Online</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            <span>Inference Connection Failed</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-700">
                          {testAIResult.provider}
                        </span>
                        {testAIResult.latencyMs > 0 && (
                          <span className="px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-indigo-700 font-bold">
                            {testAIResult.latencyMs}ms
                          </span>
                        )}
                      </div>
                    </div>

                    {testAIResult.success ? (
                      <div className="p-2.5 rounded-lg bg-white/90 border border-emerald-200 text-emerald-900 font-sans text-xs leading-relaxed">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-700 block mb-1">
                          Model Response Sample:
                        </span>
                        "{testAIResult.sampleOutput}"
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-white/90 border border-rose-200 text-rose-800 text-xs">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-rose-700 block mb-1">
                          Diagnostic Error:
                        </span>
                        {testAIResult.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM API ENDPOINTS */}
          {activeTab === 'endpoints' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-indigo-50 text-indigo-900 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  Configure manual backend routes for AI inference, batch 1 generation, adaptive loop submission, and resource search.
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. AI Generate Endpoint
                  </label>
                  <input
                    type="text"
                    value={settings.endpoints?.aiGenerate || '/api/ai/generate'}
                    onChange={(e) =>
                      updateSettings({
                        ...settings,
                        endpoints: { ...settings.endpoints, aiGenerate: e.target.value.trim() },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. Batch 1 Initial Assessment Endpoint
                  </label>
                  <input
                    type="text"
                    value={settings.endpoints?.batch1 || '/api/ai/assessment/batch1'}
                    onChange={(e) =>
                      updateSettings({
                        ...settings,
                        endpoints: { ...settings.endpoints, batch1: e.target.value.trim() },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. Adaptive Evaluation & Next Batch Endpoint
                  </label>
                  <input
                    type="text"
                    value={settings.endpoints?.adaptiveNext || '/api/ai/assessment/adaptive-next'}
                    onChange={(e) =>
                      updateSettings({
                        ...settings,
                        endpoints: { ...settings.endpoints, adaptiveNext: e.target.value.trim() },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    4. Database Sync Endpoint
                  </label>
                  <input
                    type="text"
                    value={settings.endpoints?.postgresSync || '/api/db/sync'}
                    onChange={(e) =>
                      updateSettings({
                        ...settings,
                        endpoints: { ...settings.endpoints, postgresSync: e.target.value.trim() },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    5. Live Resources Search Endpoint
                  </label>
                  <input
                    type="text"
                    value={settings.endpoints?.resourcesSearch || '/api/resources/search'}
                    onChange={(e) =>
                      updateSettings({
                        ...settings,
                        endpoints: { ...settings.endpoints, resourcesSearch: e.target.value.trim() },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: POSTGRESQL & LOCAL STORAGE */}
          {activeTab === 'postgres' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                    <Database className="w-4 h-4 text-indigo-600" />
                    Storage Engine Architecture
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Local Storage Active
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  All tests, batches, question submissions, roadmaps, and profile stats persist instantly in <strong>Browser LocalStorage</strong>. When a PostgreSQL connection string or REST sync endpoint is configured, data automatically bridges to Postgres as well.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PostgreSQL Connection String / REST URL
                  </label>
                  <input
                    type="text"
                    value={settings.postgres?.connectionString || ''}
                    onChange={(e) =>
                      updateSettings({
                        ...settings,
                        postgres: {
                          ...settings.postgres,
                          connectionString: e.target.value.trim(),
                          enabled: Boolean(e.target.value.trim()),
                        },
                      })
                    }
                    placeholder="postgresql://username:password@localhost:5432/learnpath"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none focus:border-indigo-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Leave blank to use internal server database store with instant LocalStorage synchronization.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                  <div>
                    <div className="font-bold text-xs text-slate-800">Auto-Sync On Batch Submission</div>
                    <div className="text-[11px] text-slate-500">Automatically push completed batches to Postgres</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.postgres?.autoSync ?? true}
                    onChange={(e) =>
                      updateSettings({
                        ...settings,
                        postgres: { ...settings.postgres, autoSync: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTestPostgresSync}
                    disabled={isSyncingPg}
                    className="px-4 py-2.5 rounded-xl border border-indigo-600 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPg ? 'animate-spin' : ''}`} />
                    {isSyncingPg ? 'Syncing with Database...' : 'Test Connection & Sync Now'}
                  </button>

                  {syncStatusMsg && (
                    <div
                      className={`mt-2.5 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                        syncStatusMsg.success
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {syncStatusMsg.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                      {syncStatusMsg.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SYSTEM PROMPTS (ALL 9 MODULES) */}
          {activeTab === 'prompts' && (
            <div className="space-y-5">
              {/* Header Info & Actions */}
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950">
                      System Prompts Catalog & Live Customizer
                    </h4>
                    <p className="text-[11px] text-indigo-800/90 leading-relaxed mt-0.5">
                      Fine-tune every system prompt across assessment generation, adaptive evaluation, interactive code grading, radar diagnosis, and learning guidance.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetAllPrompts}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  title="Reset all 9 system prompts to their original factory defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset All 9 Prompts
                </button>
              </div>

              {/* Search & Category Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={promptSearch}
                    onChange={(e) => setPromptSearch(e.target.value)}
                    placeholder="Search prompts by title, keyword, or content..."
                    className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-600 bg-white"
                  />
                  {promptSearch && (
                    <button
                      type="button"
                      onClick={() => setPromptSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 shrink-0">
                  {(['All', 'Assessment', 'Interactive Evaluation', 'Roadmap & Guidance'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setPromptCategoryFilter(cat)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                        promptCategoryFilter === cat
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompts Cards List */}
              <div className="space-y-4">
                {filteredPrompts.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400">
                    <p className="text-xs font-medium">No system prompts match "{promptSearch}"</p>
                    <button
                      type="button"
                      onClick={() => {
                        setPromptSearch('');
                        setPromptCategoryFilter('All');
                      }}
                      className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
                    >
                      Clear search & filters
                    </button>
                  </div>
                ) : (
                  filteredPrompts.map((pConfig) => {
                    const promptValue = settings.systemPrompts[pConfig.key] ?? '';
                    const defaultPromptValue = DEFAULT_SYSTEM_PROMPTS[pConfig.key] ?? '';
                    const isModified = promptValue.trim() !== defaultPromptValue.trim();
                    const Icon = pConfig.icon;
                    const charCount = promptValue.length;
                    const wordCount = promptValue.trim() ? promptValue.trim().split(/\s+/).length : 0;
                    const isCopied = copiedPromptKey === pConfig.key;

                    return (
                      <div
                        key={pConfig.key}
                        className={`rounded-xl border transition-all duration-200 overflow-hidden bg-white shadow-xs ${
                          isModified ? 'border-indigo-300 ring-1 ring-indigo-200/50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Prompt Header */}
                        <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                              {pConfig.id}
                            </span>
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {pConfig.name}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${pConfig.badgeColor}`}>
                                {pConfig.badge}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isModified ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Modified
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium">
                                Default
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Prompt Description */}
                        <div className="px-3.5 pt-2.5 pb-1.5 bg-white text-[11px] text-slate-500 leading-relaxed">
                          {pConfig.description}
                        </div>

                        {/* Prompt Textarea */}
                        <div className="p-3.5 pt-1.5 bg-white">
                          <textarea
                            rows={pConfig.key === 'assessmentInitial' || pConfig.key === 'assessmentAdaptive' ? 6 : 4}
                            value={promptValue}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              updateSettings({
                                ...settings,
                                systemPrompts: {
                                  ...settings.systemPrompts,
                                  [pConfig.key]: newVal,
                                  ...(pConfig.key === 'assessmentInitial' ? { assessment: newVal } : {}),
                                },
                              });
                            }}
                            placeholder={`Enter system prompt for ${pConfig.name}...`}
                            className="w-full p-3 rounded-lg border border-slate-200 text-xs font-mono leading-relaxed outline-none focus:border-indigo-600 bg-slate-50/50 hover:bg-white focus:bg-white transition resize-y"
                            spellCheck={false}
                          />

                          {/* Prompt Card Footer Toolbar */}
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                            <div className="flex items-center gap-3">
                              <span>{charCount.toLocaleString()} chars</span>
                              <span>·</span>
                              <span>{wordCount.toLocaleString()} words</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopyPrompt(pConfig.key, promptValue)}
                                className="px-2.5 py-1 rounded-md border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 bg-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                                title="Copy prompt text to clipboard"
                              >
                                {isCopied ? (
                                  <>
                                    <CheckCheck className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-600">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-400" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>

                              {isModified && (
                                <button
                                  type="button"
                                  onClick={() => handleResetSinglePrompt(pConfig.key)}
                                  className="px-2.5 py-1 rounded-md border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                                  title="Reset this prompt to original default"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Reset to Default
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            title="Reset all settings to initial defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All Settings
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved & Applied!
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
