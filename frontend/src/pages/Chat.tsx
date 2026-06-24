import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { websiteStore } from '../store/websiteStore';
import { apiService } from '../services/api';
import { Website, SourceDto } from '../types';
import { cn } from '../lib/utils';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Trash2, 
  Plus, 
  ExternalLink, 
  Loader2, 
  Clock, 
  ChevronRight,
  Sliders,
  Copy,
  Check,
  FileText,
  PanelRightClose,
  PanelRight,
  Layers,
  Database,
  Cpu,
  HelpCircle,
  ChevronDown
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceDto[];
  chunksUsed?: string[];
  totalLatencyMs?: number;
  retrievalLatencyMs?: number;
  generationLatencyMs?: number;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: string; // ISO string
  messages: ChatMessage[];
  selectedWebsiteId?: string;
  selectedPageType?: string;
}

const SUGGESTED_QUESTIONS = [
  "What is Spring Boot?",
  "Explain reactive programming",
  "What is Spring Security?",
  "Summarize this website"
];

// Domain friendly naming helper
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

export const Chat: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Search filter scopes
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>('all');
  const [selectedPageType, setSelectedPageType] = useState<string>('');
  const [minSimilarity, setMinSimilarity] = useState<number>(0.35);
  const [topK, setTopK] = useState<number>(4);
  
  // Toggles
  const [showConfig, setShowConfig] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  // Chat sessions history list (localStorage backed)
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [thinkingPhase, setThinkingPhase] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load registered websites & session list on mount
  useEffect(() => {
    const list = websiteStore.getWebsites().filter(w => w.status === 'CRAWLED');
    setWebsites(list);

    // Initialize session history from local storage
    const storedHistory = localStorage.getItem('ragbot_chat_history');
    if (storedHistory) {
      try {
        setSessions(JSON.parse(storedHistory));
      } catch (e) {
        console.error('Failed to parse chat sessions', e);
      }
    }

    // Set initial active session ID
    const websiteParam = searchParams.get('websiteId');
    if (websiteParam) {
      setSelectedWebsiteId(websiteParam);
    }
    
    // Create new blank session on mount
    createNewSession();
  }, []);

  // Update thinking loader sequences
  useEffect(() => {
    if (!loading) {
      setThinkingPhase(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingPhase(prev => (prev + 1) % 3);
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const createNewSession = () => {
    const newId = Math.random().toString(36).substring(2, 15);
    setSessionId(newId);
    setMessages([]);
    setInputMessage('');
    // Remove query params
    setSearchParams({});
  };

  // Persist session messages to local storage history
  const persistSession = (updatedMessages: ChatMessage[]) => {
    if (updatedMessages.length === 0) return;

    setSessions(prev => {
      const existingIdx = prev.findIndex(s => s.id === sessionId);
      const firstUserMsg = updatedMessages.find(m => m.role === 'user')?.content || 'New Conversation';
      const title = firstUserMsg.length > 28 ? firstUserMsg.substring(0, 26) + '...' : firstUserMsg;

      const sessionObj: ChatSession = {
        id: sessionId,
        title,
        timestamp: new Date().toISOString(),
        messages: updatedMessages,
        selectedWebsiteId,
        selectedPageType
      };

      let newSessions = [...prev];
      if (existingIdx !== -1) {
        newSessions[existingIdx] = sessionObj;
      } else {
        newSessions.unshift(sessionObj);
      }
      localStorage.setItem('ragbot_chat_history', JSON.stringify(newSessions));
      return newSessions;
    });
  };

  // Load an existing thread from history
  const handleLoadSession = (sess: ChatSession) => {
    setSessionId(sess.id);
    setMessages(sess.messages);
    if (sess.selectedWebsiteId) setSelectedWebsiteId(sess.selectedWebsiteId);
    if (sess.selectedPageType) setSelectedPageType(sess.selectedPageType);
  };

  // Delete a session thread
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      localStorage.setItem('ragbot_chat_history', JSON.stringify(filtered));
      return filtered;
    });
    if (sessionId === id) {
      createNewSession();
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: text
    };

    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInputMessage('');
    setLoading(true);

    try {
      const siteId = selectedWebsiteId === 'all' ? undefined : parseInt(selectedWebsiteId);
      const res = await apiService.chat(
        sessionId,
        text,
        siteId,
        undefined,
        selectedPageType || undefined,
        minSimilarity,
        topK
      );

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: res.answer,
        sources: res.sources,
        chunksUsed: res.chunksUsed,
        totalLatencyMs: res.totalLatencyMs,
        retrievalLatencyMs: res.retrievalLatencyMs,
        generationLatencyMs: res.generationLatencyMs
      };

      const finalMsgs = [...newMsgs, assistantMsg];
      setMessages(finalMsgs);
      persistSession(finalMsgs);
    } catch (e: any) {
      console.error(e);
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: `Error: ${e.response?.data?.message || e.message || 'Verification check: Ensure backend and LLM server are running.'}`
      };
      const finalMsgs = [...newMsgs, errorMsg];
      setMessages(finalMsgs);
      persistSession(finalMsgs);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const websiteOptions = [
    { value: 'all', label: 'All Knowledge Sources' },
    ...websites.map(w => ({ value: w.id.toString(), label: getFriendlyName(w.url) }))
  ];

  // Group sessions by relative periods
  const getGroupedSessions = () => {
    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const earlier: ChatSession[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    sessions.forEach(s => {
      const time = new Date(s.timestamp).getTime();
      if (time >= todayStart) {
        today.push(s);
      } else if (time >= yesterdayStart) {
        yesterday.push(s);
      } else {
        earlier.push(s);
      }
    });

    return { today, yesterday, earlier };
  };

  const groupedSessions = getGroupedSessions();
  const lastReply = [...messages].reverse().find(m => m.role === 'assistant');

  const thinkingMessages = [
    "Searching your content...",
    "Analyzing references...",
    "Formulating response..."
  ];

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-5 w-full relative overflow-hidden animate-fade-in">
      
      {/* 1. Left Sidebar: Recent Conversations */}
      <aside className="w-60 h-full border border-zinc-800 bg-[#111827] rounded flex flex-col justify-between shrink-0 overflow-y-auto">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest">Conversations</span>
            <button 
              onClick={createNewSession}
              className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
              title="New thread"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {sessions.length === 0 ? (
              <div className="text-center py-10 px-2 space-y-1">
                <HelpCircle className="h-6 w-6 text-zinc-700 mx-auto" />
                <p className="text-[10px] text-zinc-550 leading-normal">
                  No conversation history found.
                </p>
              </div>
            ) : (
              <>
                {/* Today */}
                {groupedSessions.today.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest px-2.5 block py-0.5">Today</span>
                    {groupedSessions.today.map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => handleLoadSession(s)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] cursor-pointer hover:bg-zinc-800 transition-colors group",
                          sessionId === s.id ? "bg-zinc-800/80 text-blue-400 font-semibold" : "text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        <span className="truncate max-w-[130px]">{s.title}</span>
                        <button 
                          onClick={(e) => handleDeleteSession(s.id, e)} 
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5"
                          title="Delete thread"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Yesterday */}
                {groupedSessions.yesterday.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest px-2.5 block py-0.5">Yesterday</span>
                    {groupedSessions.yesterday.map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => handleLoadSession(s)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] cursor-pointer hover:bg-zinc-800 transition-colors group",
                          sessionId === s.id ? "bg-zinc-800/80 text-blue-400 font-semibold" : "text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        <span className="truncate max-w-[130px]">{s.title}</span>
                        <button 
                          onClick={(e) => handleDeleteSession(s.id, e)} 
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Earlier */}
                {groupedSessions.earlier.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest px-2.5 block py-0.5">Earlier</span>
                    {groupedSessions.earlier.map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => handleLoadSession(s)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] cursor-pointer hover:bg-zinc-800 transition-colors group",
                          sessionId === s.id ? "bg-zinc-800/80 text-blue-400 font-semibold" : "text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        <span className="truncate max-w-[130px]">{s.title}</span>
                        <button 
                          onClick={(e) => handleDeleteSession(s.id, e)} 
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </aside>

      {/* 2. Middle Column: Main Conversation view */}
      <div className="flex-1 flex flex-col h-full bg-[#111827] border border-zinc-800 rounded overflow-hidden">
        
        {/* Chat top header */}
        <div className="h-14 border-b border-zinc-800 bg-[#0F172A] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center space-x-3">
            <Select 
              value={selectedWebsiteId}
              onChange={(e) => setSelectedWebsiteId(e.target.value)}
              options={websiteOptions}
              className="h-8 text-xs bg-zinc-900 border-zinc-800 w-52 sm:w-60"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowConfig(!showConfig)}
              className="text-zinc-400 hover:text-white text-xs h-8"
            >
              <Sliders className="h-4 w-4 mr-1" />
              Params
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowRightSidebar(!showRightSidebar)}
              className="text-zinc-400 hover:text-white hidden lg:flex text-xs h-8"
              title="Toggle references panel"
            >
              {showRightSidebar ? <PanelRightClose className="h-4 w-4 mr-1" /> : <PanelRight className="h-4 w-4 mr-1" />}
              Details
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={createNewSession}
              className="h-8 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs px-2.5"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Thread
            </Button>
          </div>
        </div>

        {/* Message bubbles body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#111827]">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto text-center space-y-8 py-8 animate-fade-in">
              <div className="space-y-3.5">
                <h3 className="text-2xl font-bold text-slate-100 tracking-tight">What would you like to know?</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Ask anything about your connected knowledge sources. RAGBot will locate references and generate a structured response.
                </p>
              </div>

              {/* Suggestions Prompts Deck */}
              <div className="w-full space-y-3 pt-6">
                <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest block text-left">Suggested Questions</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSendMessage(q)}
                      className="w-full text-left text-xs bg-zinc-900 border border-zinc-800/80 p-3.5 rounded hover:bg-zinc-800/40 hover:border-zinc-700 transition-all flex items-center justify-between group shadow-sm"
                    >
                      <span className="truncate text-zinc-300 font-medium">{q}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-550 group-hover:text-zinc-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Assistant Avatar */}
                  {msg.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full bg-blue-600/15 border border-blue-900/60 flex items-center justify-center shrink-0">
                      <Bot className="h-4.5 w-4.5 text-blue-500" />
                    </div>
                  )}

                  {/* Message Bubble Card */}
                  <div className={`space-y-3 max-w-[80%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                    <div className={`p-4 rounded text-xs leading-relaxed whitespace-pre-wrap select-text border ${
                      msg.role === 'user' 
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-100 rounded-br-none shadow-sm' 
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-200 rounded-bl-none shadow-sm'
                    }`}>
                      {msg.content}

                      {/* Assistant Stats Footer */}
                      {msg.role === 'assistant' && (
                        <div className="flex items-center justify-between mt-3.5 pt-3.5 border-t border-zinc-800/40 text-[9px] text-zinc-550 font-mono">
                          {msg.totalLatencyMs ? (
                            <div className="flex items-center space-x-2">
                              <Clock className="h-3 w-3 text-zinc-600" />
                              <span>Response generated in {msg.totalLatencyMs}ms (search: {msg.retrievalLatencyMs}ms, synthesis: {msg.generationLatencyMs}ms)</span>
                            </div>
                          ) : (
                            <div />
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="h-5 px-1.5 text-[9px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3 w-3 mr-1 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3 mr-1" />
                            )}
                            Copy
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Perplexity-style Citation Cards Upgrade */}
                    {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-semibold text-zinc-550 uppercase tracking-widest block">References</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {msg.sources.map((src, i) => {
                            const matchPercent = Math.round(src.score * 100);
                            return (
                              <Card key={i} className="bg-zinc-900 border-zinc-850 hover:border-zinc-800 transition-colors shadow-sm">
                                <CardContent className="p-3.5 space-y-2">
                                  <div className="flex items-start justify-between gap-2.5">
                                    <h5 className="text-[11px] font-bold text-zinc-300 truncate max-w-[130px]">
                                      {getFriendlyName(src.url)} Reference
                                    </h5>
                                    <Badge variant={matchPercent >= 60 ? 'success' : 'default'} className="text-[8px] font-mono shrink-0">
                                      {matchPercent}% match
                                    </Badge>
                                  </div>
                                  <p className="text-[9.5px] font-mono text-zinc-550 truncate select-all">{src.url.replace(/^https?:\/\//i, '')}</p>
                                  <blockquote className="text-[10.5px] leading-normal text-zinc-400 border-l border-zinc-800 pl-2 bg-zinc-950/20 py-1 line-clamp-2">
                                    "{src.snippet}"
                                  </blockquote>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* User avatar */}
                  {msg.role === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shrink-0 order-3 shadow-md">
                      <User className="h-4.5 w-4.5 text-black" />
                    </div>
                  )}
                </div>
              ))}

              {/* Sequential Loading Indicator */}
              {loading && (
                <div className="flex gap-4 justify-start">
                  <div className="h-8 w-8 rounded-full bg-blue-600/10 border border-blue-900 flex items-center justify-center shrink-0">
                    <Bot className="h-4.5 w-4.5 text-blue-500 animate-pulse" />
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-800 p-4 rounded text-xs text-zinc-400 flex items-center space-x-2.5 rounded-bl-none shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                    <span>{thinkingMessages[thinkingPhase]}</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Fixed Prompt Input Area */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputMessage);
          }}
          className="p-4 border-t border-zinc-800 bg-[#0F172A] shrink-0"
        >
          <div className="flex items-center space-x-2">
            <Input 
              type="text" 
              placeholder="Ask anything about your connected content..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={loading}
              className="bg-zinc-900 border-zinc-800 flex-1 text-zinc-200 h-10 text-xs shadow-inner"
            />
            <Button 
              type="submit" 
              disabled={loading || !inputMessage.trim()}
              className="h-10 w-10 p-0 shrink-0 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-lg shadow-blue-500/10"
            >
              <Send className="h-4.5 w-4.5" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2.5 px-1 text-[10px] text-zinc-550">
            <span>Context matched using pgvector hybrid search and answered by local Ollama model.</span>
            {selectedWebsiteId !== 'all' && (
              <span className="text-zinc-400 font-mono">
                Scope: {websites.find(w => w.id.toString() === selectedWebsiteId)?.url.replace(/^https?:\/\//i, '') || selectedWebsiteId}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* 3. Right Sidebar: Context Detail drawer (Perplexity-style sidebar) */}
      {showRightSidebar && (
        <aside className="w-76 h-full border border-zinc-800 bg-[#111827] rounded p-5 flex flex-col justify-between shrink-0 overflow-y-auto space-y-6">
          <div className="space-y-6">
            <div className="pb-3 border-b border-zinc-800 flex justify-between items-center">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Reference Context</span>
              <Badge variant="secondary" className="text-[9px] font-mono">Audit</Badge>
            </div>

            {lastReply && lastReply.sources && lastReply.sources.length > 0 ? (
              <div className="space-y-5">
                
                <div className="bg-[#0F172A] border border-zinc-850 p-3 rounded space-y-2">
                  <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider block">Latency Summary</span>
                  <div className="space-y-1 text-[10px] font-mono text-zinc-400">
                    <div className="flex justify-between">
                      <span>Vector Search:</span>
                      <span>{lastReply.retrievalLatencyMs} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>LLM Synthesis:</span>
                      <span>{lastReply.generationLatencyMs} ms</span>
                    </div>
                    <div className="flex justify-between border-t border-zinc-800 pt-1 font-semibold text-zinc-200">
                      <span>Total Turn:</span>
                      <span>{lastReply.totalLatencyMs} ms</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider block">Cosine Similarity Matches</span>
                  <div className="space-y-2.5">
                    {lastReply.sources.map((src, i) => {
                      const scorePercent = Math.round(src.score * 100);
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-[10.5px]">
                            <span className="text-zinc-355 font-medium">Source [{i + 1}] Similarity</span>
                            <span className="font-mono text-zinc-400">{scorePercent}%</span>
                          </div>
                          <div className="w-full bg-zinc-950 border border-zinc-850 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                scorePercent >= 60 ? 'bg-emerald-500' : 'bg-blue-500'
                              }`} 
                              style={{ width: `${scorePercent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {lastReply.chunksUsed && lastReply.chunksUsed.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider block">Database Chunk Keys</span>
                    <div className="flex flex-wrap gap-1.5">
                      {lastReply.chunksUsed.map((chk, i) => (
                        <span key={i} className="text-[9px] font-mono bg-zinc-950 border border-zinc-850 text-zinc-400 px-2 py-0.5 rounded">
                          {chk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="text-center py-24 text-zinc-500 space-y-3">
                <Database className="h-8 w-8 text-zinc-700 mx-auto" />
                <p className="text-[11px] font-medium">No references synced</p>
                <p className="text-[9.5px] text-zinc-550 max-w-xs mx-auto leading-normal">
                  Conversations query database segments and evaluate cosine indexes here.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-zinc-800 space-y-1.5 text-[9px] text-zinc-500 font-mono">
            <div className="flex justify-between"><span className="flex items-center gap-1"><Cpu className="h-3 w-3 text-zinc-650" /> Engine:</span> <span className="text-zinc-400">Ollama API</span></div>
            <div className="flex justify-between"><span className="flex items-center gap-1"><Layers className="h-3 w-3 text-zinc-650" /> Vector:</span> <span className="text-zinc-400">PostgreSQL (pgvector)</span></div>
          </div>
        </aside>
      )}

      {/* Left Params Sidebar */}
      <div className={`w-80 h-full border border-zinc-800 bg-[#111827] rounded p-5 flex flex-col justify-between shrink-0 transition-all duration-200 ${
        showConfig ? 'block' : 'hidden'
      }`}>
        <div className="space-y-6">
          <div className="pb-3 border-b border-zinc-800 flex justify-between items-center">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Search Parameters</span>
            <Button variant="ghost" size="sm" onClick={() => setShowConfig(false)} className="h-6 text-[10px] px-1.5">Close</Button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Metadata Category</label>
            <Input 
              type="text" 
              placeholder="e.g. guide, tutorial, blog"
              value={selectedPageType}
              onChange={(e) => setSelectedPageType(e.target.value)}
              className="h-9 text-xs bg-zinc-900 border-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-400 font-medium">Min Similarity</span>
              <span className="font-mono text-zinc-300">{minSimilarity}</span>
            </div>
            <input 
              type="range" 
              min="0.10" 
              max="0.90" 
              step="0.05" 
              value={minSimilarity}
              onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
              className="w-full accent-blue-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-400 font-medium">Context Chunks (Top-K)</span>
              <span className="font-mono text-zinc-300">{topK} chunks</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="10" 
              step="1" 
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value))}
              className="w-full accent-blue-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default Chat;
