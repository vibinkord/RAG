package com.vibin.ragbot.service.crawler;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.HttpStatusException;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Service
@Slf4j
public class RobotsTxtService {

    private final Map<String, CachedRules> cache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_HOURS = 24;
    private static final long ERROR_CACHE_TTL_HOURS = 1;

    /**
     * Checks if a URL is allowed to be crawled according to the host's robots.txt rules.
     *
     * @param urlString the URL to check
     * @return true if crawling is allowed, false otherwise
     */
    public boolean isAllowed(String urlString) {
        log.info("Checking robots.txt for URL: {}", urlString);
        if (urlString == null || urlString.trim().isEmpty()) {
            return true;
        }

        try {
            java.net.URL url = new java.net.URL(urlString);
            String protocol = url.getProtocol();
            String host = url.getHost();
            int port = url.getPort();
            
            String origin = protocol + "://" + host + (port != -1 ? ":" + port : "");
            String path = url.getPath();
            if (path == null || path.isEmpty()) {
                path = "/";
            }
            
            Map<String, List<Rule>> rulesMap = getRulesForHost(origin);
            if (rulesMap.isEmpty()) {
                return true;
            }

            // Find rules matching the specific user-agent or fallback to wildcard
            List<Rule> activeRules = rulesMap.get("ragbot");
            if (activeRules == null) {
                activeRules = rulesMap.get("ragbot/1.0");
            }
            if (activeRules == null) {
                activeRules = rulesMap.get("*");
            }

            if (activeRules == null || activeRules.isEmpty()) {
                return true;
            }

            // Match path against rule patterns (longest pattern match takes precedence)
            Rule winningRule = null;
            for (Rule rule : activeRules) {
                if (rule.matches(path)) {
                    if (winningRule == null || rule.originalLength > winningRule.originalLength) {
                        winningRule = rule;
                    } else if (rule.originalLength == winningRule.originalLength) {
                        // Allow takes precedence over Disallow if lengths are equal
                        if (rule.isAllow) {
                            winningRule = rule;
                        }
                    }
                }
            }

            return winningRule == null || winningRule.isAllow;

        } catch (Exception e) {
            log.warn("Error parsing or checking robots.txt for URL: {}. Defaulting to ALLOWED. Error: {}", urlString, e.getMessage());
            return true;
        }
    }

    private Map<String, List<Rule>> getRulesForHost(String origin) {
        CachedRules cached = cache.get(origin);
        if (cached != null && !cached.isExpired()) {
            return cached.getRules();
        }

        String robotsUrl = origin + "/robots.txt";
        log.info("Fetching robots.txt from: {}", robotsUrl);
        try {
            String content = Jsoup.connect(robotsUrl)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 RAGBot/1.0")
                    .timeout(5000)
                    .followRedirects(true)
                    .execute()
                    .body();
            
            Map<String, List<Rule>> parsed = parseRobotsTxt(content);
            cache.put(origin, new CachedRules(parsed, CACHE_TTL_HOURS));
            return parsed;
        } catch (HttpStatusException e) {
            if (e.getStatusCode() == 404) {
                log.info("No robots.txt found (404) for: {}. Allowing all.", origin);
            } else {
                log.warn("HTTP error fetching robots.txt for: {} - Status: {}. Allowing all.", origin, e.getStatusCode());
            }
            Map<String, List<Rule>> emptyMap = Collections.emptyMap();
            cache.put(origin, new CachedRules(emptyMap, CACHE_TTL_HOURS));
            return emptyMap;
        } catch (Exception e) {
            log.warn("Failed to fetch robots.txt for: {}. Allowing all. Error: {}", origin, e.getMessage());
            Map<String, List<Rule>> emptyMap = Collections.emptyMap();
            cache.put(origin, new CachedRules(emptyMap, ERROR_CACHE_TTL_HOURS));
            return emptyMap;
        }
    }

    private Map<String, List<Rule>> parseRobotsTxt(String content) {
        Map<String, List<Rule>> userAgentRules = new ConcurrentHashMap<>();
        if (content == null || content.isEmpty()) {
            return userAgentRules;
        }

        String[] lines = content.split("\\r?\\n");
        List<String> currentAgents = new ArrayList<>();
        boolean accumulatingAgents = true;

        for (String line : lines) {
            int hashIndex = line.indexOf('#');
            if (hashIndex >= 0) {
                line = line.substring(0, hashIndex);
            }
            line = line.trim();
            if (line.isEmpty()) {
                continue;
            }

            int colonIndex = line.indexOf(':');
            if (colonIndex == -1) {
                continue;
            }

            String directive = line.substring(0, colonIndex).trim().toLowerCase();
            String value = line.substring(colonIndex + 1).trim();

            if ("user-agent".equals(directive)) {
                if (!accumulatingAgents) {
                    currentAgents.clear();
                    accumulatingAgents = true;
                }
                currentAgents.add(value.toLowerCase());
            } else if ("allow".equals(directive) || "disallow".equals(directive)) {
                accumulatingAgents = false;
                if (currentAgents.isEmpty()) {
                    continue; 
                }
                boolean isAllow = "allow".equals(directive);
                Rule rule = new Rule(value, isAllow);

                for (String agent : currentAgents) {
                    userAgentRules.computeIfAbsent(agent, k -> new ArrayList<>()).add(rule);
                }
            }
        }
        return userAgentRules;
    }

    private static class CachedRules {
        private final Map<String, List<Rule>> rules;
        private final LocalDateTime expiresAt;

        public CachedRules(Map<String, List<Rule>> rules, long ttlHours) {
            this.rules = rules;
            this.expiresAt = LocalDateTime.now().plusHours(ttlHours);
        }

        public boolean isExpired() {
            return LocalDateTime.now().isAfter(expiresAt);
        }

        public Map<String, List<Rule>> getRules() {
            return rules;
        }
    }

    private static class Rule {
        private final Pattern pattern;
        private final int originalLength;
        private final boolean isAllow;

        public Rule(String pathPattern, boolean isAllow) {
            this.pattern = compilePattern(pathPattern);
            this.originalLength = pathPattern.length();
            this.isAllow = isAllow;
        }

        public boolean matches(String path) {
            return pattern != null && pattern.matcher(path).find();
        }

        private Pattern compilePattern(String pathPattern) {
            if (pathPattern == null || pathPattern.isEmpty()) {
                return Pattern.compile("^.*");
            }
            StringBuilder sb = new StringBuilder("^");
            boolean endsWithDollar = pathPattern.endsWith("$");
            String cleanedPattern = endsWithDollar ? pathPattern.substring(0, pathPattern.length() - 1) : pathPattern;

            for (int i = 0; i < cleanedPattern.length(); i++) {
                char c = cleanedPattern.charAt(i);
                if (c == '*') {
                    sb.append(".*");
                } else if ("\\.[]{}()+-^$|?".indexOf(c) != -1) {
                    sb.append('\\').append(c);
                } else {
                    sb.append(c);
                }
            }
            if (endsWithDollar) {
                sb.append("$");
            }
            return Pattern.compile(sb.toString());
        }
    }
}
