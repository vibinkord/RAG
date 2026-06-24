package com.vibin.ragbot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SourceDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private String url;
    private Double score;
    private String snippet;
}
