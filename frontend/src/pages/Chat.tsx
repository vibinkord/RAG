import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { websiteStore } from '../store/websiteStore';
import { chatStore } from '../store/chatStore';
import { apiService } from '../services/api';
import { ChatMessage, ChatSession } from '../types/index';
import { cn } from '../lib/utils';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  ChevronRight,
  Sliders,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  X,
  Globe
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import ReactMarkdown from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('markdown', markdown);

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

const MarkdownContent = ({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      components={{
        code({ node, inline, className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { inline?: boolean, node?: unknown }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <div className="rounded-md overflow-hidden my-4 border border-border bg-gray-50/50">
              <div className="bg-secondary px-3 py-1.5 text-xs text-textSecondary font-medium border-b border-border flex justify-between items-center">
                <span>{match[1]}</span>
              </div>
              <SyntaxHighlighter
                {...props}
                children={String(children).replace(/\n$/, '')}
                style={oneLight}
                language={match[1]}
                PreTag="div"
                customStyle={{ margin: 0, padding: '1rem', fontSize: '0.85rem', backgroundColor: 'transparent' }}
              />
            </div>
          ) : (
            <code {...props} className={cn("bg-secondary text-primary px-1.5 py-0.5 rounded-md text-[0.9em] font-mono", className)}>
              {children}
            </code>
          );
        },
        p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed text-textPrimary">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-6 mb-4 text-textPrimary">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 text-textPrimary">{children}</ol>,
        li: ({ children }) => <li className="mb-1 text-textPrimary">{children}</li>,
        h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6 text-textPrimary">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-5 text-textPrimary">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-4 text-textPrimary">{children}</h3>,
        a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">{children}</a>,
        blockquote: ({ children }) => <blockquote className="border-l-4 border-border pl-4 italic text-textSecondary my-4">{children}</blockquote>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export const Chat: React.FC = () => {
  const { websiteId } = useParams<{ websiteId: string }>();
  const navigate = useNavigate();
  const website = websiteStore.getWebsites().find(w => w.id === Number(websiteId));

  const [sessionId, setSessionId] = useState<string>(`session-${websiteId}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [selectedPageType, setSelectedPageType] = useState<string>('');
  const [minSimilarity, setMinSimilarity] = useState<number>(0.35);
  const [topK, setTopK] = useState<number>(4);
  
  const [showConfig, setShowConfig] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState(0);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!website || website.status !== 'CRAWLED') {
      navigate('/websites', { replace: true });
      return;
    }

    const session = chatStore.getSession(website.id);
    if (session) {
      setMessages(session.messages);
      setSessionId(session.id);
      if (session.selectedPageType) setSelectedPageType(session.selectedPageType);
    } else {
      setMessages([]);
      setSessionId(`session-${website.id}`);
    }
  }, [websiteId, website, navigate]);

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



  const persistSession = (updatedMessages: ChatMessage[]) => {
    if (!website || updatedMessages.length === 0) return;
    
    const firstUserMsg = updatedMessages.find(m => m.role === 'user')?.content || 'New Conversation';
    const title = firstUserMsg.length > 28 ? firstUserMsg.substring(0, 26) + '...' : firstUserMsg;

    const sessionObj: ChatSession = {
      id: sessionId,
      title,
      timestamp: new Date().toISOString(),
      messages: updatedMessages,
      selectedWebsiteId: website.id.toString(),
      selectedPageType
    };

    chatStore.saveSession(website.id, sessionObj);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading || !website) return;

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
      const res = await apiService.chat(
        sessionId,
        text,
        website.id,
        [website.id],
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
    } catch (error) {
      const e = error as { response?: { data?: { message?: string } }, message?: string };
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

  const thinkingMessages = [
    "Searching knowledge base...",
    "Analyzing context...",
    "Formulating response..."
  ];

  if (!website) return null;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] w-full relative overflow-hidden bg-background">
      
      {/* Main Conversation View */}
      <div className="flex-1 flex flex-col h-full bg-background relative z-10 w-full">
        
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 md:px-8 shrink-0 relative bg-background/80 backdrop-blur-sm border-b border-border/50">
          <div className="flex flex-col">
            <div className="flex items-center text-[10px] text-textSecondary uppercase tracking-wider font-semibold mb-1 cursor-pointer hover:text-textPrimary transition-colors" onClick={() => navigate('/websites')}>
              <Globe className="h-3 w-3 mr-1" />
              Knowledge Bases <ChevronRight className="h-3 w-3 mx-1" /> 
              <span className="text-primary truncate max-w-[150px] md:max-w-xs">{getFriendlyName(website.url)}</span>
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-textPrimary leading-none">{getFriendlyName(website.url)}</h1>
              <Badge variant="success" className="text-[10px] h-5 font-medium flex items-center px-1.5"><Check className="h-3 w-3 mr-0.5" /> Ready</Badge>
            </div>
          </div>
          
          <div className="flex flex-col items-end text-xs text-textSecondary">
            <div className="flex items-center gap-3 font-medium">
              <span>{website.pagesCrawled} Pages</span>
              <span>&bull;</span>
              <span>{website.chunksCreated} Chunks</span>
            </div>
            <div className="flex items-center gap-1 mt-1 opacity-70 text-[10px]">
               Using Qwen 2.5 + Nomic
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-secondary/30 border-b border-border/30 text-[11px] text-textSecondary">
          <div className="flex items-center gap-1 font-medium">
            <Sparkles className="h-3 w-3" />
            Answers are generated only from this documentation.
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowConfig(!showConfig)}
            className={cn("text-textSecondary hover:text-textPrimary text-[11px] h-6 px-2", showConfig && "bg-secondary text-textPrimary")}
          >
            <Sliders className="h-3 w-3 md:mr-1.5" />
            <span className="hidden md:inline">Parameters</span>
          </Button>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-0 bg-background relative">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center py-8 animate-fade-in px-4">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center shrink-0 mb-6 border border-border">
                <Sparkles className="h-6 w-6 text-textSecondary" />
              </div>
              <div className="space-y-3 mb-8">
                <h3 className="text-2xl font-semibold text-textPrimary tracking-tight">How can I help you today?</h3>
                <p className="text-sm text-textSecondary max-w-md mx-auto">
                  Ask me anything about {getFriendlyName(website.url)}.
                </p>
              </div>

              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSendMessage(q)}
                    className="text-left text-sm bg-card border border-border p-4 rounded-xl hover:shadow-sm hover:border-border/80 transition-all flex items-center justify-between group"
                  >
                    <span className="truncate text-textSecondary group-hover:text-textPrimary font-medium">{q}</span>
                    <ChevronRight className="h-4 w-4 text-border group-hover:text-textSecondary shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto pb-40 pt-4 px-4 md:px-8 space-y-8">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}
                >
                  <div className={cn(
                    "flex max-w-[85%] md:max-w-[80%]",
                    msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}>
                    
                    {/* Avatar */}
                    {msg.role === 'assistant' && (
                      <div className="h-8 w-8 rounded-full border border-border bg-secondary flex items-center justify-center shrink-0 mr-4 mt-1">
                        <Bot className="h-4 w-4 text-textSecondary" />
                      </div>
                    )}
                    {msg.role === 'user' && (
                      <div className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center shrink-0 ml-4 mt-1">
                        <User className="h-4 w-4 text-textSecondary" />
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={cn(
                      "rounded-2xl text-[15px] px-5 py-3.5 shadow-sm border",
                      msg.role === 'user' 
                        ? "bg-primary border-primary text-white rounded-tr-sm" 
                        : "bg-card border-border text-textPrimary rounded-tl-sm w-full"
                    )}>
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <MarkdownContent content={msg.content} />
                      )}

                      {/* Assistant Extras */}
                      {msg.role === 'assistant' && (
                        <div className="mt-5 space-y-4 w-full">
                          {/* Sources */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="pt-4 border-t border-border">
                              <span className="text-xs font-semibold text-textSecondary flex items-center gap-1.5 mb-3">
                                <Database className="h-3.5 w-3.5" /> 
                                Sources Evaluated
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {msg.sources.map((src, i) => {
                                  const matchPercent = Math.round(src.score * 100);
                                  return (
                                    <a 
                                      href={src.url} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      key={i} 
                                      className="block bg-secondary border border-border hover:border-primary/30 rounded-lg p-2.5 transition-colors group cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <h5 className="text-xs font-semibold text-textPrimary truncate group-hover:text-primary transition-colors">
                                          {getFriendlyName(src.url)}
                                        </h5>
                                        <Badge variant={matchPercent >= 60 ? 'success' : 'default'} className="text-[9px] font-mono shrink-0 px-1.5 py-0 bg-background border-border text-textSecondary">
                                          {matchPercent}%
                                        </Badge>
                                      </div>
                                      <p className="text-[11px] leading-relaxed text-textSecondary line-clamp-2">
                                        "{src.snippet}"
                                      </p>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Details Accordion */}
                          <div className="pt-2">
                            <button
                              onClick={() => toggleDetails(msg.id)}
                              className="flex items-center gap-1.5 text-xs font-medium text-textSecondary hover:text-textPrimary transition-colors"
                            >
                              {expandedDetails[msg.id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              View Retrieval Details
                            </button>
                            
                            {expandedDetails[msg.id] && (
                              <div className="mt-3 bg-secondary border border-border rounded-lg p-4 space-y-4 animate-fade-in text-xs font-mono text-textSecondary">
                                <div className="space-y-2">
                                  <span className="text-textSecondary uppercase tracking-widest text-[9px] font-sans font-bold">Performance Breakdown</span>
                                  <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-card p-2 rounded border border-border shadow-sm">
                                      <div className="text-textPrimary font-semibold">{msg.retrievalLatencyMs}ms</div>
                                      <div className="text-[9px] text-textSecondary mt-0.5">Vector Search</div>
                                    </div>
                                    <div className="bg-card p-2 rounded border border-border shadow-sm">
                                      <div className="text-textPrimary font-semibold">{msg.generationLatencyMs}ms</div>
                                      <div className="text-[9px] text-textSecondary mt-0.5">LLM Gen</div>
                                    </div>
                                    <div className="bg-card p-2 rounded border border-border shadow-sm">
                                      <div className="text-primary font-semibold">{msg.totalLatencyMs}ms</div>
                                      <div className="text-[9px] text-textSecondary mt-0.5">Total Time</div>
                                    </div>
                                  </div>
                                </div>
                                {msg.chunksUsed && msg.chunksUsed.length > 0 && (
                                  <div className="space-y-2 pt-2 border-t border-border/50">
                                    <span className="text-textSecondary uppercase tracking-widest text-[9px] font-sans font-bold">Chunk Vectors (Top K)</span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {msg.chunksUsed.map((chk, i) => (
                                        <span key={i} className="bg-card border border-border px-2 py-1 rounded text-[9px]">
                                          {chk.substring(0, 8)}...
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Footer Actions */}
                          <div className="flex items-center justify-end pt-2">
                            <button 
                              onClick={() => copyToClipboard(msg.content, msg.id)}
                              className="flex items-center text-[11px] font-medium text-textSecondary hover:text-textPrimary transition-colors"
                            >
                              {copiedId === msg.id ? (
                                <><Check className="h-3 w-3 mr-1 text-success" /> Copied</>
                              ) : (
                                <><Copy className="h-3 w-3 mr-1" /> Copy Response</>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex w-full justify-start animate-fade-in">
                  <div className="flex max-w-[80%] flex-row">
                    <div className="h-8 w-8 rounded-full border border-border bg-secondary flex items-center justify-center shrink-0 mr-4 mt-1">
                      <Bot className="h-4 w-4 text-textSecondary animate-pulse" />
                    </div>
                    <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center space-x-2 text-sm text-textSecondary">
                      <div className="flex space-x-1">
                        <div className="h-2 w-2 bg-border rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 bg-border rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 bg-border rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="pl-2">{thinkingMessages[thinkingPhase]}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Composer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
          <div className="max-w-3xl mx-auto relative pointer-events-auto">
            <div className="bg-card border border-border focus-within:border-primary/30 focus-within:ring-4 focus-within:ring-primary/5 rounded-2xl shadow-lg transition-all duration-200 overflow-hidden relative">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={adjustTextareaHeight}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Ask me anything..."
                className="w-full max-h-[200px] bg-transparent text-textPrimary text-[15px] px-4 py-4 pr-14 resize-none focus:outline-none placeholder:text-textSecondary/60 leading-relaxed"
                rows={1}
                style={{ minHeight: '56px' }}
              />
              <div className="absolute right-2 bottom-2">
                <Button 
                  onClick={() => handleSendMessage(inputMessage)}
                  disabled={loading || !inputMessage.trim()}
                  className={cn(
                    "h-9 w-9 p-0 rounded-xl flex items-center justify-center transition-all duration-200",
                    inputMessage.trim() ? "bg-primary hover:bg-primary/90 text-white shadow-sm" : "bg-secondary text-textSecondary border border-border"
                  )}
                >
                  <Send className="h-4 w-4 ml-0.5" />
                </Button>
              </div>
            </div>
            <div className="text-center mt-3">
              <span className="text-[11px] text-textSecondary">
                AI can make mistakes. Consider verifying important information.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over Params Configuration Drawer */}
      {showConfig && (
        <>
          <div className="fixed inset-0 bg-textPrimary/10 z-40 md:hidden backdrop-blur-sm" onClick={() => setShowConfig(false)} />
          <div className="absolute top-0 right-0 h-full w-80 bg-card border-l border-border shadow-2xl z-50 animate-slide-in flex flex-col">
            <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30">
              <span className="text-sm font-semibold text-textPrimary flex items-center gap-2">
                <Sliders className="h-4 w-4" />
                Search Parameters
              </span>
              <button onClick={() => setShowConfig(false)} className="text-textSecondary hover:text-textPrimary p-1 rounded-md hover:bg-border/50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-6 overflow-y-auto">
              <div className="space-y-3">
                <label className="text-sm font-medium text-textPrimary">Metadata Filter</label>
                <Input 
                  type="text" 
                  placeholder="e.g. guide, tutorial, blog"
                  value={selectedPageType}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedPageType(e.target.value)}
                  className="bg-background border-border text-sm"
                />
                <p className="text-[11px] text-textSecondary">Filter search results to a specific pageType tag.</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-textPrimary font-medium">Similarity Threshold</span>
                  <span className="font-mono text-textSecondary bg-secondary px-2 rounded">{minSimilarity}</span>
                </div>
                <input 
                  type="range" 
                  min="0.10" 
                  max="0.90" 
                  step="0.05" 
                  value={minSimilarity}
                  onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                  className="w-full accent-primary bg-secondary h-1.5 rounded-lg cursor-pointer"
                />
                <p className="text-[11px] text-textSecondary">Higher values require stricter matching.</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-textPrimary font-medium">Context Chunks (Top-K)</span>
                  <span className="font-mono text-textSecondary bg-secondary px-2 rounded">{topK} chunks</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  step="1" 
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full accent-primary bg-secondary h-1.5 rounded-lg cursor-pointer"
                />
                <p className="text-[11px] text-textSecondary">Number of segments to retrieve.</p>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default Chat;
