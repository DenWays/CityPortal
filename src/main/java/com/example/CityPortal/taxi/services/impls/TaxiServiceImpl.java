package com.example.CityPortal.taxi.services.impls;

import com.example.CityPortal.taxi.config.TaxiApiProperties;
import com.example.CityPortal.taxi.dtos.TaxiDetailsDto;
import com.example.CityPortal.taxi.dtos.TaxiOptionDto;
import com.example.CityPortal.taxi.dtos.TaxiWidgetDto;
import com.example.CityPortal.taxi.services.TaxiService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@AllArgsConstructor
public class TaxiServiceImpl implements TaxiService {
    private static final String TAXI_INFO_URL = "https://taxi-routeinfo.taxi.yandex.net/taxi_info";
    private final TaxiApiProperties taxiApiProperties;
    private final RestClient restClient;
    private static final List<String> TARIFF_ORDER = List.of("econom", "business", "comfortplus");

    @Override
    //@Cacheable("taxi:widget")
    public TaxiWidgetDto getWidget() {
        try {
            Map<String, Object> resp = fetchTaxiInfo(
                    taxiApiProperties.defaultFromLat(), taxiApiProperties.defaultFromLon(),
                    taxiApiProperties.defaultToLat(), taxiApiProperties.defaultToLon()
            );

            TaxiOptionDto best = parseCheapestOption(resp);
            String deepLink = buildDeepLink(
                    taxiApiProperties.defaultFromLat(), taxiApiProperties.defaultFromLon(),
                    taxiApiProperties.defaultToLat(), taxiApiProperties.defaultToLon()
            );

            if (best == null) {
                return fallbackWidget();
            }

            return new TaxiWidgetDto(
                    "Оренбург",
                    "available",
                    best.minPrice(),
                    best.maxPrice(),
                    best.currency() != null ? best.currency() : "RUB",
                    best.waitingTimeMinutes(),
                    deepLink,
                    taxiApiProperties.clid(),
                    Instant.now()
            );
        }
        catch (Exception e) {
            log.warn("Yandex GO API error (widget): {}", e.getMessage());
            return fallbackWidget();
        }
    }

    @Override
    //@Cacheable("taxi:details")
    public TaxiDetailsDto getDetails(double fromLat, double fromLon, double toLat, double toLon) {
        try {
            Map<String, Object> resp = fetchTaxiInfo(fromLat, fromLon, toLat, toLon);
            List<TaxiOptionDto> options = parseAllOptions(resp);
            String deepLink = buildDeepLink(fromLat, fromLon, toLat, toLon);

            return new TaxiDetailsDto(
                    "Оренбург",
                    "available",
                    fromLat, fromLon,
                    toLat, toLon,
                    options,
                    deepLink,
                    taxiApiProperties.clid(),
                    Instant.now()
            );
        }
        catch (Exception e) {
            log.warn("Yandex GO API error (details): {}", e.getMessage());
            return fallbackDetails(fromLat, fromLon, toLat, toLon);
        }
    }

    private Map<String, Object> fetchTaxiInfo(double fromLat, double fromLon, double toLat, double toLon) {
        String url = String.format(Locale.US,
                "%s?clid=%s&apikey=%s&rll=%.6f,%.6f~%.6f,%.6f&class=econom,business,comfortplus",
                TAXI_INFO_URL,
                taxiApiProperties.clid(),
                taxiApiProperties.apiKey(),
                fromLon, fromLat,
                toLon, toLat
        );
        log.debug("Yandex GO taxi_info request: {}", url);
        Map<String, Object> body = restClient.get()
                .uri(url)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
        log.debug("Yandex GO taxi_info raw response: {}", body);
        return body;
    }

    @SuppressWarnings("unchecked")
    private List<TaxiOptionDto> parseAllOptions(Map<String, Object> resp) {
        if (resp == null)
            return List.of();

        Object optionsObj = resp.get("options");
        if (!(optionsObj instanceof List<?> rawList))
            return List.of();

        List<TaxiOptionDto> result = new ArrayList<>();
        for (Object item : rawList) {
            if (!(item instanceof Map<?, ?> m)) continue;
            Map<String, Object> opt = (Map<String, Object>) m;
            result.add(mapOption(opt));
        }

        Set<String> presentIds = result.stream()
                .map(o -> o.classId() != null ? o.classId().toLowerCase() : "")
                .collect(java.util.stream.Collectors.toSet());

        for (String classId : TARIFF_ORDER) {
            if (!presentIds.contains(classId)) {
                result.add(new TaxiOptionDto(
                        classId,
                        classLabel(classId),
                        classIcon(classId),
                        null, null, "RUB", null,
                        "Нет в зоне покрытия",
                        false
                ));
            }
        }

        result.sort(Comparator.comparingInt(o -> {
            int idx = TARIFF_ORDER.indexOf(o.classId() != null ? o.classId().toLowerCase() : "");
            return idx < 0 ? 999 : idx;
        }));

        return result;
    }

    private TaxiOptionDto parseCheapestOption(Map<String, Object> resp) {
        List<TaxiOptionDto> all = parseAllOptions(resp);
        return all.stream()
                .filter(o -> o.minPrice() != null)
                .min(Comparator.comparingInt(TaxiOptionDto::minPrice))
                .orElse(all.isEmpty() ? null : all.getFirst());
    }

    @SuppressWarnings("unchecked")
    private TaxiOptionDto mapOption(Map<String, Object> opt) {
        String classId = str(opt, "class_name");
        if (classId == null)
            classId = str(opt, "class");

        if (classId == null)
            classId = str(opt, "tariff_class");

        String className = classLabel(classId);
        String icon = classIcon(classId);

        Integer minPrice = null, maxPrice = null;
        Object priceObj = opt.get("price");
        if (priceObj instanceof Number n) {
            minPrice = maxPrice = n.intValue();
        }
        else if (priceObj instanceof Map<?, ?> pm) {
            Map<String, Object> pMap = (Map<String, Object>) pm;
            minPrice = toInt(pMap.get("min_price"));
            maxPrice = toInt(pMap.get("max_price"));
        }

        if (minPrice == null)
            minPrice = toInt(opt.get("min_price"));

        if (maxPrice == null)
            maxPrice = toInt(opt.get("max_price"));

        Integer waitingRaw = toInt(opt.get("waiting_time"));
        Integer waiting = (waitingRaw != null && waitingRaw > 0)
                ? Math.max(1, (int) Math.round(waitingRaw / 60.0))
                : null;

        String currency = str(opt, "currency");

        return new TaxiOptionDto(
                classId, className, icon,
                minPrice, maxPrice,
                currency != null ? currency : "RUB",
                waiting,
                buildOptionDesc(minPrice, maxPrice, waiting),
                true
        );
    }

    private String buildDeepLink(double fromLat, double fromLon, double toLat, double toLon) {
        return String.format(Locale.US,
                "https://3.redirect.appmetrica.yandex.com/route" +
                "?start-lat=%.6f&start-lon=%.6f" +
                "&end-lat=%.6f&end-lon=%.6f" +
                "&appmetrica_tracking_id=1178268795219780156" +
                "&ref=%s",
                fromLat, fromLon, toLat, toLon,
                taxiApiProperties.clid()
        );
    }

    private TaxiWidgetDto fallbackWidget() {
        String deepLink = buildDeepLink(
                taxiApiProperties.defaultFromLat(), taxiApiProperties.defaultFromLon(),
                taxiApiProperties.defaultToLat(), taxiApiProperties.defaultToLon()
        );
        return new TaxiWidgetDto("Оренбург", "unavailable",
                null, null, "RUB", null,
                deepLink, taxiApiProperties.clid(), Instant.now());
    }

    private TaxiDetailsDto fallbackDetails(double fromLat, double fromLon,
                                            double toLat, double toLon) {
        return new TaxiDetailsDto("Оренбург", "unavailable",
                fromLat, fromLon, toLat, toLon,
                List.of(), buildDeepLink(fromLat, fromLon, toLat, toLon),
                taxiApiProperties.clid(), Instant.now());
    }

    private static String classLabel(String classId) {
        if (classId == null)
            return "Эконом";

        return switch (classId.toLowerCase()) {
            case "econom" -> "Эконом";
            case "business" -> "Комфорт";
            case "comfortplus" -> "Комфорт+";
            default -> classId;
        };
    }

    private static String classIcon(String classId) {
        if (classId == null)
            return "🚕";

        return switch (classId.toLowerCase()) {
            case "econom" -> "🚕";
            case "business" -> "🚗";
            case "comfortplus" -> "🚙";
            default -> "🚖";
        };
    }

    private static String buildOptionDesc(Integer min, Integer max, Integer wait) {
        StringBuilder sb = new StringBuilder();
        if (min != null && max != null && !min.equals(max)) {
            sb.append("~").append(min).append("–").append(max).append(" ₽");
        }
        else if (min != null) {
            sb.append("~").append(min).append(" ₽");
        }
        if (wait != null) {
            if (!sb.isEmpty())
                sb.append(" • ");
            sb.append("подача ").append(wait).append(" мин");
        }
        return sb.isEmpty() ? "Нет данных" : sb.toString();
    }

    private static String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v instanceof String s ? s : null;
    }

    private static Integer toInt(Object v) {
        if (v instanceof Number n)
            return n.intValue();

        return null;
    }
}