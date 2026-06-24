package com.vibin.ragbot.controller;

import com.vibin.ragbot.dto.SearchRequest;
import com.vibin.ragbot.dto.SearchResponse;
import com.vibin.ragbot.dto.SearchDebugResponse;
import com.vibin.ragbot.service.retrieval.SearchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
@Slf4j
public class RetrievalController {

    private final SearchService searchService;

    @PostMapping
    public SearchResponse search(@Valid @RequestBody SearchRequest request) {
        log.info("Received search request for query: '{}'", request.getQuery());
        return searchService.search(request);
    }

    @GetMapping("/debug")
    public SearchDebugResponse searchDebug(
            @RequestParam String query,
            @RequestParam(required = false) Long websiteId,
            @RequestParam(required = false) List<Long> websiteIds,
            @RequestParam(required = false) String pageType,
            @RequestParam(required = false, defaultValue = "5") Integer limit) {
        log.info("Received debug search request for query: '{}', websiteIds: {}, pageType: {}", query, websiteIds, pageType);
        return searchService.searchDebug(query, websiteId, websiteIds, pageType, limit);
    }
}
