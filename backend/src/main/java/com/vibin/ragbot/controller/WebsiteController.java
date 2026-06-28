package com.vibin.ragbot.controller;

import com.vibin.ragbot.dto.CreateWebsiteRequest;
import com.vibin.ragbot.dto.CreateWebsiteResponse;
import com.vibin.ragbot.dto.IngestionResponse;
import com.vibin.ragbot.service.WebsiteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/websites")
@RequiredArgsConstructor
public class WebsiteController {

    private final WebsiteService websiteService;

    @PostMapping
    public ResponseEntity<CreateWebsiteResponse> createWebsite(@Valid @RequestBody CreateWebsiteRequest request) {
        CreateWebsiteResponse response = websiteService.createWebsite(request);
        
        if ("Website already exists".equals(response.getMessage())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
        }
        
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/{id}/refresh")
    public ResponseEntity<IngestionResponse> refreshWebsite(@PathVariable Long id) {
        IngestionResponse response = websiteService.refreshWebsite(id);
        return ResponseEntity.ok(response);
    }

    @org.springframework.web.bind.annotation.GetMapping("/{id}/progress")
    public ResponseEntity<com.vibin.ragbot.dto.CrawlProgress> getProgress(@PathVariable Long id, @org.springframework.beans.factory.annotation.Autowired com.vibin.ragbot.service.crawler.CrawlProgressTracker crawlProgressTracker) {
        com.vibin.ragbot.dto.CrawlProgress progress = crawlProgressTracker.getProgress(id);
        if (progress == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(progress);
    }
}
