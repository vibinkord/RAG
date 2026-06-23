package com.vibin.ragbot.service.crawler;

import com.vibin.ragbot.dto.CrawlTask;
import com.vibin.ragbot.entity.Page;
import com.vibin.ragbot.entity.Website;
import com.vibin.ragbot.repository.PageRepository;
import com.vibin.ragbot.repository.WebsiteRepository;
import com.vibin.ragbot.util.DomainValidator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.HttpStatusException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebsiteCrawlerService {

    private final PageRepository pageRepository;
    private final WebsiteRepository websiteRepository;

    private static final int MAX_DEPTH = 3;
    private static final int MAX_PAGES = 50;
    private static final int TIMEOUT_MS = 5000;

    public List<String> crawlWebsite(Long websiteId, String startUrl) {
        Website website = websiteRepository.findById(websiteId)
                .orElseThrow(() -> new IllegalArgumentException("Website not found"));
        
        String baseUrl = DomainValidator.normalizeUrl(startUrl);
        
        Queue<CrawlTask> queue = new LinkedList<>();
        Set<String> visitedUrls = new HashSet<>();
        List<String> crawledUrls = new ArrayList<>();
        
        queue.add(new CrawlTask(baseUrl, 0));
        
        while (!queue.isEmpty() && crawledUrls.size() < MAX_PAGES) {
            CrawlTask currentTask = queue.poll();
            String currentUrl = currentTask.getUrl();
            int currentDepth = currentTask.getDepth();
            
            if (visitedUrls.contains(currentUrl)) {
                continue;
            }
            
            visitedUrls.add(currentUrl);

            if (pageRepository.existsByWebsiteIdAndUrl(website.getId(), currentUrl)) {
                log.info("URL already crawled for this website: {}", currentUrl);
                continue;
            }
            
            try {
                log.info("Crawling URL: {} (Depth: {})", currentUrl, currentDepth);
                org.jsoup.nodes.Document jsoupDoc = Jsoup.connect(currentUrl)
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 RAGBot/1.0")
                        .timeout(TIMEOUT_MS)
                        .followRedirects(true)
                        .get();
                
                String finalUrl = DomainValidator.normalizeUrl(jsoupDoc.location());
                if (!visitedUrls.contains(finalUrl)) {
                    visitedUrls.add(finalUrl);
                }

                if (pageRepository.existsByWebsiteIdAndUrl(website.getId(), finalUrl)) {
                    log.info("Final URL already crawled for this website: {}", finalUrl);
                    continue;
                }

                String title = jsoupDoc.title();
                String textContent = jsoupDoc.body() != null ? jsoupDoc.body().text() : "";
                
                if (textContent.trim().isEmpty()) {
                    log.warn("Empty content for URL: {}", finalUrl);
                    continue;
                }

                Page pageEntity = new Page();
                pageEntity.setWebsiteId(website.getId());
                pageEntity.setUrl(finalUrl);
                pageEntity.setTitle(title);
                pageEntity.setContent(textContent);
                pageRepository.save(pageEntity);
                
                crawledUrls.add(finalUrl);
                
                if (currentDepth < MAX_DEPTH) {
                    List<String> nextLinks = extractLinks(jsoupDoc, baseUrl);
                    for (String link : nextLinks) {
                        if (!visitedUrls.contains(link)) {
                            queue.add(new CrawlTask(link, currentDepth + 1));
                        }
                    }
                }
                
            } catch (HttpStatusException e) {
                log.error("HTTP error fetching URL (Broken Link): {} - Status: {}", currentUrl, e.getStatusCode());
            } catch (SocketTimeoutException e) {
                log.error("Timeout fetching URL: {}", currentUrl);
            } catch (IOException e) {
                log.error("Failed to crawl URL: {} - {}", currentUrl, e.getMessage());
            } catch (IllegalArgumentException e) {
                log.error("Invalid URL format: {}", currentUrl);
            }
        }
        
        website.setStatus("CRAWLED");
        website.setPagesCrawled(crawledUrls.size());
        websiteRepository.save(website);
        
        log.info("Crawling completed. Crawled {} pages from {}", crawledUrls.size(), baseUrl);
        return crawledUrls;
    }

    private List<String> extractLinks(org.jsoup.nodes.Document document, String baseUrl) {
        List<String> validLinks = new ArrayList<>();
        Elements links = document.select("a[href]");
        
        for (Element link : links) {
            String absUrl = link.attr("abs:href");
            String normalizedAbsUrl = DomainValidator.normalizeUrl(absUrl);
            
            if (normalizedAbsUrl != null && !normalizedAbsUrl.isEmpty() 
                    && isSameDomain(baseUrl, normalizedAbsUrl)) {
                validLinks.add(normalizedAbsUrl);
            }
        }
        return validLinks;
    }
    
    private boolean isSameDomain(String baseUrl, String candidateUrl) {
        return DomainValidator.isSameDomain(baseUrl, candidateUrl);
    }
}
