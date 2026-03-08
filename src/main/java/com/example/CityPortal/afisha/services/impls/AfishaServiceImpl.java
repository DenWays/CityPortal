package com.example.CityPortal.afisha.services.impls;

import com.example.CityPortal.afisha.dtos.EventDetailDto;
import com.example.CityPortal.afisha.dtos.EventDto;
import com.example.CityPortal.afisha.models.Event;
import com.example.CityPortal.afisha.repository.EventRepository;
import com.example.CityPortal.afisha.services.AfishaService;
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
import java.time.LocalDate;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class AfishaServiceImpl implements AfishaService {
    private static final String BASE_URL    = "https://orb.okkassa.ru";
    private static final String CATALOG_URL = BASE_URL + "/catalog/all";
    private static final int    TIMEOUT_MS  = 15_000;
    private final EventRepository eventRepository;
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
        }
        catch (NoSuchAlgorithmException | KeyManagementException e) {
            throw new IllegalStateException("Не удалось создать TrustAll SSLContext", e);
        }
    }

    @Override
    public int fetchAndSave() {
        int saved   = 0;
        int pageNum = 0;

        try {
            while (true) {
                String url = pageNum == 0 ? CATALOG_URL : CATALOG_URL + "?page=" + pageNum;
                log.info("Парсим афишу, страница {}: {}", pageNum, url);

                Document doc = Jsoup
                        .connect(url)
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                        .timeout(TIMEOUT_MS)
                        .sslSocketFactory(TRUST_ALL_SSL)
                        .get();

                Elements cards = doc.select("div.product");

                if (cards.isEmpty()) {
                    log.info("Страница {}: карточек не найдено, останавливаем парсинг", pageNum);
                    break;
                }

                log.info("Страница {}: найдено {} карточек", pageNum, cards.size());
                for (Element card : cards) {
                    try {
                        saved += processCard(card);
                    }
                    catch (Exception e) {
                        log.warn("Ошибка обработки карточки: {}", e.getMessage());
                    }
                }

                int nextPage = pageNum + 1;
                boolean hasNext = doc.selectFirst(
                    "li.pager-next a, " +
                    "a.pager__item--next, " +
                    "li.next > a, " +
                    "a[href*=\"page=" + nextPage + "\"]"
                ) != null;

                if (!hasNext) {
                    log.info("Следующей страницы нет, парсинг завершён на странице {}", pageNum);
                    break;
                }

                pageNum++;

                try {
                    Thread.sleep(500);
                }
                catch (InterruptedException ie) {
                    Thread.currentThread().interrupt(); break;
                }
            }
        }
        catch (Exception e) {
            log.error("Ошибка парсинга orb.okkassa.ru: {}", e.getMessage(), e);
        }

        log.info("Всего мероприятий сохранено: {}", saved);
        return saved;
    }

    private int processCard(Element card) {
        Element titleLink = card.selectFirst("div.product__title a");
        if (titleLink == null)
            return 0;

        String path = titleLink.attr("href");
        String href = path.startsWith("http") ? path : BASE_URL + path;
        if (href.isBlank())
            return 0;

        String title = titleLink.text().trim();
        if (title.isBlank())
            return 0;

        Element imgEl = card.selectFirst("div.product__img img");
        String imageUrl = null;
        if (imgEl != null) {
            String src = imgEl.attr("src");
            if (!src.isBlank()) {
                imageUrl = src.startsWith("http") ? src : BASE_URL + src;
            }
        }

        Element venueEl = card.selectFirst("div.product__venue");
        String venue = venueEl != null ? venueEl.text().trim() : null;

        Element dateEl = card.selectFirst("div.product__date");
        String dateText = dateEl != null ? dateEl.text().trim() : "";
        LocalDate eventDate = parseRussianDate(dateText);

        Element priceEl = card.selectFirst("div.product__price");
        String price = null;
        if (priceEl != null) {
            priceEl.select("img").remove();
            price = priceEl.text().trim();
            if (price.isBlank())
                price = null;
        }

        Event event = eventRepository.findBySourceUrl(href).orElseGet(Event::new);
        boolean isNew = event.getId() == null;

        event.setTitle(title);
        event.setVenue(venue);
        event.setPrice(price);
        event.setImageUrl(imageUrl);
        event.setSourceUrl(href);
        event.setEventDate(eventDate != null ? eventDate : LocalDate.now());
        event.setParsedAt(LocalDateTime.now());

        eventRepository.save(event);
        log.debug("{}: {} / {} / {}", isNew ? "Сохранено" : "Обновлено", title, dateText, venue);
        return isNew ? 1 : 0;
    }

    private static final java.util.Map<String, Integer> RU_MONTHS = new java.util.HashMap<>();
    static {
        RU_MONTHS.put("января",    1);  RU_MONTHS.put("январь",   1);
        RU_MONTHS.put("февраля",   2);  RU_MONTHS.put("февраль",  2);
        RU_MONTHS.put("марта",     3);  RU_MONTHS.put("март",     3);
        RU_MONTHS.put("апреля",    4);  RU_MONTHS.put("апрель",   4);
        RU_MONTHS.put("мая",       5);  RU_MONTHS.put("май",      5);
        RU_MONTHS.put("июня",      6);  RU_MONTHS.put("июнь",     6);
        RU_MONTHS.put("июля",      7);  RU_MONTHS.put("июль",     7);
        RU_MONTHS.put("августа",   8);  RU_MONTHS.put("август",   8);
        RU_MONTHS.put("сентября",  9);  RU_MONTHS.put("сентябрь", 9);
        RU_MONTHS.put("октября",  10);  RU_MONTHS.put("октябрь", 10);
        RU_MONTHS.put("ноября",   11);  RU_MONTHS.put("ноябрь",  11);
        RU_MONTHS.put("декабря",  12);  RU_MONTHS.put("декабрь", 12);
    }

    private LocalDate parseRussianDate(String raw) {
        if (raw == null || raw.isBlank())
            return null;

        String s = raw.trim().replaceAll("^(\\d+)-\\d+(.*)$", "$1$2").trim();
        String[] parts = s.split("\\s+");
        if (parts.length < 2)
            return null;

        int day;
        try {
            day = Integer.parseInt(parts[0]);
        }
        catch (NumberFormatException e) {
            return null;
        }

        Integer month = RU_MONTHS.get(parts[1].toLowerCase());
        if (month == null)
            return null;

        int currentYear = LocalDate.now().getYear();
        int year;
        if (parts.length >= 3) {
            try {
                year = Integer.parseInt(parts[2]);
            }
            catch (NumberFormatException e) {
                year = currentYear;
            }
        }
        else {
            year = currentYear;
        }

        try {
            LocalDate d = LocalDate.of(year, month, day);
            if (parts.length < 3 && d.isBefore(LocalDate.now())) {
                d = d.withYear(currentYear + 1);
            }
            return d;
        }
        catch (Exception e) {
            log.debug("Не удалось собрать дату из: «{}»", raw);
            return null;
        }
    }

    @Override
    public Page<EventDto> getAll(Pageable pageable) {
        return eventRepository.findAllByEventDateGreaterThanEqualOrderByEventDateAsc(LocalDate.now(), pageable).map(this::toDto);
    }

    @Override
    public Page<EventDto> search(String title, String dateFrom, String dateTo, Pageable pageable) {
        String titleParam = (title != null && !title.isBlank()) ? title.trim() : null;
        LocalDate from = parseIsoDate(dateFrom);
        LocalDate to   = parseIsoDate(dateTo);
        if (from == null) {
            from = LocalDate.now();
        }
        return eventRepository.search(titleParam, from, to, pageable).map(this::toDto);
    }

    @Override
    public EventDetailDto getById(Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Мероприятие не найдено"));
        return toDetailDto(event);
    }

    private LocalDate parseIsoDate(String s) {
        if (s == null || s.isBlank())
            return null;

        try {
            return LocalDate.parse(s);
        }
        catch (Exception ignored) {}
        return null;
    }

    private EventDto toDto(Event e) {
        EventDto dto = new EventDto();
        dto.setId(e.getId());
        dto.setTitle(e.getTitle());
        dto.setVenue(e.getVenue());
        dto.setPrice(e.getPrice());
        dto.setImageUrl(e.getImageUrl());
        dto.setSourceUrl(e.getSourceUrl());
        dto.setEventDate(e.getEventDate());
        return dto;
    }

    private EventDetailDto toDetailDto(Event e) {
        EventDetailDto dto = new EventDetailDto();
        dto.setId(e.getId());
        dto.setTitle(e.getTitle());
        dto.setVenue(e.getVenue());
        dto.setPrice(e.getPrice());
        dto.setImageUrl(e.getImageUrl());
        dto.setSourceUrl(e.getSourceUrl());
        dto.setEventDate(e.getEventDate());
        dto.setParsedAt(e.getParsedAt());
        return dto;
    }
}