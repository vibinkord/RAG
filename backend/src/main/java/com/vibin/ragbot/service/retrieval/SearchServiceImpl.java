package com.vibin.ragbot.service.retrieval;

import com.vibin.ragbot.dto.SearchRequest;
import com.vibin.ragbot.dto.SearchResponse;
import com.vibin.ragbot.dto.SearchDebugResponse;
import com.vibin.ragbot.entity.Chunk;
import com.vibin.ragbot.entity.Embedding;
import com.vibin.ragbot.repository.ChunkRepository;
import com.vibin.ragbot.repository.EmbeddingRepository;
import com.vibin.ragbot.service.embedding.OllamaEmbeddingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchServiceImpl implements SearchService {

    private final OllamaEmbeddingService ollamaEmbeddingService;
    private final EmbeddingRepository embeddingRepository;
    private final ChunkRepository chunkRepository;

    @Override
    public SearchResponse search(SearchRequest request) {
        long startTime = System.currentTimeMillis();
        log.info("Performing similarity search for query: '{}', limit: {}, websiteId: {}, websiteIds: {}, pageType: {}",
                request.getQuery(), request.getLimit(), request.getWebsiteId(), request.getWebsiteIds(), request.getPageType());

        // 1. Generate embedding for query text
        float[] queryVector = ollamaEmbeddingService.generateEmbedding(request.getQuery());

        // 2. Determine limits and threshold
        int limit = (request.getLimit() != null && request.getLimit() > 0) ? request.getLimit() : 5;
        double minSim = (request.getMinSimilarity() != null) ? request.getMinSimilarity() : 0.35;

        // 3. Resolve website IDs filter
        List<Long> filterWebsiteIds = request.getWebsiteIds();
        if (filterWebsiteIds == null || filterWebsiteIds.isEmpty()) {
            if (request.getWebsiteId() != null) {
                filterWebsiteIds = List.of(request.getWebsiteId());
            }
        }

        // 4. Find closest neighbors in database
        List<Embedding> nearestEmbeddings;
        if (filterWebsiteIds != null && !filterWebsiteIds.isEmpty()) {
            nearestEmbeddings = embeddingRepository.findNearestNeighborsByWebsitesAndPageType(queryVector, filterWebsiteIds, request.getPageType(), limit * 3);
        } else {
            nearestEmbeddings = embeddingRepository.findNearestNeighborsAndPageType(queryVector, request.getPageType(), limit * 3);
        }

        // 5. Calculate scores, apply threshold, and gather chunk IDs
        List<Embedding> filteredEmbeddings = new ArrayList<>();
        List<Long> chunkIds = new ArrayList<>();
        Map<Long, Double> scoreMap = new HashMap<>();

        for (Embedding emb : nearestEmbeddings) {
            double similarity = calculateCosineSimilarity(queryVector, emb.getEmbedding());
            if (similarity >= minSim) {
                filteredEmbeddings.add(emb);
                chunkIds.add(emb.getChunkId());
                scoreMap.put(emb.getChunkId(), similarity);
            }
        }

        // Limit the candidate chunks to top "limit" elements
        List<Long> topChunkIds = chunkIds.stream().limit(limit).collect(Collectors.toList());

        // 6. Batch load chunk details (Reduces N+1 queries to exactly 1 query)
        List<Chunk> chunks = topChunkIds.isEmpty() ? Collections.emptyList() : chunkRepository.findAllById(topChunkIds);
        Map<Long, Chunk> chunkMap = chunks.stream().collect(Collectors.toMap(Chunk::getId, java.util.function.Function.identity()));

        // 7. Map to search response results maintaining sorted order of similarity score
        List<SearchResponse.SearchResult> results = new ArrayList<>();
        for (Long chunkId : topChunkIds) {
            Chunk chunk = chunkMap.get(chunkId);
            if (chunk != null) {
                double similarity = scoreMap.get(chunkId);
                String snippet = extractSnippet(chunk.getContent(), request.getQuery());
                
                results.add(SearchResponse.SearchResult.builder()
                        .chunkId(chunk.getId())
                        .content(chunk.getContent())
                        .snippet(snippet)
                        .sourceUrl(chunk.getSourceUrl())
                        .score(similarity)
                        .build());
            }
        }

        long latencyMs = System.currentTimeMillis() - startTime;
        log.info("[METRIC] operation=search query='{}' websiteIds={} pageType={} threshold={} latencyMs={} resultsCount={}",
                request.getQuery(), filterWebsiteIds, request.getPageType(), minSim, latencyMs, results.size());

        return SearchResponse.builder()
                .query(request.getQuery())
                .results(results)
                .latencyMs(latencyMs)
                .build();
    }

    @Override
    public SearchDebugResponse searchDebug(String query, Long websiteId, List<Long> websiteIds, String pageType, Integer limit) {
        long startTime = System.currentTimeMillis();
        float[] queryVector = ollamaEmbeddingService.generateEmbedding(query);
        int finalLimit = (limit != null && limit > 0) ? limit : 5;

        List<Long> filterWebsiteIds = websiteIds;
        if (filterWebsiteIds == null || filterWebsiteIds.isEmpty()) {
            if (websiteId != null) {
                filterWebsiteIds = List.of(websiteId);
            }
        }

        List<Embedding> nearestEmbeddings;
        if (filterWebsiteIds != null && !filterWebsiteIds.isEmpty()) {
            nearestEmbeddings = embeddingRepository.findNearestNeighborsByWebsitesAndPageType(queryVector, filterWebsiteIds, pageType, finalLimit);
        } else {
            nearestEmbeddings = embeddingRepository.findNearestNeighborsAndPageType(queryVector, pageType, finalLimit);
        }

        List<Long> chunkIds = nearestEmbeddings.stream().map(Embedding::getChunkId).collect(Collectors.toList());
        List<Chunk> chunks = chunkIds.isEmpty() ? Collections.emptyList() : chunkRepository.findAllById(chunkIds);
        Map<Long, Chunk> chunkMap = chunks.stream().collect(Collectors.toMap(Chunk::getId, java.util.function.Function.identity()));

        List<SearchDebugResponse.DebugResult> debugResults = new ArrayList<>();
        for (Embedding emb : nearestEmbeddings) {
            Chunk chunk = chunkMap.get(emb.getChunkId());
            if (chunk != null) {
                double similarity = calculateCosineSimilarity(queryVector, emb.getEmbedding());
                debugResults.add(SearchDebugResponse.DebugResult.builder()
                        .chunkId(chunk.getId())
                        .content(chunk.getContent())
                        .sourceUrl(chunk.getSourceUrl())
                        .similarityScore(similarity)
                        .rawVectorScore(similarity)
                        .rankingScore(similarity)
                        .pageType(chunk.getPageType())
                        .pageTitle(chunk.getTitle())
                        .build());
            }
        }

        long latencyMs = System.currentTimeMillis() - startTime;
        return SearchDebugResponse.builder()
                .query(query)
                .results(debugResults)
                .latencyMs(latencyMs)
                .build();
    }

    /**
     * Calculates the cosine similarity between two float vectors.
     */
    private double calculateCosineSimilarity(float[] vector1, float[] vector2) {
        if (vector1 == null || vector2 == null || vector1.length != vector2.length) {
            return 0.0;
        }
        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;
        for (int i = 0; i < vector1.length; i++) {
            dotProduct += vector1[i] * vector2[i];
            normA += vector1[i] * vector1[i];
            normB += vector2[i] * vector2[i];
        }
        if (normA == 0.0 || normB == 0.0) {
            return 0.0;
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Extracts a 200-character window around the matched query keywords.
     */
    private String extractSnippet(String content, String query) {
        if (content == null || content.isEmpty()) {
            return "";
        }
        if (query == null || query.trim().isEmpty()) {
            return content.substring(0, Math.min(200, content.length())) + (content.length() > 200 ? "..." : "");
        }
        
        String lowerContent = content.toLowerCase();
        String[] terms = query.toLowerCase().split("\\s+");
        
        int bestIdx = 0;
        int maxTermMatches = 0;
        
        for (int i = 0; i < content.length() - 100; i += 50) {
            String window = lowerContent.substring(i, Math.min(i + 200, content.length()));
            int matches = 0;
            for (String term : terms) {
                if (term.length() > 2 && window.contains(term)) {
                    matches++;
                }
            }
            if (matches > maxTermMatches) {
                maxTermMatches = matches;
                bestIdx = i;
            }
        }
        
        int start = Math.max(0, bestIdx - 30);
        int end = Math.min(content.length(), start + 200);
        
        if (start > 0) {
            int space = content.indexOf(' ', start);
            if (space != -1 && space < start + 20) {
                start = space + 1;
            }
        }
        
        String snippet = content.substring(start, end).trim();
        if (start > 0) {
            snippet = "..." + snippet;
        }
        if (end < content.length()) {
            snippet = snippet + "...";
        }
        return snippet;
    }
}
