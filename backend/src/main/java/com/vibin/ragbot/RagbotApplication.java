package com.vibin.ragbot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@EnableAsync
@RestController
public class RagbotApplication {

	public static void main(String[] args) {
		SpringApplication.run(RagbotApplication.class, args);
	}

	@GetMapping("/")
	public String home() {
		return "RAG Bot Backend Running";
	}
}