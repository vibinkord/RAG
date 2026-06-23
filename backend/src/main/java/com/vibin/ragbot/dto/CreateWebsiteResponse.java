package com.vibin.ragbot.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CreateWebsiteResponse {
    private Long id;
    private String url;
    private String status;
    private String message;
}
