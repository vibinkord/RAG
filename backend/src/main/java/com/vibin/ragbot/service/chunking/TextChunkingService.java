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

@Service
@RequiredArgsConstructor
@Slf4j
public class TextChunkingService {

    private final PageRepository pageRepository;
    private final ChunkRepository chunkRepository;

    private static final int CHUNK_SIZE = 800;
    private static final int OVERLAP = 150;

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
                        if (!subChunk.trim().isEmpty()) {
                            createdChunks.add(Chunk.builder()
                                    .pageId(page.getId())
                                    .chunkIndex(chunkIndex++)
                                    .sourceUrl(page.getUrl())
                                    .chunkText(subChunk.trim())
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
                createdChunks.add(Chunk.builder()
                        .pageId(page.getId())
                        .chunkIndex(chunkIndex++)
                        .sourceUrl(page.getUrl())
                        .chunkText(chunkText)
                        .build());
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
     * @return the list of all created Chunk entities across all pages
     */
    @Transactional
    public List<Chunk> processAllPages(Long websiteId) {
        log.info("Processing document chunking for websiteId: {}", websiteId);
        List<Page> pages = pageRepository.findByWebsiteId(websiteId);
        if (pages.isEmpty()) {
            log.info("No pages found for websiteId: {}", websiteId);
            return Collections.emptyList();
        }

        List<Chunk> allChunks = new ArrayList<>();
        List<Long> pageIds = new ArrayList<>();

        for (Page page : pages) {
            pageIds.add(page.getId());
        }

        // Delete existing chunks for all pages of this website first
        chunkRepository.deleteByPageIdIn(pageIds);

        // Generate and save chunks for each page
        for (Page page : pages) {
            List<Chunk> pageChunks = createChunksForPage(page);
            if (!pageChunks.isEmpty()) {
                allChunks.addAll(chunkRepository.saveAll(pageChunks));
            }
        }

        log.info("Successfully created and saved {} chunks for websiteId: {}", allChunks.size(), websiteId);
        return allChunks;
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
}
