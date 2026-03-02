package com.example.CityPortal.taxi.controllers;

import com.example.CityPortal.taxi.dtos.TaxiDetailsDto;
import com.example.CityPortal.taxi.dtos.TaxiWidgetDto;
import com.example.CityPortal.taxi.services.TaxiService;
import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@AllArgsConstructor
@RequestMapping("/api/taxi")
public class TaxiController {
    private final TaxiService taxiService;

    @GetMapping("/widget")
    public TaxiWidgetDto getWidget() {
        return taxiService.getWidget();
    }

    @GetMapping("/details")
    public TaxiDetailsDto getDetails(@RequestParam(required = false) Double fromLat,
                                                        @RequestParam(required = false) Double fromLon,
                                                        @RequestParam(required = false) Double toLat,
                                                        @RequestParam(required = false) Double toLon) {
        double fLat = fromLat != null ? fromLat : 0;
        double fLon = fromLon != null ? fromLon : 0;
        double tLat = toLat   != null ? toLat : 0;
        double tLon = toLon   != null ? toLon : 0;
        return taxiService.getDetails(fLat, fLon, tLat, tLon);
    }
}