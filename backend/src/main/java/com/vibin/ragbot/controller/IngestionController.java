package com.vibin.ragbot.controller;

import com.vibin.ragbot.dto.CreateWebsiteRequest;
import com.vibin.ragbot.dto.IngestionResponse;
import com.vibin.ragbot.entity.CrawlStatus;
import com.vibin.ragbot.entity.Website;
import com.vibin.ragbot.repository.WebsiteRepository;
import com.vibin.ragbot.service.crawler.WebsiteCrawlerService;
import com.vibin.ragbot.util.DomainValidator;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("/api/ingest")
@RequiredArgsConstructor
@Slf4j
public class IngestionController {

    private final WebsiteRepository websiteRepository;
    private final WebsiteCrawlerService crawlerService;

    /**
     * Initiates asynchronous crawling for a given website URL.
     *
     * @param request the request body containing the URL to crawl
     * @return response indicating that crawl task was successfully initiated
     */
    @PostMapping
    public ResponseEntity<IngestionResponse> ingestWebsite(@Valid @RequestBody CreateWebsiteRequest request) {
        String normalizedUrl = DomainValidator.normalizeUrl(request.getUrl());
        if (normalizedUrl == null || normalizedUrl.isEmpty()) {
            return ResponseEntity.badRequest().body(
                IngestionResponse.builder()
                    .message("Failed to normalize provided URL. Please verify format.")
                    .build()
            );
        }

        Optional<Website> existingWebsiteOpt = websiteRepository.findByUrl(normalizedUrl);
        Website website;

        if (existingWebsiteOpt.isPresent()) {
            website = existingWebsiteOpt.get();
            if (website.getStatus() == CrawlStatus.CRAWLING) {
                return ResponseEntity.ok(
                    IngestionResponse.builder()
                        .id(website.getId())
                        .url(website.getUrl())
                        .status(website.getStatus())
                        .message("Crawling is already in progress for this website.")
                        .build()
                );
            }

            log.info("Re-crawling requested for existing website: {}. Keeping existing crawls until new crawl succeeds.", normalizedUrl);
            website.setStatus(CrawlStatus.PENDING);
            website = websiteRepository.save(website);
        } else {
            log.info("Registering new website target: {}", normalizedUrl);
            website = Website.builder()
                    .url(normalizedUrl)
                    .status(CrawlStatus.PENDING)
                    .pagesCrawled(0)
                    .chunksCreated(0)
                    .build();
            website = websiteRepository.save(website);
        }

        // Trigger crawler asynchronously
        crawlerService.crawlWebsite(website.getId(), website.getUrl());

        return ResponseEntity.ok(
            IngestionResponse.builder()
                .id(website.getId())
                .url(website.getUrl())
                .status(CrawlStatus.PENDING)
                .pagesCrawled(0)
                .chunksCreated(0)
                .message("Asynchronous crawling task has been successfully scheduled.")
                .build()
        );
    }

    /**
     * Retrieves the crawling status and statistics for a given website ID.
     *
     * @param websiteId the ID of the website target
     * @return response containing current crawl status and stats
     */
    @GetMapping("/{websiteId}/status")
    public ResponseEntity<IngestionResponse> getIngestionStatus(@PathVariable Long websiteId) {
        return websiteRepository.findById(websiteId)
                .map(website -> ResponseEntity.ok(
                    IngestionResponse.builder()
                        .id(website.getId())
                        .url(website.getUrl())
                        .status(website.getStatus())
                        .pagesCrawled(website.getPagesCrawled())
                        .chunksCreated(website.getChunksCreated())
                        .message("Current ingestion task status.")
                        .build()
                ))
                .orElse(ResponseEntity.notFound().build());
    }
}
