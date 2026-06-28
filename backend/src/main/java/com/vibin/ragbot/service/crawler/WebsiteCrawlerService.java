package com.vibin.ragbot.service.crawler;

import com.vibin.ragbot.config.CrawlerProperties;
import com.vibin.ragbot.dto.CrawlProgress;
import com.vibin.ragbot.dto.CrawlTask;
import com.vibin.ragbot.entity.CrawlStatus;
import com.vibin.ragbot.entity.Page;
import com.vibin.ragbot.entity.Website;
import com.vibin.ragbot.repository.PageRepository;
import com.vibin.ragbot.repository.WebsiteRepository;
import com.vibin.ragbot.util.DomainValidator;
import com.vibin.ragbot.service.chunking.TextChunkingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.HttpStatusException;
import org.jsoup.Jsoup;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebsiteCrawlerService {

    private final PageRepository pageRepository;
    private final WebsiteRepository websiteRepository;
    private final RobotsTxtService robotsTxtService;
    private final ContentExtractorService contentExtractorService;
    private final TextChunkingService textChunkingService;
    private final TransactionTemplate transactionTemplate;
    private final com.vibin.ragbot.service.embedding.EmbeddingGenerationService embeddingGenerationService;
    private final CrawlerProperties crawlerProperties;
    private final CrawlProgressTracker progressTracker;

    private static final int TIMEOUT_MS = 10000;

    @Async
    public CompletableFuture<List<String>> crawlWebsite(Long websiteId, String startUrl) {
        try {
            Website website = websiteRepository.findById(websiteId)
                    .orElseThrow(() -> new IllegalArgumentException("Website not found"));
            log.info("STEP 1 - Website loaded");

            website.setStatus(CrawlStatus.CRAWLING);
            websiteRepository.save(website);
            log.info("STEP 2 - Status changed to CRAWLING");

            String baseUrl = DomainValidator.normalizeUrl(startUrl);
            log.info("STEP 3 - Base URL = {}", baseUrl);

            // Determine config
            int maxPages = website.getMaxPages() != null ? website.getMaxPages() : crawlerProperties.getMaxPages();
            int maxDepth = website.getMaxDepth() != null ? website.getMaxDepth() : crawlerProperties.getMaxDepth();
            long crawlDelayMs = website.getCrawlDelayMs() != null ? website.getCrawlDelayMs() : crawlerProperties.getCrawlDelayMs();
            boolean respectRobots = website.getRespectRobots() != null ? website.getRespectRobots() : crawlerProperties.isRespectRobots();
            boolean sameDomainOnly = website.getSameDomainOnly() != null ? website.getSameDomainOnly() : crawlerProperties.isSameDomainOnly();
            boolean excludeQueryParameters = website.getExcludeQueryParameters() != null ? website.getExcludeQueryParameters() : crawlerProperties.isExcludeQueryParameters();
            boolean followExternalLinks = website.getFollowExternalLinks() != null ? website.getFollowExternalLinks() : false;
            
            if (website.getCrawlMode() != null) {
                switch (website.getCrawlMode().toUpperCase()) {
                    case "QUICK": maxPages = 50; maxDepth = 4; break;
                    case "STANDARD": maxPages = 500; maxDepth = 8; break;
                    case "DEEP": maxPages = 2000; maxDepth = 15; break;
                    case "ENTIRE": maxPages = 0; maxDepth = 100; break; // 0 = unlimited
                }
            }

            log.info("Config for {}: mode={}, maxPages={}, maxDepth={}", baseUrl, website.getCrawlMode(), maxPages, maxDepth);

            progressTracker.init(websiteId);
            long startTimeMs = System.currentTimeMillis();

            log.info("STEP 4 - Creating BFS queue");
            Queue<CrawlTask> queue = new LinkedList<>();
            Set<String> visitedUrls = new HashSet<>();
            List<String> crawledUrls = new ArrayList<>();
            List<Page> newPagesList = new ArrayList<>();

            queue.add(new CrawlTask(baseUrl, 0));

            try {
                while (!queue.isEmpty() && (maxPages == 0 || crawledUrls.size() < maxPages)) {
                    CrawlTask currentTask = queue.poll();
                    String currentUrl = currentTask.getUrl();
                    int currentDepth = currentTask.getDepth();

                    if (excludeQueryParameters && currentUrl.contains("?")) {
                        currentUrl = currentUrl.substring(0, currentUrl.indexOf("?"));
                    }

                    if (visitedUrls.contains(currentUrl)) {
                        continue;
                    }
                    
                    boolean ignored = false;
                    for (String pattern : crawlerProperties.getIgnoreUrls()) {
                        if (currentUrl.matches(pattern)) {
                            ignored = true;
                            break;
                        }
                    }
                    if (ignored) {
                        visitedUrls.add(currentUrl);
                        continue;
                    }

                    visitedUrls.add(currentUrl);

                    log.info("STEP 5 - Robots check {}", currentUrl);
                    if (respectRobots && !robotsTxtService.isAllowed(currentUrl)) {
                        log.info("URL is disallowed by robots.txt: {}", currentUrl);
                        continue;
                    }
                    log.info("STEP 6 - Robots allowed");

                    try {
                        if (crawlDelayMs > 0) {
                            Thread.sleep(crawlDelayMs);
                        }
                        
                        int attempts = 0;
                        org.jsoup.nodes.Document jsoupDoc = null;
                        String finalUrl = currentUrl;

                        while (attempts < 3) {
                            attempts++;
                            try {
                                log.info("STEP 7 - Connecting {}", currentUrl);
                                org.jsoup.Connection.Response response = Jsoup.connect(currentUrl)
                                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                                        .referrer("https://www.google.com")
                                        .timeout(TIMEOUT_MS)
                                        .followRedirects(true)
                                        .ignoreHttpErrors(true)
                                        .execute();

                                int statusCode = response.statusCode();
                                log.info("STEP 8 - Response {}", statusCode);

                                if (statusCode >= 400) {
                                    throw new HttpStatusException("HTTP error fetching URL", statusCode, currentUrl);
                                }

                                jsoupDoc = response.parse();
                                finalUrl = DomainValidator.normalizeUrl(response.url().toString());
                                if (excludeQueryParameters && finalUrl.contains("?")) {
                                    finalUrl = finalUrl.substring(0, finalUrl.indexOf("?"));
                                }
                                break;
                            } catch (HttpStatusException e) {
                                log.warn("HTTP status error on attempt {} for URL {}: Status {}", attempts, currentUrl, e.getStatusCode());
                                if (attempts >= 3) throw e;
                            } catch (SocketTimeoutException e) {
                                log.warn("Timeout on attempt {} for URL {}: {}", attempts, currentUrl, e.getMessage());
                                if (attempts >= 3) throw e;
                            } catch (IOException e) {
                                log.warn("IO error on attempt {} for URL {}: {}", attempts, currentUrl, e.getMessage());
                                if (attempts >= 3) throw e;
                            }
                        }

                        if (!finalUrl.equals(currentUrl) && visitedUrls.contains(finalUrl)) {
                            continue;
                        }
                        visitedUrls.add(finalUrl);

                        log.info("STEP 5 - Robots check final {}", finalUrl);
                        if (respectRobots && !robotsTxtService.isAllowed(finalUrl)) {
                            continue;
                        }
                        log.info("STEP 6 - Robots allowed final");

                        ExtractedContent extracted = contentExtractorService.extract(jsoupDoc, baseUrl, sameDomainOnly, followExternalLinks);
                        log.info("STEP 9 - Extracted text length {}", extracted.cleanText().length());

                        if (extracted.cleanText().trim().isEmpty()) {
                            continue;
                        }

                        Page pageEntity = new Page();
                        pageEntity.setUrl(finalUrl);
                        pageEntity.setTitle(extracted.title());
                        pageEntity.setContent(extracted.cleanText());
                        newPagesList.add(pageEntity);
                        log.info("STEP 10 - Page added");

                        crawledUrls.add(finalUrl);

                        if (currentDepth < maxDepth) {
                            for (String link : extracted.internalLinks()) {
                                if (excludeQueryParameters && link.contains("?")) {
                                    link = link.substring(0, link.indexOf("?"));
                                }
                                if (!visitedUrls.contains(link)) {
                                    queue.add(new CrawlTask(link, currentDepth + 1));
                                }
                            }
                        }

                        long elapsedMs = System.currentTimeMillis() - startTimeMs;
                        long elapsedSec = elapsedMs / 1000;
                        int pagesCrawledCount = crawledUrls.size();
                        long estRemaining = 0;
                        if (pagesCrawledCount > 0) {
                            long msPerPage = elapsedMs / pagesCrawledCount;
                            estRemaining = (queue.size() * msPerPage) / 1000;
                        }

                        progressTracker.updateProgress(websiteId, CrawlProgress.builder()
                                .status("CRAWLING")
                                .pagesDiscovered(visitedUrls.size() + queue.size())
                                .pagesCrawled(pagesCrawledCount)
                                .pagesRemaining(queue.size())
                                .chunksCreated(0)
                                .embeddingsGenerated(0)
                                .elapsedSeconds(elapsedSec)
                                .estimatedRemainingSeconds(estRemaining)
                                .build());

                    } catch (Exception e) {
                        log.error("Failed to crawl URL: {} - {}", currentUrl, e.getMessage());
                    }
                }

                log.info("Crawl completed in memory. Crawled {} pages. Saving atomic transaction...", crawledUrls.size());

                log.info("STEP 11 - Transaction start");
                transactionTemplate.executeWithoutResult(status -> {
                    Website currentWebsite = websiteRepository.findById(websiteId)
                            .orElseThrow(() -> new IllegalArgumentException("Website not found"));

                    currentWebsite.getPages().clear();
                    websiteRepository.saveAndFlush(currentWebsite);

                    for (Page pageEntity : newPagesList) {
                        pageEntity.setWebsite(currentWebsite);
                        currentWebsite.getPages().add(pageEntity);
                    }

                    log.info("STEP 12 - Saving {} pages", newPagesList.size());
                    pageRepository.saveAll(newPagesList);
                    pageRepository.flush();
                    log.info("STEP 13 - Saved pages");

                    log.info("STEP 14 - Chunking start");
                    int totalChunks = textChunkingService.processAllPages(websiteId);
                    log.info("STEP 15 - Chunk count {}", totalChunks);

                    currentWebsite.setChunksCreated(totalChunks);
                    currentWebsite.setPagesCrawled(newPagesList.size());
                    currentWebsite.setStatus(CrawlStatus.CRAWLED);
                    websiteRepository.save(currentWebsite);
                    log.info("STEP 16 - Status changed to CRAWLED");
                    
                    CrawlProgress currentProgress = progressTracker.getProgress(websiteId);
                    if (currentProgress != null) {
                        currentProgress.setChunksCreated(totalChunks);
                        progressTracker.updateProgress(websiteId, currentProgress);
                    }
                });

                log.info("Transaction committed. Starting embedding generation for website {}", websiteId);
                embeddingGenerationService.startEmbeddingGeneration(websiteId);

                log.info("Crawling and chunking completed.");
                return CompletableFuture.completedFuture(crawledUrls);

            } catch (Exception e) {
                log.error("Fatal error during crawling for websiteId {}: {}", websiteId, e.getMessage());
                try {
                    transactionTemplate.executeWithoutResult(status -> {
                        Website currentWebsite = websiteRepository.findById(websiteId).orElse(null);
                        if (currentWebsite != null) {
                            currentWebsite.setStatus(CrawlStatus.FAILED);
                            websiteRepository.save(currentWebsite);
                        }
                    });
                } catch (Exception ex) {
                    log.error("Failed to update status to FAILED: {}", ex.getMessage());
                }
                return CompletableFuture.failedFuture(e);
            }
        } catch (Exception e) {
            log.error("CRAWLER FATAL ERROR", e);
            throw e;
        }
    }
}
