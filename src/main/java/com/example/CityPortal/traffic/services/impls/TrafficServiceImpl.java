package com.example.CityPortal.traffic.services.impls;

import com.example.CityPortal.map.config.MapApiProperties;
import com.example.CityPortal.traffic.config.TrafficApiProperties;
import com.example.CityPortal.traffic.dtos.SegmentDto;
import com.example.CityPortal.traffic.dtos.TrafficDetailsDto;
import com.example.CityPortal.traffic.dtos.TrafficWidgetDto;
import com.example.CityPortal.traffic.services.TrafficService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@Primary
@AllArgsConstructor
public class TrafficServiceImpl implements TrafficService {

    private static final String FLOW_URL =
            "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json";

    private static final String INCIDENTS_URL =
            "https://api.tomtom.com/traffic/services/5/incidentDetails";

    private final TrafficApiProperties trafficApiProperties;
    private final MapApiProperties mapApiProperties;
    private final RestClient restClient;

    @Override
    public TrafficWidgetDto getWidget() {
        try {
            int level = fetchCombinedLevel();
            return new TrafficWidgetDto(
                    "Оренбург", level,
                    levelDescription(level), levelColor(level), levelIcon(level),
                    Instant.now()
            );
        } catch (Exception e) {
            log.warn("TomTom Traffic API error (widget): {}", e.getMessage());
            return new TrafficWidgetDto("Оренбург", 0, "Нет данных", "#6b7280", "❓", Instant.now());
        }
    }

    @Override
    public TrafficDetailsDto getDetails() {
        try {
            int level = fetchCombinedLevel();
            List<SegmentDto> segments = fetchSegments();
            return new TrafficDetailsDto(
                    "Оренбург", level,
                    levelDescription(level), levelColor(level), levelIcon(level),
                    buildTrend(level), buildAdvice(level),
                    segments, Instant.now(),
                    trafficApiProperties.lat(), trafficApiProperties.lon(),
                    mapApiProperties.jsApiKey()
            );
        } catch (Exception e) {
            log.warn("TomTom Traffic API error (details): {}", e.getMessage());
            return buildFallbackDetails();
        }
    }

    @SuppressWarnings("unchecked")
    private double fetchFlowRatio() {
        String point = String.format(Locale.US, "%.4f,%.4f",
                trafficApiProperties.lat(), trafficApiProperties.lon());
        String uri = FLOW_URL
                + "?key=" + trafficApiProperties.apiKey()
                + "&point=" + point
                + "&unit=KMPH";

        log.debug("TomTom Flow request: {}", uri);
        Map<String, Object> body = restClient.get()
                .uri(uri)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});

        if (body == null) return 1.0;
        Object fsObj = body.get("flowSegmentData");
        if (!(fsObj instanceof Map<?, ?> fs)) return 1.0;

        Map<String, Object> fsMap = (Map<String, Object>) fs;
        double current  = toDouble(fsMap.get("currentSpeed"),  0);
        double freeFlow = toDouble(fsMap.get("freeFlowSpeed"), 0);

        if (freeFlow <= 0) return 1.0;
        return Math.min(current / freeFlow, 1.0);
    }

    @SuppressWarnings("unchecked")
    private int fetchIncidentSeverity() {
        double r   = trafficApiProperties.bboxRadius();
        double lat = trafficApiProperties.lat();
        double lon = trafficApiProperties.lon();

        String bbox = String.format(Locale.US, "%.4f,%.4f,%.4f,%.4f",
                lon - r, lat - r, lon + r, lat + r);

        String fields = "{incidents{type,properties{magnitudeOfDelay}}}";

        log.debug("TomTom Incidents request: {} bbox={}", INCIDENTS_URL, bbox);

        Map<String, Object> body;
        try {
            String encodedFields = URLEncoder.encode(fields, StandardCharsets.UTF_8);
            String encodedBbox = URLEncoder.encode(bbox, StandardCharsets.UTF_8);
            URI incidentsUri = URI.create(INCIDENTS_URL
                    + "?key=" + trafficApiProperties.apiKey()
                    + "&bbox=" + encodedBbox
                    + "&fields=" + encodedFields
                    + "&language=ru-RU"
                    + "&categoryFilter=0,1,2,3,4,5,6,7,8,9,10,11"
                    + "&timeValidityFilter=present");

            body = restClient.get()
                    .uri(incidentsUri)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
        } catch (Exception e) {
            log.warn("TomTom Incidents API failed: {}", e.getMessage());
            return 0;
        }

        if (body == null) return 0;
        Object incObj = body.get("incidents");
        if (!(incObj instanceof List<?> incList)) return 0;

        int maxMag = 0;
        for (Object item : incList) {
            if (!(item instanceof Map<?, ?> inc)) continue;
            Map<String, Object> incMap = (Map<String, Object>) inc;
            Object propsObj = incMap.get("properties");
            if (!(propsObj instanceof Map<?, ?> props)) continue;
            Object mag = ((Map<String, Object>) props).get("magnitudeOfDelay");
            if (mag instanceof Number n) maxMag = Math.max(maxMag, n.intValue());
        }
        return maxMag;
    }

    private int fetchCombinedLevel() {
        double ratio = fetchFlowRatio();
        int sev   = fetchIncidentSeverity();
        double congestion = 1.0 - ratio;
        int baseLevel = (int) Math.round(congestion * 9) + 1;

        int boost = switch (sev) {
            case 1 -> 1;
            case 2 -> 2;
            case 3 -> 3;
            case 4 -> 2;
            default -> 0;
        };

        return Math.min(10, Math.max(1, baseLevel + boost));
    }

    private static final double[][] PROBE_POINTS = {
            {51.792499, 55.126088},  // пр. Победы
            {51.809686, 55.107124},  // ул. Терешковой
            {51.787797, 55.094161},  // ул. Пролетарская
            {51.780236, 55.100198},  // ул. Комсомольская
            {51.768918, 55.130570},  // ул. Чкалова
            {51.799912, 55.146381},  // ул. Монтажников
    };

    private static final String[] STREET_NAMES = {
            "пр. Победы",
            "ул. Терешковой",
            "ул. Пролетарская",
            "ул. Комсомольская",
            "ул. Чкалова",
            "ул. Монтажников",
    };

    @SuppressWarnings("unchecked")
    private List<SegmentDto> fetchSegments() {
        List<SegmentDto> result = new ArrayList<>();
        for (int i = 0; i < PROBE_POINTS.length; i++) {
            double lat = PROBE_POINTS[i][0];
            double lon = PROBE_POINTS[i][1];
            String name = STREET_NAMES[i];
            try {
                String point = String.format(Locale.US, "%.4f,%.4f", lat, lon);
                String uri = FLOW_URL
                        + "?key=" + trafficApiProperties.apiKey()
                        + "&point=" + point
                        + "&unit=KMPH";

                Map<String, Object> body = restClient.get()
                        .uri(uri)
                        .retrieve()
                        .body(new ParameterizedTypeReference<>() {});

                int lvl = 1;
                if (body != null) {
                    Object fsObj = body.get("flowSegmentData");
                    if (fsObj instanceof Map<?, ?> fs) {
                        Map<String, Object> fsMap = (Map<String, Object>) fs;
                        double current  = toDouble(fsMap.get("currentSpeed"),  0);
                        double freeFlow = toDouble(fsMap.get("freeFlowSpeed"), 0);
                        if (freeFlow > 0) {
                            double ratio = Math.min(current / freeFlow, 1.0);
                            double congestion = 1.0 - ratio;
                            lvl = Math.max(1, Math.min(10, (int) Math.round(congestion * 9) + 1));
                        }
                    }
                }
                result.add(new SegmentDto(name, lvl, levelDescription(lvl), levelColor(lvl)));
            } catch (Exception e) {
                log.warn("TomTom Flow for {} failed: {}", name, e.getMessage());
                result.add(new SegmentDto(name, 0, "Нет данных", "#6b7280"));
            }
        }
        return result;
    }

    private TrafficDetailsDto buildFallbackDetails() {
        return new TrafficDetailsDto(
                "Оренбург", 0, "Нет данных", "#6b7280", "❓",
                "Данные временно недоступны", "Попробуйте обновить позже",
                List.of(), Instant.now(),
                trafficApiProperties.lat(), trafficApiProperties.lon(),
                mapApiProperties.jsApiKey()
        );
    }

    private static double toDouble(Object val, double def) {
        if (val instanceof Number n) return n.doubleValue();
        return def;
    }

    private String levelDescription(int level) {
        return switch (level) {
            case 0 -> "Нет данных";
            case 1 -> "Свободно";
            case 2 -> "Свободно";
            case 3 -> "Небольшие пробки";
            case 4 -> "Небольшие пробки";
            case 5 -> "Умеренные пробки";
            case 6 -> "Умеренные пробки";
            case 7 -> "Сложная обстановка";
            case 8 -> "Сложная обстановка";
            case 9 -> "Пробки";
            case 10 -> "Большие пробки";
            default -> "Неизвестно";
        };
    }

    private String levelColor(int level) {
        if (level <= 0)  return "#6b7280";
        if (level <= 2)  return "#22c55e";
        if (level <= 4)  return "#84cc16";
        if (level <= 6)  return "#f59e0b";
        if (level <= 8)  return "#ef4444";
        return "#7f1d1d";
    }

    private String levelIcon(int level) {
        if (level <= 0)  return "❓";
        if (level <= 2)  return "🟢";
        if (level <= 4)  return "🟡";
        if (level <= 6)  return "🟠";
        return "🔴";
    }

    private String buildTrend(int level) {
        if (level <= 2)  return "Дорожная ситуация благоприятная";
        if (level <= 4)  return "Незначительные задержки на отдельных участках";
        if (level <= 6)  return "Умеренные задержки движения";
        if (level <= 8)  return "Значительные задержки, рекомендуется объезд";
        return "Серьёзные пробки — избегайте центральных улиц";
    }

    private String buildAdvice(int level) {
        if (level <= 2)  return "Можно ехать по любому маршруту";
        if (level <= 4)  return "Желательно заранее изучить маршрут";
        if (level <= 6)  return "Рекомендуется использовать объездные дороги";
        if (level <= 8)  return "Используйте общественный транспорт или объезды";
        return "Рекомендуется отложить поездку или воспользоваться общественным транспортом";
    }
}