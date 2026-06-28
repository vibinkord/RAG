import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { websiteStore } from '../store/websiteStore';
import { apiService } from '../services/api';
import { Website, IngestionResponse } from '../types';
import { 
  Globe, 
  Plus, 
  RefreshCw, 
  Trash2, 
  MessageSquare, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Activity,
  Clock,
  X,
  FileText,
  Layers,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert';
import { cn } from '../lib/utils';

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
    
    const parts = hostKey.split('.');
    if (parts.length > 0) {
      const name = parts[0];
      return name.charAt(0).toUpperCase() + name.slice(1) + ' Docs';
    }
    return host;
  } catch (e) {
    return url;
  }
};

export const Websites: React.FC = () => {
  const navigate = useNavigate();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  
  // Advanced configuration state
  const [crawlMode, setCrawlMode] = useState('QUICK');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxPages, setMaxPages] = useState<number>(50);
  const [maxDepth, setMaxDepth] = useState<number>(4);
  const [crawlDelayMs, setCrawlDelayMs] = useState<number>(100);
  const [respectRobots, setRespectRobots] = useState<boolean>(true);
  const [sameDomainOnly, setSameDomainOnly] = useState<boolean>(true);
  const [excludeQueryParameters, setExcludeQueryParameters] = useState<boolean>(true);
  
  const [addLoading, setAddLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const [refreshingIds, setRefreshingIds] = useState<Record<number, boolean>>({});
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [progressData, setProgressData] = useState<Record<number, import('../types').CrawlProgress>>({});

  const loadWebsites = () => {
    const list = websiteStore.getWebsites();
    setWebsites(list);
  };

  useEffect(() => {
    loadWebsites();
  }, []);

  useEffect(() => {
    if (selectedWebsite) {
      const match = websites.find(w => w.id === selectedWebsite.id);
      if (match && JSON.stringify(match) !== JSON.stringify(selectedWebsite)) {
        setSelectedWebsite(match);
      }
    }
  }, [websites, selectedWebsite]);

  useEffect(() => {
    switch(crawlMode) {
      case 'QUICK': setMaxPages(50); setMaxDepth(4); break;
      case 'STANDARD': setMaxPages(500); setMaxDepth(8); break;
      case 'DEEP': setMaxPages(2000); setMaxDepth(15); break;
      case 'ENTIRE': setMaxPages(0); setMaxDepth(100); break;
    }
  }, [crawlMode]);

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      let updatedAny = false;
      const list = websiteStore.getWebsites();

      for (const w of list) {
        if (w.status === 'PENDING' || w.status === 'CRAWLING') {
          try {
            // First try to get live progress if it's crawling
            if (w.status === 'CRAWLING') {
              try {
                const progress = await apiService.getCrawlProgress(w.id);
                setProgressData(prev => ({ ...prev, [w.id]: progress }));
                if (progress.status && progress.status !== w.status) {
                  websiteStore.updateWebsite(w.id, {
                    status: progress.status as import('../types').CrawlStatus,
                    pagesCrawled: progress.pagesCrawled,
                    chunksCreated: progress.chunksCreated
                  });
                  updatedAny = true;
                }
              } catch (e) {
                // Ignore progress error, maybe it just started or finished
              }
            }

            // Always poll the database status to be sure
            const crawl: IngestionResponse = await apiService.getCrawlStatus(w.id);
            if (crawl.status !== w.status || crawl.pagesCrawled !== w.pagesCrawled || crawl.chunksCreated !== w.chunksCreated) {
              websiteStore.updateWebsite(w.id, {
                status: crawl.status,
                pagesCrawled: crawl.pagesCrawled,
                chunksCreated: crawl.chunksCreated
              });
              updatedAny = true;
            }
          } catch (e) {
            console.error('Crawl status poll error', e);
          }
        }
      }

      if (updatedAny) {
        loadWebsites();
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, []);

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) {
      setUrlValidationError('URL target is required');
      return false;
    }
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    if (!urlPattern.test(url.trim())) {
      setUrlValidationError('Please enter a valid website URL target (e.g. spring.io)');
      return false;
    }
    setUrlValidationError(null);
    return true;
  };

  const handleAddWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUrl(newUrl)) return;

    setAddLoading(true);
    setErrorMsg(null);

    try {
      let cleanUrl = newUrl.trim();
      if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = 'https://' + cleanUrl;
      }
      
      const payload: any = {
        url: cleanUrl,
        crawlMode
      };
      
      if (showAdvanced) {
        payload.maxPages = maxPages;
        payload.maxDepth = maxDepth;
        payload.crawlDelayMs = crawlDelayMs;
        payload.respectRobots = respectRobots;
        payload.sameDomainOnly = sameDomainOnly;
        payload.excludeQueryParameters = excludeQueryParameters;
        payload.followExternalLinks = !sameDomainOnly;
      }

      const res = await apiService.ingestWebsite(payload);
      websiteStore.addWebsite(cleanUrl, res.id);
      loadWebsites();
      
      setIsAddModalOpen(false);
      setNewUrl('');

      if (res.chunksCreated > 0) {
        await apiService.triggerEmbedding(res.id);
      }
    } catch (error) {
      const e = error as { response?: { data?: { message?: string } }, message?: string };
      console.error(e);
      setErrorMsg(e.response?.data?.message || e.message || 'Failed to sync content. Verify connection settings.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRefresh = async (id: number) => {
    setRefreshingIds(prev => ({ ...prev, [id]: true }));
    try {
      const res = await apiService.refreshWebsite(id);
      websiteStore.updateWebsite(id, {
        status: res.status,
        pagesCrawled: res.pagesCrawled,
        chunksCreated: res.chunksCreated
      });
      loadWebsites();

      if (res.chunksCreated > 0) {
        await apiService.triggerEmbedding(id);
      }
    } catch (e) {
      console.error('Refresh error', e);
    } finally {
      setRefreshingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to disconnect this knowledge source?')) {
      websiteStore.deleteWebsite(id);
      setSelectedWebsite(null);
      loadWebsites();
    }
  };

  const renderStatusText = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="text-textSecondary font-medium text-xs">Waiting</span>;
      case 'CRAWLING':
        return <span className="text-warning font-medium text-xs flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing...</span>;
      case 'CRAWLED':
        return <span className="text-success font-medium text-xs flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Synced</span>;
      case 'FAILED':
        return <span className="text-danger font-medium text-xs flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Failed</span>;
      default:
        return <span className="text-textSecondary text-xs">{status}</span>;
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="bg-secondary text-textSecondary text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border border-border/50">Waiting</span>;
      case 'CRAWLING':
        return <span className="bg-warning/10 text-warning text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border border-warning/20 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Syncing</span>;
      case 'CRAWLED':
        return <span className="bg-success/10 text-success text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border border-success/20">Synced</span>;
      case 'FAILED':
        return <span className="bg-danger/10 text-danger text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border border-danger/20">Failed</span>;
      default:
        return <span className="bg-secondary text-textSecondary text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border border-border/50">{status}</span>;
    }
  };

  return (
    <div className="space-y-8 w-full animate-fade-in pb-12 relative">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-textPrimary tracking-tight">Knowledge Bases</h2>
          <p className="text-sm text-textSecondary mt-1">
            {websites.length} {websites.length === 1 ? 'Base' : 'Bases'} Connected &bull; Add websites to index paragraphs and ask questions.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="sm:self-start bg-primary hover:bg-primary/90 text-white font-medium shadow-sm h-9 px-4 text-sm rounded-md transition-all">
          <Plus className="h-4 w-4 mr-2" />
          Add Source
        </Button>
      </div>

      {/* Grid of Cards */}
      {websites.length === 0 ? (
        <Card className="bg-card border-border shadow-sm border-dashed">
          <CardContent className="p-16 text-center space-y-6">
            <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center mx-auto">
              <Globe className="h-8 w-8 text-textSecondary" />
            </div>
            <div className="space-y-2">
              <p className="text-base font-semibold text-textPrimary">No knowledge bases yet</p>
              <p className="text-sm text-textSecondary max-w-sm mx-auto leading-relaxed">
                Connect your first website to start indexing pages and extracting insights.
              </p>
            </div>
            <Button onClick={() => setIsAddModalOpen(true)} className="bg-primary hover:bg-primary/90 text-white text-sm font-medium px-5 h-9 rounded-md shadow-sm">
              Add Knowledge Base
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {websites.map((w) => {
            const friendlyName = getFriendlyName(w.url);
            
            const getChatButtonState = (w: Website) => {
              if (w.status === 'CRAWLING' || w.status === 'PENDING') return { disabled: true, reason: 'Embedding in progress...' };
              if (w.status === 'FAILED') return { disabled: true, reason: 'Sync failed' };
              if (w.chunksCreated === 0) return { disabled: true, reason: 'No embeddings generated yet' };
              return { disabled: false, reason: '' };
            };
            const chatState = getChatButtonState(w);
            
            return (
              <Card 
                key={w.id}
                onClick={() => setSelectedWebsite(w)}
                className="bg-card border-border hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between h-[200px] group"
              >
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  {/* Top: URL & title */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-2 truncate">
                        <div className="h-8 w-8 bg-secondary rounded flex items-center justify-center shrink-0">
                          <Globe className="h-4 w-4 text-textSecondary" />
                        </div>
                        <div className="flex flex-col truncate">
                          <h4 className="text-sm font-semibold text-textPrimary group-hover:text-primary transition-colors truncate">
                            {friendlyName}
                          </h4>
                          <p className="text-[11px] text-textSecondary truncate">{w.url}</p>
                        </div>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        {renderStatusBadge(w.status)}
                      </div>
                    </div>
                  </div>

                  {/* Mid: Stats */}
                  <div className="flex flex-col gap-2 mt-4 text-xs text-textSecondary">
                    {w.status === 'CRAWLING' && progressData[w.id] ? (
                      <div className="space-y-2 mb-2">
                        <div className="flex justify-between items-center text-[10px] font-medium text-textPrimary">
                          <span>Progress</span>
                          <span>{progressData[w.id].pagesCrawled} / {progressData[w.id].pagesDiscovered} pages</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-primary h-1.5 rounded-full transition-all duration-500 ease-in-out" 
                            style={{ width: `${Math.max(5, Math.min(100, (progressData[w.id].pagesCrawled / Math.max(1, progressData[w.id].pagesDiscovered)) * 100))}%` }}
                          ></div>
                        </div>
                        {progressData[w.id].estimatedRemainingSeconds > 0 && (
                          <div className="text-[10px] text-textSecondary text-right">
                            ~{Math.ceil(progressData[w.id].estimatedRemainingSeconds / 60)} min remaining
                          </div>
                        )}
                      </div>
                    ) : null}
                    
                    <div className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Indexed Pages</span>
                      <span className="font-medium text-textPrimary">{w.pagesCrawled}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Knowledge Segments</span>
                      <span className="font-medium text-textPrimary">{w.chunksCreated}</span>
                    </div>
                  </div>

                  {/* Bottom Action buttons */}
                  <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-border/50" onClick={e => e.stopPropagation()}>
                    <span className="text-[10px] text-textSecondary flex items-center justify-between">
                      <span className="flex items-center"><Clock className="h-3 w-3 mr-1" /> Updated just now</span>
                    </span>

                    <div className="flex items-center w-full gap-2">
                      {chatState.disabled ? (
                        <div className="text-xs text-textSecondary flex-1 text-center py-1.5 bg-secondary rounded border border-border/50 font-medium">
                          {chatState.reason}
                        </div>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); navigate(`/websites/${w.id}/chat`); }}
                          className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90 text-white shadow-sm rounded font-medium"
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                          Open AI Assistant
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={refreshingIds[w.id] || w.status === 'CRAWLING'}
                        onClick={(e) => { e.stopPropagation(); handleRefresh(w.id); }}
                        className="h-8 w-8 p-0 flex items-center justify-center text-textSecondary hover:text-textPrimary hover:bg-secondary shrink-0"
                        title="Refresh"
                      >
                        <RefreshCw className={cn("h-4 w-4", refreshingIds[w.id] && "animate-spin")} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }}
                        className="h-8 w-8 p-0 flex items-center justify-center text-danger hover:text-danger hover:bg-danger/10 shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Slide drawer for detailed inspection */}
      {selectedWebsite && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div 
            className="fixed inset-0 bg-textPrimary/20 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedWebsite(null)}
          />
          
          <div className="relative w-full max-w-md bg-card border-l border-border shadow-2xl h-full flex flex-col z-10 animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/30">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-white border border-border rounded shadow-sm flex items-center justify-center">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-textPrimary">Source Details</h3>
              </div>
              <button 
                onClick={() => setSelectedWebsite(null)} 
                className="text-textSecondary hover:text-textPrimary p-1.5 rounded-md hover:bg-border/50 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Info lists */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-textSecondary">Title</label>
                  <div className="text-sm font-semibold text-textPrimary bg-secondary px-3 py-2.5 rounded-md border border-border/50">
                    {getFriendlyName(selectedWebsite.url)}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-textSecondary">Target URL</label>
                  <div className="flex items-center justify-between bg-secondary px-3 py-2.5 rounded-md border border-border/50 text-sm">
                    <span className="text-textPrimary truncate max-w-[280px]">{selectedWebsite.url}</span>
                    <a href={selectedWebsite.url} target="_blank" rel="noreferrer" className="text-textSecondary hover:text-primary transition-colors ml-2">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border p-4 rounded-md shadow-sm space-y-2">
                  <span className="text-xs font-medium text-textSecondary flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> Status</span>
                  <div>{renderStatusText(selectedWebsite.status)}</div>
                </div>
                <div className="bg-card border border-border p-4 rounded-md shadow-sm space-y-2">
                  <span className="text-xs font-medium text-textSecondary flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Last Synced</span>
                  <div className="text-sm font-semibold text-textPrimary">Just now</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border p-4 rounded-md shadow-sm space-y-2">
                  <span className="text-xs font-medium text-textSecondary flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Indexed Pages</span>
                  <div className="text-xl font-bold text-textPrimary">{selectedWebsite.pagesCrawled.toLocaleString()}</div>
                </div>
                <div className="bg-card border border-border p-4 rounded-md shadow-sm space-y-2">
                  <span className="text-xs font-medium text-textSecondary flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Segments</span>
                  <div className="text-xl font-bold text-textPrimary">{selectedWebsite.chunksCreated.toLocaleString()}</div>
                </div>
              </div>

              {selectedWebsite.status === 'CRAWLED' && (
                <div className="space-y-2 mt-4">
                  <label className="text-xs font-medium text-textSecondary">AI Database Index</label>
                  <div className="bg-card border border-border p-4 rounded-md text-sm space-y-3 shadow-sm">
                    <div className="flex justify-between border-b border-border/50 pb-2.5">
                      <span className="text-textSecondary">Vector Embeddings:</span>
                      <span className="text-textPrimary font-medium">{selectedWebsite.chunksCreated}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-2.5">
                      <span className="text-textSecondary">Vector Status:</span>
                      <span className="text-success font-medium flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Complete</span>
                    </div>
                    <div className="flex justify-between pt-0.5">
                      <span className="text-textSecondary">Embedding Engine:</span>
                      <span className="text-textPrimary font-mono text-xs bg-secondary px-2 py-0.5 rounded">nomic-embed-text</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Quick Actions Footer */}
            <div className="p-5 border-t border-border bg-card grid grid-cols-1 gap-3 shrink-0">
              <Button 
                variant="primary" 
                onClick={() => {
                  setSelectedWebsite(null);
                  navigate(`/chat?websiteId=${selectedWebsite.id}`);
                }}
                disabled={selectedWebsite.status !== 'CRAWLED'}
                className="bg-primary hover:bg-primary/90 text-white text-sm h-10 w-full justify-between px-4 shadow-sm"
              >
                <div className="flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat with this source
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => handleRefresh(selectedWebsite.id)}
                  disabled={refreshingIds[selectedWebsite.id] || selectedWebsite.status === 'CRAWLING'}
                  className="border-border text-textPrimary hover:bg-secondary text-xs h-9 shadow-sm"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", refreshingIds[selectedWebsite.id] && "animate-spin")} />
                  Force Sync
                </Button>
                <Button 
                  variant="danger" 
                  onClick={() => handleDelete(selectedWebsite.id)}
                  className="border-danger/20 text-danger bg-danger/5 hover:bg-danger/10 text-xs h-9 shadow-sm"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Website dialog */}
      <Dialog 
        isOpen={isAddModalOpen} 
        onClose={() => {
          setIsAddModalOpen(false);
          setNewUrl('');
          setUrlValidationError(null);
          setErrorMsg(null);
        }} 
        title="Add Knowledge Source"
      >
        <form onSubmit={handleAddWebsite} className="space-y-5 p-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-textPrimary">Website URL</label>
            <Input 
              type="text"
              placeholder="e.g. spring.io or https://example.com"
              value={newUrl}
              onChange={(e) => {
                setNewUrl(e.target.value);
                setUrlValidationError(null);
              }}
              disabled={addLoading}
              required
              className="bg-background border-border text-textPrimary focus:ring-primary focus:border-primary placeholder:text-textSecondary"
            />
            {urlValidationError && (
              <p className="text-xs text-danger font-medium mt-1">{urlValidationError}</p>
            )}
            <p className="text-xs text-textSecondary leading-normal mt-2">
              RAGBot will scan the pages matching this prefix to extract text segments.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-textPrimary">Crawl Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'QUICK', name: 'Quick', desc: '~50 pages' },
                { id: 'STANDARD', name: 'Standard', desc: '~500 pages' },
                { id: 'DEEP', name: 'Deep', desc: '~2000 pages' },
                { id: 'ENTIRE', name: 'Entire Website', desc: 'Unlimited' },
              ].map(mode => (
                <div 
                  key={mode.id}
                  onClick={() => setCrawlMode(mode.id)}
                  className={`border rounded-md p-3 cursor-pointer transition-colors ${crawlMode === mode.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-secondary'}`}
                >
                  <div className="text-sm font-semibold text-textPrimary">{mode.name}</div>
                  <div className="text-xs text-textSecondary mt-0.5">{mode.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-md overflow-hidden bg-card">
            <div 
              className="px-4 py-3 bg-secondary/50 flex justify-between items-center cursor-pointer select-none"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span className="text-sm font-medium text-textPrimary">Advanced Settings</span>
              <ChevronRight className={`h-4 w-4 text-textSecondary transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
            </div>
            
            {showAdvanced && (
              <div className="p-4 space-y-4 border-t border-border">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-textSecondary">Max Pages</label>
                    <Input type="number" min={0} value={maxPages} onChange={e => setMaxPages(Number(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-textSecondary">Max Depth</label>
                    <Input type="number" min={1} value={maxDepth} onChange={e => setMaxDepth(Number(e.target.value))} className="h-8 text-sm" />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-textSecondary">Crawl Delay (ms)</label>
                  <Input type="number" min={0} value={crawlDelayMs} onChange={e => setCrawlDelayMs(Number(e.target.value))} className="h-8 text-sm" />
                </div>
                
                <div className="space-y-2 pt-2">
                  <label className="flex items-center space-x-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={respectRobots} onChange={e => setRespectRobots(e.target.checked)} className="rounded border-border text-primary focus:ring-primary h-4 w-4" />
                    <span className="text-textPrimary">Respect robots.txt rules</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={sameDomainOnly} onChange={e => setSameDomainOnly(e.target.checked)} className="rounded border-border text-primary focus:ring-primary h-4 w-4" />
                    <span className="text-textPrimary">Restrict to same domain only</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={excludeQueryParameters} onChange={e => setExcludeQueryParameters(e.target.checked)} className="rounded border-border text-primary focus:ring-primary h-4 w-4" />
                    <span className="text-textPrimary">Exclude URL Query Parameters (?id=1)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <Alert variant="destructive" className="border-danger/20 bg-danger/10 text-danger">
              <AlertTitle className="text-sm font-semibold">Operation Error</AlertTitle>
              <AlertDescription className="text-xs mt-1">{errorMsg}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-6">
            <Button 
              type="button" 
              variant="outline" 
              disabled={addLoading}
              onClick={() => {
                setIsAddModalOpen(false);
                setNewUrl('');
                setUrlValidationError(null);
                setErrorMsg(null);
              }}
              className="border-border hover:bg-secondary text-textPrimary text-sm h-9 px-4"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={addLoading}
              className="bg-primary hover:bg-primary/90 text-white font-medium text-sm h-9 px-4 shadow-sm"
            >
              {addLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                'Add Source'
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};

export default Websites;
