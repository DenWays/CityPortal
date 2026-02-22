package com.example.CityPortal.weather.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "weather.openmeteo")
public record WeatherApiProperties(
        String baseUrl,
        int days
) { }