package com.vibin.ragbot.controller;

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

    @GetMapping("/ping")
    public String ping() {
        return "Test Controller Working";
    }

    @GetMapping("/crawl")
    public List<String> testCrawl() {
        return crawlerService.crawlWebsite(1L, "https://claysys.com");
    }
}
