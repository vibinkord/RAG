package com.vibin.ragbot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchDebugResponse {
    private String query;
    private List<DebugResult> results;
    private Long latencyMs;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DebugResult {
        private Long chunkId;
        private String content;
        private String sourceUrl;
        private Double similarityScore;
        private Double rawVectorScore;
        private Double rankingScore;
        private String pageType;
        private String pageTitle;
    }
}
