package com.vibin.ragbot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmbeddingStatusResponse {
    private Long websiteId;
    private long totalChunks;
    private long embeddedChunks;
    private long remainingChunks;
    private String status;
}
