package com.example.CityPortal.weather.services.impls;

import com.example.CityPortal.weather.config.WeatherApiProperties;
import com.example.CityPortal.weather.config.WeatherCityProperties;
import com.example.CityPortal.weather.dtos.DailyDto;
import com.example.CityPortal.weather.dtos.HourlyDto;
import com.example.CityPortal.weather.dtos.WeatherDetailsDto;
import com.example.CityPortal.weather.dtos.WeatherWidgetDto;
import com.example.CityPortal.weather.services.WeatherService;
import lombok.AllArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@AllArgsConstructor
@Primary
public class WeatherServiceImpl implements WeatherService {
    private final RestClient restClient;
    private final WeatherApiProperties weatherApiProperties;
    private final WeatherCityProperties weatherCityProperties;
    private static final DateTimeFormatter ISO_LOCAL = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchForecast() {
        String url = weatherApiProperties.baseUrl() + "/v1/forecast"
                + "?latitude=" + weatherCityProperties.latitude()
                + "&longitude=" + weatherCityProperties.longitude()
                + "&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,is_day"
                + "&hourly=temperature_2m,apparent_temperature,weathercode"
                + "&daily=weathercode,temperature_2m_max,temperature_2m_min"
                + "&timezone=" + weatherCityProperties.timezone()
                + "&forecast_days=" + weatherApiProperties.days();

        return restClient.get()
                .uri(url)
                .retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    @SuppressWarnings("unchecked")
    @Override
    public WeatherWidgetDto getWidget() {
        Map<String, Object> root = fetchForecast();
        Map<String, Object> current = (Map<String, Object>) root.get("current");

        int code = toInt(current.get("weathercode"));
        boolean isDay = toInt(current.get("is_day")) == 1;
        String timeStr = (String) current.get("time");
        Instant updatedAt = parseLocalTime(timeStr, weatherCityProperties.timezone());

        return new WeatherWidgetDto(
                weatherCityProperties.name(),
                toDouble(current.get("temperature_2m")),
                toDouble(current.get("apparent_temperature")),
                wmoDescription(code),
                wmoIcon(code, isDay),
                updatedAt
        );
    }

    @SuppressWarnings("unchecked")
    @Override
    public WeatherDetailsDto getDetails() {
        Map<String, Object> root = fetchForecast();
        Map<String, Object> current = (Map<String, Object>) root.get("current");

        int currentCode = toInt(current.get("weathercode"));
        boolean isDay = toInt(current.get("is_day")) == 1;
        String timeStr = (String) current.get("time");
        Instant updatedAt = parseLocalTime(timeStr, weatherCityProperties.timezone());

        WeatherWidgetDto currentDto = new WeatherWidgetDto(
                weatherCityProperties.name(),
                toDouble(current.get("temperature_2m")),
                toDouble(current.get("apparent_temperature")),
                wmoDescription(currentCode),
                wmoIcon(currentCode, isDay),
                updatedAt
        );

        Map<String, Object> hourly = (Map<String, Object>) root.get("hourly");
        List<String> hourlyTimes = (List<String>) hourly.get("time");
        List<Number> hourlyTemps = (List<Number>) hourly.get("temperature_2m");
        List<Number> hourlyFeels = (List<Number>) hourly.get("apparent_temperature");
        List<Number> hourlyCodes = (List<Number>) hourly.get("weathercode");
        String todayPrefix = hourlyTimes.get(0).substring(0, 10);
        List<HourlyDto> hourlyList = new ArrayList<>();

        for (int i = 0; i < hourlyTimes.size(); i++) {
            String t = hourlyTimes.get(i);
            if (!t.startsWith(todayPrefix)) break;
            int hCode = hourlyCodes.get(i).intValue();
            hourlyList.add(new HourlyDto(
                    parseLocalTime(t, weatherCityProperties.timezone()),
                    hourlyTemps.get(i).doubleValue(),
                    hourlyFeels.get(i).doubleValue(),
                    wmoDescription(hCode),
                    wmoIcon(hCode, true)
            ));
        }

        Map<String, Object> daily = (Map<String, Object>) root.get("daily");
        List<String> dailyDates = (List<String>) daily.get("time");
        List<Number> dailyMax = (List<Number>) daily.get("temperature_2m_max");
        List<Number> dailyMin = (List<Number>) daily.get("temperature_2m_min");
        List<Number> dailyCodes = (List<Number>) daily.get("weathercode");
        List<DailyDto> dailyList = new ArrayList<>();

        for (int i = 0; i < dailyDates.size(); i++) {
            int dCode = dailyCodes.get(i).intValue();
            dailyList.add(new DailyDto(
                    LocalDate.parse(dailyDates.get(i), DATE_FMT),
                    dailyMin.get(i).doubleValue(),
                    dailyMax.get(i).doubleValue(),
                    wmoDescription(dCode),
                    wmoIcon(dCode, true)
            ));
        }

        return new WeatherDetailsDto(currentDto, hourlyList, dailyList);
    }

    private Instant parseLocalTime(String isoLocal, String timezone) {
        LocalDateTime ldt = LocalDateTime.parse(isoLocal, ISO_LOCAL);
        return ldt.atZone(ZoneId.of(timezone)).toInstant();
    }

    private double toDouble(Object v) {
        return v instanceof Number ? ((Number) v).doubleValue() : 0.0;
    }

    private int toInt(Object v) {
        return v instanceof Number ? ((Number) v).intValue() : 0;
    }

    private String wmoDescription(int code) {
        return switch (code) {
            case 0 -> "Ясно";
            case 1 -> "Преимущественно ясно";
            case 2 -> "Переменная облачность";
            case 3 -> "Пасмурно";
            case 45 -> "Туман";
            case 48 -> "Изморозевый туман";
            case 51 -> "Лёгкая морось";
            case 53 -> "Умеренная морось";
            case 55 -> "Сильная морось";
            case 56 -> "Лёгкий ледяной дождь";
            case 57 -> "Сильный ледяной дождь";
            case 61 -> "Небольшой дождь";
            case 63 -> "Умеренный дождь";
            case 65 -> "Сильный дождь";
            case 66 -> "Небольшой ледяной дождь";
            case 67 -> "Сильный ледяной дождь";
            case 71 -> "Небольшой снег";
            case 73 -> "Умеренный снег";
            case 75 -> "Сильный снег";
            case 77 -> "Снежные зёрна";
            case 80 -> "Небольшой ливень";
            case 81 -> "Умеренный ливень";
            case 82 -> "Сильный ливень";
            case 85 -> "Небольшой снегопад";
            case 86 -> "Сильный снегопад";
            case 95 -> "Гроза";
            case 96 -> "Гроза с небольшим градом";
            case 99 -> "Гроза с крупным градом";
            default -> "Неизвестно";
        };
    }

    private String wmoIcon(int code, boolean isDay) {
        String d = isDay ? "day" : "night";
        return switch (code) {
            case 0 -> "clear-" + d;
            case 1 -> "mostly-clear-" + d;
            case 2 -> "partly-cloudy-" + d;
            case 3 -> "overcast-" + d;
            case 45 -> "fog-" + d;
            case 48 -> "rime-fog";
            case 51 -> "drizzle";
            case 53 -> "drizzle";
            case 55 -> "extreme-drizzle";
            case 56, 57 -> "freezing-drizzle";
            case 61 -> "partly-cloudy-" + d + "-rain";
            case 63 -> "rain";
            case 65 -> "extreme-rain";
            case 66, 67 -> "freezing-rain";
            case 71 -> "partly-cloudy-" + d + "-snow";
            case 73 -> "snow";
            case 75 -> "extreme-snow";
            case 77 -> "snowflake";
            case 80 -> "partly-cloudy-" + d + "-rain";
            case 81 -> "rain";
            case 82 -> "thunderstorms-rain";
            case 85 -> "partly-cloudy-" + d + "-snow";
            case 86 -> "extreme-snow";
            case 95 -> "thunderstorms-" + d;
            case 96 -> "thunderstorms-" + d + "-rain";
            case 99 -> "thunderstorms-extreme-rain";
            default -> "not-available";
        };
    }
}