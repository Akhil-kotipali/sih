import React, { useState, useEffect } from 'react';
import { UserProfile, LiveResource } from '../types';
import {
  searchLiveResources,
  PLATFORM_SEARCH_HUBS,
} from '../services/resourceService';
import {
  loadBookmarkedResources,
  toggleBookmarkResource,
} from '../services/storageService';
import {
  Search,
  BookOpen,
  Video,
  FileText,
  Code,
  Award,
  Bookmark,
  ExternalLink,
  Sparkles,
  Filter,
  Check,
  Zap,
  Bot,
} from 'lucide-react';

interface LiveResourcesSearchProps {
  user?: UserProfile;
  initialQuery?: string;
  onLaunchPracticeTopic?: (topic: string) => void;
  onLaunchMentor?: (topic: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All Resources', icon: Search },
  { id: 'video', label: 'Video Lessons', icon: Video },
  { id: 'article', label: 'In-Depth Articles', icon: BookOpen },
  { id: 'documentation', label: 'Official Docs & Texts', icon: FileText },
  { id: 'practice', label: 'Problem Sets & Exercises', icon: Code },
  { id: 'interactive', label: 'Interactive Courses', icon: Award },
];

const POPULAR_TOPICS = [
  'Linear Algebra Matrix Invariants',
  'Organic Chemistry Synthesis Reactions',
  'Macroeconomics Fiscal & Monetary Policy',
  'Constitutional Due Process & Law',
  'Cellular Respiration & Krebs Cycle',
  'Spanish Subjunctive Verb Conjugation',
  'Database Indexing & ACID Guarantees',
  'Distributed Systems Concurrency',
];

export const LiveResourcesSearch: React.FC<LiveResourcesSearchProps> = ({
  user,
  initialQuery = 'Linear Algebra Matrix Invariants',
  onLaunchPracticeTopic,
  onLaunchMentor,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string>('all');
  const [resources, setResources] = useState<LiveResource[]>([]);
  const [hubLinks, setHubLinks] = useState<{ name: string; url: string; badge: string; color: string }[]>([]);
  const [isLiveGrounding, setIsLiveGrounding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [bookmarks, setBookmarks] = useState<LiveResource[]>([]);

  useEffect(() => {
    setBookmarks(loadBookmarkedResources(user?.id));
    handleSearch(initialQuery);
  }, [user?.id]);

  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
      handleSearch(initialQuery, category);
    }
  }, [initialQuery]);

  const handleSearch = async (searchTerm: string, cat = category) => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const res = await searchLiveResources({
        query: searchTerm,
        category: cat as any,
      });
      setResources(res.resources);
      setHubLinks(res.hubLinks);
      setIsLiveGrounding(res.isLiveGrounding);
    } catch (e) {
      console.error('Resource search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const onSelectPill = (topic: string) => {
    setQuery(topic);
    handleSearch(topic, category);
  };

  const handleCategoryChange = (catId: string) => {
    setCategory(catId);
    handleSearch(query, catId);
  };

  const handleToggleBookmark = (res: LiveResource) => {
    toggleBookmarkResource(res);
    setBookmarks(loadBookmarkedResources());
    setResources((prev) =>
      prev.map((r) => (r.id === res.id ? { ...r, isBookmarked: !r.isBookmarked } : r))
    );
  };

  const displayList = bookmarkedOnly
    ? bookmarks
    : category === 'all'
    ? resources
    : resources.filter((r) => r.type === category);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Search Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Live Technical Resources Discovery
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Search Authoritative Learning Materials
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              bookmarkedOnly
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 text-slate-700 hover:border-slate-400 bg-white'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${bookmarkedOnly ? 'fill-indigo-600' : ''}`} />
            Saved Bookmarks ({bookmarks.length})
          </button>
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-200 rounded-2xl p-2 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition">
          <Search className="w-5 h-5 text-slate-400 ml-2 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            placeholder="Search any subject, algorithm, library, or engineering exam topic..."
            className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none px-2"
          />
          <button
            type="button"
            disabled={loading || !query.trim()}
            onClick={() => handleSearch(query)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:bg-slate-300"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              'Search Live'
            )}
          </button>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="font-bold text-slate-400 shrink-0">Popular:</span>
          {POPULAR_TOPICS.map((topic, i) => (
            <button
              type="button"
              key={i}
              onClick={() => onSelectPill(topic)}
              className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-medium shrink-0 transition"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {/* Direct Hub Grounding Bar */}
      {hubLinks.length > 0 && !bookmarkedOnly && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2.5">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Direct 1-Click Search Hubs for "{query}"
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {PLATFORM_SEARCH_HUBS.map((hub, idx) => {
              const url = hub.buildUrl(query);
              return (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 hover:shadow-xs group ${hub.color}`}
                >
                  <span className="text-xs font-bold leading-tight group-hover:underline flex items-center gap-1">
                    {hub.name}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </span>
                  <span className="text-[10px] opacity-75 font-medium">{hub.badge}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Filter Pills */}
      {!bookmarkedOnly && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat.id;
            const Icon = cat.icon;
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Results Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {bookmarkedOnly
              ? `Saved Bookmarks (${displayList.length})`
              : `${displayList.length} Curated Resources for "${query}"`}
            {isLiveGrounding && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] normal-case font-semibold">
                AI Web Grounded
              </span>
            )}
          </div>
        </div>

        {displayList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3 shadow-xs">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">No resources found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {bookmarkedOnly
                ? "You haven't bookmarked any resources yet. Click the bookmark icon on any resource card to save it."
                : 'Try adjusting your search keywords or switching category filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayList.map((res) => {
              const isBookmarked = res.isBookmarked || bookmarks.some((b) => b.url === res.url);

              return (
                <div
                  key={res.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 p-5 shadow-xs transition flex flex-col justify-between gap-3 space-y-2 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold">
                          {res.source}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold uppercase">
                          {res.type}
                        </span>
                        {res.difficulty && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            · {res.difficulty}
                          </span>
                        )}
                        {res.duration && (
                          <span className="text-[11px] text-slate-400">· {res.duration}</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleBookmark(res)}
                        className={`p-1.5 rounded-lg border transition ${
                          isBookmarked
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                            : 'border-slate-200 text-slate-400 hover:text-slate-700 bg-white'
                        }`}
                        title="Bookmark resource"
                      >
                        <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-indigo-600' : ''}`} />
                      </button>
                    </div>

                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug"
                    >
                      {res.title}
                    </a>

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {res.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {res.tags?.slice(0, 2).map((t, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      {onLaunchMentor && (
                        <button
                          type="button"
                          onClick={() => onLaunchMentor(res.tags?.[0] || query)}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Discuss this topic with AI Mentor"
                        >
                          <Bot className="w-3 h-3 text-purple-600" /> Mentor
                        </button>
                      )}

                      {onLaunchPracticeTopic && (
                        <button
                          type="button"
                          onClick={() => onLaunchPracticeTopic(res.tags?.[0] || query)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Zap className="w-3 h-3" /> Practice
                        </button>
                      )}

                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1 shrink-0"
                      >
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
