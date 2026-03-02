package com.example.CityPortal.taxi.controllers;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class TaxiPageController {

    @GetMapping("/taxi")
    public String taxiPage() {
        return "forward:/taxi.html";
    }
}

