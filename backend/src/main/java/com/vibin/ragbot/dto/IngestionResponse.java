package com.vibin.ragbot.dto;

import com.vibin.ragbot.entity.CrawlStatus;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class IngestionResponse {
    private Long id;
    private String url;
    private CrawlStatus status;
    private Integer pagesCrawled;
    private Integer chunksCreated;
    private String message;
}
