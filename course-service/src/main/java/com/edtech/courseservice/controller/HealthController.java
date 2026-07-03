package com.edtech.courseservice.controller;

import java.sql.Connection;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class HealthController {

    private final DataSource dataSource;

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "UP");
        response.put("service", "course-service");
        response.put("timestamp", Instant.now());
        return response;
    }

    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> ready() {
        try (Connection connection = dataSource.getConnection()) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "READY");
            response.put("database", connection.isValid(2) ? "UP" : "DOWN");
            response.put("timestamp", Instant.now());
            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "NOT_READY");
            response.put("database", "DOWN");
            response.put("timestamp", Instant.now());
            response.put("error", ex.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }
    }
}
