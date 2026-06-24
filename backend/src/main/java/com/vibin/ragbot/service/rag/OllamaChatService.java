package com.vibin.ragbot.service.rag;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
@Slf4j
public class OllamaChatService {

    private final RestTemplate restTemplate;

    @Value("${ollama.api.url:http://localhost:11434}")
    private String ollamaApiUrl;

    private static final String MODEL_NAME = "mistral";

    /**
     * Generates a text response from Ollama's mistral model.
     *
     * @param prompt the prompt to send to the model
     * @return the generated response text
     */
    public String generateAnswer(String prompt) {
        String url = ollamaApiUrl + "/api/generate";
        OllamaGenerateRequest request = new OllamaGenerateRequest(MODEL_NAME, prompt, false);

        log.debug("Sending generation request to Ollama URL: {}", url);
        OllamaGenerateResponse response = restTemplate.postForObject(url, request, OllamaGenerateResponse.class);

        if (response != null && response.getResponse() != null) {
            return response.getResponse();
        } else {
            throw new RuntimeException("Ollama returned an empty response");
        }
    }

    public String getModelName() {
        return MODEL_NAME;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    private static class OllamaGenerateRequest {
        private String model;
        private String prompt;
        private boolean stream;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    private static class OllamaGenerateResponse {
        private String model;
        private String response;
        private boolean done;
    }
}
