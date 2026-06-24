package com.vibin.ragbot.service.chunking;

import com.vibin.ragbot.entity.Chunk;
import com.vibin.ragbot.entity.Page;
import com.vibin.ragbot.repository.ChunkRepository;
import com.vibin.ragbot.repository.PageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.BreakIterator;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class TextChunkingService {

    private final PageRepository pageRepository;
    private final ChunkRepository chunkRepository;

    private static final int CHUNK_SIZE = 800;
    private static final int OVERLAP = 150;

    private static final Set<String> LOW_VALUE_PATTERNS = Set.of(
            "view all",
            "learn more",
            "get support",
            "read more",
            "upcoming events",
            "sign up",
            "login",
            "register",
            "footer links",
            "navigation items"
    );

    /**
     * Helper to identify low-value chunks (too short, too few words, or UI match).
     */
    private boolean isLowValueChunk(String content) {
        if (content == null) {
            return true;
        }
        String trimmed = content.trim();
        
        // 1. Length < 100 characters
        if (trimmed.length() < 100) {
            return true;
        }
        
        // 2. Less than 15 words
        String[] words = trimmed.split("\\s+");
        if (words.length < 15) {
            return true;
        }
        
        // 3. Matches common UI text (case-insensitive)
        String lower = trimmed.toLowerCase();
        if (LOW_VALUE_PATTERNS.contains(lower)) {
            return true;
        }
        
        return false;
    }

    /**
     * Splits a Page's content into chunks, preserving sentence boundaries where possible.
     *
     * @param page the Page entity to chunk
     * @return the list of created Chunk entities
     */
    public List<Chunk> createChunksForPage(Page page) {
        if (page == null || page.getContent() == null || page.getContent().trim().isEmpty()) {
            log.warn("Page is null or has empty content. Skipping chunking.");
            return Collections.emptyList();
        }

        String content = page.getContent();
        List<String> sentences = splitIntoSentences(content);
        List<Chunk> createdChunks = new ArrayList<>();
        
        int start = 0;
        int chunkIndex = 0;
        
        while (start < sentences.size()) {
            StringBuilder currentChunkBuilder = new StringBuilder();
            int end = start;
            
            while (end < sentences.size()) {
                String nextSentence = sentences.get(end);
                
                // If a single sentence exceeds the chunk size limit
                if (nextSentence.length() > CHUNK_SIZE) {
                    // Finalize the current chunk first, if it has content
                    if (currentChunkBuilder.length() > 0) {
                        break;
                    }
                    // Hard-split this long sentence
                    List<String> subChunks = splitLongSentence(nextSentence, CHUNK_SIZE, OVERLAP);
                    for (String subChunk : subChunks) {
                        String trimmedSubChunk = subChunk.trim();
                        if (!trimmedSubChunk.isEmpty()) {
                            if (isLowValueChunk(trimmedSubChunk)) {
                                log.info("Skipped low-value chunk: {}", trimmedSubChunk);
                                continue;
                            }
                            log.info("Creating chunk for pageId={}, url={}", page.getId(), page.getUrl());
                            createdChunks.add(Chunk.builder()
                                    .page(page)
                                    .sourceUrl(page.getUrl())
                                    .chunkIndex(chunkIndex++)
                                    .content(trimmedSubChunk)
                                    .tokenCount(estimateTokenCount(trimmedSubChunk))
                                    .build());
                        }
                    }
                    start = end + 1;
                    break;
                }
                
                int currentLen = currentChunkBuilder.length();
                int newLen = currentLen + (currentLen > 0 ? 1 : 0) + nextSentence.length();
                
                if (newLen <= CHUNK_SIZE) {
                    if (currentLen > 0) {
                        currentChunkBuilder.append(" ");
                    }
                    currentChunkBuilder.append(nextSentence);
                    end++;
                } else {
                    break;
                }
            }
            
            if (end == start) {
                // Already processed a long sentence in this iteration
                continue;
            }
            
            String chunkText = currentChunkBuilder.toString().trim();
            if (!chunkText.isEmpty()) {
                if (isLowValueChunk(chunkText)) {
                    log.info("Skipped low-value chunk: {}", chunkText);
                } else {
                    log.info("Creating chunk for pageId={}, url={}", page.getId(), page.getUrl());
                    createdChunks.add(Chunk.builder()
                            .page(page)
                            .sourceUrl(page.getUrl())
                            .chunkIndex(chunkIndex++)
                            .content(chunkText)
                            .tokenCount(estimateTokenCount(chunkText))
                            .build());
                }
            }
            
            // Calculate the next start index with overlap
            int nextStart = end;
            int overlapLength = 0;
            for (int k = end - 1; k >= start; k--) {
                int len = sentences.get(k).length();
                if (overlapLength + len + (overlapLength > 0 ? 1 : 0) <= OVERLAP) {
                    overlapLength += len + (overlapLength > 0 ? 1 : 0);
                    nextStart = k;
                } else {
                    break;
                }
            }
            
            // Force progress to prevent infinite loop
            if (nextStart <= start) {
                nextStart = start + 1;
            }
            
            start = nextStart;
        }
        
        return createdChunks;
    }

    /**
     * Reads all pages associated with the given websiteId, deletes any of their old chunks,
     * creates new chunks, and persists them.
     *
     * @param websiteId the ID of the website to process
     * @return the total number of chunks created and saved
     */
    @Transactional
    public int processAllPages(Long websiteId) {
        log.info("STARTING CHUNK GENERATION");
        List<Page> pages = pageRepository.findByWebsiteId(websiteId);
        log.info("Pages retrieved for chunking: {}", pages.size());
        if (pages.isEmpty()) {
            log.info("No pages found for websiteId: {}", websiteId);
            log.info("Chunking Completed");
            return 0;
        }

        List<Long> pageIds = new ArrayList<>();

        for (Page page : pages) {
            pageIds.add(page.getId());
        }

        // Delete existing chunks for all pages of this website first
        chunkRepository.deleteByPageIdIn(pageIds);

        int totalChunksSaved = 0;

        // Generate and save chunks for each page
        for (Page page : pages) {
            log.info("Processing Page: {}", page.getTitle());
            List<Chunk> pageChunks = createChunksForPage(page);
            log.info("Generated {} chunks", pageChunks.size());
            if (!pageChunks.isEmpty()) {
                List<Chunk> saved = chunkRepository.saveAll(pageChunks);
                log.info("Saved {} chunks", saved.size());
                totalChunksSaved += saved.size();
            } else {
                log.info("Saved 0 chunks");
            }
        }

        log.info("Chunking Completed");
        return totalChunksSaved;
    }

    private List<String> splitIntoSentences(String content) {
        List<String> sentences = new ArrayList<>();
        BreakIterator iterator = BreakIterator.getSentenceInstance(Locale.US);
        iterator.setText(content);
        int start = iterator.first();
        for (int end = iterator.next(); end != BreakIterator.DONE; start = end, end = iterator.next()) {
            String sentence = content.substring(start, end).trim();
            if (!sentence.isEmpty()) {
                sentences.add(sentence);
            }
        }
        return sentences;
    }

    private List<String> splitLongSentence(String sentence, int chunkSize, int overlap) {
        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < sentence.length()) {
            int end = Math.min(start + chunkSize, sentence.length());
            chunks.add(sentence.substring(start, end));
            if (end == sentence.length()) {
                break;
            }
            start = end - overlap;
            if (start >= end) {
                start = end;
            }
        }
        return chunks;
    }

    private int estimateTokenCount(String text) {
        if (text == null || text.trim().isEmpty()) {
            return 0;
        }
        // Approximate token count: 4 characters per token
        return (int) Math.ceil(text.length() / 4.0);
    }
}
