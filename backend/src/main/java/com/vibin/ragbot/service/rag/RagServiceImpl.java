package com.vibin.ragbot.service.rag;

import com.vibin.ragbot.dto.AnswerRequest;
import com.vibin.ragbot.dto.AnswerResponse;
import com.vibin.ragbot.dto.SourceDto;
import com.vibin.ragbot.dto.SearchRequest;
import com.vibin.ragbot.dto.SearchResponse;
import com.vibin.ragbot.exception.RagException;
import com.vibin.ragbot.repository.WebsiteRepository;
import com.vibin.ragbot.service.retrieval.SearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RagServiceImpl implements RagService {

    private final SearchService searchService;
    private final WebsiteRepository websiteRepository;
    private final OllamaChatService ollamaChatService;

    private static final int MAX_CONTEXT_CHARS = 6000;
    private static final double SIMILARITY_THRESHOLD = 0.35;
    private static final String FALLBACK_ANSWER = "I could not find that information in the website.";

    @Override
    public AnswerResponse generateAnswer(AnswerRequest request) {
        log.info("Starting RAG answer generation for websiteId: {}, question: '{}'", 
                request.getWebsiteId(), request.getQuestion());

        // 1. Verify that the website exists
        if (!websiteRepository.existsById(request.getWebsiteId())) {
            log.error("Website not found with ID: {}", request.getWebsiteId());
            throw new RagException("Website not found with ID: " + request.getWebsiteId());
        }

        // 2. Perform similarity search
        int limit = request.getTopK() != null && request.getTopK() > 0 ? request.getTopK() : 5;
        SearchRequest searchRequest = SearchRequest.builder()
                .query(request.getQuestion())
                .websiteId(request.getWebsiteId())
                .limit(limit)
                .build();

        SearchResponse searchResponse = searchService.search(searchRequest);

        // 3. Calculate highest similarity score
        double highestScore = searchResponse.getResults().stream()
                .mapToDouble(SearchResponse.SearchResult::getScore)
                .max()
                .orElse(0.0);

        log.info("Search returned {} results. Highest similarity score: {}", 
                searchResponse.getResults().size(), highestScore);

        // 4. Handle score below threshold or empty results
        if (highestScore < SIMILARITY_THRESHOLD || searchResponse.getResults().isEmpty()) {
            log.warn("Highest similarity score {} is below threshold {} or results are empty. Returning fallback response.", 
                    highestScore, SIMILARITY_THRESHOLD);
            
            // Map the source URLs for logging/response even if score is below threshold, or return empty list
            List<SourceDto> sources = searchResponse.getResults().stream()
                    .map(r -> SourceDto.builder()
                            .url(r.getSourceUrl())
                            .score(r.getScore())
                            .build())
                    .collect(Collectors.toList());

            // Log details before returning
            log.info("RAG Query - Question: '{}', Website ID: {}", request.getQuestion(), request.getWebsiteId());
            log.info("Retrieved chunk IDs: {}", searchResponse.getResults().stream().map(SearchResponse.SearchResult::getChunkId).collect(Collectors.toList()));
            log.info("Similarity scores: {}", searchResponse.getResults().stream().map(SearchResponse.SearchResult::getScore).collect(Collectors.toList()));
            log.info("Prompt size (chars): 0 (bypassed)");
            log.info("Model response time: 0 ms (bypassed)");
            log.info("Source URLs: {}", sources.stream().map(SourceDto::getUrl).collect(Collectors.toList()));

            return AnswerResponse.builder()
                    .question(request.getQuestion())
                    .answer(FALLBACK_ANSWER)
                    .model(ollamaChatService.getModelName())
                    .topSimilarityScore(highestScore)
                    .sources(Collections.emptyList())
                    .chunksUsed(Collections.emptyList())
                    .build();
        }

        // 5. Build context from chunks up to MAX_CONTEXT_CHARS limit
        StringBuilder contextBuilder = new StringBuilder();
        List<String> chunksUsed = new ArrayList<>();
        for (SearchResponse.SearchResult result : searchResponse.getResults()) {
            String content = result.getContent();
            if (content == null) continue;

            // Check if adding this chunk exceeds our max context character limit
            if (contextBuilder.length() + content.length() > MAX_CONTEXT_CHARS) {
                if (contextBuilder.length() == 0) {
                    // Truncate first chunk if it exceeds the limit
                    String truncated = content.substring(0, MAX_CONTEXT_CHARS);
                    contextBuilder.append(truncated);
                    chunksUsed.add(truncated);
                }
                break;
            }

            if (contextBuilder.length() > 0) {
                contextBuilder.append("\n\n");
            }
            contextBuilder.append(content);
            chunksUsed.add(content);
        }

        // 6. Deduplicate sources, maintaining the highest similarity score per URL
        Map<String, Double> bestScoresByUrl = new LinkedHashMap<>();
        for (SearchResponse.SearchResult result : searchResponse.getResults()) {
            String url = result.getSourceUrl();
            double score = result.getScore();
            bestScoresByUrl.merge(url, score, Double::max);
        }
        List<SourceDto> sources = bestScoresByUrl.entrySet().stream()
                .map(entry -> SourceDto.builder()
                        .url(entry.getKey())
                        .score(entry.getValue())
                        .build())
                .collect(Collectors.toList());

        // 7. Build prompt for Ollama
        String prompt = "Use ONLY the provided context.\n\n" +
                "If the answer is not present in the context,\n" +
                "respond exactly:\n\n" +
                "\"I could not find that information in the website.\"\n\n" +
                "Context:\n" + contextBuilder.toString() + "\n\n" +
                "Question:\n" + request.getQuestion() + "\n\n" +
                "Answer:";

        // 8. Call Ollama model and measure response time
        long startTime = System.currentTimeMillis();
        String answer;
        try {
            answer = ollamaChatService.generateAnswer(prompt);
        } catch (Exception e) {
            log.error("Failed to generate answer via Ollama. Error: {}", e.getMessage(), e);
            throw e;
        }
        long durationMs = System.currentTimeMillis() - startTime;

        // Clean up answer quotes if model included them
        if (answer != null) {
            answer = answer.trim();
            if (answer.startsWith("\"") && answer.endsWith("\"") && answer.length() >= 2) {
                answer = answer.substring(1, answer.length() - 1).trim();
            }
        }

        // 9. Detailed Logging
        log.info("RAG Query - Question: '{}', Website ID: {}", request.getQuestion(), request.getWebsiteId());
        log.info("Retrieved chunk IDs: {}", searchResponse.getResults().stream().map(SearchResponse.SearchResult::getChunkId).collect(Collectors.toList()));
        log.info("Similarity scores: {}", searchResponse.getResults().stream().map(SearchResponse.SearchResult::getScore).collect(Collectors.toList()));
        log.info("Prompt size (chars): {}", prompt.length());
        log.info("Model response time: {} ms", durationMs);
        log.info("Source URLs: {}", sources.stream().map(SourceDto::getUrl).collect(Collectors.toList()));

        return AnswerResponse.builder()
                .question(request.getQuestion())
                .answer(answer)
                .model(ollamaChatService.getModelName())
                .topSimilarityScore(highestScore)
                .sources(sources)
                .chunksUsed(chunksUsed)
                .build();
    }
}
