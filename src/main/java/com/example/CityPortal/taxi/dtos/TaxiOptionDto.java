package com.example.CityPortal.taxi.dtos;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TaxiOptionDto(
        String classId,
        String className,
        String icon,
        Integer minPrice,
        Integer maxPrice,
        String currency,
        Integer waitingTimeMinutes,
        String description,
        boolean available
) { }

