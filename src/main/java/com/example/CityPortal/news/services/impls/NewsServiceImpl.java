package com.example.CityPortal.news.services.impls;

import com.example.CityPortal.news.dtos.NewsDetailDto;
import com.example.CityPortal.news.dtos.NewsDto;
import com.example.CityPortal.news.models.News;
import com.example.CityPortal.news.repository.NewsRepository;
import com.example.CityPortal.news.services.NewsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.HttpStatusException;
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
import java.io.IOException;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.X509Certificate;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class NewsServiceImpl implements NewsService {
    private static final String BASE_URL  = "https://orenburg.ru";
    private static final String NEWS_URL  = BASE_URL + "/presscenter/news/";
    private static final String RSS_URL   = BASE_URL + "/rss/";
    private static final int    TIMEOUT_MS = 15_000;
    private static final int    MAX_RETRIES = 3;

    private static final List<String> USER_AGENTS = List.of(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0"
    );
    private static int uaIndex = 0;

    private static String nextUserAgent() {
        String ua = USER_AGENTS.get(uaIndex % USER_AGENTS.size());
        uaIndex++;
        return ua;
    }

    private final NewsRepository newsRepository;
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
        log.info("Запуск парсинга новостей orenburg.ru (HTML)...");
        int result = fetchHtml();
        if (result < 0) {
            log.warn("HTML-парсинг недоступен (сайт вернул 503/ошибку), пробуем RSS...");
            result = fetchRss();
            if (result < 0) {
                log.warn("RSS-парсинг тоже недоступен — пропускаем цикл");
                return 0;
            }
        }
        log.info("Всего новостей сохранено: {}", result);
        return result;
    }

    private int fetchHtml() {
        int saved = 0;
        LocalDate stopBefore = LocalDate.now().minusDays(3);
        int pageNum = 1;
        final int MAX_OLD_IN_ROW = 5;
        int oldInRow = 0;

        try {
            outer:
            while (true) {
                String url = pageNum == 1 ? NEWS_URL : NEWS_URL + "?nav-news=page-" + pageNum;
                Document listPage;
                try {
                    listPage = connectWithRetry(url);
                }
                catch (HttpStatusException hse) {
                    if (hse.getStatusCode() == 503 || hse.getStatusCode() == 429) {
                        log.warn("HTML-парсинг: сервер вернул {} на стр. {} — сайт недоступен", hse.getStatusCode(), pageNum);
                        return -1;
                    }
                    log.error("HTML-парсинг: HTTP {} на {}", hse.getStatusCode(), url);
                    break;
                }
                catch (IOException e) {
                    log.warn("HTML-парсинг: сетевая ошибка на стр. {}: {}", pageNum, e.getMessage());
                    return -1;
                }

                Elements cards = listPage.select("article.list__item");
                if (cards.isEmpty()) break;

                log.info("Страница {}: найдено карточек {}", pageNum, cards.size());

                for (Element card : cards) {
                    try {
                        Element timeEl = card.selectFirst("time[datetime]");
                        if (timeEl != null) {
                            LocalDateTime dt = parseTimeElement(timeEl);
                            if (dt != null && dt.toLocalDate().isBefore(stopBefore)) {
                                oldInRow++;
                                if (oldInRow >= MAX_OLD_IN_ROW) {
                                    log.info("{} карточек подряд старше 3 дней — останавливаем", MAX_OLD_IN_ROW);
                                    break outer;
                                }
                                continue;
                            }
                        }
                        oldInRow = 0;
                        saved += processCard(card);
                    }
                    catch (Exception e) {
                        log.warn("Ошибка обработки карточки: {}", e.getMessage());
                    }
                }

                boolean hasNext = listPage.selectFirst("a[href*=nav-news=page-" + (pageNum + 1) + "]") != null;
                if (!hasNext) break;
                pageNum++;
            }
        } catch (Exception e) {
            log.error("Непредвиденная ошибка HTML-парсинга: {}", e.getMessage(), e);
        }
        return saved;
    }

    private int fetchRss() {
        int saved = 0;
        try {
            Document rss = connectWithRetry(RSS_URL);
            Elements items = rss.select("item");
            if (items.isEmpty()) {
                log.warn("RSS: элементов <item> не найдено");
                return 0;
            }
            log.info("RSS: найдено {} элементов", items.size());
            for (Element item : items) {
                try {
                    saved += processRssItem(item);
                } catch (Exception e) {
                    log.warn("RSS: ошибка обработки item: {}", e.getMessage());
                }
            }
        }
        catch (HttpStatusException hse) {
            log.warn("RSS недоступен: HTTP {}", hse.getStatusCode());
            return -1;
        }
        catch (IOException e) {
            log.warn("RSS сетевая ошибка: {}", e.getMessage());
            return -1;
        }
        return saved;
    }

    private int processRssItem(Element item) {
        Element linkEl = item.selectFirst("link");
        String link = linkEl != null ? linkEl.text().trim() : "";
        if (link.isBlank()) link = item.select("link").text().trim();
        if (link.isBlank())
            return 0;
        if (!link.matches(".*presscenter/news/\\d+/?.*"))
            return 0;
        if (newsRepository.existsBySourceUrl(link))
            return 0;

        Element titleEl = item.selectFirst("title");
        String title = titleEl != null ? titleEl.text().trim() : "";
        if (title.isBlank())
            return 0;

        Element pubDateEl = item.selectFirst("pubDate");
        String pubDateRaw = pubDateEl != null ? pubDateEl.text().trim() : null;
        LocalDateTime publishedAt = pubDateRaw != null ? tryParseRssDate(pubDateRaw) : null;

        String description = null;
        Element descEl = item.selectFirst("description");
        if (descEl != null) {
            String raw = descEl.text().trim();
            if (!raw.isBlank())
                description = Jsoup.parse(raw).text();
        }

        String imageUrl = null;
        Element enclosure = item.selectFirst("enclosure[type^=image]");
        if (enclosure != null)
            imageUrl = enclosure.attr("url");
        if (imageUrl == null || imageUrl.isBlank()) {
            Element media = item.selectFirst("media|content, media\\:content");
            if (media != null)
                imageUrl = media.attr("url");
        }
        if (imageUrl != null && !imageUrl.isBlank() && !imageUrl.startsWith("http")) {
            imageUrl = BASE_URL + imageUrl;
        }

        News news = new News();
        news.setTitle(title);
        news.setDescription(description);
        news.setContent(null);
        news.setImageUrl(imageUrl != null && !imageUrl.isBlank() ? imageUrl : null);
        news.setSourceUrl(link);
        news.setPublishedAt(publishedAt != null ? publishedAt : LocalDateTime.now());
        news.setParsedAt(LocalDateTime.now());
        newsRepository.save(news);
        log.debug("RSS сохранено: {}", title);
        return 1;
    }

    private Document connectWithRetry(String url) throws IOException {
        IOException lastEx = null;
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return Jsoup.connect(url)
                        .userAgent(nextUserAgent())
                        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                        .header("Accept-Language", "ru-RU,ru;q=0.9,en;q=0.8")
                        .header("Referer", BASE_URL + "/")
                        .timeout(TIMEOUT_MS)
                        .sslSocketFactory(TRUST_ALL_SSL)
                        .get();
            }
            catch (HttpStatusException hse) {
                if (hse.getStatusCode() == 503 || hse.getStatusCode() == 429) throw hse;
                lastEx = hse;
                log.warn("Попытка {}/{}: HTTP {} для {}", attempt, MAX_RETRIES, hse.getStatusCode(), url);
            }
            catch (IOException e) {
                lastEx = e;
                log.warn("Попытка {}/{}: сетевая ошибка для {}: {}", attempt, MAX_RETRIES, url, e.getMessage());
            }
            if (attempt < MAX_RETRIES) {
                try {
                    Thread.sleep(1500L * attempt);
                }
                catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new IOException("Прервано", ie);
                }
            }
        }
        throw lastEx;
    }

    private LocalDateTime tryParseRssDate(String raw) {
        String[] patterns = {
            "EEE, dd MMM yyyy HH:mm:ss Z",
            "EEE, dd MMM yyyy HH:mm:ss zzz",
            "dd MMM yyyy HH:mm:ss Z"
        };
        for (String p : patterns) {
            try {
                return ZonedDateTime.parse(raw.trim(),
                        DateTimeFormatter.ofPattern(p, Locale.ENGLISH)).toLocalDateTime();
            }
            catch (DateTimeParseException ignored) {}
        }
        return tryParseDateTime(raw);
    }

    private LocalDateTime parseTimeElement(Element timeEl) {
        String dateAttr = timeEl.attr("datetime").trim();
        LocalDateTime dt = tryParseDateTime(dateAttr);
        if (dt == null)
            return null;

        if (!dateAttr.contains("T") && !dateAttr.contains(" ")) {
            String text = timeEl.text();
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d{1,2}):(\\d{2})").matcher(text);
            if (m.find()) {
                try {
                    int hour   = Integer.parseInt(m.group(1));
                    int minute = Integer.parseInt(m.group(2));
                    dt = dt.toLocalDate().atTime(hour, minute);
                }
                catch (Exception ignored) {}
            }
        }
        return dt;
    }

    @Override
    public Page<NewsDto> getAll(Pageable pageable) {
        return newsRepository.findAllByOrderByPublishedAtDesc(pageable).map(this::toDto);
    }

    @Override
    public Page<NewsDto> search(String title, String date, Pageable pageable) {
        String titleParam = (title != null && !title.isBlank()) ? title.trim() : null;
        LocalDateTime from = null;
        LocalDateTime to = null;
        if (date != null && !date.isBlank()) {
            try {
                LocalDate d = LocalDate.parse(date);
                from = d.atStartOfDay();
                to = d.plusDays(1).atStartOfDay();
            }
            catch (Exception ignored) {}
        }
        return newsRepository.search(titleParam, from, to, pageable).map(this::toDto);
    }

    @Override
    public NewsDetailDto getById(Long id) {
        News news = newsRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Новость не найдена"));
        return toDetailDto(news);
    }

    private int processCard(Element card) throws Exception {
        Element linkEl = card.selectFirst("a.list__link, a.list__photo, a[href*=/presscenter/news/]");
        if (linkEl == null)
            return 0;

        String path = linkEl.attr("href");
        String href = path.startsWith("http") ? path : BASE_URL + path;

        if (!href.matches(".*presscenter/news/\\d+/?$"))
            return 0;

        if (newsRepository.existsBySourceUrl(href))
            return 0;

        String title = card.select("h3.list__title, h2.list__title, .list__title").text();
        if (title.isBlank())
            return 0;

        LocalDateTime publishedAt = null;
        Element timeEl = card.selectFirst("time[datetime]");
        if (timeEl != null) {
            publishedAt = parseTimeElement(timeEl);
        }

        String cardImageUrl = null;
        Element pictureEl = card.selectFirst("picture");
        if (pictureEl != null) {
            Elements sources = pictureEl.select("source[srcset]");
            if (!sources.isEmpty()) {
                cardImageUrl = lastSrcsetCandidate(sources.last().attr("srcset"));
            }
            if (cardImageUrl == null) {
                Element imgEl = pictureEl.selectFirst("img[srcset]");
                if (imgEl != null)
                    cardImageUrl = lastSrcsetCandidate(imgEl.attr("srcset"));
            }
            if (cardImageUrl == null) {
                Element imgEl = pictureEl.selectFirst("img[src]");
                if (imgEl != null) {
                    String src = imgEl.attr("src");
                    if (!src.isBlank())
                        cardImageUrl = src.startsWith("http") ? src : BASE_URL + src;
                }
            }
        }
        if (cardImageUrl == null) {
            Element imgEl = card.selectFirst("img.list__photo-image, .list__photo img, img[src]");
            if (imgEl != null) {
                String srcset = imgEl.attr("srcset");
                if (!srcset.isBlank())
                    cardImageUrl = lastSrcsetCandidate(srcset);
                if (cardImageUrl == null) {
                    String src = imgEl.attr("src");
                    if (!src.isBlank())
                        cardImageUrl = src.startsWith("http") ? src : BASE_URL + src;
                }
            }
        }

        Document articleDoc = connectWithRetry(href);

        String content = null;
        Element textEl = articleDoc.selectFirst("div.detail__text");
        if (textEl != null)
            content = textEl.html();

        String description = null;
        if (textEl != null) {
            Element firstP = textEl.selectFirst("p");
            if (firstP != null)
                description = firstP.text();
        }

        String imageUrl = null;
        Element detailPicture = articleDoc.selectFirst(".detail__photos picture, .detail__aside picture");
        if (detailPicture != null) {
            Elements sources = detailPicture.select("source[srcset]");
            if (!sources.isEmpty()) {
                imageUrl = lastSrcsetCandidate(sources.last().attr("srcset"));
            }

            if (imageUrl == null) {
                Element detailImg = detailPicture.selectFirst("img[srcset]");
                if (detailImg != null)
                    imageUrl = lastSrcsetCandidate(detailImg.attr("srcset"));
            }

            if (imageUrl == null) {
                Element detailImg = detailPicture.selectFirst("img[src]");
                if (detailImg != null) {
                    String src = detailImg.attr("src");
                    if (!src.isBlank())
                        imageUrl = src.startsWith("http") ? src : BASE_URL + src;
                }
            }
        }

        if (imageUrl == null) {
            Element detailImg = articleDoc.selectFirst("img.detail__main-photo");
            if (detailImg != null) {
                String srcset = detailImg.attr("srcset");
                if (!srcset.isBlank())
                    imageUrl = lastSrcsetCandidate(srcset);
                if (imageUrl == null) {
                    String src = detailImg.attr("src");
                    if (!src.isBlank())
                        imageUrl = src.startsWith("http") ? src : BASE_URL + src;
                }
            }
        }

        if (imageUrl == null) {
            imageUrl = cardImageUrl;
        }


        if (publishedAt == null) {
            Element detailTime = articleDoc.selectFirst("time[datetime]");
            if (detailTime != null)
                publishedAt = parseTimeElement(detailTime);
        }

        News news = new News();
        news.setTitle(title.trim());
        news.setDescription(description);
        news.setContent(content);
        news.setImageUrl(imageUrl);
        news.setSourceUrl(href);
        news.setPublishedAt(publishedAt != null ? publishedAt : LocalDateTime.now());
        news.setParsedAt(LocalDateTime.now());

        newsRepository.save(news);
        return 1;
    }

    private String lastSrcsetCandidate(String srcset) {
        if (srcset == null || srcset.isBlank())
            return null;

        String[] parts = srcset.split(",");
        String candidate = parts[parts.length - 1].trim().split("\\s+")[0];
        if (candidate.isBlank())
            return null;

        return candidate.startsWith("http") ? candidate : BASE_URL + candidate;
    }

    private LocalDateTime tryParseDateTime(String raw) {
        if (raw == null || raw.isBlank())
            return null;
        String s = raw.trim();
        Locale ru = Locale.forLanguageTag("ru");

        for (String p : new String[]{"yyyy-MM-dd'T'HH:mm:ssXXX", "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"}) {
            try {
                return ZonedDateTime.parse(s, DateTimeFormatter.ofPattern(p, ru)).toLocalDateTime();
            }
            catch (DateTimeParseException ignored) {}
        }

        for (String p : new String[]{
                "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd'T'HH:mm",
                "yyyy-MM-dd HH:mm:ss",   "yyyy-MM-dd HH:mm",
                "dd MMMM yyyy HH:mm",    "dd.MM.yyyy HH:mm"}) {
            try {
                return LocalDateTime.parse(s, DateTimeFormatter.ofPattern(p, ru));
            }
            catch (DateTimeParseException ignored) {}
        }

        for (String p : new String[]{"yyyy-MM-dd", "dd MMMM yyyy", "dd.MM.yyyy"}) {
            try {
                return LocalDate.parse(s, DateTimeFormatter.ofPattern(p, ru)).atStartOfDay();
            }
            catch (DateTimeParseException ignored) {}
        }

        return null;
    }

    private NewsDto toDto(News n) {
        NewsDto dto = new NewsDto();
        dto.setId(n.getId());
        dto.setTitle(n.getTitle());
        dto.setDescription(n.getDescription());
        dto.setImageUrl(n.getImageUrl());
        dto.setSourceUrl(n.getSourceUrl());
        dto.setPublishedAt(n.getPublishedAt());
        return dto;
    }

    private NewsDetailDto toDetailDto(News n) {
        NewsDetailDto dto = new NewsDetailDto();
        dto.setId(n.getId());
        dto.setTitle(n.getTitle());
        dto.setDescription(n.getDescription());
        dto.setContent(n.getContent());
        dto.setImageUrl(n.getImageUrl());
        dto.setSourceUrl(n.getSourceUrl());
        dto.setPublishedAt(n.getPublishedAt());
        dto.setParsedAt(n.getParsedAt());
        return dto;
    }
}