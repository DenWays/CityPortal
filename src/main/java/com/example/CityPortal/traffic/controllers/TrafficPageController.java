package com.example.CityPortal.traffic.controllers;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class TrafficPageController {

    @GetMapping("/traffic")
    public String trafficPage() {
        return "forward:/traffic.html";
    }
}

