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
public class AnswerRequest {

    private Long websiteId; // Optional: backward compatibility

    private List<Long> websiteIds; // Optional: filter by multiple websites

    private String pageType; // Optional: filter by metadata category (e.g. blog, docs)

    private Double minSimilarity; // Optional: custom similarity threshold

    @NotBlank(message = "Question cannot be blank")
    private String question;

    @Builder.Default
    private Integer topK = 5;
}
