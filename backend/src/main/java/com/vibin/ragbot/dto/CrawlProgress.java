package com.vibin.ragbot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CrawlProgress {
    private String status;
    private int pagesDiscovered;
    private int pagesCrawled;
    private int pagesRemaining;
    private int chunksCreated;
    private int embeddingsGenerated;
    private long elapsedSeconds;
    private long estimatedRemainingSeconds;
}
