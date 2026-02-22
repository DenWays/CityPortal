package com.example.CityPortal.weather.dtos;

import java.time.LocalDate;

public record DailyDto(
        LocalDate date,
        double minC,
        double maxC,
        String description,
        String icon
) { }
