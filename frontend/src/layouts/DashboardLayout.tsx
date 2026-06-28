import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Globe, 
  Search, 
  Menu, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  User,
  Moon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { apiService } from '../services/api';
import { websiteStore } from '../store/websiteStore';

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const [health, setHealth] = useState({
    backend: 'checking',
    database: 'checking',
    ollama: 'checking'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<{ type: string; label: string; to: string }[]>([]);

  const menuGroups = [
    {
      group: 'Workspace',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/websites', label: 'Knowledge Bases', icon: Globe },
      ]
    }
  ];

  const runHealthChecks = async () => {
    let backendOk = false;
    let databaseOk = false;
    let ollamaOk = false;

    try {
      const model = await apiService.getModelInfo();
      backendOk = true;
      if (model && model.modelName) {
        ollamaOk = true;
      }
    } catch (e) {
      console.warn('Backend check failed', e);
    }

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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    const matches: typeof searchResults = [];
    const queryLower = q.toLowerCase();

    menuGroups.forEach(g => {
      g.items.forEach(item => {
        if (item.label.toLowerCase().includes(queryLower)) {
          matches.push({ type: 'Page', label: item.label, to: item.to });
        }
      });
    });

    const websites = websiteStore.getWebsites();
    websites.forEach(w => {
      if (w.url.toLowerCase().includes(queryLower)) {
        matches.push({ type: 'Source', label: w.url, to: `/websites/${w.id}/chat` });
      }
    });

    setSearchResults(matches);
  };

  const handleSearchResultClick = (to: string) => {
    navigate(to);
    setSearchQuery('');
    setIsSearchActive(false);
  };

  const getSystemStatus = () => {
    const { backend, database, ollama } = health;
    if (backend === 'checking' || database === 'checking' || ollama === 'checking') {
      return { label: 'Checking system', color: 'bg-warning' };
    }
    if (backend === 'online' && database === 'online' && ollama === 'online') {
      return { label: 'Operational', color: 'bg-success' };
    }
    return { label: 'Service Interrupted', color: 'bg-danger' };
  };

  const sysStatus = getSystemStatus();

  // Retrieve current page title for Topbar
  const getPageTitle = () => {
    if (location.pathname.match(/^\/websites\/\d+\/chat/)) return 'AI Assistant';
    if (location.pathname.startsWith('/websites')) return 'Knowledge Bases';
    if (location.pathname.startsWith('/search')) return 'Search Playground';
    if (location.pathname.startsWith('/evaluate')) return 'Evaluation';
    if (location.pathname.startsWith('/dashboard')) return 'Dashboard';
    if (location.pathname.startsWith('/settings')) return 'Settings';
    return 'Home';
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-secondary border-r border-border text-textPrimary transition-all duration-300">
      
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-4 shrink-0 bg-transparent">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-textPrimary tracking-tight text-sm">RAGBot Platform</span>
          )}
        </div>
        
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="hidden md:flex text-textSecondary hover:text-textPrimary p-1 rounded-md hover:bg-border/50 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Group items */}
      <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
        {menuGroups.map((g, i) => (
          <div key={i} className="space-y-1">
            {!isCollapsed && (
              <span className="text-[11px] font-medium text-textSecondary uppercase tracking-wider px-3 block mb-2">
                {g.group}
              </span>
            )}
            <nav className="space-y-1">
              {g.items.map((item) => {
                // Special style logic removed for global chat
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center rounded-md text-sm font-medium transition-all focus:outline-none",
                        isCollapsed ? "justify-center p-2.5 mx-auto w-10 h-10" : "px-3 py-2 space-x-3",
                        isActive
                          ? "bg-white shadow-sm text-primary"
                          : "text-textSecondary hover:text-textPrimary hover:bg-border/30",
                      )
                    }
                    title={isCollapsed ? item.label : undefined}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0")} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 mt-auto flex flex-col space-y-2 border-t border-border/50 bg-secondary">
        {!isCollapsed ? (
          <>
            <div className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-border/30 cursor-pointer transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center">
                  <User className="w-4 h-4 text-textSecondary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-textPrimary">User Profile</span>
                  <span className="text-[10px] text-textSecondary">v1.0.0-mvp</span>
                </div>
              </div>
              <Moon className="w-4 h-4 text-textSecondary hover:text-textPrimary" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center space-y-4 py-2">
            <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center">
              <User className="w-4 h-4 text-textSecondary" />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-textPrimary font-sans">
      
      {/* Sidebar Frame - Desktop */}
      <aside className={cn(
        "hidden md:flex flex-col shrink-0 transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}>
        <SidebarContent />
      </aside>

      {/* Sidebar Drawer for Mobile */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-textPrimary/20 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
          <div className="relative w-64 h-full flex flex-col z-10 animate-slide-in bg-secondary">
            <button 
              onClick={() => setIsMobileOpen(false)} 
              className="absolute top-3 right-3 text-textSecondary hover:text-textPrimary p-1.5 rounded-md hover:bg-border"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        
        {/* Top Navbar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-8 bg-card shrink-0">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsMobileOpen(true)} 
              className="flex md:hidden text-textSecondary hover:text-textPrimary p-1.5 rounded-md hover:bg-secondary transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-textPrimary">
              {getPageTitle()}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Global Search Bar */}
            <div className="relative w-full max-w-xs hidden sm:block">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => setIsSearchActive(true)}
                  onBlur={() => setTimeout(() => setIsSearchActive(false), 200)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-secondary border border-border rounded-md text-textPrimary placeholder:text-textSecondary focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                />
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-textSecondary" />
              </div>
              
              {/* Global Search Dropdown */}
              {isSearchActive && searchResults.length > 0 && (
                <div className="absolute top-10 left-0 right-0 z-50 bg-card border border-border rounded-md shadow-lg p-1.5 max-h-60 overflow-y-auto space-y-0.5">
                  <span className="text-[10px] font-medium text-textSecondary uppercase tracking-wider px-2 block py-1">Results</span>
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      onMouseDown={() => handleSearchResultClick(res.to)}
                      className="w-full text-left px-2.5 py-1.5 rounded-sm text-[12px] text-textPrimary hover:bg-secondary transition-colors flex justify-between items-center"
                    >
                      <span className="truncate max-w-[200px]">{res.label}</span>
                      <span className="text-[9px] bg-border/50 text-textSecondary px-1.5 py-0.5 rounded-sm font-medium shrink-0">
                        {res.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status Indicator */}
            <div className="flex items-center space-x-2 shrink-0 bg-secondary px-2.5 py-1 rounded-full border border-border/50 cursor-help" title={sysStatus.label}>
              <div className={cn("h-1.5 w-1.5 rounded-full", sysStatus.color, sysStatus.color.includes('warning') && "animate-pulse")}></div>
              <span className="text-[11px] font-medium text-textSecondary hidden md:inline-block">LLaMA 3 • Nomic</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow overflow-y-auto w-full max-w-none p-4 md:p-8">
          <div className="w-full max-w-5xl mx-auto h-full flex flex-col">
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
};

export default DashboardLayout;
