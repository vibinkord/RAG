import React, { useState, useEffect } from 'react';
import { websiteStore } from '../store/websiteStore';
import { apiService } from '../services/api';
import { Website, SearchResult, DebugResult } from '../types';
import { 
  Search, 
  Info, 
  ExternalLink, 
  Sliders, 
  Layers, 
  HelpCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  CheckCircle,
  FileText
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';

// Friendly domain mapping helper
const getFriendlyName = (url: string): string => {
  try {
    const cleanUrl = url.trim().toLowerCase();
    const host = new URL(cleanUrl.startsWith('http') ? cleanUrl : 'https://' + cleanUrl).hostname;
    const mappings: Record<string, string> = {
      'spring.io': 'Spring Documentation',
      'react.dev': 'React Core Docs',
      'nextjs.org': 'Next.js Framework Docs',
      'tailwindcss.com': 'Tailwind Style Guide',
      'github.com': 'GitHub Hub',
      'claysys.com': 'ClaySys Knowledge Base'
    };
    const hostKey = host.replace(/^www\./, '');
    if (mappings[hostKey]) return mappings[hostKey];
    return hostKey;
  } catch (e) {
    return url;
  }
};

export const SearchPlayground: React.FC = () => {
  const [query, setQuery] = useState('');
  const [websites, setWebsites] = useState<Website[]>([]);
  
  // Parameters
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>('all');
  const [selectedPageType, setSelectedPageType] = useState<string>('');
  const [minSimilarity, setMinSimilarity] = useState<number>(0.35);
  const [limit, setLimit] = useState<number>(5);
  
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Results
  const [regularResults, setRegularResults] = useState<SearchResult[]>([]);
  const [debugResults, setDebugResults] = useState<DebugResult[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Expanded state
  const [expandedChunks, setExpandedChunks] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const list = websiteStore.getWebsites().filter(w => w.status === 'CRAWLED');
    setWebsites(list);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setHasSearched(true);
    setExpandedChunks({});

    const siteId = selectedWebsiteId === 'all' ? undefined : parseInt(selectedWebsiteId);

    try {
      if (isDebugMode) {
        const res = await apiService.searchDebug(
          query,
          siteId,
          undefined,
          selectedPageType || undefined,
          limit
        );
        setDebugResults(res.results);
        setRegularResults([]);
        setLatencyMs(res.latencyMs);
      } else {
        const res = await apiService.search(
          query,
          siteId,
          undefined,
          selectedPageType || undefined,
          minSimilarity,
          limit
        );
        setRegularResults(res.results);
        setDebugResults([]);
        setLatencyMs(res.latencyMs);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.response?.data?.message || e.message || 'Search Explorer encountered an error. Verify your local services.');
    } finally {
      setLoading(false);
    }
  };

  const toggleChunkExpand = (chunkId: number) => {
    setExpandedChunks(prev => ({ ...prev, [chunkId]: !prev[chunkId] }));
  };

  const renderScoreBar = (score: number) => {
    const barPercent = Math.min(100, Math.max(0, Math.round(score * 100)));
    const blockCount = Math.round(barPercent / 10);
    const blocks = '█'.repeat(blockCount) + '░'.repeat(10 - blockCount);
    
    return (
      <div className="flex items-center space-x-2.5 font-mono text-xs">
        <span className={score >= 0.6 ? 'text-emerald-400' : score >= 0.4 ? 'text-blue-400' : 'text-amber-400'}>
          {blocks}
        </span>
        <span className="text-zinc-300 font-semibold">{score.toFixed(4)}</span>
      </div>
    );
  };

  const websiteOptions = [
    { value: 'all', label: 'All Knowledge Sources' },
    ...websites.map(w => ({ value: w.id.toString(), label: getFriendlyName(w.url) }))
  ];

  // Pipeline Stepper
  const stepperSteps = [
    { label: 'Input Parsed', desc: `"${query || 'Query'}"`, active: hasSearched },
    { label: 'Create Embeddings', desc: 'nomic-embed-text 768d', active: hasSearched && !loading },
    { label: 'Content Search', desc: `pgvector threshold: ${minSimilarity}`, active: hasSearched && !loading && (regularResults.length > 0 || debugResults.length > 0) },
    { label: 'Final Matches', desc: isDebugMode ? 'Reciprocal Rank Fusion (RRF)' : 'Similarity Weighting', active: hasSearched && !loading && (regularResults.length > 0 || debugResults.length > 0) }
  ];

  return (
    <div className="space-y-8 w-full animate-fade-in">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-50 tracking-tight">Search Explorer</h2>
          <p className="text-xs text-zinc-400 mt-1">Audit content indexing, check matching ratings, and trace hybrid search queries.</p>
        </div>
        
        {/* Toggle Mode */}
        <div className="inline-flex rounded border border-zinc-800 p-0.5 bg-zinc-950 self-start shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsDebugMode(false);
              setHasSearched(false);
              setRegularResults([]);
              setDebugResults([]);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              !isDebugMode 
                ? 'bg-zinc-850 text-white shadow-sm' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Standard Search
          </button>
          <button
            type="button"
            onClick={() => {
              setIsDebugMode(true);
              setHasSearched(false);
              setRegularResults([]);
              setDebugResults([]);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              isDebugMode 
                ? 'bg-zinc-850 text-white shadow-sm' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Audit Breakdowns
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Setup Parameters */}
        <div className="space-y-6">
          <Card className="bg-[#111827] border-zinc-800">
            <CardHeader className="p-5 border-b border-zinc-850">
              <div className="flex items-center space-x-2">
                <Sliders className="h-4 w-4 text-zinc-400" />
                <CardTitle className="text-sm font-semibold">Explorer Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSearch} className="space-y-5">
                
                {/* Query */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Search Phrase</label>
                  <div className="relative">
                    <Input 
                      type="text"
                      placeholder="Type words or questions..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      required
                      className="bg-black border-zinc-850 pr-10 text-xs h-10"
                    />
                    <Search className="absolute right-3.5 top-3 h-4 w-4 text-zinc-500" />
                  </div>
                </div>

                {/* Scope */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Knowledge Source Target</label>
                  <Select 
                    value={selectedWebsiteId}
                    onChange={(e) => setSelectedWebsiteId(e.target.value)}
                    options={websiteOptions}
                    className="text-xs h-10 bg-black border-zinc-850"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Page Type Category</label>
                  <Input 
                    type="text"
                    placeholder="e.g. guide, API, tutorial"
                    value={selectedPageType}
                    onChange={(e) => setSelectedPageType(e.target.value)}
                    className="text-xs h-10 bg-black border-zinc-850"
                  />
                </div>

                {/* Min Similarity slider */}
                {!isDebugMode && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-400 font-medium">Similarity Threshold</span>
                      <span className="font-mono text-zinc-300">{minSimilarity}</span>
                    </div>
                    <input 
                      type="range"
                      min="0.10"
                      max="0.80"
                      step="0.05"
                      value={minSimilarity}
                      onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                      className="w-full accent-blue-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                    />
                  </div>
                )}

                {/* Limit result count */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400 font-medium">Segments Limit</span>
                    <span className="font-mono text-zinc-300">{limit} items</span>
                  </div>
                  <input 
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value))}
                    className="w-full accent-blue-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={loading || !query.trim()}
                  className="w-full h-10 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/10"
                >
                  {loading ? 'Searching index...' : 'Search Explorer'}
                </Button>

              </form>
            </CardContent>
          </Card>

          <Card className="bg-[#111827] border-zinc-800 text-xs text-zinc-400">
            <CardContent className="p-5 flex items-start gap-2">
              <Info className="h-4.5 w-4.5 text-zinc-500 shrink-0 mt-0.5" />
              <span>
                {isDebugMode 
                  ? "Audit Breakdowns view displays reciprocal rank weights calculated by combined database search indexes."
                  : "Standard mode searches database paragraph entries and rates cosine similarity scores."
                }
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Stepper Pipeline */}
          {hasSearched && (
            <Card className="bg-[#111827] border-zinc-800">
              <CardHeader className="p-5 pb-2 border-b-0">
                <CardTitle className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Search Execution Stepper</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 relative">
                  <div className="hidden md:block absolute top-[18px] left-[12%] right-[12%] h-0.5 bg-zinc-800 z-0"></div>
                  
                  {stepperSteps.map((step, i) => (
                    <div key={i} className="flex md:flex-col items-center md:text-center space-x-3 md:space-x-0 md:space-y-2.5 z-10">
                      <span className={`h-8 w-8 rounded-full border flex items-center justify-center shrink-0 text-xs font-mono font-bold ${
                        step.active 
                          ? 'bg-blue-600/10 border-blue-500 text-blue-400' 
                          : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="flex flex-col text-left md:text-center min-w-0">
                        <span className="text-xs font-semibold text-zinc-300">{step.label}</span>
                        <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[150px] md:max-w-none">{step.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Matches lists */}
          <Card className="bg-[#111827] border-zinc-800 min-h-[400px] flex flex-col">
            <CardHeader className="p-5 border-b border-zinc-850 flex flex-row items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="h-4 w-4 text-zinc-400" />
                <CardTitle className="text-sm font-semibold">Retrieved Segments</CardTitle>
              </div>
              {hasSearched && latencyMs !== null && (
                <span className="text-[10px] text-zinc-500 font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                  Latency: {latencyMs} ms
                </span>
              )}
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-between">
              
              {errorMsg && (
                <div className="bg-red-950/20 border border-red-900 p-4 rounded text-xs text-red-300 mb-6">
                  {errorMsg}
                </div>
              )}

              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-xs text-zinc-400 font-mono">Running index calculations...</p>
                </div>
              ) : !hasSearched ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-3 max-w-sm mx-auto">
                  <Search className="h-10 w-10 text-zinc-700" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-300">Explorer Ready</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Enter search phrases to evaluate index coordinates and check matching similarity scores.
                    </p>
                  </div>
                </div>
              ) : !isDebugMode && regularResults.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-1.5">
                  <HelpCircle className="h-6 w-6 text-zinc-650" />
                  <p className="text-xs text-zinc-400 font-medium">No segments matched active parameters.</p>
                </div>
              ) : isDebugMode && debugResults.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-1">
                  <HelpCircle className="h-6 w-6 text-zinc-650" />
                  <p className="text-xs text-zinc-400">No results found for audit.</p>
                </div>
              ) : (
                
                <div className="space-y-5 flex-1">
                  
                  {/* STANDARD SEARCH RESULTS */}
                  {!isDebugMode && regularResults.map((res) => (
                    <div 
                      key={res.chunkId} 
                      className="border border-zinc-800 bg-[#1F2937]/10 rounded p-4.5 space-y-3 hover:border-zinc-700/80 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 font-mono text-[9px] text-zinc-500">
                            <span className="font-semibold text-zinc-400 bg-zinc-800 px-1 rounded-sm">ID: {res.chunkId}</span>
                            <span>&bull;</span>
                            <span className="truncate max-w-xs md:max-w-sm select-all">{res.sourceUrl}</span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center space-x-3">
                          <span className="text-[10px] text-zinc-500 font-mono">Similarity Matches:</span>
                          {renderScoreBar(res.score)}
                        </div>
                      </div>

                      {/* Content preview */}
                      <div className="text-xs text-zinc-300 font-mono leading-relaxed bg-zinc-950 border border-zinc-850 p-3 rounded max-h-56 overflow-y-auto whitespace-pre-wrap select-all">
                        {expandedChunks[res.chunkId] ? res.content : res.snippet}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                        <a 
                          href={res.sourceUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="hover:text-white flex items-center gap-1"
                        >
                          Visit Original URL <ExternalLink className="h-2.5 w-2.5 text-zinc-650" />
                        </a>
                        
                        {res.content !== res.snippet && (
                          <button 
                            onClick={() => toggleChunkExpand(res.chunkId)} 
                            className="hover:text-white flex items-center gap-0.5"
                          >
                            {expandedChunks[res.chunkId] ? (
                              <>Collapse full content <ChevronUp className="h-3.5 w-3.5" /></>
                            ) : (
                              <>Show full content ({res.content.length} chars) <ChevronDown className="h-3.5 w-3.5" /></>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* AUDIT BREAKDOWNS TABLE */}
                  {isDebugMode && (
                    <div className="overflow-x-auto border border-zinc-850 rounded">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-zinc-950 hover:bg-zinc-950 border-zinc-850">
                            <TableHead className="w-[80px]">ID</TableHead>
                            <TableHead>Document Title & URL</TableHead>
                            <TableHead className="font-mono text-center">Vector Cosine</TableHead>
                            <TableHead className="font-mono text-center">FTS Rank</TableHead>
                            <TableHead className="font-mono text-center">Combined Score</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {debugResults.map((res) => (
                            <React.Fragment key={res.chunkId}>
                              <TableRow className="hover:bg-zinc-800/10 border-zinc-850">
                                <TableCell className="font-mono text-xs text-zinc-500">{res.chunkId}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col space-y-0.5 max-w-[150px] sm:max-w-xs md:max-w-sm">
                                    <span className="text-xs font-semibold text-zinc-200 truncate">{res.pageTitle || 'Untitled page'}</span>
                                    <span className="text-[9px] text-zinc-500 truncate font-mono">{res.sourceUrl}</span>
                                    {res.pageType && (
                                      <span className="inline-flex self-start mt-1 text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1 rounded-sm uppercase font-mono">
                                        {res.pageType}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-xs text-center text-zinc-400">
                                  {res.rawVectorScore !== null ? res.rawVectorScore.toFixed(4) : '-'}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-center text-zinc-400">
                                  {res.rankingScore !== null ? res.rankingScore.toFixed(4) : '-'}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-center font-bold text-zinc-100">
                                  {renderScoreBar(res.similarityScore)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <button
                                    onClick={() => toggleChunkExpand(res.chunkId)}
                                    className="text-[10px] text-zinc-400 hover:text-white underline font-medium"
                                  >
                                    {expandedChunks[res.chunkId] ? 'Hide' : 'Inspect'}
                                  </button>
                                </TableCell>
                              </TableRow>
                              {expandedChunks[res.chunkId] && (
                                <TableRow className="bg-zinc-950/40 border-b border-zinc-850">
                                  <TableCell colSpan={6} className="p-4">
                                    <div className="space-y-2">
                                      <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest block">Raw Segment Content</span>
                                      <pre className="text-[10.5px] leading-relaxed text-zinc-300 bg-black border border-zinc-850 p-4 rounded font-mono whitespace-pre-wrap select-all max-h-60 overflow-y-auto">
                                        {res.content}
                                      </pre>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default SearchPlayground;
