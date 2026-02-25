package com.example.CityPortal.map.services;

public interface MapService {
    String getJsApiKey();
    String geocode(String query);
}

