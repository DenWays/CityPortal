package com.example.CityPortal.venue.controllers;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class VenuePageController {

    @GetMapping("/venues")
    public String venuesListPage() {
        return "forward:/venues.html";
    }

    @GetMapping("/venues/{id}")
    public String venueDetailPage(@PathVariable Long id) {
        return "forward:/venues.html";
    }
}