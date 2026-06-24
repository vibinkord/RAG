package com.vibin.ragbot;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import javax.sql.DataSource;
import java.sql.Connection;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@EnableAsync
@RestController
@Slf4j
public class RagbotApplication {

	public static void main(String[] args) {
		SpringApplication.run(RagbotApplication.class, args);
	}

	@GetMapping("/")
	public String home() {
		return "RAG Bot Backend Running";
	}

	@Bean
	public CommandLineRunner dbConnectivityLogger(DataSource dataSource) {
		return args -> {
			try (Connection connection = dataSource.getConnection()) {
				log.info("Connected to pgvector database on port 5433");
			} catch (Exception e) {
				log.error("Failed to connect to pgvector database on port 5433: {}", e.getMessage());
			}
		};
	}
}