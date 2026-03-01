package com.example.CityPortal.traffic.dtos;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TrafficDetailsDto(
        String city,
        int level,
        String description,
        String color,
        String icon,
        String trend,
        String advice,
        List<SegmentDto> segments,
        Instant updatedAt,
        double lat,
        double lon,
        String jsApiKey
) { }

