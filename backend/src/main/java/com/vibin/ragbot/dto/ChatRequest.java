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
public class ChatRequest {

    @NotBlank(message = "Session ID cannot be blank")
    private String sessionId;

    @NotBlank(message = "Message cannot be blank")
    private String message;

    private Long websiteId; // Optional: filter by website
    
    private List<Long> websiteIds; // Optional: filter by multiple websites

    private String pageType; // Optional: filter by metadata category (e.g. blog, docs)

    private Double minSimilarity; // Optional: similarity threshold

    @Builder.Default
    private Integer topK = 5;
}
