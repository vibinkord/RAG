package com.vibin.ragbot.controller;

import com.vibin.ragbot.service.chunking.TextChunkingService;
import com.vibin.ragbot.service.crawler.WebsiteCrawlerService;
import com.vibin.ragbot.service.embedding.EmbeddingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/test")
@RequiredArgsConstructor
public class TestController {

    private final WebsiteCrawlerService crawlerService;
    private final TextChunkingService chunkingService;
    private final EmbeddingService embeddingService;

    @GetMapping("/ping")
    public String ping() {
        return "Test Controller Working";
    }

    @GetMapping("/crawl")
    public List<String> testCrawl() {
        // Blocks synchronously for test endpoint compatibility
        try {
            crawlerService.crawlWebsite(1L, "https://claysys.com").get();
        } catch (Exception e) {
            return List.of("Crawl failed: " + e.getMessage());
        }
        return List.of("Crawl initiated/completed successfully for website 1");
    }

    @GetMapping("/chunk")
    public String testChunk() {
        chunkingService.processAllPages(1L);
        return "Chunking completed for website 1";
    }

    @GetMapping("/embed")
    public String testEmbed() {
        embeddingService.generateEmbeddingsForWebsite(1L);
        return "Embedding completed for website 1";
    }
}
