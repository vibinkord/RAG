package com.vibin.ragbot.controller;

import com.vibin.ragbot.dto.EmbeddingGenerationStartResponse;
import com.vibin.ragbot.dto.EmbeddingStatusResponse;
import com.vibin.ragbot.service.embedding.EmbeddingGenerationService;
import com.vibin.ragbot.service.embedding.OllamaEmbeddingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/embeddings")
@RequiredArgsConstructor
@Slf4j
public class EmbeddingController {

    private final EmbeddingGenerationService embeddingGenerationService;
    private final OllamaEmbeddingService ollamaEmbeddingService;

    /**
     * Triggers asynchronous embedding generation for all chunks associated with the websiteId.
     *
     * @param websiteId the ID of the website target
     * @return response indicating that the embedding generation task has been initiated
     */
    @PostMapping("/{websiteId}/generate")
    public ResponseEntity<EmbeddingGenerationStartResponse> generateEmbeddings(@PathVariable Long websiteId) {
        log.info("Received request to trigger embedding generation for websiteId: {}", websiteId);
        
        // Trigger background asynchronous task
        embeddingGenerationService.startEmbeddingGeneration(websiteId);
        
        return ResponseEntity.ok(EmbeddingGenerationStartResponse.builder()
                .status("STARTED")
                .build());
    }

    /**
     * Checks the progress and status of embedding generation for a given website.
     *
     * @param websiteId the ID of the website target
     * @return response containing current processing metrics and status
     */
    @GetMapping("/{websiteId}/status")
    public ResponseEntity<EmbeddingStatusResponse> getStatus(@PathVariable Long websiteId) {
        log.info("Received request for embedding generation status of websiteId: {}", websiteId);
        EmbeddingStatusResponse status = embeddingGenerationService.getStatus(websiteId);
        return ResponseEntity.ok(status);
    }

    /**
     * Verification endpoint to check model and dimension.
     *
     * @return model name and fixed dimension
     */
    @GetMapping("/model-info")
    public ResponseEntity<Map<String, Object>> getModelInfo() {
        log.info("Received request for embedding model information.");
        return ResponseEntity.ok(Map.of(
            "model", "nomic-embed-text",
            "dimension", ollamaEmbeddingService.getEmbeddingDimension()
        ));
    }
}
