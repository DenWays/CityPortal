package com.example.CityPortal.weather.controllers;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class WeatherPageController {

    @GetMapping("/weather")
    public String weatherPage() {
        return "forward:/weather.html";
    }
}

