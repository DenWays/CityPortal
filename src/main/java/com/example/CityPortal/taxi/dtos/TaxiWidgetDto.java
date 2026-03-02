package com.example.CityPortal.taxi.dtos;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TaxiWidgetDto(
        String city,
        String status,
        Integer minPrice,
        Integer maxPrice,
        String currency,
        Integer waitingTimeMinutes,
        String deepLink,
        String clid,
        Instant updatedAt
) { }


