package com.example.CityPortal.traffic.services;

import com.example.CityPortal.traffic.dtos.TrafficDetailsDto;
import com.example.CityPortal.traffic.dtos.TrafficWidgetDto;

public interface TrafficService {
    TrafficWidgetDto getWidget();
    TrafficDetailsDto getDetails();
}