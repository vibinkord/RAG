package com.vibin.ragbot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchResponse implements Serializable {
    private static final long serialVersionUID = 1L;
    
    private String query;
    private List<SearchResult> results;
    private Long latencyMs; // Retrieval latency

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SearchResult implements Serializable {
        private static final long serialVersionUID = 1L;
        
        private Long chunkId;
        private String content;
        private String snippet; // Snippet highlighting search query
        private String sourceUrl;
        private double score; // Cosine similarity score
    }
}
