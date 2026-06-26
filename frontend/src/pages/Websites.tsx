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
  const [addLoading, setAddLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const [refreshingIds, setRefreshingIds] = useState<Record<number, boolean>>({});
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);

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
    const pollInterval = setInterval(async () => {
      let updatedAny = false;
      const list = websiteStore.getWebsites();

      for (const w of list) {
        if (w.status === 'PENDING' || w.status === 'CRAWLING') {
          try {
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
      
      const res = await apiService.ingestWebsite(cleanUrl);
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
          <h2 className="text-2xl font-bold text-textPrimary tracking-tight">Knowledge Sources</h2>
          <p className="text-sm text-textSecondary mt-1">
            {websites.length} {websites.length === 1 ? 'Source' : 'Sources'} Connected &bull; Add websites to index paragraphs and ask questions.
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
              <p className="text-base font-semibold text-textPrimary">No knowledge sources yet</p>
              <p className="text-sm text-textSecondary max-w-sm mx-auto leading-relaxed">
                Connect your first website to start indexing pages and extracting insights.
              </p>
            </div>
            <Button onClick={() => setIsAddModalOpen(true)} className="bg-primary hover:bg-primary/90 text-white text-sm font-medium px-5 h-9 rounded-md shadow-sm">
              Add Knowledge Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {websites.map((w) => {
            const friendlyName = getFriendlyName(w.url);
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
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/50" onClick={e => e.stopPropagation()}>
                    <span className="text-[10px] text-textSecondary flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Updated just now
                    </span>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={refreshingIds[w.id] || w.status === 'CRAWLING'}
                        onClick={(e) => { e.stopPropagation(); handleRefresh(w.id); }}
                        className="h-7 text-xs text-textSecondary hover:text-textPrimary hover:bg-secondary px-2"
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", refreshingIds[w.id] && "animate-spin")} />
                        Sync
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={w.status !== 'CRAWLED'}
                        onClick={(e) => { e.stopPropagation(); navigate(`/chat?websiteId=${w.id}`); }}
                        className="h-7 text-xs bg-primary hover:bg-primary/90 text-white px-3 shadow-sm rounded"
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                        Chat
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
