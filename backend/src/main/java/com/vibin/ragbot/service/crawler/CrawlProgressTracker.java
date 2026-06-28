package com.vibin.ragbot.service.crawler;

import com.vibin.ragbot.dto.CrawlProgress;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CrawlProgressTracker {
    private final Map<Long, CrawlProgress> progressMap = new ConcurrentHashMap<>();

    public void init(Long websiteId) {
        progressMap.put(websiteId, CrawlProgress.builder()
                .status("CRAWLING")
                .pagesDiscovered(0)
                .pagesCrawled(0)
                .pagesRemaining(0)
                .chunksCreated(0)
                .embeddingsGenerated(0)
                .elapsedSeconds(0)
                .estimatedRemainingSeconds(0)
                .build());
    }

    public CrawlProgress getProgress(Long websiteId) {
        return progressMap.get(websiteId);
    }

    public void updateProgress(Long websiteId, CrawlProgress progress) {
        progressMap.put(websiteId, progress);
    }

    public void remove(Long websiteId) {
        progressMap.remove(websiteId);
    }
}
