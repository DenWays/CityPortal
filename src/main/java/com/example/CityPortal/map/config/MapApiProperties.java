package com.example.CityPortal.map.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "yandex.maps")
public record MapApiProperties(
        String jsApiKey,
        String geocoderApiKey,
        int geocoderTtlMinutes
) { }

