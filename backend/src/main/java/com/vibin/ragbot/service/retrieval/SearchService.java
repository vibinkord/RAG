package com.vibin.ragbot.service.retrieval;

import com.vibin.ragbot.dto.SearchRequest;
import com.vibin.ragbot.dto.SearchResponse;

public interface SearchService {
    SearchResponse search(SearchRequest request);
}
