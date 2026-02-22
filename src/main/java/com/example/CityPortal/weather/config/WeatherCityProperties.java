package com.example.CityPortal.weather.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "weather.city")
public record WeatherCityProperties(
        String name,
        double latitude,
        double longitude,
        String timezone
) { }
