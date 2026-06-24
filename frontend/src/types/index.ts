export type CrawlStatus = 'PENDING' | 'CRAWLING' | 'CRAWLED' | 'FAILED';

export interface Website {
  id: number;
  url: string;
  status: CrawlStatus;
  pagesCrawled: number;
  chunksCreated: number;
  createdAt?: string;
}

export interface Page {
  id: number;
  url: string;
  title: string;
  content: string;
}

export interface Chunk {
  id: number;
  pageId: number;
  sourceUrl: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  title?: string;
  pageType?: string;
  createdAt: string;
}

export interface EmbeddingStatus {
  websiteId: number;
  totalChunks: number;
  embeddedChunks: number;
  remainingChunks: number;
  status: string; // 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
}

export interface ModelInfo {
  modelName: string;
  dimension: number;
}

export interface SearchResult {
  chunkId: number;
  content: string;
  snippet: string;
  sourceUrl: string;
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  latencyMs: number;
}

export interface SourceDto {
  url: string;
  score: number;
  snippet: string;
}

export interface AnswerResponse {
  question: string;
  answer: string;
  model: string;
  topSimilarityScore: number;
  sources: SourceDto[];
  chunksUsed: string[];
  retrievalLatencyMs: number;
  generationLatencyMs: number;
  totalLatencyMs: number;
}

export interface ChatResponse {
  sessionId: string;
  answer: string;
  model: string;
  sources: SourceDto[];
  chunksUsed: string[];
  retrievalLatencyMs: number;
  generationLatencyMs: number;
  totalLatencyMs: number;
}

export interface EvaluationResponse {
  question: string;
  expectedAnswer: string;
  generatedAnswer: string;
  similarityScore: number;
  factualCorrectnessScore: number;
  explanation: string;
  retrievedChunksCount: number;
  sources: SourceDto[];
  retrievalLatencyMs: number;
  generationLatencyMs: number;
  totalLatencyMs: number;
}

export interface DebugResult {
  chunkId: number;
  content: string;
  sourceUrl: string;
  similarityScore: number;
  rawVectorScore: number;
  rankingScore: number;
  pageType: string;
  pageTitle: string;
}

export interface SearchDebugResponse {
  query: string;
  results: DebugResult[];
  latencyMs: number;
}

export interface IngestionResponse {
  id: number;
  url: string;
  status: CrawlStatus;
  pagesCrawled: number;
  chunksCreated: number;
  message: string;
}
