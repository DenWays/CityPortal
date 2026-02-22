package com.example.CityPortal.weather.dtos;

import java.time.Instant;

public record HourlyDto(
        Instant time,
        double tempC,
        double feelsLikeC,
        String description,
        String icon
) { }
