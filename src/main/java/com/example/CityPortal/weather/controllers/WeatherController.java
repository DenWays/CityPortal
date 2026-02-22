package com.example.CityPortal.weather.controllers;

import com.example.CityPortal.weather.dtos.WeatherDetailsDto;
import com.example.CityPortal.weather.dtos.WeatherWidgetDto;
import com.example.CityPortal.weather.services.WeatherService;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@AllArgsConstructor
@RequestMapping("/api/weather")
public class WeatherController {
    private final WeatherService weatherService;

    @GetMapping("/widget")
    public WeatherWidgetDto getWidget() {
        return weatherService.getWidget();
    }

    @GetMapping("/details")
    public WeatherDetailsDto getDetails() {
        return weatherService.getDetails();
    }
}

