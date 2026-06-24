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
  ChevronDown,
  ChevronUp,
  Info,
  Database,
  Cpu,
  Layers,
  HelpCircle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
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
  timestamp: string;
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

  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>('all');
  const [selectedPageType, setSelectedPageType] = useState<string>('');
  const [minSimilarity, setMinSimilarity] = useState<number>(0.35);
  const [topK, setTopK] = useState<number>(4);
  
  const [showConfig, setShowConfig] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [thinkingPhase, setThinkingPhase] = useState(0);

  // Accordion state per message for developer details
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const list = websiteStore.getWebsites().filter(w => w.status === 'CRAWLED');
    setWebsites(list);

    const storedHistory = localStorage.getItem('ragbot_chat_history');
    if (storedHistory) {
      try {
        setSessions(JSON.parse(storedHistory));
      } catch (e) {
        console.error('Failed to parse chat sessions', e);
      }
    }

    const websiteParam = searchParams.get('websiteId');
    if (websiteParam) {
      setSelectedWebsiteId(websiteParam);
    }
    
    createNewSession();
  }, []);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const createNewSession = () => {
    const newId = Math.random().toString(36).substring(2, 15);
    setSessionId(newId);
    setMessages([]);
    setInputMessage('');
    setExpandedDetails({});
    setSearchParams({});
  };

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

  const handleLoadSession = (sess: ChatSession) => {
    setSessionId(sess.id);
    setMessages(sess.messages);
    if (sess.selectedWebsiteId) setSelectedWebsiteId(sess.selectedWebsiteId);
    if (sess.selectedPageType) setSelectedPageType(sess.selectedPageType);
    setExpandedDetails({});
  };

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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputMessage);
    }
  };

  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggleDetails = (id: string) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const websiteOptions = [
    { value: 'all', label: 'All Knowledge Sources' },
    ...websites.map(w => ({ value: w.id.toString(), label: getFriendlyName(w.url) }))
  ];

  const getGroupedSessions = () => {
    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const earlier: ChatSession[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    sessions.forEach(s => {
      const time = new Date(s.timestamp).getTime();
      if (time >= todayStart) today.push(s);
      else if (time >= yesterdayStart) yesterday.push(s);
      else earlier.push(s);
    });

    return { today, yesterday, earlier };
  };

  const groupedSessions = getGroupedSessions();

  const thinkingMessages = [
    "Searching your knowledge base...",
    "Analyzing retrieved context...",
    "Preparing your answer..."
  ];

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-5 w-full relative overflow-hidden animate-fade-in">
      
      {/* Sidebar: Recent Conversations */}
      <aside className="w-64 h-full border border-zinc-800 bg-[#111827] rounded flex flex-col justify-between shrink-0 overflow-y-auto hidden md:flex">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Conversations</span>
            <button 
              onClick={createNewSession}
              className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
              title="New thread"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-5">
            {sessions.length === 0 ? (
              <div className="text-center py-10 px-2 space-y-1">
                <HelpCircle className="h-6 w-6 text-zinc-700 mx-auto" />
                <p className="text-xs text-zinc-500 leading-normal">
                  No conversation history found.
                </p>
              </div>
            ) : (
              <>
                {groupedSessions.today.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-2.5 block py-1">Today</span>
                    {groupedSessions.today.map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => handleLoadSession(s)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-2 rounded text-xs cursor-pointer transition-colors group",
                          sessionId === s.id ? "bg-zinc-800/80 text-blue-400 font-medium" : "text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
                        )}
                      >
                        <span className="truncate max-w-[150px]">{s.title}</span>
                        <button 
                          onClick={(e) => handleDeleteSession(s.id, e)} 
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {groupedSessions.yesterday.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-2.5 block py-1">Yesterday</span>
                    {groupedSessions.yesterday.map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => handleLoadSession(s)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-2 rounded text-xs cursor-pointer transition-colors group",
                          sessionId === s.id ? "bg-zinc-800/80 text-blue-400 font-medium" : "text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
                        )}
                      >
                        <span className="truncate max-w-[150px]">{s.title}</span>
                        <button 
                          onClick={(e) => handleDeleteSession(s.id, e)} 
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {groupedSessions.earlier.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-2.5 block py-1">Earlier</span>
                    {groupedSessions.earlier.map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => handleLoadSession(s)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-2 rounded text-xs cursor-pointer transition-colors group",
                          sessionId === s.id ? "bg-zinc-800/80 text-blue-400 font-medium" : "text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
                        )}
                      >
                        <span className="truncate max-w-[150px]">{s.title}</span>
                        <button 
                          onClick={(e) => handleDeleteSession(s.id, e)} 
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Main Conversation View */}
      <div className="flex-1 flex flex-col h-full bg-[#111827] border border-zinc-800 rounded-xl overflow-hidden relative shadow-lg">
        
        {/* Header */}
        <div className="h-14 border-b border-zinc-800 bg-[#111827] flex items-center justify-between px-6 shrink-0 z-10 relative">
          <div className="flex items-center space-x-3">
            <Select 
              value={selectedWebsiteId}
              onChange={(e) => setSelectedWebsiteId(e.target.value)}
              options={websiteOptions}
              className="h-8 text-xs bg-zinc-900 border-zinc-800 w-52 sm:w-64 font-medium"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowConfig(!showConfig)}
              className={cn("text-zinc-400 hover:text-white text-xs h-8", showConfig && "bg-zinc-800 text-white")}
            >
              <Sliders className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">Parameters</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={createNewSession}
              className="h-8 text-zinc-400 hover:text-white text-xs md:hidden"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-12 py-8 bg-[#0F172A] relative">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-10 py-8 animate-fade-in">
              <div className="h-16 w-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/10">
                <Sparkles className="h-8 w-8 text-blue-500" />
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-bold text-slate-100 tracking-tight">Welcome to RAGBot</h3>
                <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                  I can answer questions based on the knowledge sources you've connected. Ask anything below to get started.
                </p>
              </div>

              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 pt-6">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSendMessage(q)}
                    className="text-left text-sm bg-[#111827] border border-zinc-800 p-4 rounded-xl hover:bg-zinc-800/80 hover:border-zinc-700 transition-all flex items-center justify-between group shadow-sm"
                  >
                    <span className="truncate text-zinc-300 font-medium">{q}</span>
                    <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8 max-w-3xl mx-auto pb-6">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex gap-4 md:gap-6 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Assistant Avatar */}
                  {msg.role === 'assistant' && (
                    <div className="h-10 w-10 rounded-xl bg-blue-600/15 border border-blue-900/60 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-5 w-5 text-blue-500" />
                    </div>
                  )}

                  {/* Message Bubble Card */}
                  <div className={`space-y-3 max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                    <div className={cn(
                      "p-5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap select-text border shadow-sm",
                      msg.role === 'user' 
                        ? "bg-zinc-800 border-zinc-700 text-zinc-100 rounded-tr-sm" 
                        : "bg-transparent border-none text-zinc-200 p-0 mt-2"
                    )}>
                      {msg.content}

                      {/* Source Citations & Details Accordion (Assistant Only) */}
                      {msg.role === 'assistant' && (
                        <div className="mt-6 space-y-4 w-full">
                          {/* Sources Overview */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="space-y-3">
                              <span className="text-xs font-semibold text-zinc-500 flex items-center gap-2">
                                <Database className="h-3.5 w-3.5" /> 
                                Sources Evaluated ({msg.sources.length})
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {msg.sources.map((src, i) => {
                                  const matchPercent = Math.round(src.score * 100);
                                  return (
                                    <a 
                                      href={src.url} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      key={i} 
                                      className="block bg-[#111827] border border-zinc-800 hover:border-zinc-700 rounded-lg p-3 transition-colors group cursor-pointer"
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <h5 className="text-xs font-medium text-zinc-300 truncate group-hover:text-blue-400 transition-colors">
                                          {getFriendlyName(src.url)}
                                        </h5>
                                        <Badge variant={matchPercent >= 60 ? 'success' : 'default'} className="text-[9px] font-mono shrink-0 px-1.5 py-0">
                                          {matchPercent}%
                                        </Badge>
                                      </div>
                                      <p className="text-[11px] leading-relaxed text-zinc-500 line-clamp-2">
                                        "{src.snippet}"
                                      </p>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Developer Details Accordion */}
                          <div className="pt-2 border-t border-zinc-800/60">
                            <button
                              onClick={() => toggleDetails(msg.id)}
                              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              {expandedDetails[msg.id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              View Retrieval Details
                            </button>
                            
                            {expandedDetails[msg.id] && (
                              <div className="mt-4 bg-[#111827] border border-zinc-800 rounded-lg p-4 space-y-4 animate-fade-in text-xs font-mono text-zinc-400">
                                {/* Latency */}
                                <div className="space-y-2">
                                  <span className="text-zinc-500 uppercase tracking-widest text-[10px] font-sans font-bold">Performance</span>
                                  <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-[#0F172A] p-2 rounded border border-zinc-800/50">
                                      <div className="text-zinc-300 font-semibold">{msg.retrievalLatencyMs}ms</div>
                                      <div className="text-[9px] text-zinc-600 mt-0.5">Vector Search</div>
                                    </div>
                                    <div className="bg-[#0F172A] p-2 rounded border border-zinc-800/50">
                                      <div className="text-zinc-300 font-semibold">{msg.generationLatencyMs}ms</div>
                                      <div className="text-[9px] text-zinc-600 mt-0.5">LLM Generation</div>
                                    </div>
                                    <div className="bg-[#0F172A] p-2 rounded border border-zinc-800/50">
                                      <div className="text-blue-400 font-semibold">{msg.totalLatencyMs}ms</div>
                                      <div className="text-[9px] text-zinc-600 mt-0.5">Total Time</div>
                                    </div>
                                  </div>
                                </div>
                                {/* Chunks */}
                                {msg.chunksUsed && msg.chunksUsed.length > 0 && (
                                  <div className="space-y-2">
                                    <span className="text-zinc-500 uppercase tracking-widest text-[10px] font-sans font-bold">Chunk Index Keys</span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {msg.chunksUsed.map((chk, i) => (
                                        <span key={i} className="bg-[#0F172A] border border-zinc-800/50 px-2 py-1 rounded text-[10px]">
                                          {chk}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Assistant Footer Actions */}
                          <div className="flex items-center justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => copyToClipboard(msg.content, msg.id)}
                              className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-300"
                            >
                              {copiedId === msg.id ? (
                                <><Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> Copied</>
                              ) : (
                                <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* User avatar */}
                  {msg.role === 'user' && (
                    <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 order-3 mt-1 shadow-sm border border-zinc-700">
                      <User className="h-5 w-5 text-zinc-300" />
                    </div>
                  )}
                </div>
              ))}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex gap-4 md:gap-6 justify-start animate-fade-in">
                  <div className="h-10 w-10 rounded-xl bg-blue-600/10 border border-blue-900/40 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-5 w-5 text-blue-500 animate-pulse" />
                  </div>
                  <div className="bg-[#111827] border border-zinc-800/60 p-4 rounded-xl text-sm text-zinc-400 flex items-center space-x-3 rounded-tl-sm shadow-sm mt-2">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                    <span className="font-medium text-zinc-300">{thinkingMessages[thinkingPhase]}</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Sticky Input Composer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#0F172A] via-[#0F172A] to-transparent pointer-events-none">
          <div className="max-w-3xl mx-auto relative pointer-events-auto">
            <div className="bg-[#111827] border border-zinc-700 focus-within:border-zinc-500 rounded-2xl shadow-xl transition-all duration-200 overflow-hidden">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={adjustTextareaHeight}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Ask anything about your connected knowledge sources..."
                className="w-full max-h-48 bg-transparent text-zinc-200 text-[14px] p-4 pr-14 resize-none focus:outline-none placeholder:text-zinc-500"
                rows={1}
              />
              <div className="absolute right-3 bottom-3 flex items-center justify-end">
                <Button 
                  onClick={() => handleSendMessage(inputMessage)}
                  disabled={loading || !inputMessage.trim()}
                  className="h-8 w-8 p-0 rounded-lg bg-white hover:bg-zinc-200 text-black shadow disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-center mt-2.5">
              <span className="text-[10px] text-zinc-500">
                AI can make mistakes. Consider verifying important information.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over Params Configuration Drawer */}
      {showConfig && (
        <div className="absolute top-14 right-0 w-80 h-[calc(100%-3.5rem)] bg-[#111827] border-l border-zinc-800 shadow-2xl z-20 animate-slide-in flex flex-col">
          <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-[#0F172A]">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              Search Parameters
            </span>
            <Button variant="ghost" size="sm" onClick={() => setShowConfig(false)} className="h-7 px-2 text-zinc-400 hover:text-white">
              Close
            </Button>
          </div>

          <div className="flex-1 p-5 space-y-6 overflow-y-auto">
            <div className="space-y-3">
              <label className="text-xs text-zinc-400 font-medium">Metadata Category Filter</label>
              <Input 
                type="text" 
                placeholder="e.g. guide, tutorial, blog"
                value={selectedPageType}
                onChange={(e) => setSelectedPageType(e.target.value)}
                className="h-9 text-xs bg-zinc-900 border-zinc-800"
              />
              <p className="text-[10px] text-zinc-550">Filter search results to a specific pageType tag.</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400 font-medium">Minimum Similarity Threshold</span>
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
              <p className="text-[10px] text-zinc-550">Higher values require stricter vector cosine similarity matching.</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs">
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
              <p className="text-[10px] text-zinc-550">Number of related database chunks to retrieve and pass to the LLM.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Chat;
