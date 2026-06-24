import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Globe, 
  MessageSquare, 
  Search, 
  Award, 
  Menu, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Database,
  Activity,
  Cpu,
  Server,
  Terminal,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { apiService } from '../services/api';
import { websiteStore } from '../store/websiteStore';

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  
  // Layout states
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Health check statuses
  const [health, setHealth] = useState({
    backend: 'checking',
    database: 'checking',
    ollama: 'checking'
  });

  // Global Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<{ type: string; label: string; to: string }[]>([]);

  // Navigation Items Grouping (Renamed & Structured according to design principles)
  const menuGroups = [
    {
      group: 'Workspace',
      items: [
        { to: '/chat', label: 'Chat', icon: MessageSquare },
        { to: '/websites', label: 'Knowledge Sources', icon: Globe },
        { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      ]
    },
    {
      group: 'Tools',
      items: [
        { to: '/search', label: 'Search Explorer', icon: Search },
        { to: '/evaluate', label: 'Answer Evaluation', icon: Award },
      ]
    }
  ];

  // Perform health checks
  const runHealthChecks = async () => {
    let backendOk = false;
    let databaseOk = false;
    let ollamaOk = false;

    // 1. Check Backend via model-info
    try {
      const model = await apiService.getModelInfo();
      backendOk = true;
      if (model && model.modelName) {
        ollamaOk = true;
      }
    } catch (e) {
      console.warn('Backend check failed', e);
    }

    // 2. Check Database via website status poll
    try {
      const list = websiteStore.getWebsites();
      if (list.length > 0) {
        await apiService.getCrawlStatus(list[0].id);
        databaseOk = true;
      } else {
        databaseOk = true;
      }
    } catch (e) {
      console.warn('Database check failed', e);
    }

    setHealth({
      backend: backendOk ? 'online' : 'offline',
      database: backendOk && databaseOk ? 'online' : 'offline',
      ollama: backendOk && ollamaOk ? 'online' : 'offline'
    });
  };

  useEffect(() => {
    runHealthChecks();
    const interval = setInterval(runHealthChecks, 15000);
    return () => clearInterval(interval);
  }, []);

  // Handle Global Search Input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    const matches: typeof searchResults = [];
    const queryLower = q.toLowerCase();

    // 1. Match Navigation Items
    menuGroups.forEach(g => {
      g.items.forEach(item => {
        if (item.label.toLowerCase().includes(queryLower)) {
          matches.push({ type: 'Tool', label: item.label, to: item.to });
        }
      });
    });

    // 2. Match Ingested Websites (Knowledge Sources)
    const websites = websiteStore.getWebsites();
    websites.forEach(w => {
      if (w.url.toLowerCase().includes(queryLower)) {
        matches.push({ type: 'Source', label: w.url, to: `/chat?websiteId=${w.id}` });
      }
    });

    setSearchResults(matches);
  };

  const handleSearchResultClick = (to: string) => {
    navigate(to);
    setSearchQuery('');
    setIsSearchActive(false);
  };

  // Determine global system status based on health checks
  const getSystemStatus = () => {
    const { backend, database, ollama } = health;
    if (backend === 'checking' || database === 'checking' || ollama === 'checking') {
      return { label: 'Checking system status...', color: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse' };
    }
    if (backend === 'online' && database === 'online' && ollama === 'online') {
      return { label: 'All systems operational', color: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' };
    }
    return { label: 'Service Interrupted', color: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' };
  };

  const sysStatus = getSystemStatus();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#111827] text-zinc-100">
      {/* Brand Header */}
      <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 shrink-0 bg-[#0F172A]">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="h-7 w-7 rounded bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-zinc-100 tracking-tight text-sm uppercase">RAGBot</span>
          )}
        </div>
        
        {/* Toggle Collapse Button on Desktop */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="hidden md:flex text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800/50 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Group items */}
      <div className="flex-1 py-6 px-4 space-y-6 overflow-y-auto">
        {menuGroups.map((g, i) => (
          <div key={i} className="space-y-1.5">
            {!isCollapsed && (
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-3 block">
                {g.group}
              </span>
            )}
            <nav className="space-y-1">
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded text-sm transition-all focus:outline-none",
                      isCollapsed ? "justify-center p-2.5" : "px-3 py-2.5 space-x-3",
                      isActive
                        ? "bg-zinc-800 text-blue-400 font-semibold border-l-2 border-blue-500"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
                    )
                  }
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </div>

      {/* Simple, premium status badge in sidebar footer */}
      <div className="p-4 border-t border-zinc-800 shrink-0 bg-[#0F172A]/40 text-xs">
        {isCollapsed ? (
          <div className="flex flex-col items-center">
            <span className={cn("h-2 w-2 rounded-full", sysStatus.color)} title={sysStatus.label} />
          </div>
        ) : (
          <div className="flex items-center space-x-2 px-1 text-[11px] text-zinc-400">
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", sysStatus.color)}></span>
            <span className="truncate">{sysStatus.label}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0F172A] text-zinc-100 font-sans">
      
      {/* Sidebar Frame - Desktop */}
      <aside className={cn(
        "hidden md:flex flex-col border-r border-zinc-800 shrink-0 transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}>
        <SidebarContent />
      </aside>

      {/* Sidebar Drawer for Mobile */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
          <div className="relative w-64 h-full border-r border-zinc-800 flex flex-col z-10 animate-slide-in">
            <button 
              onClick={() => setIsMobileOpen(false)} 
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0F172A]">
        
        {/* Top Navbar */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#111827]/70 backdrop-blur-md shrink-0">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsMobileOpen(true)} 
              className="flex md:hidden text-zinc-400 hover:text-white p-1.5 rounded hover:bg-zinc-800 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest hidden sm:inline-block">
              Knowledge Assistant
            </span>
          </div>

          {/* Global Search Bar */}
          <div className="relative w-full max-w-sm mx-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search knowledge sources, prompts..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => setIsSearchActive(true)}
                onBlur={() => setTimeout(() => setIsSearchActive(false), 200)}
                className="w-full h-8 pl-8 pr-3 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
            </div>
            
            {/* Global Search Dropdown */}
            {isSearchActive && searchResults.length > 0 && (
              <div className="absolute top-10 left-0 right-0 z-50 bg-[#111827] border border-zinc-800 rounded shadow-2xl p-2 max-h-60 overflow-y-auto space-y-1">
                <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider px-2 block py-1 font-mono">Matched Indexes</span>
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    onMouseDown={() => handleSearchResultClick(res.to)}
                    className="w-full text-left px-2.5 py-1.5 rounded text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex justify-between items-center"
                  >
                    <span className="truncate max-w-[200px]">{res.label}</span>
                    <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 rounded font-mono uppercase shrink-0">
                      {res.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-mono text-zinc-400 font-semibold select-none">connected</span>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow overflow-y-auto w-full max-w-none px-4 md:px-8 py-6">
          <div className="w-[95%] mx-auto py-2">
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
};

export default DashboardLayout;
