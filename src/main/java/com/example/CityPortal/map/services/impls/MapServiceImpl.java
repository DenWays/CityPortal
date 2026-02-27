package com.example.CityPortal.map.services.impls;

import com.example.CityPortal.map.config.MapApiProperties;
import com.example.CityPortal.map.services.MapService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

@Slf4j
@Service
@AllArgsConstructor
@Primary
public class MapServiceImpl implements MapService {

    private static final String GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/";

    private final MapApiProperties mapApiProperties;
    private final RestClient restClient;

    @Override
    public String getJsApiKey() {
        return mapApiProperties.jsApiKey();
    }

    @Override
    //@Cacheable(value = "maps:geocode", key = "#query.toLowerCase().trim()")
    public String geocode(String query) {
        String uri = UriComponentsBuilder.fromUriString(GEOCODER_URL)
                .queryParam("apikey", mapApiProperties.geocoderApiKey())
                .queryParam("geocode", query)
                .queryParam("format", "json")
                .queryParam("results", "20")
                .queryParam("lang", "ru_RU")
                .build()
                .toUriString();

        log.debug("Geocoder request: {}", uri);

        return restClient.get()
                .uri(uri)
                .retrieve()
                .body(String.class);
    }
}