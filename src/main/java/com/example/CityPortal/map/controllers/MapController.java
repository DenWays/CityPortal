package com.example.CityPortal.map.controllers;

import com.example.CityPortal.map.services.MapService;
import lombok.AllArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@AllArgsConstructor
@RequestMapping("/api/maps")
public class MapController {
    private final MapService mapService;

    @GetMapping("/js-key")
    public String getJsKey() {
        return mapService.getJsApiKey();
    }

    @GetMapping(value = "/geocode", produces = MediaType.APPLICATION_JSON_VALUE)
    public String geocode(@RequestParam String q) {
        return mapService.geocode(q);
    }
}