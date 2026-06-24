package com.vibin.ragbot.service.embedding;

import com.vibin.ragbot.dto.EmbeddingStatusResponse;
import com.vibin.ragbot.entity.Chunk;
import com.vibin.ragbot.entity.Embedding;
import com.vibin.ragbot.entity.Website;
import com.vibin.ragbot.exception.RagException;
import com.vibin.ragbot.repository.ChunkRepository;
import com.vibin.ragbot.repository.EmbeddingRepository;
import com.vibin.ragbot.repository.WebsiteRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class EmbeddingGenerationService {

    private final WebsiteRepository websiteRepository;
    private final ChunkRepository chunkRepository;
    private final EmbeddingRepository embeddingRepository;
    private final OllamaEmbeddingService ollamaEmbeddingService;
    private final TransactionTemplate transactionTemplate;
    private final ApplicationContext applicationContext;

    // Track status of jobs in-memory
    private final Map<Long, String> activeJobs = new ConcurrentHashMap<>();

    private static final int BATCH_SIZE = 50;

    public EmbeddingGenerationService(
            WebsiteRepository websiteRepository,
            ChunkRepository chunkRepository,
            EmbeddingRepository embeddingRepository,
            OllamaEmbeddingService ollamaEmbeddingService,
            PlatformTransactionManager transactionManager,
            ApplicationContext applicationContext) {
        this.websiteRepository = websiteRepository;
        this.chunkRepository = chunkRepository;
        this.embeddingRepository = embeddingRepository;
        this.ollamaEmbeddingService = ollamaEmbeddingService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.applicationContext = applicationContext;
    }

    /**
     * Starts the asynchronous embedding generation process.
     * If a job is already in progress, does nothing.
     */
    public void startEmbeddingGeneration(Long websiteId) {
        // Check if website exists
        Website website = websiteRepository.findById(websiteId)
                .orElseThrow(() -> new RagException("Website not found with ID: " + websiteId));

        String currentStatus = activeJobs.get(websiteId);
        if ("IN_PROGRESS".equals(currentStatus)) {
            log.warn("Embedding generation already in progress for website ID: {}", websiteId);
            return;
        }

        activeJobs.put(websiteId, "IN_PROGRESS");
        // Trigger async execution via proxy to ensure @Async is intercepted
        applicationContext.getBean(EmbeddingGenerationService.class).generateEmbeddingsAsync(websiteId);
    }

    /**
     * Performs the actual embedding generation in the background.
     */
    @Async
    public void generateEmbeddingsAsync(Long websiteId) {
        log.info("Starting background embedding generation for website ID: {}", websiteId);
        try {
            // Load all chunks for the website
            List<Chunk> chunks = chunkRepository.findByPageWebsiteId(websiteId);
            log.info("Loaded {} chunks", chunks.size());
            
            // Filter out chunks that already have embeddings
            List<Chunk> chunksToProcess = new ArrayList<>();
            for (Chunk chunk : chunks) {
                if (!embeddingRepository.existsByChunkId(chunk.getId())) {
                    chunksToProcess.add(chunk);
                }
            }

            log.info("Found {} chunks total. {} need embeddings for website ID: {}", 
                    chunks.size(), chunksToProcess.size(), websiteId);

            // Process chunks in batches of 50
            for (int i = 0; i < chunksToProcess.size(); i += BATCH_SIZE) {
                List<Chunk> batch = chunksToProcess.subList(i, Math.min(i + BATCH_SIZE, chunksToProcess.size()));
                List<Embedding> batchEmbeddings = new ArrayList<>();
                List<String> contents = new ArrayList<>();
                for (Chunk chunk : batch) {
                    contents.add(chunk.getContent());
                }

                try {
                    log.info("Generating batch embeddings for {} chunks", batch.size());
                    List<float[]> vectors = ollamaEmbeddingService.generateEmbeddings(contents);
                    for (int j = 0; j < batch.size(); j++) {
                        Chunk chunk = batch.get(j);
                        float[] vector = vectors.get(j);
                        batchEmbeddings.add(Embedding.builder()
                                .chunkId(chunk.getId())
                                .embedding(vector)
                                .build());
                    }
                } catch (Exception e) {
                    log.warn("Failed to generate batch embeddings, falling back to individual generation. Error: {}", e.getMessage());
                    for (Chunk chunk : batch) {
                        try {
                            float[] vector = ollamaEmbeddingService.generateEmbedding(chunk.getContent());
                            batchEmbeddings.add(Embedding.builder()
                                    .chunkId(chunk.getId())
                                    .embedding(vector)
                                    .build());
                        } catch (Exception ex) {
                            log.error("Failed to generate fallback embedding for chunk ID: {} in website ID: {}. Error: {}",
                                    chunk.getId(), websiteId, ex.getMessage());
                        }
                    }
                }

                if (!batchEmbeddings.isEmpty()) {
                    // Save batch inside its own transaction block
                    transactionTemplate.executeWithoutResult(status -> {
                        embeddingRepository.saveAll(batchEmbeddings);
                    });
                    for (Embedding embedding : batchEmbeddings) {
                        log.info("Embedding saved for chunk {}", embedding.getChunkId());
                    }
                    log.info("Embedding count now {}", embeddingRepository.count());
                    log.info("Committed batch of {} embeddings for website ID: {}", batchEmbeddings.size(), websiteId);
                }
            }

            long finalEmbeddedCount = embeddingRepository.countByWebsiteId(websiteId);
            if (finalEmbeddedCount == chunks.size()) {
                activeJobs.put(websiteId, "COMPLETED");
                log.info("Background embedding generation completed successfully for website ID: {}", websiteId);
            } else {
                activeJobs.put(websiteId, "FAILED");
                log.warn("Background embedding generation finished but not all chunks were embedded. Website ID: {}. Embedded: {}/{}",
                        websiteId, finalEmbeddedCount, chunks.size());
            }
        } catch (Exception e) {
            activeJobs.put(websiteId, "FAILED");
            log.error("Background embedding generation failed for website ID: {}. Error: {}", websiteId, e.getMessage(), e);
        }
    }

    /**
     * Returns the embedding status and metrics for a website.
     */
    public EmbeddingStatusResponse getStatus(Long websiteId) {
        // Check if website exists
        if (!websiteRepository.existsById(websiteId)) {
            throw new RagException("Website not found with ID: " + websiteId);
        }

        long totalChunks = chunkRepository.findByPageWebsiteId(websiteId).size();
        long embeddedChunks = embeddingRepository.countByWebsiteId(websiteId);
        long remainingChunks = Math.max(0, totalChunks - embeddedChunks);

        String status = activeJobs.get(websiteId);
        if (status == null) {
            if (totalChunks > 0 && remainingChunks == 0) {
                status = "COMPLETED";
            } else if (embeddedChunks > 0) {
                status = "FAILED"; // Job was interrupted or terminated prematurely
            } else {
                status = "NOT_STARTED";
            }
        } else if ("COMPLETED".equals(status) && embeddedChunks < totalChunks) {
            status = "FAILED";
        }

        return EmbeddingStatusResponse.builder()
                .websiteId(websiteId)
                .totalChunks(totalChunks)
                .embeddedChunks(embeddedChunks)
                .remainingChunks(remainingChunks)
                .status(status)
                .build();
    }
}
