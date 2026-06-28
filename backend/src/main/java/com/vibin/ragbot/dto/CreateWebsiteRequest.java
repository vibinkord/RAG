package com.vibin.ragbot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import org.hibernate.validator.constraints.URL;

@Data
public class CreateWebsiteRequest {
    @NotBlank(message = "URL is required")
    @URL(message = "Please provide a valid URL")
    private String url;
    
    private Integer maxPages;
    private Integer maxDepth;
    private Long crawlDelayMs;
    private Boolean respectRobots;
    private Boolean sameDomainOnly;
    private Boolean excludeQueryParameters;
    private Boolean followExternalLinks;
    private String crawlMode;
}
