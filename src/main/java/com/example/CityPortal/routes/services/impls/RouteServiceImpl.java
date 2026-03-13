package com.example.CityPortal.routes.services.impls;

import com.example.CityPortal.routes.dtos.RouteDetailDto;
import com.example.CityPortal.routes.dtos.RouteDto;
import com.example.CityPortal.routes.models.Route;
import com.example.CityPortal.routes.repository.RouteRepository;
import com.example.CityPortal.routes.services.RouteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.net.ssl.*;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RouteServiceImpl implements RouteService {
    private static final String BASE_URL   = "https://travel.orb.ru";
    private static final int    TIMEOUT_MS = 15_000;
    private static final Map<String, String> SECTION_URLS = new LinkedHashMap<>();
    static {
        SECTION_URLS.put("operator", "/routes/operator/");
        SECTION_URLS.put("self", "/routes/self/");
        SECTION_URLS.put("audio", "/routes/audio/");
        SECTION_URLS.put("guide", "/routes/guide/");
    }
    private final RouteRepository routeRepository;
    private static final SSLSocketFactory TRUST_ALL_SSL = buildTrustAllSslFactory();

    private static SSLSocketFactory buildTrustAllSslFactory() {
        try {
            TrustManager[] trustAll = {
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    public void checkClientTrusted(X509Certificate[] c, String a) {}
                    public void checkServerTrusted(X509Certificate[] c, String a) {}
                }
            };
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, trustAll, new java.security.SecureRandom());
            return ctx.getSocketFactory();
        } catch (NoSuchAlgorithmException | KeyManagementException e) {
            throw new IllegalStateException("Не удалось создать TrustAll SSLContext", e);
        }
    }

    @Override
    public int fetchAndSave() {
        int total = 0;
        for (Map.Entry<String, String> entry : SECTION_URLS.entrySet()) {
            String routeType   = entry.getKey();
            String sectionPath = entry.getValue();
            total += fetchSection(routeType, sectionPath);
        }
        log.info("Итого маршрутов сохранено/обновлено: {}", total);
        return total;
    }

    private int fetchSection(String routeType, String sectionPath) {
        int saved   = 0;
        int pageNum = 0;

        try {
            while (true) {
                String url = BASE_URL + sectionPath + (pageNum > 0 ? "?PAGEN_1=" + pageNum : "");
                log.info("Парсим маршруты [{}], стр. {}: {}", routeType, pageNum, url);

                Document doc = Jsoup.connect(url)
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                                + "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                        .timeout(TIMEOUT_MS)
                        .sslSocketFactory(TRUST_ALL_SSL)
                        .get();

                Elements cards = doc.select("div.places__card");

                if (cards.isEmpty()) {
                    log.info("[{}] стр. {}: карточек не найдено, останавливаем парсинг", routeType, pageNum);
                    break;
                }

                log.info("[{}] стр. {}: найдено {} карточек", routeType, pageNum, cards.size());
                for (Element card : cards) {
                    try {
                        saved += processCard(card, routeType);
                    }
                    catch (Exception e) {
                        log.warn("Ошибка обработки карточки [{}]: {}", routeType, e.getMessage());
                    }
                }

                boolean hasNext = doc.selectFirst(
                        "a.pagination-next, " +
                        "li.pager-next a, " +
                        "a[href*=\"PAGEN_1=" + (pageNum + 1) + "\"]"
                ) != null;

                if (!hasNext) {
                    log.info("[{}] Следующей страницы нет, парсинг завершён на стр. {}", routeType, pageNum);
                    break;
                }

                pageNum++;
                try {
                    Thread.sleep(500);
                }
                catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        catch (Exception e) {
            log.error("Ошибка парсинга раздела [{}]: {}", routeType, e.getMessage(), e);
        }

        return saved;
    }

    private int processCard(Element card, String routeType) {
        Element nameEl = card.selectFirst("a.places__card__name");
        if (nameEl == null)
            return 0;

        String title = nameEl.text().trim();
        if (title.isBlank())
            return 0;

        String path = nameEl.attr("href");
        if (path.isBlank())
            return 0;
        String sourceUrl = path.startsWith("http") ? path : BASE_URL + path;

        Element imgEl = card.selectFirst("img[data-splide-lazy]");
        String imageUrl = null;
        if (imgEl != null) {
            String src = imgEl.attr("data-splide-lazy");
            if (!src.isBlank()) {
                imageUrl = src.startsWith("http") ? src : BASE_URL + src;
            }
        }
        if (imageUrl == null) {
            imgEl = card.selectFirst("img");
            if (imgEl != null) {
                String src = imgEl.attr("src");
                if (!src.isBlank() && !src.contains("pixel")) {
                    imageUrl = src.startsWith("http") ? src : BASE_URL + src;
                }
            }
        }

        Element fromEl = card.selectFirst("p.places__card__from");
        String operatorName = fromEl != null ? fromEl.text().trim() : null;

        Element durEl = card.selectFirst("p.places__card__duration");
        String duration = null;
        if (durEl != null) {
            duration = durEl.text().replaceFirst("(?i)Длительность\\s*[:：]?\\s*", "").trim();
            if (duration.isBlank())
                duration = null;
        }

        Route route = routeRepository.findBySourceUrl(sourceUrl).orElseGet(Route::new);
        boolean isNew = route.getId() == null;

        route.setTitle(title);
        route.setOperatorName(operatorName);
        route.setDuration(duration);
        route.setImageUrl(imageUrl);
        route.setSourceUrl(sourceUrl);
        route.setRouteType(routeType);
        route.setParsedAt(LocalDateTime.now());

        routeRepository.save(route);
        log.debug("{}: [{}] {}", isNew ? "Сохранён" : "Обновлён", routeType, title);
        return isNew ? 1 : 0;
    }

    @Override
    public Page<RouteDto> getAll(Pageable pageable) {
        return routeRepository.findAllByOrderByIdDesc(pageable).map(this::toDto);
    }

    @Override
    public Page<RouteDto> getAllRandom(Pageable pageable) {
        return routeRepository.findAllRandom(pageable).map(this::toDto);
    }

    @Override
    public Page<RouteDto> search(String title, List<String> routeTypes, Pageable pageable) {
        String titleParam = (title != null && !title.isBlank()) ? title.trim() : null;
        List<String> types = (routeTypes != null && !routeTypes.isEmpty()) ? routeTypes : null;
        return routeRepository.search(titleParam, types, pageable).map(this::toDto);
    }

    @Override
    public RouteDetailDto getById(Long id) {
        Route route = routeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Маршрут не найден"));
        return toDetailDto(route);
    }

    private RouteDto toDto(Route r) {
        RouteDto dto = new RouteDto();
        dto.setId(r.getId());
        dto.setTitle(r.getTitle());
        dto.setOperatorName(r.getOperatorName());
        dto.setDuration(r.getDuration());
        dto.setImageUrl(r.getImageUrl());
        dto.setSourceUrl(r.getSourceUrl());
        dto.setRouteType(r.getRouteType());
        return dto;
    }

    private RouteDetailDto toDetailDto(Route r) {
        RouteDetailDto dto = new RouteDetailDto();
        dto.setId(r.getId());
        dto.setTitle(r.getTitle());
        dto.setOperatorName(r.getOperatorName());
        dto.setDuration(r.getDuration());
        dto.setImageUrl(r.getImageUrl());
        dto.setSourceUrl(r.getSourceUrl());
        dto.setRouteType(r.getRouteType());
        dto.setParsedAt(r.getParsedAt());
        return dto;
    }
}