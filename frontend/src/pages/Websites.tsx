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
  Clock,
  X,
  FileText,
  Layers,
  ExternalLink
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert';

// Helper to generate friendly names for knowledge sources
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
    
    // Default format
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
  
  // Embedding statuses removed as unused
  const [refreshingIds, setRefreshingIds] = useState<Record<number, boolean>>({});

  // Drawer selected website state
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);

  const loadWebsites = () => {
    const list = websiteStore.getWebsites();
    setWebsites(list);
  };

  useEffect(() => {
    loadWebsites();
  }, []);

  // Sync drawer if websites list changes
  useEffect(() => {
    if (selectedWebsite) {
      const match = websites.find(w => w.id === selectedWebsite.id);
      if (match && JSON.stringify(match) !== JSON.stringify(selectedWebsite)) {
        setSelectedWebsite(match);
      }
    }
  }, [websites, selectedWebsite]);

  // Poll status of syncing sources
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
    } catch (e: any) {
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
        return <span className="text-zinc-500 font-medium text-xs">Waiting</span>;
      case 'CRAWLING':
        return <span className="text-amber-400 font-medium text-xs flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Syncing...</span>;
      case 'CRAWLED':
        return <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Synced</span>;
      case 'FAILED':
        return <span className="text-red-400 font-medium text-xs flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Failed</span>;
      default:
        return <span className="text-zinc-400 text-xs">{status}</span>;
    }
  };

  return (
    <div className="space-y-8 w-full animate-fade-in relative">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-50 tracking-tight">Knowledge Sources</h2>
          <p className="text-xs text-zinc-400 mt-1">
            {websites.length} {websites.length === 1 ? 'Source' : 'Sources'} Connected &bull; Add websites to index paragraphs and ask questions.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="sm:self-start bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-500/10 h-10 text-xs">
          <Plus className="h-4 w-4 mr-2" />
          Add Knowledge Source
        </Button>
      </div>

      {/* Grid of Cards (Replacing Wide Table for Notion/Vercel styling) */}
      {websites.length === 0 ? (
        <Card className="bg-[#111827] border-zinc-800">
          <CardContent className="p-10 text-center space-y-5">
            <Globe className="h-12 w-12 text-zinc-650 mx-auto" />
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-zinc-300">No knowledge sources yet</p>
              <p className="text-xs text-zinc-550 max-w-sm mx-auto leading-relaxed">
                Connect your first website to start indexing pages and asking questions.
              </p>
            </div>
            <Button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 h-9">
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
                className="bg-[#111827] border-zinc-800 hover:border-zinc-700 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between h-48 group"
              >
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                  {/* Top: URL & title */}
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm font-bold text-slate-200 group-hover:text-blue-400 transition-colors truncate max-w-[180px]">
                        {friendlyName}
                      </h4>
                      {renderStatusText(w.status)}
                    </div>
                    <p className="text-[10px] font-mono text-zinc-500 truncate select-all">{w.url}</p>
                  </div>

                  {/* Mid: Stats */}
                  <div className="flex items-center space-x-4 text-[11px] text-zinc-400">
                    <div className="flex items-center gap-1 font-mono">
                      <FileText className="h-3.5 w-3.5 text-zinc-550 shrink-0" />
                      <span>{w.pagesCrawled} pages indexed</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono">
                      <Layers className="h-3.5 w-3.5 text-zinc-550 shrink-0" />
                      <span>{w.chunksCreated} knowledge segments</span>
                    </div>
                  </div>

                  {/* Bottom Action buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/40" onClick={e => e.stopPropagation()}>
                    <span className="text-[9px] text-zinc-500 font-mono flex items-center">
                      <Clock className="h-2.5 w-2.5 mr-1" />
                      Last synced 3 min ago
                    </span>

                    <div className="flex items-center space-x-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={refreshingIds[w.id] || w.status === 'CRAWLING'}
                        onClick={() => handleRefresh(w.id)}
                        className="h-7 text-[10.5px] text-zinc-400 hover:text-white px-2"
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${refreshingIds[w.id] ? 'animate-spin' : ''}`} />
                        Sync
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={w.status !== 'CRAWLED'}
                        onClick={() => navigate(`/chat?websiteId=${w.id}`)}
                        className="h-7 text-[10.5px] bg-blue-600 hover:bg-blue-500 text-white px-2.5 shadow"
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedWebsite(null)}
          />
          
          <div className="relative w-full max-w-lg bg-[#111827] border-l border-zinc-800 shadow-2xl h-full flex flex-col p-6 z-10 animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-850">
              <div className="flex items-center space-x-2.5">
                <Globe className="h-5 w-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-100">Knowledge Source Details</h3>
              </div>
              <button 
                onClick={() => setSelectedWebsite(null)} 
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-850 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Info lists */}
            <div className="flex-1 overflow-y-auto py-6 space-y-6">
              
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Friendly Source Title</span>
                <div className="text-sm font-bold text-zinc-200 bg-zinc-950/40 border border-zinc-850 p-3 rounded">
                  {getFriendlyName(selectedWebsite.url)}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">URL Address Target</span>
                <div className="flex items-center justify-between bg-zinc-950/40 border border-zinc-850 p-3 rounded font-mono text-xs select-all">
                  <span className="text-zinc-300 truncate max-w-xs">{selectedWebsite.url}</span>
                  <a href={selectedWebsite.url} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-white ml-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1F2937]/30 border border-zinc-850 p-4 rounded space-y-1">
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Crawl Status</span>
                  <div className="pt-1">{renderStatusText(selectedWebsite.status)}</div>
                </div>
                <div className="bg-[#1F2937]/30 border border-zinc-850 p-4 rounded space-y-1">
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Indexed Pages</span>
                  <div className="text-lg font-bold font-mono text-slate-200">{selectedWebsite.pagesCrawled}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1F2937]/30 border border-zinc-850 p-4 rounded space-y-1">
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Knowledge Segments</span>
                  <div className="text-lg font-bold font-mono text-slate-200">{selectedWebsite.chunksCreated}</div>
                </div>
                <div className="bg-[#1F2937]/30 border border-zinc-850 p-4 rounded space-y-1">
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Last Synced Log</span>
                  <div className="text-xs font-semibold text-zinc-300 pt-1 font-mono flex items-center">
                    <Clock className="h-3 w-3 mr-1 text-zinc-500" />
                    <span>3 min ago</span>
                  </div>
                </div>
              </div>

              {selectedWebsite.status === 'CRAWLED' && (
                <div className="space-y-2.5">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">AI Database Index Status</span>
                  <div className="bg-[#1F2937]/10 border border-zinc-850 p-4 rounded text-xs space-y-3 font-mono">
                    <div className="flex justify-between border-b border-zinc-900 pb-2">
                      <span className="text-zinc-500">Vector Embeddings generated:</span>
                      <span className="text-zinc-300">{selectedWebsite.chunksCreated}</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-900 pb-2">
                      <span className="text-zinc-500">Sync Status:</span>
                      <span className="text-emerald-400 font-semibold">COMPLETE</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Embedding Engine:</span>
                      <span className="text-zinc-400">nomic-embed-text</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Quick Actions Footer */}
            <div className="pt-4 border-t border-zinc-800 grid grid-cols-3 gap-2.5">
              <Button 
                variant="outline" 
                onClick={() => handleRefresh(selectedWebsite.id)}
                disabled={refreshingIds[selectedWebsite.id] || selectedWebsite.status === 'CRAWLING'}
                className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs h-10"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshingIds[selectedWebsite.id] ? 'animate-spin' : ''}`} />
                Sync Now
              </Button>
              <Button 
                variant="primary" 
                onClick={() => {
                  setSelectedWebsite(null);
                  navigate(`/chat?websiteId=${selectedWebsite.id}`);
                }}
                disabled={selectedWebsite.status !== 'CRAWLED'}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-10"
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Chat
              </Button>
              <Button 
                variant="danger" 
                onClick={() => handleDelete(selectedWebsite.id)}
                className="text-red-200 border-red-900 bg-red-950/40 hover:bg-red-900/50 text-xs h-10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Disconnect
              </Button>
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
        <form onSubmit={handleAddWebsite} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Root Website Target URL</label>
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
              className="bg-black border-zinc-850"
            />
            {urlValidationError && (
              <p className="text-[10px] text-red-400 font-semibold">{urlValidationError}</p>
            )}
            <p className="text-[10px] text-zinc-500 leading-normal">
              Enter the documentation url. RAGBot will scan the pages matching this prefix to extract text segments.
            </p>
          </div>

          {errorMsg && (
            <Alert variant="destructive" className="border-red-900 bg-red-950/20 text-red-300">
              <AlertTitle className="text-xs">Operation Error</AlertTitle>
              <AlertDescription className="text-[10px]">{errorMsg}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-900">
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              disabled={addLoading}
              onClick={() => {
                setIsAddModalOpen(false);
                setNewUrl('');
                setUrlValidationError(null);
                setErrorMsg(null);
              }}
              className="border-zinc-800 hover:bg-zinc-800 text-zinc-300"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              size="sm"
              disabled={addLoading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            >
              {addLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Syncing content...
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
