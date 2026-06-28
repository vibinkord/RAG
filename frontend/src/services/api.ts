import axios from 'axios';
import { 
  IngestionResponse, 
  EmbeddingStatus, 
  ModelInfo, 
  SearchResponse, 
  SearchDebugResponse, 
  AnswerResponse, 
  ChatResponse, 
  EvaluationResponse 
} from '../types';

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Telemetry types
export interface TelemetryLog {
  id: string;
  type: 'search' | 'chat' | 'evaluate';
  query: string;
  latencyMs: number;
  timestamp: string;
  success: boolean;
}

// Telemetry helper
export const telemetryStore = {
  getLogs(): TelemetryLog[] {
    const logs = localStorage.getItem('ragbot_telemetry');
    if (!logs) return [];
    try {
      return JSON.parse(logs);
    } catch {
      return [];
    }
  },
  addLog(type: 'search' | 'chat' | 'evaluate', query: string, latencyMs: number, success: boolean) {
    const logs = this.getLogs();
    const newLog: TelemetryLog = {
      id: Math.random().toString(36).substring(7),
      type,
      query,
      latencyMs,
      timestamp: new Date().toISOString(),
      success
    };
    logs.unshift(newLog);
    // Limit to last 50 logs
    localStorage.setItem('ragbot_telemetry', JSON.stringify(logs.slice(0, 50)));
  }
};

export const apiService = {
  // Ingestion (Crawling)
  ingestWebsite: async (payload: { 
    url: string;
    crawlMode?: string;
    maxPages?: number;
    maxDepth?: number;
    crawlDelayMs?: number;
    respectRobots?: boolean;
    sameDomainOnly?: boolean;
    excludeQueryParameters?: boolean;
    followExternalLinks?: boolean;
  }): Promise<IngestionResponse> => {
    const response = await api.post<IngestionResponse>('/api/websites', payload);
    return response.data;
  },

  getCrawlStatus: async (websiteId: number): Promise<IngestionResponse> => {
    const response = await api.get<IngestionResponse>(`/api/ingest/${websiteId}/status`);
    return response.data;
  },

  getCrawlProgress: async (websiteId: number): Promise<import('../types').CrawlProgress> => {
    const response = await api.get<import('../types').CrawlProgress>(`/api/websites/${websiteId}/progress`);
    return response.data;
  },

  // Website Configuration
  refreshWebsite: async (websiteId: number): Promise<IngestionResponse> => {
    const response = await api.post<IngestionResponse>(`/api/websites/${websiteId}/refresh`);
    return response.data;
  },

  // Embeddings
  getEmbeddingStatus: async (websiteId: number): Promise<EmbeddingStatus> => {
    const response = await api.get<EmbeddingStatus>(`/api/embeddings/${websiteId}/status`);
    return response.data;
  },

  triggerEmbedding: async (websiteId: number): Promise<EmbeddingStatus> => {
    const response = await api.post<EmbeddingStatus>(`/api/embeddings/${websiteId}`);
    return response.data;
  },

  getModelInfo: async (): Promise<ModelInfo> => {
    const response = await api.get<ModelInfo>('/api/embeddings/model-info');
    return response.data;
  },

  // Search & Retrieval
  search: async (
    query: string, 
    websiteId?: number, 
    websiteIds?: number[], 
    pageType?: string, 
    minSimilarity?: number, 
    limit?: number
  ): Promise<SearchResponse> => {
    const startTime = Date.now();
    try {
      const response = await api.post<SearchResponse>('/api/search', {
        query,
        websiteId: websiteId || undefined,
        websiteIds: websiteIds && websiteIds.length > 0 ? websiteIds : undefined,
        pageType: pageType || undefined,
        minSimilarity: minSimilarity !== undefined ? minSimilarity : undefined,
        limit: limit || undefined
      });
      const latencyMs = Date.now() - startTime;
      telemetryStore.addLog('search', query, latencyMs, true);
      return response.data;
    } catch (e) {
      telemetryStore.addLog('search', query, Date.now() - startTime, false);
      throw e;
    }
  },

  searchDebug: async (
    query: string, 
    websiteId?: number, 
    websiteIds?: number[], 
    pageType?: string, 
    limit?: number
  ): Promise<SearchDebugResponse> => {
    const params = new URLSearchParams();
    params.append('query', query);
    if (websiteId) params.append('websiteId', websiteId.toString());
    if (websiteIds && websiteIds.length > 0) {
      websiteIds.forEach(id => params.append('websiteIds', id.toString()));
    }
    if (pageType) params.append('pageType', pageType);
    if (limit) params.append('limit', limit.toString());

    const response = await api.get<SearchDebugResponse>('/api/search/debug', { params });
    return response.data;
  },

  // Chat & Q&A
  generateAnswer: async (
    question: string,
    websiteId?: number,
    websiteIds?: number[],
    pageType?: string,
    minSimilarity?: number,
    topK?: number
  ): Promise<AnswerResponse> => {
    const startTime = Date.now();
    try {
      const response = await api.post<AnswerResponse>('/api/answer', {
        question,
        websiteId: websiteId || undefined,
        websiteIds: websiteIds && websiteIds.length > 0 ? websiteIds : undefined,
        pageType: pageType || undefined,
        minSimilarity: minSimilarity !== undefined ? minSimilarity : undefined,
        topK: topK || undefined
      });
      const latencyMs = Date.now() - startTime;
      telemetryStore.addLog('chat', question, latencyMs, true);
      return response.data;
    } catch (e) {
      telemetryStore.addLog('chat', question, Date.now() - startTime, false);
      throw e;
    }
  },

  chat: async (
    sessionId: string,
    message: string,
    websiteId?: number,
    websiteIds?: number[],
    pageType?: string,
    minSimilarity?: number,
    topK?: number
  ): Promise<ChatResponse> => {
    const startTime = Date.now();
    try {
      const response = await api.post<ChatResponse>('/api/chat', {
        sessionId,
        message,
        websiteId: websiteId || undefined,
        websiteIds: websiteIds && websiteIds.length > 0 ? websiteIds : undefined,
        pageType: pageType || undefined,
        minSimilarity: minSimilarity !== undefined ? minSimilarity : undefined,
        topK: topK || undefined
      });
      const latencyMs = Date.now() - startTime;
      telemetryStore.addLog('chat', message, latencyMs, true);
      return response.data;
    } catch (e) {
      telemetryStore.addLog('chat', message, Date.now() - startTime, false);
      throw e;
    }
  },

  // Evaluation
  evaluate: async (
    question: string,
    expectedAnswer: string,
    websiteId?: number,
    websiteIds?: number[],
    pageType?: string
  ): Promise<EvaluationResponse> => {
    const startTime = Date.now();
    try {
      const response = await api.post<EvaluationResponse>('/api/evaluate', {
        question,
        expectedAnswer,
        websiteId: websiteId || undefined,
        websiteIds: websiteIds && websiteIds.length > 0 ? websiteIds : undefined,
        pageType: pageType || undefined
      });
      const latencyMs = Date.now() - startTime;
      telemetryStore.addLog('evaluate', question, latencyMs, true);
      return response.data;
    } catch (e) {
      telemetryStore.addLog('evaluate', question, Date.now() - startTime, false);
      throw e;
    }
  }
};
