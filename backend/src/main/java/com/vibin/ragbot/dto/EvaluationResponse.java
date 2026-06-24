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
public class EvaluationResponse {
    private String question;
    private String expectedAnswer;
    private String generatedAnswer;
    private Double similarityScore;
    private Integer factualCorrectnessScore;
    private String explanation;
    private Integer retrievedChunksCount;
    private List<SourceDto> sources;
    private Long retrievalLatencyMs;
    private Long generationLatencyMs;
    private Long totalLatencyMs;
}
