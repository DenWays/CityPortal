package com.example.CityPortal.traffic.controllers;

import com.example.CityPortal.traffic.dtos.TrafficDetailsDto;
import com.example.CityPortal.traffic.dtos.TrafficWidgetDto;
import com.example.CityPortal.traffic.services.TrafficService;
import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@AllArgsConstructor
@RequestMapping("/api/traffic")
public class TrafficController {

    private final TrafficService trafficService;

    @GetMapping("/widget")
    public TrafficWidgetDto getWidget() {
        return trafficService.getWidget();
    }

    @GetMapping("/details")
    public TrafficDetailsDto getDetails() {
        return trafficService.getDetails();
    }
}

