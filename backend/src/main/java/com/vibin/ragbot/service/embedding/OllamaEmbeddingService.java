package com.vibin.ragbot.service.embedding;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class OllamaEmbeddingService {

    private final RestTemplate restTemplate;

    @Value("${ollama.api.url:http://localhost:11434}")
    private String ollamaApiUrl;

    private static final String MODEL_NAME = "nomic-embed-text";
    private static final int MAX_ATTEMPTS = 3;
    private static final long INITIAL_BACKOFF_MS = 1000;

    /**
     * Generates a vector embedding for the given text using the Ollama API.
     * Incorporates retry logic with exponential backoff.
     *
     * @param text the text to embed
     * @return the float array representing the vector embedding
     */
    public float[] generateEmbedding(String text) {
        if (text == null || text.trim().isEmpty()) {
            return new float[0];
        }

        String url = ollamaApiUrl + "/api/embed";
        OllamaEmbedRequest request = new OllamaEmbedRequest(MODEL_NAME, text);

        long backoffMs = INITIAL_BACKOFF_MS;
        Exception lastException = null;

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                log.debug("Calling Ollama API (attempt {}/{}): {}", attempt, MAX_ATTEMPTS, url);
                OllamaEmbedResponse response = restTemplate.postForObject(url, request, OllamaEmbedResponse.class);
                
                if (response != null && response.getEmbeddings() != null && !response.getEmbeddings().isEmpty()) {
                    return response.getEmbeddings().get(0);
                } else {
                    throw new RuntimeException("Ollama returned an empty embedding list");
                }
            } catch (Exception e) {
                lastException = e;
                log.warn("Ollama embedding generation failed on attempt {}/{} for text length {}. Error: {}",
                        attempt, MAX_ATTEMPTS, text.length(), e.getMessage());
                
                if (attempt < MAX_ATTEMPTS) {
                    try {
                        log.info("Backing off for {} ms before next retry...", backoffMs);
                        Thread.sleep(backoffMs);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Embedding generation interrupted during retry backoff", ie);
                    }
                    backoffMs *= 2; // Exponential backoff
                }
            }
        }

        log.error("All {} attempts to generate embedding via Ollama failed.", MAX_ATTEMPTS);
        throw new RuntimeException("Ollama embedding generation failed after " + MAX_ATTEMPTS + " attempts", lastException);
    }

    /**
     * Helper method to get the fixed dimension of the embedding model.
     *
     * @return fixed embedding dimension (768)
     */
    public int getEmbeddingDimension() {
        return 768;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    private static class OllamaEmbedRequest {
        private String model;
        private String input;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    private static class OllamaEmbedResponse {
        private String model;
        private List<float[]> embeddings;
    }
}
