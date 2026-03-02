package com.example.CityPortal.taxi.services;

import com.example.CityPortal.taxi.dtos.TaxiDetailsDto;
import com.example.CityPortal.taxi.dtos.TaxiWidgetDto;

public interface TaxiService {
    TaxiWidgetDto getWidget();
    TaxiDetailsDto getDetails(double fromLat, double fromLon, double toLat, double toLon);
}