package com.example.CityPortal.taxi.dtos;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TaxiDetailsDto(
        String city,
        String status,
        double fromLat,
        double fromLon,
        double toLat,
        double toLon,
        List<TaxiOptionDto> options,
        String deepLink,
        String clid,
        Instant updatedAt
) { }

