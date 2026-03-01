package com.example.CityPortal.traffic.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tomtom.traffic")
public record TrafficApiProperties(
        String apiKey,
        double lat,
        double lon,
        double bboxRadius,
        int cacheTtlMinutes
) { }

