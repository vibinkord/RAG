package com.vibin.ragbot.service.crawler;

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

    private static final int MAX_DEPTH = 3;
    private static final int MAX_PAGES = 50;
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
            
            log.info("STEP 4 - Creating BFS queue");
            Queue<CrawlTask> queue = new LinkedList<>();
            Set<String> visitedUrls = new HashSet<>();
            List<String> crawledUrls = new ArrayList<>();
            List<Page> newPagesList = new ArrayList<>();
            
            queue.add(new CrawlTask(baseUrl, 0));
            
            try {
                while (!queue.isEmpty() && crawledUrls.size() < MAX_PAGES) {
                    CrawlTask currentTask = queue.poll();
                    String currentUrl = currentTask.getUrl();
                    int currentDepth = currentTask.getDepth();
                    
                    if (visitedUrls.contains(currentUrl)) {
                        continue;
                    }
                    
                    visitedUrls.add(currentUrl);

                    log.info("STEP 5 - Robots check {}", currentUrl);
                    if (!robotsTxtService.isAllowed(currentUrl)) {
                        log.info("URL is disallowed by robots.txt: {}", currentUrl);
                        continue;
                    }
                    log.info("STEP 6 - Robots allowed");
                    
                    try {
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
                                break; // Success, exit retry loop
                            } catch (HttpStatusException e) {
                                log.warn("HTTP status error on attempt {} for URL {}: Status {}", attempts, currentUrl, e.getStatusCode());
                                if (attempts >= 3) {
                                    throw e;
                                }
                            } catch (SocketTimeoutException e) {
                                log.warn("Timeout on attempt {} for URL {}: {}", attempts, currentUrl, e.getMessage());
                                if (attempts >= 3) {
                                    throw e;
                                }
                            } catch (IOException e) {
                                log.warn("IO error on attempt {} for URL {}: {}", attempts, currentUrl, e.getMessage());
                                if (attempts >= 3) {
                                    throw e;
                                }
                            }
                        }
                        
                        // If redirected to another URL that was already visited in this session, skip.
                        if (!finalUrl.equals(currentUrl) && visitedUrls.contains(finalUrl)) {
                            log.info("Final URL already visited: {}", finalUrl);
                            continue;
                        }
                        visitedUrls.add(finalUrl);

                        log.info("STEP 5 - Robots check {}", finalUrl);
                        if (!robotsTxtService.isAllowed(finalUrl)) {
                            log.info("Final URL is disallowed by robots.txt: {}", finalUrl);
                            continue;
                        }
                        log.info("STEP 6 - Robots allowed");

                        ExtractedContent extracted = contentExtractorService.extract(jsoupDoc, baseUrl);
                        log.info("STEP 9 - Extracted text length {}", extracted.cleanText().length());
                        
                        if (extracted.cleanText().trim().isEmpty()) {
                            log.warn("Empty content for URL: {}", finalUrl);
                            continue;
                        }

                        Page pageEntity = new Page();
                        pageEntity.setUrl(finalUrl);
                        pageEntity.setTitle(extracted.title());
                        pageEntity.setContent(extracted.cleanText());
                        newPagesList.add(pageEntity);
                        log.info("STEP 10 - Page added");
                        
                        crawledUrls.add(finalUrl);
                        
                        if (currentDepth < MAX_DEPTH) {
                            for (String link : extracted.internalLinks()) {
                                if (!visitedUrls.contains(link)) {
                                    queue.add(new CrawlTask(link, currentDepth + 1));
                                }
                            }
                        }
                        
                    } catch (HttpStatusException e) {
                        log.error("HTTP error fetching URL (Broken Link) after 3 attempts: {} - Status: {}", currentUrl, e.getStatusCode());
                    } catch (SocketTimeoutException e) {
                        log.error("Timeout fetching URL after 3 attempts: {}", currentUrl);
                    } catch (IOException e) {
                        log.error("Failed to crawl URL after 3 attempts: {} - {}", currentUrl, e.getMessage());
                    } catch (IllegalArgumentException e) {
                        log.error("Invalid URL format: {}", currentUrl);
                    }
                }
                
                log.info("Crawl completed in memory. Crawled {} pages. Saving atomic transaction...", crawledUrls.size());
                
                log.info("STEP 11 - Transaction start");
                transactionTemplate.executeWithoutResult(status -> {
                    Website currentWebsite = websiteRepository.findById(websiteId)
                            .orElseThrow(() -> new IllegalArgumentException("Website not found"));
                    
                    // Clear old pages and trigger orphan removal
                    currentWebsite.getPages().clear();
                    websiteRepository.saveAndFlush(currentWebsite);
                    
                    // Set website association and synchronize bidirectional relationship
                    for (Page pageEntity : newPagesList) {
                        pageEntity.setWebsite(currentWebsite);
                        currentWebsite.getPages().add(pageEntity);
                    }
                    
                    log.info("Pages collected in memory: {}", newPagesList.size());
                    log.info("Saving pages to database...");
                    
                    log.info("STEP 12 - Saving {} pages", newPagesList.size());
                    List<Page> savedPages = pageRepository.saveAll(newPagesList);
                    pageRepository.flush();
                    log.info("STEP 13 - Saved pages");
                    
                    log.info("Saved pages count: {}", savedPages.size());
                    
                    log.info(
                        "Database page count for website {} = {}",
                        websiteId,
                        pageRepository.findByWebsiteId(websiteId).size()
                    );
                    
                    // Generate chunks for the new pages
                    log.info("STEP 14 - Chunking start");
                    log.info("Generating chunks automatically for websiteId: {}", websiteId);
                    int totalChunks = textChunkingService.processAllPages(websiteId);
                    log.info("STEP 15 - Chunk count {}", totalChunks);
                    
                    currentWebsite.setChunksCreated(totalChunks);
                    currentWebsite.setPagesCrawled(newPagesList.size());
                    currentWebsite.setStatus(CrawlStatus.CRAWLED);
                    websiteRepository.save(currentWebsite);
                    log.info("STEP 16 - Status changed to CRAWLED");
                });
                
                log.info("Crawling and chunking completed. Crawled {} pages and created chunks from {}", crawledUrls.size(), baseUrl);
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
