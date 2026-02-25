package com.example.CityPortal.map.controllers;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class MapPageController {

    @GetMapping("/map")
    public String mapPage() {
        return "forward:/map.html";
    }
}

