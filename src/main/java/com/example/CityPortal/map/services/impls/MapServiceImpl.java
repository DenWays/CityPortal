package com.example.CityPortal.map.services.impls;

import com.example.CityPortal.map.config.MapApiProperties;
import com.example.CityPortal.map.services.MapService;
import lombok.AllArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

@Service
@AllArgsConstructor
@Primary
public class MapServiceImpl implements MapService {
    private final MapApiProperties mapApiProperties;

    @Override
    public String getJsApiKey() {
        return mapApiProperties.jsApiKey();
    }

    @Override
    public String geocode(String query) {
        return null;
    }
}