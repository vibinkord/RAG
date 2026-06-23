package com.vibin.ragbot.controller;

import com.vibin.ragbot.service.chunking.TextChunkingService;
import com.vibin.ragbot.service.crawler.WebsiteCrawlerService;
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

    @GetMapping("/ping")
    public String ping() {
        return "Test Controller Working";
    }

    @GetMapping("/crawl")
    public List<String> testCrawl() {
        return crawlerService.crawlWebsite(1L, "https://claysys.com");
    }

    @GetMapping("/chunk")
    public String testChunk() {
        chunkingService.processAllPages(1L);
        return "Chunking completed for website 1";
    }
}
