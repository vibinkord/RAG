package com.vibin.ragbot.controller;

import com.vibin.ragbot.service.embedding.EmbeddingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/embeddings")
@RequiredArgsConstructor
@Slf4j
public class EmbeddingController {

    private final EmbeddingService embeddingService;

    /**
     * Triggers asynchronous embedding generation for all chunks associated with the websiteId.
     *
     * @param websiteId the ID of the website target
     * @return response indicating that the embedding generation task has been initiated
     */
    @PostMapping("/{websiteId}/generate")
    public ResponseEntity<Map<String, String>> generateEmbeddings(@PathVariable Long websiteId) {
        log.info("Received request to generate embeddings for websiteId: {}", websiteId);
        
        // Trigger background asynchronous task
        embeddingService.generateEmbeddingsForWebsite(websiteId);
        
        return ResponseEntity.ok(Map.of(
            "status", "ACCEPTED",
            "message", "Embedding generation task initiated asynchronously for websiteId: " + websiteId
        ));
    }

    /**
     * Startup verification endpoint to check model and dynamically resolved dimension.
     *
     * @return model name and resolved dimension
     */
    @GetMapping("/model-info")
    public ResponseEntity<Map<String, Object>> getModelInfo() {
        log.info("Received request for embedding model information.");
        return ResponseEntity.ok(Map.of(
            "model", "nomic-embed-text",
            "dimension", embeddingService.getEmbeddingDimension()
        ));
    }
}
