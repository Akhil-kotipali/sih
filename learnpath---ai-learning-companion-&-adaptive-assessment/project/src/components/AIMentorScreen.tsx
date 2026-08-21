import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, AISettings } from '../types';
import { callAI, checkInferenceReady, getActiveProviderModel } from '../services/aiService';
import {
  loadAISettings,
  getModelCapabilities,
  isInferenceConfigured,
  checkServerGeminiStatus,
} from '../services/storageService';
import {
  Bot,
  Send,
  Sparkles,
  RotateCcw,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Image as ImageIcon,
  X,
  Copy,
  Check,
  Code2,
  GraduationCap,
  Briefcase,
  Layers,
  Bug,
  AlertTriangle,
  Download,
  Terminal,
  ExternalLink,
  ChevronDown,
  Paperclip,
} from 'lucide-react';

interface AIMentorScreenProps {
  user: UserProfile;
  onLaunchPractice: (topic: string) => void;
}

interface AttachedImage {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64 string without data:image/xxx;base64, prefix
  previewUrl: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
  images?: AttachedImage[];
  modeUsed?: string;
  modelUsed?: string;
  suggestedTopic?: string;
}

type MentorMode = 'socratic' | 'interviewer' | 'architect' | 'debugger';

const MENTOR_MODES: Record<
  MentorMode,
  { label: string; icon: any; desc: string; systemDirective: string; badgeColor: string }
> = {
  socratic: {
    label: 'Engineering Professor',
    icon: GraduationCap,
    desc: 'First-principles derivations, invariants & conceptual intuition',
    systemDirective:
      'Adopt the persona of an inspiring, rigorous CS professor. Explain concepts starting from first principles and mathematical invariants. Guide the student using the Socratic method when appropriate, and reinforce foundational intuition.',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  interviewer: {
    label: 'FAANG Interviewer',
    icon: Briefcase,
    desc: 'DSA optimization, Big-O trade-offs & edge-case grilling',
    systemDirective:
      'Adopt the persona of a senior technical interviewer at a tier-1 tech company. Grill the student on asymptotic time/space complexities, potential memory bottlenecks, edge cases, and follow-up optimization questions.',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  architect: {
    label: 'Systems Architect',
    icon: Layers,
    desc: 'Scalability, distributed systems, CAP theorem & microservices',
    systemDirective:
      'Adopt the persona of a Principal Systems Architect. Evaluate designs and questions based on latency, throughput, consistency models, fault tolerance, caching, and horizontal scaling trade-offs.',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  debugger: {
    label: 'Code Debugger',
    icon: Bug,
    desc: 'Line-by-line tracing, memory leaks & error log analysis',
    systemDirective:
      'Adopt the persona of an expert compiler engineer and debugging specialist. Analyze code snippets, error traces, and screenshots with extreme precision, pinpointing logical flaws, off-by-one errors, and memory management issues.',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

const PRESET_TOPICS = [
  'Explain the difference between TCP and UDP with real-world examples',
  'What are the most common edge cases in Two Pointer algorithms?',
  'How does indexing work internally in B-Trees for relational DBs?',
  'Explain Virtual Memory, Page Faults, and TLB simply',
  'Analyze the time & space complexity of Dijkstra vs A* algorithm',
  'How does Raft consensus guarantee leader election safety?',
];

export const AIMentorScreen: React.FC<AIMentorScreenProps> = ({
  user,
  onLaunchPractice,
}) => {
  const [settings, setSettings] = useState<AISettings>(loadAISettings());
  const [inferenceReady, setInferenceReady] = useState<boolean>(true);
  const [inferenceReason, setInferenceReason] = useState<string>('');
  const [activeMode, setActiveMode] = useState<MentorMode>('socratic');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Voice Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Text to Speech State
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      role: 'assistant',
      text: `Hello **${user.name.split(' ')[0]}**! I am your AI Engineering Mentor.\n\nI'm customized for your **${user.year} · ${user.branch}** curriculum with active focus on **${user.shortGoals.map((g) => user.shortGoalLabels[g] || g).join(', ')}**.\n\nYou can ask conceptual questions, attach architectural diagrams or code screenshots for multimodal vision analysis, dictate using voice, or simulate mock interview scenarios.`,
      time: 'Just now',
      modeUsed: 'socratic',
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check inference readiness on mount & reload settings
  useEffect(() => {
    async function verify() {
      const currentSettings = loadAISettings();
      setSettings(currentSettings);
      const serverGemini = await checkServerGeminiStatus();
      const configured = isInferenceConfigured(currentSettings, serverGemini);
      const readiness = await checkInferenceReady(currentSettings);
      setInferenceReady(readiness.ready && configured);
      setInferenceReason(readiness.reason || (configured ? '' : 'Inference provider has no API key configured.'));
    }
    verify();
  }, []);

  const activeModel = getActiveProviderModel(settings);
  const capabilities = getModelCapabilities(settings.provider, activeModel);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle Speech Recognition setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser environment.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Speech recognition error:', err);
        setIsListening(false);
      }
    }
  };

  // Handle Text to Speech synthesis
  const handleToggleSpeak = (msgId: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-Speech is not supported in this browser.');
      return;
    }

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown symbols from text for clearer speech
    const cleanSpeechText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted for speech.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_#>-]/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Image Upload Handling (Multimodal)
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFiles = (files: File[]) => {
    files.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        alert('Please select valid image files (PNG, JPG, WEBP, etc.)');
        return;
      }

      if (file.size > 8 * 1024 * 1024) {
        alert('Image size exceeds 8MB limit. Please attach a smaller image.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:image/png;base64, prefix
        const base64Data = result.split(',')[1] || '';
        const newImg: AttachedImage = {
          id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          mimeType: file.type,
          data: base64Data,
          previewUrl: result,
        };
        setAttachedImages((prev) => [...prev, newImg]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Clipboard Paste for Screenshots (Ctrl+V / Cmd+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      processFiles(imageFiles);
    }
  };

  const removeImage = (id: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportChat = () => {
    const markdownContent = messages
      .map(
        (m) =>
          `### ${m.role === 'user' ? 'Student' : 'AI Engineering Mentor'} (${m.time})\n\n${m.text}\n\n---`
      )
      .join('\n\n');

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LearnPath-Mentor-Session-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || input).trim();
    if ((!textToSend && attachedImages.length === 0) || loading) return;

    // Check if inference is ready
    if (!inferenceReady) {
      const currentSettings = loadAISettings();
      const readiness = await checkInferenceReady(currentSettings);
      if (!readiness.ready) {
        alert(
          `AI Inference is not setup:\n${readiness.reason || 'Please configure an API key in Settings (Shortcut: Ctrl+Shift+K)'}`
        );
        return;
      }
    }

    const currentImages = [...attachedImages];
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: textToSend || 'Please analyze the attached image.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      images: currentImages.length > 0 ? currentImages : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachedImages([]);
    setLoading(true);

    try {
      const currentSettings = loadAISettings();
      const modeConfig = MENTOR_MODES[activeMode];
      const baseSystem = currentSettings.systemPrompts.mentor;

      const fullSystemPrompt = `${baseSystem}

ACTIVE MENTOR SPECIALIZATION MODE: [${modeConfig.label}]
${modeConfig.systemDirective}

Student Academic Context:
- Name: ${user.name}
- Year: ${user.year}
- Major: ${user.branch}
- Current Focus Goals: ${user.shortGoals.map((g) => user.shortGoalLabels[g] || g).join(', ')}
- Long-Term Target: ${user.longGoals.join(', ')} (${user.skillName || 'Engineering Mastery'})

Response Directives:
1. Provide technically precise, crystal-clear, and mathematically grounded answers.
2. If code is relevant, use clean, well-commented blocks with Big-O complexity annotations.
3. If an image is attached (architecture diagrams, circuits, logic formulas, whiteboard notes, code screenshot), carefully inspect every visual detail and explain it rigorously.
4. Conclude with a helpful conceptual follow-up or practice question.`;

      const prompt = `Student Query:
"${userMsg.text}"
${
  currentImages.length > 0
    ? `\n[The student has attached ${currentImages.length} image(s) for visual multimodal analysis]`
    : ''
}`;

      const res = await callAI(fullSystemPrompt, prompt, {
        maxTokens: 1400,
        images: currentImages.map((img) => ({
          mimeType: img.mimeType,
          data: img.data,
        })),
      });

      // Extract possible topic suggestion for practice shortcut
      let topicGuess = '';
      const topicMatches = textToSend.match(
        /(binary search|graph|tree|dynamic programming|sql|database|tcp|udp|os|concurrency|paging|heap|stack|queue|sorting|hashing)/i
      );
      if (topicMatches) {
        topicGuess = topicMatches[0];
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: res.text || 'Keep practicing and exploring core fundamentals!',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modeUsed: activeMode,
          modelUsed: res.providerUsed || activeModel,
          suggestedTopic: topicGuess || undefined,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: `⚠️ **Inference Request Failed**: ${
            err?.message || 'Could not connect to AI inference provider.'
          }\n\nPlease verify your API key and provider configuration by pressing **Ctrl+Shift+K** (or **Cmd+Shift+K** on Mac).`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modeUsed: activeMode,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 flex flex-col h-[calc(100vh-135px)]">
      {/* Inference Not Configured Alert Banner */}
      {!inferenceReady && (
        <div className="bg-amber-500/10 border border-amber-300/80 rounded-2xl p-3.5 px-4 flex items-center justify-between gap-3 text-amber-900 shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs">
              <span className="font-bold block">AI Inference Not Configured</span>
              <span className="text-amber-700">
                {inferenceReason || 'Configure an API key in Settings (Shortcut: Ctrl+Shift+K) to enable live mentor inference.'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <kbd className="px-2 py-1 bg-amber-100/80 border border-amber-300 rounded text-[11px] font-mono font-bold text-amber-900">
              Ctrl+Shift+K
            </kbd>
          </div>
        </div>
      )}

      {/* Header Bar with Model Capabilities & Persona Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-extrabold text-slate-900">AI Engineering Mentor</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Sparkles className="w-2.5 h-2.5" />
                {activeModel}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  capabilities.supportsVision
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {capabilities.supportsVision ? '👁️ Vision Multimodal' : '📝 Text Only'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalized for {user.name.split(' ')[0]} · {user.branch} ({user.year})
            </p>
          </div>
        </div>

        {/* Mentor Persona Selector & Chat Tools */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(Object.keys(MENTOR_MODES) as MentorMode[]).map((modeKey) => {
              const m = MENTOR_MODES[modeKey];
              const Icon = m.icon;
              const isSelected = activeMode === modeKey;
              return (
                <button
                  type="button"
                  key={modeKey}
                  onClick={() => setActiveMode(modeKey)}
                  title={`${m.label}: ${m.desc}`}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    isSelected
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{m.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportChat}
              title="Export Conversation to Markdown"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                window.speechSynthesis?.cancel();
                setSpeakingMessageId(null);
                setMessages([
                  {
                    id: `m_${Date.now()}`,
                    role: 'assistant',
                    text: `Session reset. Ready in **${MENTOR_MODES[activeMode].label}** mode. What would you like to explore?`,
                    time: 'Just now',
                    modeUsed: activeMode,
                  },
                ]);
              }}
              title="Reset Chat Session"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Preset Topics Carousel */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 text-xs no-scrollbar">
        <span className="text-slate-400 font-bold shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          Quick Topics:
        </span>
        {PRESET_TOPICS.map((p, i) => (
          <button
            type="button"
            key={i}
            onClick={() => handleSend(p)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 font-medium shrink-0 transition shadow-2xs whitespace-nowrap cursor-pointer"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const modeInfo = m.modeUsed ? MENTOR_MODES[m.modeUsed as MentorMode] : undefined;

          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`p-4 sm:p-5 rounded-2xl text-sm leading-relaxed max-w-2xl space-y-3 ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-tr-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs'
                }`}
              >
                {/* Mode Tag & Model indicator for Assistant */}
                {!isUser && modeInfo && (
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-md font-bold border ${modeInfo.badgeColor}`}>
                      {modeInfo.label}
                    </span>
                    {m.modelUsed && (
                      <span className="text-slate-400 font-mono text-[10px]">
                        via {m.modelUsed}
                      </span>
                    )}
                  </div>
                )}

                {/* Attached Images Render in Message */}
                {m.images && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {m.images.map((img) => (
                      <div
                        key={img.id}
                        className="relative rounded-xl overflow-hidden border border-white/20 max-w-[200px] max-h-[160px] bg-slate-900"
                      >
                        <img
                          src={img.previewUrl}
                          alt={img.name}
                          referrerPolicy="no-referrer"
                          className="object-cover w-full h-full max-h-[160px]"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white px-1.5 py-0.5 truncate font-mono">
                          {img.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Main Message Text (Rendered cleanly with formatting) */}
                <div className="whitespace-pre-wrap font-sans text-sm break-words">
                  {m.text}
                </div>

                {/* Suggested Assessment CTA if applicable */}
                {!isUser && m.suggestedTopic && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">
                      Ready to test your knowledge on {m.suggestedTopic}?
                    </span>
                    <button
                      type="button"
                      onClick={() => onLaunchPractice(m.suggestedTopic!)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3" />
                      Take Assessment
                    </button>
                  </div>
                )}

                {/* Footer Controls: Timestamp, TTS, Copy */}
                <div
                  className={`flex items-center justify-between pt-1 text-[10px] ${
                    isUser ? 'text-indigo-200' : 'text-slate-400'
                  }`}
                >
                  <span>{m.time}</span>

                  <div className="flex items-center gap-1.5">
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleToggleSpeak(m.id, m.text)}
                        title={speakingMessageId === m.id ? 'Stop Narration' : 'Listen to Explanation (Audio TTS)'}
                        className={`p-1 rounded hover:bg-slate-200 text-slate-500 transition cursor-pointer ${
                          speakingMessageId === m.id ? 'text-indigo-600 bg-indigo-50 font-bold' : ''
                        }`}
                      >
                        {speakingMessageId === m.id ? (
                          <VolumeX className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopy(m.text, m.id)}
                      title="Copy response text"
                      className={`p-1 rounded hover:bg-white/20 transition cursor-pointer ${
                        isUser ? 'text-indigo-200 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {copiedId === m.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-xs italic flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              AI Mentor ({MENTOR_MODES[activeMode].label}) is formulating an engineering explanation...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Container with Multimedia Upload & Voice */}
      <div
        onPaste={handlePaste}
        className="bg-white rounded-2xl border border-slate-200 p-2.5 sm:p-3 shadow-xs space-y-2 shrink-0"
      >
        {/* Attached Images Preview Row */}
        {attachedImages.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 pl-1">Attached for Vision:</span>
            {attachedImages.map((img) => (
              <div
                key={img.id}
                className="relative group shrink-0 rounded-lg overflow-hidden border border-slate-300 w-14 h-14 bg-slate-900"
              >
                <img
                  src={img.previewUrl}
                  alt={img.name}
                  referrerPolicy="no-referrer"
                  className="object-cover w-full h-full"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Bar & Controls */}
        <div className="flex items-center gap-2">
          {/* File Upload Trigger */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            multiple
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={
              capabilities.supportsVision
                ? 'Attach Image / Diagram (Vision Multimodal)'
                : 'Current model is text-only. Switch to Gemini or Claude in settings for vision.'
            }
            className={`p-2.5 rounded-xl border transition cursor-pointer ${
              capabilities.supportsVision
                ? 'border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 bg-slate-50'
                : 'border-slate-200 text-slate-300 bg-slate-50/50'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          {/* Voice Speech Recognition Toggle */}
          <button
            type="button"
            onClick={toggleVoiceListening}
            title={isListening ? 'Stop Speech Dictation' : 'Dictate with Voice (Speech Recognition)'}
            className={`p-2.5 rounded-xl border transition cursor-pointer ${
              isListening
                ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse'
                : 'border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 bg-slate-50'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Textarea Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={
              isListening
                ? 'Listening to your voice...'
                : capabilities.supportsVision
                ? 'Ask a technical doubt, paste a screenshot (Ctrl+V), or request a proof...'
                : 'Ask a technical doubt, explain an algorithm, or ask for interview questions...'
            }
            className="flex-1 px-3 py-2 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />

          {/* Send Button */}
          <button
            type="button"
            disabled={loading || (!input.trim() && attachedImages.length === 0)}
            onClick={() => handleSend()}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
