package com.vibin.ragbot.service.crawler;

import java.util.Set;

public record ExtractedContent(
    String title,
    String cleanText,
    Set<String> internalLinks
) {}
