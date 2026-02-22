package com.example.CityPortal.weather.dtos;

import java.util.List;

public record WeatherDetailsDto(
        WeatherWidgetDto current,
        List<HourlyDto> hourly,
        List<DailyDto> daily
) { }
