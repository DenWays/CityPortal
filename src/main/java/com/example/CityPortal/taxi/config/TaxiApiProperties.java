package com.example.CityPortal.taxi.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "yandex.taxi")
public record TaxiApiProperties(
        String apiKey,
        String clid,
        double defaultFromLat,
        double defaultFromLon,
        double defaultToLat,
        double defaultToLon,
        int cacheTtlMinutes
) { }

