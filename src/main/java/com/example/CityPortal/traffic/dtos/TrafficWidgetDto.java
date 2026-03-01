package com.example.CityPortal.traffic.dtos;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TrafficWidgetDto(
        String city,
        int level,
        String description,
        String color,
        String icon,
        Instant updatedAt
) { }

