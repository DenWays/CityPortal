package com.example.CityPortal.map.services.impls;

import com.example.CityPortal.map.config.MapApiProperties;
import com.example.CityPortal.map.services.MapService;
import lombok.AllArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Service
@AllArgsConstructor
@Primary
public class MapServiceImpl implements MapService {
    private final MapApiProperties mapApiProperties;
    private final RestClient restClient;

    @Override
    public String getJsApiKey() {
        return mapApiProperties.jsApiKey();
    }

    @Override
    //@Cacheable(value = "maps:geocode", key = "#query")
    public String geocode(String query) {
        String url = "https://geocode-maps.yandex.ru/1.x/"
                + "?apikey=" + mapApiProperties.geocoderApiKey()
                + "&geocode=" + encodeQuery(query)
                + "&format=json"
                + "&results=1"
                + "&lang=ru_RU";

        Map<String, Object> response = restClient.get()
                .uri(url)
                .retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {});

        return extractCoordinates(response);
    }

    private String encodeQuery(String query) {
        try {
            return java.net.URLEncoder.encode(query, "UTF-8");
        }
        catch (Exception e) {
            return query;
        }
    }

    @SuppressWarnings("unchecked")
    private String extractCoordinates(Map<String, Object> response) {
        try {
            Map<String, Object> geoObjectCollection =
                    (Map<String, Object>) ((Map<String, Object>) response.get("response")).get("GeoObjectCollection");
            java.util.List<Object> featureMembers =
                    (java.util.List<Object>) geoObjectCollection.get("featureMember");
            if (featureMembers == null || featureMembers.isEmpty()) {
                return null;
            }
            Map<String, Object> geoObject =
                    (Map<String, Object>) ((Map<String, Object>) featureMembers.get(0)).get("GeoObject");
            Map<String, Object> point =
                    (Map<String, Object>) ((Map<String, Object>) geoObject.get("Point"));
            String pos = (String) point.get("pos"); // "lon lat"
            String[] parts = pos.split(" ");
            // Convert "lon lat" -> "lat,lon" for Yandex Maps JS API
            return parts[1] + "," + parts[0];
        } catch (Exception e) {
            return null;
        }
    }
}