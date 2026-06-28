package com.vibin.ragbot.service.crawler;

import com.vibin.ragbot.util.DomainValidator;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

@Service
@Slf4j
public class ContentExtractorService {

    // Noise elements and advertisement selectors to remove
    private static final String[] NOISE_SELECTORS = {
        "nav", "footer", "header", "script", "style", "iframe", "aside", "noscript", "svg", "canvas",
        ".ads", ".advertisement", "#ads", "#advertisement",
        "[class*=\"ad-container\"]", "[class*=\"ads-container\"]",
        "[id*=\"ad-container\"]", "[id*=\"ads-container\"]",
        "ins.adsbygoogle", ".social-share", ".footer-links"
    };

    // File extensions to skip for internal links
    private static final Set<String> IGNORED_EXTENSIONS = Set.of(
        "pdf", "png", "jpg", "jpeg", "gif", "svg", "ico", "css", "js", 
        "zip", "tar", "gz", "rar", "mp4", "mp3", "avi", "mov", "doc", "docx", "xls", "xlsx", "ppt", "pptx"
    );

    /**
     * Extracts clean content (title, clean text) and discovers internal links from a JSoup Document.
     *
     * @param document the JSoup document to extract from
     * @param baseUrl the base website URL to match internal domain
     * @param sameDomainOnly whether to restrict discovered links to the same domain
     * @param followExternalLinks whether to extract external links (overrides sameDomainOnly)
     * @return the ExtractedContent record containing text and links
     */
    public ExtractedContent extract(Document document, String baseUrl, boolean sameDomainOnly, boolean followExternalLinks) {
        if (document == null) {
            return new ExtractedContent("", "", Set.of());
        }

        String title = document.title();

        // Clone the document to avoid modifying the original if it is reused
        Document cleanDoc = document.clone();

        // Strip noise and ad elements
        for (String selector : NOISE_SELECTORS) {
            try {
                cleanDoc.select(selector).remove();
            } catch (Exception e) {
                log.warn("Failed to apply clean selector: {}. Error: {}", selector, e.getMessage());
            }
        }

        // Extract clean readable text
        String cleanText;
        if (cleanDoc.body() != null) {
            cleanText = cleanDoc.body().text();
        } else {
            cleanText = cleanDoc.text();
        }

        // Discover and filter internal links from the original document
        Set<String> internalLinks = new HashSet<>();
        Elements links = document.select("a[href]");

        for (Element linkElement : links) {
            String absUrl = linkElement.attr("abs:href");
            String normalizedUrl = DomainValidator.normalizeUrl(absUrl);

            if (normalizedUrl != null && !normalizedUrl.isEmpty()) {
                // Strip hash fragments
                normalizedUrl = stripFragment(normalizedUrl);

                if (!isBinaryResource(normalizedUrl)) {
                    if (followExternalLinks || (!sameDomainOnly || isInternalLink(baseUrl, normalizedUrl))) {
                        internalLinks.add(normalizedUrl);
                    }
                }
            }
        }

        log.info("Title: {}", title);
        log.info("Content Length: {}", cleanText.length());
        log.info("Links Found: {}", internalLinks.size());

        return new ExtractedContent(title, cleanText, internalLinks);
    }

    private boolean isInternalLink(String baseUrl, String candidateUrl) {
        return DomainValidator.isSameDomain(baseUrl, candidateUrl);
    }

    private boolean isBinaryResource(String url) {
        try {
            String path = new java.net.URL(url).getPath();
            int dotIndex = path.lastIndexOf('.');
            if (dotIndex != -1 && dotIndex < path.length() - 1) {
                String extension = path.substring(dotIndex + 1).toLowerCase();
                return IGNORED_EXTENSIONS.contains(extension);
            }
        } catch (Exception e) {
            // Log warning or ignore malformed URLs
        }
        return false;
    }

    private String stripFragment(String url) {
        int hashIdx = url.indexOf('#');
        if (hashIdx != -1) {
            return url.substring(0, hashIdx);
        }
        return url;
    }
}
