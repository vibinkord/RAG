package com.vibin.ragbot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnswerRequest {

    @NotNull(message = "Website ID cannot be null")
    private Long websiteId;

    @NotBlank(message = "Question cannot be blank")
    private String question;

    @Builder.Default
    private Integer topK = 5;
}
