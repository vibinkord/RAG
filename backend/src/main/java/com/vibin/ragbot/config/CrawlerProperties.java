package com.vibin.ragbot.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Data
@Configuration
@ConfigurationProperties(prefix = "crawler")
public class CrawlerProperties {
    private int maxPages = 500;
    private int maxDepth = 8;
    private boolean sameDomainOnly = true;
    private boolean respectRobots = true;
    private long crawlDelayMs = 100;
    private boolean excludeQueryParameters = true;
    private int maxConcurrentPages = 5;
    private List<String> ignoreUrls = List.of("(?i).*(/login|/logout|/search|/privacy|/terms|/feed|/rss|\\\\?page=|\\\\?sort=|\\\\?utm=|#).*");
}
