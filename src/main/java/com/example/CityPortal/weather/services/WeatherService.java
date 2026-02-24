package com.example.CityPortal.weather.services;

import com.example.CityPortal.weather.dtos.WeatherDetailsDto;
import com.example.CityPortal.weather.dtos.WeatherWidgetDto;

public interface WeatherService {
    WeatherWidgetDto getWidget();
    WeatherDetailsDto getDetails();
}