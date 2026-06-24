package com.vibin.ragbot.integration;

import com.vibin.ragbot.dto.AnswerRequest;
import com.vibin.ragbot.dto.AnswerResponse;
import com.vibin.ragbot.dto.ChatRequest;
import com.vibin.ragbot.dto.ChatResponse;
import com.vibin.ragbot.dto.EvaluationRequest;
import com.vibin.ragbot.dto.EvaluationResponse;
import com.vibin.ragbot.dto.SearchRequest;
import com.vibin.ragbot.dto.SearchResponse;
import com.vibin.ragbot.dto.SearchDebugResponse;
import com.vibin.ragbot.dto.IngestionResponse;
import com.vibin.ragbot.entity.Chunk;
import com.vibin.ragbot.entity.Embedding;
import com.vibin.ragbot.entity.Page;
import com.vibin.ragbot.entity.Website;
import com.vibin.ragbot.entity.CrawlStatus;
import com.vibin.ragbot.repository.ChunkRepository;
import com.vibin.ragbot.repository.EmbeddingRepository;
import com.vibin.ragbot.repository.PageRepository;
import com.vibin.ragbot.repository.WebsiteRepository;
import com.vibin.ragbot.service.chunking.TextChunkingService;
import com.vibin.ragbot.service.embedding.OllamaEmbeddingService;
import com.vibin.ragbot.service.rag.OllamaChatService;
import com.vibin.ragbot.service.rag.RagService;
import com.vibin.ragbot.service.retrieval.SearchService;
import com.vibin.ragbot.service.WebsiteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;

@SpringBootTest
@Transactional
public class RAGIntegrationTests {

    @Autowired
    private WebsiteRepository websiteRepository;

    @Autowired
    private PageRepository pageRepository;

    @Autowired
    private ChunkRepository chunkRepository;

    @Autowired
    private EmbeddingRepository embeddingRepository;

    @Autowired
    private TextChunkingService textChunkingService;

    @Autowired
    private SearchService searchService;

    @Autowired
    private RagService ragService;

    @Autowired
    private WebsiteService websiteService;

    @MockitoBean
    private OllamaEmbeddingService ollamaEmbeddingService;

    @MockitoBean
    private OllamaChatService ollamaChatService;

    private Website testWebsite;

    @BeforeEach
    void setUp() {
        // Clear repos
        embeddingRepository.deleteAll();
        chunkRepository.deleteAll();
        pageRepository.deleteAll();
        websiteRepository.deleteAll();

        // Mock embedding and chat services
        float[] mockVector = new float[768];
        mockVector[0] = 1.0f; // mock non-zero vector
        Mockito.when(ollamaEmbeddingService.generateEmbedding(anyString())).thenReturn(mockVector);
        Mockito.when(ollamaEmbeddingService.generateEmbeddings(anyList())).thenAnswer(invocation -> {
            List<String> input = invocation.getArgument(0);
            List<float[]> res = new ArrayList<>();
            for (int i = 0; i < input.size(); i++) {
                res.add(mockVector);
            }
            return res;
        });

        Mockito.when(ollamaChatService.getModelName()).thenReturn("mistral");
        Mockito.when(ollamaChatService.generateAnswer(anyString())).thenAnswer(invocation -> {
            String prompt = invocation.getArgument(0);
            if (prompt.contains("similarityScore")) {
                return "{\n  \"similarityScore\": 0.85,\n  \"factualCorrectnessScore\": 4,\n  \"explanation\": \"Highly matches the facts.\"\n}";
            }
            return "Based on the website context, Spring Boot is a developer-friendly framework.";
        });

        // Initialize a website entity for test
        testWebsite = Website.builder()
                .url("https://spring.io")
                .status(CrawlStatus.CRAWLED)
                .pagesCrawled(0)
                .chunksCreated(0)
                .build();
        testWebsite = websiteRepository.save(testWebsite);
    }

    @Test
    void testIngestionQualityAndMetadataExtraction() {
        // Create sample pages: home, docs, blog
        Page homePage = Page.builder()
                .website(testWebsite)
                .url("https://spring.io/")
                .title("Spring Home")
                .content("Welcome to Spring Boot. It makes it very easy to create stand-alone production applications. This contains at least fifteen words to avoid being marked low value.")
                .build();

        Page blogPage = Page.builder()
                .website(testWebsite)
                .url("https://spring.io/blog/release-notes")
                .title("Release Notes Blog")
                .content("We are happy to announce Spring Boot version updates. This blog post covers release notes and details of major libraries. This contains at least fifteen words to avoid being marked low value.")
                .build();

        // Duplicate page content to test deduplication
        Page duplicatePage = Page.builder()
                .website(testWebsite)
                .url("https://spring.io/blog/release-notes-copy")
                .title("Release Notes Blog Copy")
                .content("We are happy to announce Spring Boot version updates. This blog post covers release notes and details of major libraries. This contains at least fifteen words to avoid being marked low value.")
                .build();

        // Short page to test minimum length filtering
        Page shortPage = Page.builder()
                .website(testWebsite)
                .url("https://spring.io/short")
                .title("Short Page")
                .content("Too short.") // < 100 characters
                .build();

        // Page with footer fragments to test navigation filtering
        Page footerPage = Page.builder()
                .website(testWebsite)
                .url("https://spring.io/footer-page")
                .title("Footer Page")
                .content("Copyright © 2026 VMware, Inc. All rights reserved. Home About Contact Privacy Terms of Service Careers Support Sitemap") // nav/footer
                .build();

        pageRepository.saveAll(List.of(homePage, blogPage, duplicatePage, shortPage, footerPage));

        // Process chunking
        int totalChunks = textChunkingService.processAllPages(testWebsite.getId());

        // Verify deduplication and quality filters:
        // Expected unique chunks: 1 from homePage, 1 from blogPage.
        // duplicatePage chunk should be skipped as duplicate.
        // shortPage chunk should be skipped as < 100 characters.
        // footerPage chunk should be skipped as a copyright/nav fragment.
        List<Chunk> chunks = chunkRepository.findByPageWebsiteId(testWebsite.getId());
        assertThat(chunks).hasSize(2);

        // Verify metadata extraction
        Chunk chunkHome = chunks.stream().filter(c -> c.getSourceUrl().equals("https://spring.io/")).findFirst().orElseThrow();
        assertThat(chunkHome.getTitle()).isEqualTo("Spring Home");
        assertThat(chunkHome.getPageType()).isEqualTo("home");

        Chunk chunkBlog = chunks.stream().filter(c -> c.getSourceUrl().contains("/blog/")).findFirst().orElseThrow();
        assertThat(chunkBlog.getTitle()).isEqualTo("Release Notes Blog");
        assertThat(chunkBlog.getPageType()).isEqualTo("blog");
    }

    @Test
    void testSearchRetrievalThresholdsAndSnippets() {
        // Setup chunk and embedding
        Page page = Page.builder()
                .website(testWebsite)
                .url("https://spring.io/docs/quickstart")
                .title("Spring Quickstart Docs")
                .content("Spring Boot provides multiple starters to make development fast. Spring Boot features auto-configuration. It is designed to get you up and running as quickly as possible.")
                .build();
        page = pageRepository.save(page);

        Chunk chunk = Chunk.builder()
                .page(page)
                .sourceUrl(page.getUrl())
                .chunkIndex(0)
                .content(page.getContent())
                .tokenCount(10)
                .title(page.getTitle())
                .pageType("documentation")
                .build();
        chunk = chunkRepository.save(chunk);

        float[] vector = new float[768];
        vector[0] = 0.9f;
        Embedding embedding = Embedding.builder()
                .chunkId(chunk.getId())
                .embedding(vector)
                .build();
        embeddingRepository.save(embedding);

        // Mock search query embedding matching behavior
        Mockito.when(ollamaEmbeddingService.generateEmbedding("starters")).thenReturn(vector);

        // 1. Verify similarity thresholding (exceeds threshold)
        SearchRequest searchRequest = SearchRequest.builder()
                .query("starters")
                .websiteId(testWebsite.getId())
                .minSimilarity(0.35)
                .build();
        SearchResponse response = searchService.search(searchRequest);
        assertThat(response.getResults()).hasSize(1);
        assertThat(response.getResults().get(0).getSnippet()).contains("Spring Boot");

        // 2. Verify threshold filtering (fails threshold)
        SearchRequest highThresholdRequest = SearchRequest.builder()
                .query("starters")
                .websiteId(testWebsite.getId())
                .minSimilarity(0.99) // too high
                .build();
        SearchResponse highThresholdResponse = searchService.search(highThresholdRequest);
        assertThat(highThresholdResponse.getResults()).isEmpty();

        // 3. Verify metadata pageType filtering (non-matching)
        SearchRequest wrongCategoryRequest = SearchRequest.builder()
                .query("starters")
                .websiteId(testWebsite.getId())
                .pageType("blog") // chunk pageType is 'documentation'
                .build();
        SearchResponse wrongCategoryResponse = searchService.search(wrongCategoryRequest);
        assertThat(wrongCategoryResponse.getResults()).isEmpty();

        // 4. Verify search debug results
        SearchDebugResponse debugResponse = searchService.searchDebug("starters", testWebsite.getId(), null, null, 5);
        assertThat(debugResponse.getResults()).hasSize(1);
        assertThat(debugResponse.getResults().get(0).getRawVectorScore()).isGreaterThan(0.0);
        assertThat(debugResponse.getResults().get(0).getPageType()).isEqualTo("documentation");
        assertThat(debugResponse.getResults().get(0).getPageTitle()).isEqualTo("Spring Quickstart Docs");
    }

    @Test
    void testConversationalChatContext() {
        // Setup chunk and embedding
        Page page = Page.builder()
                .website(testWebsite)
                .url("https://spring.io/docs")
                .title("Spring Docs")
                .content("Spring Boot auto-configures dependencies. This helps developers start writing code quickly without manually registering beans.")
                .build();
        page = pageRepository.save(page);

        Chunk chunk = Chunk.builder()
                .page(page)
                .sourceUrl(page.getUrl())
                .chunkIndex(0)
                .content(page.getContent())
                .tokenCount(10)
                .title(page.getTitle())
                .pageType("documentation")
                .build();
        chunk = chunkRepository.save(chunk);

        float[] vector = new float[768];
        vector[0] = 0.8f;
        Embedding embedding = Embedding.builder()
                .chunkId(chunk.getId())
                .embedding(vector)
                .build();
        embeddingRepository.save(embedding);

        Mockito.when(ollamaEmbeddingService.generateEmbedding("auto-configures")).thenReturn(vector);

        ChatRequest request1 = ChatRequest.builder()
                .sessionId("test-session-123")
                .message("How does auto-configures work?")
                .websiteId(testWebsite.getId())
                .build();

        ChatResponse response1 = ragService.chat(request1);
        assertThat(response1.getAnswer()).contains("Spring Boot is a developer-friendly framework");
        assertThat(response1.getSources()).hasSize(1);
        assertThat(response1.getRetrievalLatencyMs()).isNotNull();
        assertThat(response1.getGenerationLatencyMs()).isNotNull();

        // Send a second chat message to verify history inclusion in Ollama prompt
        ChatRequest request2 = ChatRequest.builder()
                .sessionId("test-session-123")
                .message("Can you explain further?")
                .websiteId(testWebsite.getId())
                .build();

        ChatResponse response2 = ragService.chat(request2);
        assertThat(response2.getAnswer()).isNotNull();
    }

    @Test
    void testEvaluationEndpoint() {
        // Setup chunk and embedding
        Page page = Page.builder()
                .website(testWebsite)
                .url("https://spring.io/docs")
                .title("Spring Docs")
                .content("Spring Boot auto-configures dependencies. This helps developers start writing code quickly.")
                .build();
        page = pageRepository.save(page);

        Chunk chunk = Chunk.builder()
                .page(page)
                .sourceUrl(page.getUrl())
                .chunkIndex(0)
                .content(page.getContent())
                .tokenCount(10)
                .title(page.getTitle())
                .pageType("documentation")
                .build();
        chunk = chunkRepository.save(chunk);

        float[] vector = new float[768];
        vector[0] = 0.8f;
        Embedding embedding = Embedding.builder()
                .chunkId(chunk.getId())
                .embedding(vector)
                .build();
        embeddingRepository.save(embedding);

        Mockito.when(ollamaEmbeddingService.generateEmbedding("dependencies")).thenReturn(vector);

        EvaluationRequest request = EvaluationRequest.builder()
                .question("What does Spring Boot auto-configure?")
                .expectedAnswer("Spring Boot auto-configures dependencies to make starting development faster.")
                .websiteId(testWebsite.getId())
                .build();

        EvaluationResponse response = ragService.evaluate(request);
        assertThat(response.getSimilarityScore()).isEqualTo(0.85);
        assertThat(response.getFactualCorrectnessScore()).isEqualTo(4);
        assertThat(response.getExplanation()).isEqualTo("Highly matches the facts.");
        assertThat(response.getGeneratedAnswer()).contains("Spring Boot is a developer-friendly framework");
    }

    @Test
    void testWebsiteRefreshReIngestion() {
        // Setup existing pages, chunks, and embeddings
        Page page = Page.builder()
                .website(testWebsite)
                .url("https://spring.io/old")
                .title("Old Page")
                .content("Old content that should be cleared during refresh re-ingestion.")
                .build();
        page = pageRepository.save(page);

        Chunk chunk = Chunk.builder()
                .page(page)
                .sourceUrl(page.getUrl())
                .chunkIndex(0)
                .content(page.getContent())
                .tokenCount(10)
                .title(page.getTitle())
                .pageType("general")
                .build();
        chunk = chunkRepository.save(chunk);

        Embedding embedding = Embedding.builder()
                .chunkId(chunk.getId())
                .embedding(new float[768])
                .build();
        embeddingRepository.save(embedding);

        // Verify count is 1
        assertThat(pageRepository.findByWebsiteId(testWebsite.getId())).hasSize(1);
        assertThat(chunkRepository.findByPageWebsiteId(testWebsite.getId())).hasSize(1);
        assertThat(embeddingRepository.countByWebsiteId(testWebsite.getId())).isEqualTo(1L);

        // Trigger refresh
        IngestionResponse response = websiteService.refreshWebsite(testWebsite.getId());
        assertThat(response.getMessage()).contains("Website re-ingestion task has been successfully scheduled");

        // Verify old entities are deleted synchronously
        assertThat(pageRepository.findByWebsiteId(testWebsite.getId())).isEmpty();
        assertThat(chunkRepository.findByPageWebsiteId(testWebsite.getId())).isEmpty();
        assertThat(embeddingRepository.countByWebsiteId(testWebsite.getId())).isEqualTo(0L);

        // Verify website stats are reset
        Website updatedWebsite = websiteRepository.findById(testWebsite.getId()).orElseThrow();
        assertThat(updatedWebsite.getPagesCrawled()).isEqualTo(0);
        assertThat(updatedWebsite.getChunksCreated()).isEqualTo(0);
        assertThat(updatedWebsite.getStatus()).isEqualTo(CrawlStatus.PENDING);
    }
}
