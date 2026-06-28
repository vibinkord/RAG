package com.vibin.ragbot.service.rag;

import com.vibin.ragbot.dto.AnswerRequest;
import com.vibin.ragbot.dto.AnswerResponse;
import com.vibin.ragbot.dto.ChatRequest;
import com.vibin.ragbot.dto.ChatResponse;
import com.vibin.ragbot.dto.EvaluationRequest;
import com.vibin.ragbot.dto.EvaluationResponse;
import com.vibin.ragbot.dto.SourceDto;
import com.vibin.ragbot.dto.SearchRequest;
import com.vibin.ragbot.dto.SearchResponse;
import com.vibin.ragbot.exception.RagException;
import com.vibin.ragbot.repository.WebsiteRepository;
import com.vibin.ragbot.service.retrieval.SearchService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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

    // Session histories map: Session ID -> Chat history list (last N messages)
    private final Map<String, List<ChatMessage>> chatHistories = new ConcurrentHashMap<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatMessage {
        private String role; // "user" or "assistant"
        private String content;
    }

    @Override
    public AnswerResponse generateAnswer(AnswerRequest request) {
        long totalStartTime = System.currentTimeMillis();
        log.info("Starting RAG answer generation for websiteId: {}, websiteIds: {}, question: '{}'", 
                request.getWebsiteId(), request.getWebsiteIds(), request.getQuestion());

        // 1. Verify websites exist if IDs are provided
        if (request.getWebsiteId() != null) {
            if (!websiteRepository.existsById(request.getWebsiteId())) {
                log.error("Website not found with ID: {}", request.getWebsiteId());
                throw new RagException("Website not found with ID: " + request.getWebsiteId());
            }
        }
        if (request.getWebsiteIds() != null && !request.getWebsiteIds().isEmpty()) {
            for (Long wId : request.getWebsiteIds()) {
                if (!websiteRepository.existsById(wId)) {
                    log.error("Website not found with ID: {}", wId);
                    throw new RagException("Website not found with ID: " + wId);
                }
            }
        }

        // 2. Perform similarity search
        int limit = request.getTopK() != null && request.getTopK() > 0 ? request.getTopK() : 8;
        double threshold = request.getMinSimilarity() != null ? request.getMinSimilarity() : SIMILARITY_THRESHOLD;

        SearchRequest searchRequest = SearchRequest.builder()
                .query(request.getQuestion())
                .websiteId(request.getWebsiteId())
                .websiteIds(request.getWebsiteIds())
                .pageType(request.getPageType())
                .minSimilarity(threshold)
                .limit(limit)
                .build();

        long retrievalStartTime = System.currentTimeMillis();
        SearchResponse searchResponse = searchService.search(searchRequest);
        long retrievalLatency = System.currentTimeMillis() - retrievalStartTime;

        // 3. Calculate highest similarity score
        double highestScore = searchResponse.getResults().stream()
                .mapToDouble(SearchResponse.SearchResult::getScore)
                .max()
                .orElse(0.0);

        log.info("Search returned {} results. Highest similarity score: {}", 
                searchResponse.getResults().size(), highestScore);

        // 4. Handle score below threshold or empty results
        if (highestScore < threshold || searchResponse.getResults().isEmpty()) {
            log.warn("Highest similarity score {} is below threshold {} or results are empty. Returning fallback response.", 
                    highestScore, threshold);
            
            long totalLatency = System.currentTimeMillis() - totalStartTime;

            log.info("[METRIC] operation=rag_fallback question='{}' websiteId={} topK={} highestScore={} totalLatencyMs={}",
                    request.getQuestion(), request.getWebsiteId(), request.getTopK(), highestScore, totalLatency);

            return AnswerResponse.builder()
                    .question(request.getQuestion())
                    .answer(FALLBACK_ANSWER)
                    .model(ollamaChatService.getModelName())
                    .topSimilarityScore(highestScore)
                    .sources(Collections.emptyList())
                    .chunksUsed(Collections.emptyList())
                    .retrievalLatencyMs(retrievalLatency)
                    .generationLatencyMs(0L)
                    .totalLatencyMs(totalLatency)
                    .build();
        }

        // 5. Build context from chunks up to MAX_CONTEXT_CHARS limit
        StringBuilder contextBuilder = new StringBuilder();
        List<String> chunksUsed = new ArrayList<>();
        for (SearchResponse.SearchResult result : searchResponse.getResults()) {
            String content = result.getContent();
            if (content == null) continue;

            if (contextBuilder.length() + content.length() > MAX_CONTEXT_CHARS) {
                if (contextBuilder.length() == 0) {
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

        // 6. Deduplicate sources, maintaining the highest similarity score and snippet per URL
        Map<String, Double> bestScoresByUrl = new LinkedHashMap<>();
        for (SearchResponse.SearchResult result : searchResponse.getResults()) {
            String url = result.getSourceUrl();
            double score = result.getScore();
            bestScoresByUrl.merge(url, score, Double::max);
        }
        List<SourceDto> sources = bestScoresByUrl.entrySet().stream()
                .map(entry -> {
                    String snippet = searchResponse.getResults().stream()
                            .filter(r -> entry.getKey().equals(r.getSourceUrl()))
                            .map(SearchResponse.SearchResult::getSnippet)
                            .findFirst()
                            .orElse("");
                    return SourceDto.builder()
                            .url(entry.getKey())
                            .score(entry.getValue())
                            .snippet(snippet)
                            .build();
                })
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
        long generationStartTime = System.currentTimeMillis();
        String answer;
        try {
            answer = ollamaChatService.generateAnswer(prompt);
        } catch (Exception e) {
            log.error("Failed to generate answer via Ollama. Error: {}", e.getMessage(), e);
            throw e;
        }
        long generationLatency = System.currentTimeMillis() - generationStartTime;
        long totalLatency = System.currentTimeMillis() - totalStartTime;

        // Clean up answer quotes if model included them
        if (answer != null) {
            answer = answer.trim();
            if (answer.startsWith("\"") && answer.endsWith("\"") && answer.length() >= 2) {
                answer = answer.substring(1, answer.length() - 1).trim();
            }
        }

        // 9. Detailed Logging
        log.info("[METRIC] operation=rag_generation question='{}' websiteId={} topK={} highestScore={} sourcesCount={} retrievalLatencyMs={} generationLatencyMs={} totalLatencyMs={} model='{}'",
                request.getQuestion(), request.getWebsiteId(), request.getTopK(), highestScore, sources.size(), retrievalLatency, generationLatency, totalLatency, ollamaChatService.getModelName());

        return AnswerResponse.builder()
                .question(request.getQuestion())
                .answer(answer)
                .model(ollamaChatService.getModelName())
                .topSimilarityScore(highestScore)
                .sources(sources)
                .chunksUsed(chunksUsed)
                .retrievalLatencyMs(retrievalLatency)
                .generationLatencyMs(generationLatency)
                .totalLatencyMs(totalLatency)
                .build();
    }

    @Override
    public ChatResponse chat(ChatRequest request) {
        long totalStartTime = System.currentTimeMillis();
        log.info("Starting conversational RAG chat session ID: {}, message: '{}'", 
                request.getSessionId(), request.getMessage());

        // 1. Get or initialize chat history
        List<ChatMessage> history = chatHistories.computeIfAbsent(request.getSessionId(), k -> new ArrayList<>());

        // 2. Perform similarity search using the latest message as the query
        int limit = request.getTopK() != null && request.getTopK() > 0 ? request.getTopK() : 8;
        double threshold = request.getMinSimilarity() != null ? request.getMinSimilarity() : SIMILARITY_THRESHOLD;

        SearchRequest searchRequest = SearchRequest.builder()
                .query(request.getMessage())
                .websiteId(request.getWebsiteId())
                .websiteIds(request.getWebsiteIds())
                .pageType(request.getPageType())
                .minSimilarity(threshold)
                .limit(limit)
                .build();

        long retrievalStartTime = System.currentTimeMillis();
        SearchResponse searchResponse = searchService.search(searchRequest);
        long retrievalLatency = System.currentTimeMillis() - retrievalStartTime;

        double highestScore = searchResponse.getResults().stream()
                .mapToDouble(SearchResponse.SearchResult::getScore)
                .max()
                .orElse(0.0);

        // Deduplicate sources and match snippets
        Map<String, Double> bestScoresByUrl = new LinkedHashMap<>();
        for (SearchResponse.SearchResult result : searchResponse.getResults()) {
            bestScoresByUrl.merge(result.getSourceUrl(), result.getScore(), Double::max);
        }
        List<SourceDto> sources = bestScoresByUrl.entrySet().stream()
                .map(entry -> {
                    String snippet = searchResponse.getResults().stream()
                            .filter(r -> entry.getKey().equals(r.getSourceUrl()))
                            .map(SearchResponse.SearchResult::getSnippet)
                            .findFirst()
                            .orElse("");
                    return SourceDto.builder()
                            .url(entry.getKey())
                            .score(entry.getValue())
                            .snippet(snippet)
                            .build();
                })
                .collect(Collectors.toList());

        List<String> chunksUsed = new ArrayList<>();
        StringBuilder contextBuilder = new StringBuilder();

        // 3. Build context if match meets the similarity threshold
        if (highestScore >= threshold && !searchResponse.getResults().isEmpty()) {
            for (SearchResponse.SearchResult result : searchResponse.getResults()) {
                String content = result.getContent();
                if (content == null) continue;
                if (contextBuilder.length() + content.length() > MAX_CONTEXT_CHARS) {
                    break;
                }
                if (contextBuilder.length() > 0) {
                    contextBuilder.append("\n\n");
                }
                contextBuilder.append(content);
                chunksUsed.add(content);
            }
        }

        // 4. Construct prompt containing context AND history
        StringBuilder promptBuilder = new StringBuilder();
        promptBuilder.append("Use ONLY the provided context to answer the user's question.\n");
        promptBuilder.append("If the answer is not present in the context, respond exactly:\n");
        promptBuilder.append("\"I could not find that information in the website.\"\n\n");
        promptBuilder.append("Context:\n").append(contextBuilder.length() > 0 ? contextBuilder.toString() : "No context available.").append("\n\n");
        
        if (!history.isEmpty()) {
            promptBuilder.append("Conversation History:\n");
            synchronized (history) {
                for (ChatMessage msg : history) {
                    promptBuilder.append(msg.getRole().equals("user") ? "User: " : "Assistant: ").append(msg.getContent()).append("\n");
                }
            }
            promptBuilder.append("\n");
        }
        
        promptBuilder.append("Question:\n").append(request.getMessage()).append("\n\nAnswer:");

        // 5. Generate chat response via Ollama
        long generationStartTime = System.currentTimeMillis();
        String answer;
        try {
            answer = ollamaChatService.generateAnswer(promptBuilder.toString());
        } catch (Exception e) {
            log.error("Failed to generate conversational answer via Ollama. Error: {}", e.getMessage(), e);
            throw e;
        }
        long generationLatency = System.currentTimeMillis() - generationStartTime;
        long totalLatency = System.currentTimeMillis() - totalStartTime;

        if (answer != null) {
            answer = answer.trim();
            if (answer.startsWith("\"") && answer.endsWith("\"") && answer.length() >= 2) {
                answer = answer.substring(1, answer.length() - 1).trim();
            }
        }

        // 6. Record interaction in history
        synchronized (history) {
            history.add(new ChatMessage("user", request.getMessage()));
            history.add(new ChatMessage("assistant", answer));
            while (history.size() > 6) { // Store last 6 messages
                history.remove(0);
            }
        }

        log.info("[METRIC] operation=chat session={} question='{}' totalLatencyMs={} model='{}'",
                request.getSessionId(), request.getMessage(), totalLatency, ollamaChatService.getModelName());

        return ChatResponse.builder()
                .sessionId(request.getSessionId())
                .answer(answer)
                .model(ollamaChatService.getModelName())
                .sources(sources)
                .chunksUsed(chunksUsed)
                .retrievalLatencyMs(retrievalLatency)
                .generationLatencyMs(generationLatency)
                .totalLatencyMs(totalLatency)
                .build();
    }

    @Override
    public EvaluationResponse evaluate(EvaluationRequest request) {
        long totalStartTime = System.currentTimeMillis();
        log.info("Starting RAG evaluation for question: '{}'", request.getQuestion());

        // 1. Generate answer using existing RAG pipeline
        long retrievalStartTime = System.currentTimeMillis();
        AnswerRequest answerRequest = AnswerRequest.builder()
                .question(request.getQuestion())
                .websiteId(request.getWebsiteId())
                .websiteIds(request.getWebsiteIds())
                .pageType(request.getPageType())
                .build();
        
        AnswerResponse answerResponse = generateAnswer(answerRequest);
        long retrievalLatency = answerResponse.getRetrievalLatencyMs();

        // 2. Instruct Ollama to score similarity and correctness
        String evalPrompt = "You are an AI evaluator. Compare the generated answer with the expected answer for correctness, completeness, and factual similarity.\n\n" +
                "Question: " + request.getQuestion() + "\n" +
                "Expected Answer: " + request.getExpectedAnswer() + "\n" +
                "Generated Answer: " + answerResponse.getAnswer() + "\n\n" +
                "Rate the generated answer on:\n" +
                "1. Semantic Similarity: How similar is the meaning? (0.0 to 1.0)\n" +
                "2. Factual Correctness: Are the facts correct compared to the expected answer? (1 to 5 stars)\n\n" +
                "Provide the output in JSON format with exactly these keys (do not include markdown wrapping or other text, just the raw JSON):\n" +
                "{\n" +
                "  \"similarityScore\": <double>,\n" +
                "  \"factualCorrectnessScore\": <int>,\n" +
                "  \"explanation\": \"<string>\"\n" +
                "}";

        long generationStartTime = System.currentTimeMillis();
        String response = ollamaChatService.generateAnswer(evalPrompt);
        long generationLatency = System.currentTimeMillis() - generationStartTime;
        long totalLatency = System.currentTimeMillis() - totalStartTime;

        double similarityScore = 0.0;
        int factualCorrectnessScore = 1;
        String explanation = "Failed to parse evaluation JSON.";

        try {
            String json = response.trim();
            if (json.startsWith("```")) {
                int firstLineEnd = json.indexOf('\n');
                int lastFence = json.lastIndexOf("```");
                if (firstLineEnd != -1 && lastFence != -1 && lastFence > firstLineEnd) {
                    json = json.substring(firstLineEnd + 1, lastFence).trim();
                }
            }
            similarityScore = parseDoubleFromJson(json, "similarityScore", 0.0);
            factualCorrectnessScore = parseIntFromJson(json, "factualCorrectnessScore", 1);
            explanation = parseStringFromJson(json, "explanation", response);
        } catch (Exception e) {
            log.error("Failed to parse evaluation response JSON: {}", response, e);
        }

        return EvaluationResponse.builder()
                .question(request.getQuestion())
                .expectedAnswer(request.getExpectedAnswer())
                .generatedAnswer(answerResponse.getAnswer())
                .similarityScore(similarityScore)
                .factualCorrectnessScore(factualCorrectnessScore)
                .explanation(explanation)
                .retrievedChunksCount(answerResponse.getChunksUsed().size())
                .sources(answerResponse.getSources())
                .retrievalLatencyMs(retrievalLatency)
                .generationLatencyMs(generationLatency)
                .totalLatencyMs(totalLatency)
                .build();
    }

    private double parseDoubleFromJson(String json, String key, double defaultVal) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"" + key + "\"\\s*:\\s*([0-9.]+)").matcher(json);
        if (m.find()) {
            return Double.parseDouble(m.group(1));
        }
        return defaultVal;
    }

    private int parseIntFromJson(String json, String key, int defaultVal) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"" + key + "\"\\s*:\\s*(\\d+)").matcher(json);
        if (m.find()) {
            return Integer.parseInt(m.group(1));
        }
        return defaultVal;
    }

    private String parseStringFromJson(String json, String key, String defaultVal) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"" + key + "\"\\s*:\\s*\"([^\"]+)\"").matcher(json);
        if (m.find()) {
            return m.group(1);
        }
        return defaultVal;
    }
}
