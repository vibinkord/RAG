package com.vibin.ragbot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import org.hibernate.validator.constraints.URL;

@Data
public class CreateWebsiteRequest {
    @NotBlank(message = "URL is required")
    @URL(message = "Please provide a valid URL")
    private String url;
}
