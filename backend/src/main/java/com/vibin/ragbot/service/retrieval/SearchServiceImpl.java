package com.vibin.ragbot.service.retrieval;

import com.vibin.ragbot.dto.SearchRequest;
import com.vibin.ragbot.dto.SearchResponse;
import com.vibin.ragbot.entity.Embedding;
import com.vibin.ragbot.repository.ChunkRepository;
import com.vibin.ragbot.repository.EmbeddingRepository;
import com.vibin.ragbot.service.embedding.OllamaEmbeddingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchServiceImpl implements SearchService {

    private final OllamaEmbeddingService ollamaEmbeddingService;
    private final EmbeddingRepository embeddingRepository;
    private final ChunkRepository chunkRepository;

    @Override
    public SearchResponse search(SearchRequest request) {
        log.info("Performing vector similarity search for query: '{}', limit: {}, websiteId: {}",
                request.getQuery(), request.getLimit(), request.getWebsiteId());

        // 1. Generate embedding for query text
        float[] queryVector = ollamaEmbeddingService.generateEmbedding(request.getQuery());

        // 2. Determine limits
        int limit = (request.getLimit() != null && request.getLimit() > 0) ? request.getLimit() : 5;

        // 3. Find closest neighbors in database
        List<Embedding> nearestEmbeddings;
        if (request.getWebsiteId() != null) {
            nearestEmbeddings = embeddingRepository.findNearestNeighborsByWebsite(queryVector, request.getWebsiteId(), limit);
        } else {
            nearestEmbeddings = embeddingRepository.findNearestNeighbors(queryVector, limit);
        }

        // 4. Map nearest neighbors to results with details and calculated similarity score
        List<SearchResponse.SearchResult> results = new ArrayList<>();
        for (Embedding emb : nearestEmbeddings) {
            chunkRepository.findById(emb.getChunkId()).ifPresent(chunk -> {
                double similarity = calculateCosineSimilarity(queryVector, emb.getEmbedding());
                
                log.info("Chunk {} content preview: {}", chunk.getId(), 
                        chunk.getContent() != null ? chunk.getContent().substring(0, Math.min(100, chunk.getContent().length())) : "null");

                results.add(SearchResponse.SearchResult.builder()
                        .chunkId(chunk.getId())
                        .content(chunk.getContent())
                        .sourceUrl(chunk.getSourceUrl())
                        .score(similarity)
                        .build());
            });
        }

        return SearchResponse.builder()
                .query(request.getQuery())
                .results(results)
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
}
