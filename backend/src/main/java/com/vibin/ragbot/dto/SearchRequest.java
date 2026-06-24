package com.vibin.ragbot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchRequest {

    @NotBlank(message = "Query cannot be blank")
    private String query;

    private Long websiteId; // Optional: filter by website
    
    private List<Long> websiteIds; // Optional: filter by multiple websites

    private String pageType; // Optional: filter by metadata category (e.g. blog, docs)

    private Double minSimilarity; // Optional: custom similarity threshold

    private Integer limit; // Optional: default limit
}
