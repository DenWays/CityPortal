package com.example.CityPortal.weather.dtos;

import java.time.Instant;

public record WeatherWidgetDto (
        String city,
        double tempC,
        double feelsLikeC,
        String description,
        String icon,
        Instant updatedAt
) { }
