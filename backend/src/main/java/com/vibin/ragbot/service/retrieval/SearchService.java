package com.vibin.ragbot.service.retrieval;

import com.vibin.ragbot.dto.SearchRequest;
import com.vibin.ragbot.dto.SearchResponse;
import com.vibin.ragbot.dto.SearchDebugResponse;
import java.util.List;

public interface SearchService {
    SearchResponse search(SearchRequest request);
    SearchDebugResponse searchDebug(String query, Long websiteId, List<Long> websiteIds, String pageType, Integer limit);
}
