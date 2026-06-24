package com.vibin.ragbot.service.embedding;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vibin.ragbot.entity.Chunk;
import com.vibin.ragbot.entity.Embedding;
import com.vibin.ragbot.repository.ChunkRepository;
import com.vibin.ragbot.repository.EmbeddingRepository;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmbeddingService {

    private final ChunkRepository chunkRepository;
    private final EmbeddingRepository embeddingRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${ollama.api.url:http://localhost:11434}")
    private String ollamaApiUrl;

    private static final String MODEL_NAME = "nomic-embed-text";

    /**
     * Generates a vector embedding for the given text using the Ollama API.
     *
     * @param text the text to embed
     * @return the list of double values representing the vector embedding
     */
    public List<Double> generateEmbedding(String text) {
        if (text == null || text.trim().isEmpty()) {
            return Collections.emptyList();
        }

        String url = ollamaApiUrl + "/api/embeddings";
        OllamaEmbeddingRequest request = new OllamaEmbeddingRequest(MODEL_NAME, text);

        try {
            OllamaEmbeddingResponse response = restTemplate.postForObject(url, request, OllamaEmbeddingResponse.class);
            if (response != null && response.getEmbedding() != null) {
                return response.getEmbedding();
            }
        } catch (Exception e) {
            log.error("Failed to generate embedding from Ollama for text: {}. Error: {}", text, e.getMessage());
            throw new RuntimeException("Embedding generation failed", e);
        }

        return Collections.emptyList();
    }

    /**
     * Determines the embedding dimension dynamically from the model.
     *
     * @return the embedding dimension (e.g. 768)
     */
    public int getEmbeddingDimension() {
        try {
            List<Double> testEmbedding = generateEmbedding("test");
            if (!testEmbedding.isEmpty()) {
                return testEmbedding.size();
            }
        } catch (Exception e) {
            log.error("Failed to dynamically determine embedding dimension: {}", e.getMessage());
        }
        // Fallback default dimension for nomic-embed-text
        return 768;
    }

    /**
     * Reads all chunks for a website, fetches embeddings from Ollama for any chunks
     * that do not have them yet, and stores them in the database.
     *
     * @param websiteId the ID of the website target
     */
    @Async
    @Transactional
    public void generateEmbeddingsForWebsite(Long websiteId) {
        log.info("Generating embeddings for websiteId: {}", websiteId);
        List<Chunk> chunks = chunkRepository.findByPageWebsiteId(websiteId);
        if (chunks.isEmpty()) {
            log.info("No chunks found for websiteId: {}", websiteId);
            return;
        }

        int count = 0;
        for (Chunk chunk : chunks) {
            if (embeddingRepository.existsByChunkId(chunk.getId())) {
                log.debug("Chunk {} already has an embedding. Skipping.", chunk.getId());
                continue;
            }

            try {
                List<Double> vector = generateEmbedding(chunk.getContent());
                if (!vector.isEmpty()) {
                    String vectorJson = objectMapper.writeValueAsString(vector);
                    Embedding embedding = Embedding.builder()
                            .chunkId(chunk.getId())
                            .vectorJson(vectorJson)
                            .build();
                    embeddingRepository.save(embedding);
                    count++;
                }
            } catch (Exception e) {
                log.error("Error processing embedding for chunk {}: {}", chunk.getId(), e.getMessage());
            }
        }

        log.info("Completed embedding generation for websiteId: {}. Created {} new embeddings.", websiteId, count);
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    private static class OllamaEmbeddingRequest {
        private String model;
        private String prompt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    private static class OllamaEmbeddingResponse {
        private List<Double> embedding;
    }
}
