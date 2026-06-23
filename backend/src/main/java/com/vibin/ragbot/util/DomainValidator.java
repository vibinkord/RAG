package com.vibin.ragbot.util;

import java.net.URI;
import java.net.URISyntaxException;

public class DomainValidator {

    private DomainValidator() {}

    public static boolean isSameDomain(String baseUrl, String targetUrl) {
        try {
            if (baseUrl == null || targetUrl == null) return false;
            
            URI baseUri = new URI(baseUrl);
            URI targetUri = new URI(targetUrl);
            
            String baseHost = baseUri.getHost();
            String targetHost = targetUri.getHost();
            
            if (baseHost == null || targetHost == null) {
                return false;
            }
            
            // Allow matching www.example.com to example.com and vice versa
            baseHost = baseHost.replaceFirst("^www\\.", "");
            targetHost = targetHost.replaceFirst("^www\\.", "");
            
            return targetHost.equals(baseHost) || targetHost.endsWith("." + baseHost);
            
        } catch (URISyntaxException e) {
            return false;
        }
    }
    
    public static String normalizeUrl(String url) {
        if (url == null) return null;
        int hashIndex = url.indexOf('#');
        if (hashIndex != -1) {
            url = url.substring(0, hashIndex);
        }
        if (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }
}
