import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Websites from './pages/Websites';
import Chat from './pages/Chat';
import SearchPlayground from './pages/SearchPlayground';
import Evaluation from './pages/Evaluation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Navigate to="/websites" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/websites" element={<Websites />} />
            <Route path="/websites/:websiteId/chat" element={<Chat />} />
            <Route path="/chat" element={<Navigate to="/websites" replace />} />
            <Route path="/search" element={<SearchPlayground />} />
            <Route path="/evaluate" element={<Evaluation />} />
            <Route path="*" element={<Navigate to="/websites" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
