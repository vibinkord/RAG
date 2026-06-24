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
public class ChatResponse {
    private String sessionId;
    private String answer;
    private String model;
    private List<SourceDto> sources;
    private List<String> chunksUsed;
    private Long retrievalLatencyMs;
    private Long generationLatencyMs;
    private Long totalLatencyMs;
}
