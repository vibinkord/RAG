package com.vibin.ragbot.service.embedding;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
@Deprecated
public class EmbeddingService {

    private final EmbeddingGenerationService embeddingGenerationService;
    private final OllamaEmbeddingService ollamaEmbeddingService;

    /**
     * Generates a vector embedding for the given text.
     * Deprecated: Use OllamaEmbeddingService instead.
     */
    @Deprecated
    public List<Double> generateEmbedding(String text) {
        float[] vector = ollamaEmbeddingService.generateEmbedding(text);
        List<Double> doubleList = new ArrayList<>(vector.length);
        for (float f : vector) {
            doubleList.add((double) f);
        }
        return doubleList;
    }

    /**
     * Gets the embedding dimension.
     * Deprecated: Use OllamaEmbeddingService instead.
     */
    @Deprecated
    public int getEmbeddingDimension() {
        return ollamaEmbeddingService.getEmbeddingDimension();
    }

    /**
     * Generates embeddings for a website.
     * Deprecated: Use EmbeddingGenerationService instead.
     */
    @Deprecated
    public void generateEmbeddingsForWebsite(Long websiteId) {
        log.warn("Calling deprecated generateEmbeddingsForWebsite for website ID: {}", websiteId);
        embeddingGenerationService.startEmbeddingGeneration(websiteId);
    }
}
