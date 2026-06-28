package com.vibin.ragbot.service;

import com.vibin.ragbot.dto.CreateWebsiteRequest;
import com.vibin.ragbot.dto.CreateWebsiteResponse;
import com.vibin.ragbot.dto.IngestionResponse;
import com.vibin.ragbot.entity.CrawlStatus;
import com.vibin.ragbot.entity.Website;
import com.vibin.ragbot.repository.PageRepository;
import com.vibin.ragbot.repository.ChunkRepository;
import com.vibin.ragbot.repository.EmbeddingRepository;
import com.vibin.ragbot.repository.WebsiteRepository;
import com.vibin.ragbot.service.crawler.WebsiteCrawlerService;
import com.vibin.ragbot.exception.RagException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebsiteService {

    private final WebsiteRepository websiteRepository;
    private final PageRepository pageRepository;
    private final ChunkRepository chunkRepository;
    private final EmbeddingRepository embeddingRepository;
    private final WebsiteCrawlerService crawlerService;

    @Transactional
    public CreateWebsiteResponse createWebsite(CreateWebsiteRequest request) {
        String url = request.getUrl().trim();

        // Check if the website is already registered
        Optional<Website> existingWebsite = websiteRepository.findByUrl(url);
        if (existingWebsite.isPresent()) {
            Website website = existingWebsite.get();
            return CreateWebsiteResponse.builder()
                    .id(website.getId())
                    .url(website.getUrl())
                    .status(website.getStatus().name())
                    .message("Website already exists")
                    .build();
        }

        // Create new website entity with specified requirements
        Website newWebsite = Website.builder()
                .url(url)
                .status(CrawlStatus.PENDING)
                .pagesCrawled(0)
                .chunksCreated(0)
                .createdAt(LocalDateTime.now())
                .maxPages(request.getMaxPages())
                .maxDepth(request.getMaxDepth())
                .crawlDelayMs(request.getCrawlDelayMs())
                .respectRobots(request.getRespectRobots())
                .sameDomainOnly(request.getSameDomainOnly())
                .excludeQueryParameters(request.getExcludeQueryParameters())
                .followExternalLinks(request.getFollowExternalLinks())
                .crawlMode(request.getCrawlMode())
                .build();

        Website savedWebsite = websiteRepository.save(newWebsite);
        log.info("Registered new website: {}", savedWebsite.getUrl());

        return CreateWebsiteResponse.builder()
                .id(savedWebsite.getId())
                .url(savedWebsite.getUrl())
                .status(savedWebsite.getStatus().name())
                .message("Website successfully created")
                .build();
    }

    @Transactional
    public IngestionResponse refreshWebsite(Long id) {
        Website website = websiteRepository.findById(id)
                .orElseThrow(() -> new RagException("Website not found with ID: " + id));

        log.info("Refreshing website ID: {}, URL: {}", id, website.getUrl());

        // 1. Delete old embeddings, chunks, and pages
        embeddingRepository.deleteByWebsiteId(id);
        chunkRepository.deleteByWebsiteId(id);
        pageRepository.deleteByWebsiteId(id);

        // Reset crawled stats and update status to PENDING
        website.setPagesCrawled(0);
        website.setChunksCreated(0);
        website.setStatus(CrawlStatus.PENDING);
        websiteRepository.saveAndFlush(website);

        // 2. Trigger asynchronous crawling and chunking
        crawlerService.crawlWebsite(id, website.getUrl());

        return IngestionResponse.builder()
                .id(id)
                .url(website.getUrl())
                .status(CrawlStatus.PENDING)
                .pagesCrawled(0)
                .chunksCreated(0)
                .message("Website re-ingestion task has been successfully scheduled.")
                .build();
    }
}
