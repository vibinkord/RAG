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
public class EvaluationRequest {

    @NotBlank(message = "Question cannot be blank")
    private String question;

    @NotBlank(message = "Expected answer cannot be blank")
    private String expectedAnswer;

    private Long websiteId; // Optional: filter by website
    
    private List<Long> websiteIds; // Optional: filter by multiple websites
    
    private String pageType; // Optional: filter by pageType
}
