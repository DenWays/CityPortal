package com.example.CityPortal.venue.services.impls;

import com.example.CityPortal.venue.models.Venue;
import com.example.CityPortal.venue.models.VenueReview;
import com.example.CityPortal.venue.repository.VenueRepository;
import com.example.CityPortal.venue.repository.VenueReviewRepository;
import io.github.bonigarcia.wdm.WebDriverManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class YandexMapsScraperService {
    private final VenueRepository venueRepository;
    private final VenueReviewRepository venueReviewRepository;

    @Value("${venue.scraper.headless:false}")
    private boolean headless;

    @Value("${venue.scraper.chrome-profile:}")
    private String chromeProfilePath;

    @Value("${venue.scraper.chrome-profile-name:Default}")
    private String chromeProfileName;

    private boolean isCaptchaPage(ChromeDriver driver) {
        try {
            String title = driver.getTitle();
            String bodyText = driver.findElement(By.tagName("body")).getText();
            return (title != null && title.toLowerCase().contains("подтвердите"))
                || bodyText.contains("Подтвердите, что запросы отправляли вы")
                || bodyText.contains("подозрительные запросы")
                || driver.getCurrentUrl().contains("showcaptcha");
        }
        catch (Exception e) {
            return false;
        }
    }

    private ChromeOptions buildChromeOptions() {
        ChromeOptions options = new ChromeOptions();
        boolean useProfile = chromeProfilePath != null && !chromeProfilePath.isBlank();
        Path tempProfileDir = null;

        if (useProfile) {
            try {
                tempProfileDir = copyProfileToTemp(chromeProfilePath, chromeProfileName);
                if (tempProfileDir != null) {
                    options.addArguments("--user-data-dir=" + tempProfileDir.toAbsolutePath());
                    options.addArguments("--profile-directory=Profile");
                    log.info("Используем временный профиль Chrome: {}", tempProfileDir);
                }
            }
            catch (Exception e) {
                log.warn("Не удалось скопировать профиль Chrome: {}", e.getMessage());
            }
        }

        if (!useProfile && headless) {
            options.addArguments("--headless=new");
        }

        options.addArguments(
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--window-size=1440,900",
            "--lang=ru-RU",
            "--disable-popup-blocking",
            "--disable-infobars"
        );
        options.addArguments("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36");
        options.setExperimentalOption("excludeSwitches", List.of("enable-automation"));
        options.setExperimentalOption("useAutomationExtension", false);

        if (tempProfileDir != null) {
            final Path toDelete = tempProfileDir;
            Thread cleanupThread = new Thread(() -> {
                try {
                    Thread.sleep(600_000);
                }
                catch (InterruptedException ignored) {}
                deleteDir(toDelete);
            });
            cleanupThread.setDaemon(true);
            cleanupThread.start();
        }

        return options;
    }

    private Path copyProfileToTemp(String profileDir, String profileName) throws IOException {
        Path src = Paths.get(profileDir, profileName);
        if (!Files.exists(src)) {
            log.warn("Профиль Chrome не найден: {}", src);
            return null;
        }
        Path tempBase = Files.createTempDirectory("chrome-scraper-");
        Path destProfile = tempBase.resolve("Profile");
        Files.createDirectories(destProfile);

        String[] importantFiles = {"Cookies", "Local Storage", "Session Storage",
                                   "Web Data", "Preferences", "Secure Preferences"};
        for (String fname : importantFiles) {
            Path srcFile = src.resolve(fname);
            if (Files.exists(srcFile)) {
                Path destFile = destProfile.resolve(fname);
                if (Files.isDirectory(srcFile)) {
                    copyDir(srcFile, destFile);
                }
                else {
                    try {
                        Files.copy(srcFile, destFile, StandardCopyOption.REPLACE_EXISTING);
                    }
                    catch (IOException e) {
                        log.debug("Не удалось скопировать {}: {}", fname, e.getMessage());
                    }
                }
            }
        }
        return tempBase;
    }

    private void copyDir(Path src, Path dest) throws IOException {
        Files.walkFileTree(src, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                Files.createDirectories(dest.resolve(src.relativize(dir)));
                return FileVisitResult.CONTINUE;
            }
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                try {
                    Files.copy(file, dest.resolve(src.relativize(file)), StandardCopyOption.REPLACE_EXISTING);
                }
                catch (IOException ignored) {}

                return FileVisitResult.CONTINUE;
            }
        });
    }

    private void deleteDir(Path dir) {
        try {
            if (dir == null || !Files.exists(dir))
                return;
            Files.walkFileTree(dir, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    try {
                        Files.delete(file);
                    }
                    catch (IOException ignored) {}

                    return FileVisitResult.CONTINUE;
                }
                @Override
                public FileVisitResult postVisitDirectory(Path d, IOException exc) {
                    try {
                        Files.delete(d);
                    }
                    catch (IOException ignored) {}

                    return FileVisitResult.CONTINUE;
                }
            });
        }
        catch (Exception ignored) {}
    }

    @Transactional
    public Venue scrapeByDirectUrl(String yandexOrgUrl, String venueName, String address, Double lat, Double lon) {
        log.info("Скрапинг по прямой ссылке: {}", yandexOrgUrl);

        WebDriverManager.chromedriver().setup();
        ChromeDriver driver = new ChromeDriver(buildChromeOptions());
        try {
            Venue venue = new Venue();
            venue.setName(venueName);
            venue.setAddress(address);
            venue.setLatitude(lat);
            venue.setLongitude(lon);
            venue.setYandexUrl(yandexOrgUrl);

            driver.get(yandexOrgUrl);
            log.info("Страница открыта, ждём 7с...");
            sleep(7000);

            if (isCaptchaPage(driver)) {
                log.warn("КАПЧА! Текущий URL: {}", driver.getCurrentUrl());
                savePageHtml(driver, "yandex_captcha.html");
                sleep(10000);
                if (isCaptchaPage(driver)) {
                    throw new RuntimeException("Яндекс заблокировал запрос капчей.");
                }
            }

            log.info("Текущий URL после загрузки: {}", driver.getCurrentUrl());
            log.info("Title страницы: {}", driver.getTitle());
            boolean cardLoaded = waitForCard(driver, 20);
            if (!cardLoaded) {
                log.warn("Карточка не найдена за 20с - сохраняем HTML");
                savePageHtml(driver, "yandex_card_fail.html");
            }
            else {
                log.info("Карточка найдена: {}", driver.getCurrentUrl());
            }

            savePageHtml(driver, "yandex_page_loaded.html");
            sleep(2000);

            extractVenueData(driver, venue);
            log.info("Извлечено: name='{}', category='{}', rating='{}', phone='{}', address='{}'",
                venue.getName(), venue.getCategory(), venue.getRating(),
                venue.getPhone(), venue.getAddress());

            if (venue.getName() != null && (
                venue.getName().toLowerCase().contains("подтвердите")
                || venue.getName().toLowerCase().contains("робот")
                || venue.getName().toLowerCase().contains("captcha"))) {
                throw new RuntimeException("Яндекс показал капчу вместо карточки. Название: " + venue.getName());
            }

            String currentUrl = driver.getCurrentUrl();
            if (currentUrl != null && currentUrl.contains("yandex.ru/maps")) {
                venue.setYandexUrl(currentUrl);
            }
            venue.setScrapedAt(LocalDateTime.now());

            Venue savedVenue = venueRepository.findByLatitudeAndLongitude(lat, lon).orElse(null);
            if (savedVenue != null) {
                if (venue.getName() != null && !venue.getName().isBlank())
                    savedVenue.setName(venue.getName());
                if (venue.getAddress() != null && !venue.getAddress().isBlank())
                    savedVenue.setAddress(venue.getAddress());
                if (venue.getPhone() != null)
                    savedVenue.setPhone(venue.getPhone());
                if (venue.getRating() != null)
                    savedVenue.setRating(venue.getRating());
                if (venue.getCategory() != null)
                    savedVenue.setCategory(venue.getCategory());
                if (venue.getDescription() != null)
                    savedVenue.setDescription(venue.getDescription());

                savedVenue.setYandexUrl(venue.getYandexUrl());
                savedVenue.setScrapedAt(venue.getScrapedAt());
            }
            else {
                savedVenue = venue;
            }
            savedVenue = venueRepository.save(savedVenue);
            log.info("✅ Venue сохранён: id={}, name='{}'", savedVenue.getId(), savedVenue.getName());

            List<VenueReview> reviews = scrapeReviews(driver, savedVenue);
            if (!reviews.isEmpty()) {
                venueReviewRepository.deleteByVenueId(savedVenue.getId());
                venueReviewRepository.saveAll(reviews);
                log.info("✅ Сохранено {} отзывов для venue id={}", reviews.size(), savedVenue.getId());
            }
            else {
                log.warn("Отзывы не найдены для venue id={}", savedVenue.getId());
            }

            return savedVenue;
        }
        finally {
            try {
                driver.quit();
            }
            catch (Exception e) {
                log.warn("Ошибка закрытия WebDriver: {}", e.getMessage());
            }
        }
    }

    @Transactional
    public Venue scrapeAndSave(String venueName, String address, Double lat, Double lon) {
        log.info("Начинаем скрапинг Яндекс Карт для: '{}', адрес: '{}'", venueName, address);

        WebDriverManager.chromedriver().setup();
        ChromeDriver driver = new ChromeDriver(buildChromeOptions());
        try {
            return doScrape(driver, venueName, address, lat, lon);
        }
        finally {
            try {
                driver.quit();
            }
            catch (Exception e) {
                log.warn("Ошибка закрытия WebDriver: {}", e.getMessage());
            }
        }
    }

    private Venue doScrape(ChromeDriver driver, String venueName, String address, Double lat, Double lon) {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));

        String searchQuery = buildSearchQuery(venueName, address);
        String encodedQuery = encodeUrl(searchQuery);
        String url = "https://yandex.ru/maps/56/orenburg/?text=" + encodedQuery;
        log.info("Поисковый запрос: '{}', URL: {}", searchQuery, url);

        Venue venue = new Venue();
        venue.setName(venueName);
        venue.setAddress(address);
        venue.setLatitude(lat);
        venue.setLongitude(lon);
        venue.setYandexUrl(url);

        driver.get(url);
        sleep(4000);

        if (isCaptchaPage(driver)) {
            log.warn("Яндекс показал капчу при поиске '{}'!", searchQuery);
            savePageHtml(driver, "yandex_captcha.html");
            throw new RuntimeException("Яндекс заблокировал запрос капчей. Настройте профиль Chrome в application.yml.");
        }

        boolean cardOpened = false;
        try {
            List<WebElement> directCard = driver.findElements(
                By.cssSelector("[class*='card-title-view__title'], [class*='orgpage-header-view__name']")
            );
            if (!directCard.isEmpty()) {
                log.info("Карточка организации открылась сразу");
                cardOpened = true;
            }
        }
        catch (Exception ignored) {}

        if (!cardOpened) {
            try {
                WebElement firstResult = wait.until(ExpectedConditions.presenceOfElementLocated(
                    By.cssSelector(
                        "li.search-snippet-view, " +
                        "[class*='search-snippet-view'], " +
                        "[class*='serp-item_type_business']"
                    )
                ));

                log.info("Найден первый результат, кликаем...");
                firstResult.click();
                sleep(3000);
            }
            catch (Exception e) {
                log.warn("Не нашли список результатов: {}", e.getMessage());
            }
        }

        extractVenueData(driver, venue);

        String currentUrl = driver.getCurrentUrl();
        if (currentUrl != null && currentUrl.contains("yandex.ru/maps")) {
            venue.setYandexUrl(currentUrl);
        }
        venue.setScrapedAt(LocalDateTime.now());

        Venue savedVenue = venueRepository.findByLatitudeAndLongitude(lat, lon).orElse(venue);
        if (savedVenue.getId() != null) {
            savedVenue.setName(venue.getName());
            savedVenue.setAddress(venue.getAddress());
            savedVenue.setPhone(venue.getPhone());
            savedVenue.setRating(venue.getRating());
            savedVenue.setCategory(venue.getCategory());
            savedVenue.setDescription(venue.getDescription());
            savedVenue.setYandexUrl(venue.getYandexUrl());
            savedVenue.setScrapedAt(venue.getScrapedAt());
        }
        else {
            savedVenue = venue;
        }
        savedVenue = venueRepository.save(savedVenue);
        log.info("Venue сохранён: id={}, name={}", savedVenue.getId(), savedVenue.getName());

        List<VenueReview> reviews = scrapeReviews(driver, savedVenue);
        if (!reviews.isEmpty()) {
            venueReviewRepository.deleteByVenueId(savedVenue.getId());
            venueReviewRepository.saveAll(reviews);
            log.info("Сохранено {} отзывов для venue id={}", reviews.size(), savedVenue.getId());
        }

        return savedVenue;
    }

    private boolean waitForCard(ChromeDriver driver, int seconds) {
        try {
            new WebDriverWait(driver, Duration.ofSeconds(seconds)).until(
                ExpectedConditions.presenceOfElementLocated(By.cssSelector(
                    "[class*='tabs-select-view'], " +
                    "[class*='tabs-select'], " +
                    "[class*='orgpage-header-view__name'], " +
                    "[class*='card-title-view__title'], " +
                    "[class*='orgpage-header-view'], " +
                    "[class*='business-card-title'], " +
                    "[class*='business-header-title'], " +
                    "h1"
                ))
            );

            return true;
        }
        catch (Exception e) {
            return false;
        }
    }

    private void extractVenueData(ChromeDriver driver, Venue venue) {
        try {
            String name = findTextFirst(driver,
                "[class*='orgpage-header-view__name']",
                "[class*='card-title-view__title']",
                "h1[class*='business-card']",
                "h1[class*='orgpage']",
                "h1"
            );

            if (name != null && !name.isBlank()) {
                venue.setName(name.trim());
                log.info("  name='{}'", venue.getName());
            }
            else {
                log.warn("  name: не найдено");
            }
        }
        catch (Exception e) {
            log.debug("Название: {}", e.getMessage());
        }

        try {
            String cat = (String) ((JavascriptExecutor) driver).executeScript(
                "var els = document.querySelectorAll('[class*=\"business-categories-view__category\"]');" +
                "if (els.length > 0) { return Array.from(els).map(e => e.textContent.trim()).filter(t => t.length > 0).join(', '); }" +
                "var bc = document.querySelectorAll('[class*=\"breadcrumbs\"] a, [class*=\"breadcrumb\"] a');" +
                "if (bc.length > 0) { return Array.from(bc).map(e => e.textContent.trim()).filter(t => t.length > 0 && !t.toLowerCase().includes('яндекс') && !t.toLowerCase().includes('карт') && !t.toLowerCase().includes('оренбург')).join(', '); }" +
                "var scripts = document.querySelectorAll('script');" +
                "for (var s of scripts) {" +
                "  var txt = s.textContent || '';" +
                "  var m = txt.match(/\"rubrics\":\\s*\\[.*?\\{.*?\"name\":\\s*\"([^\"]+)\"/);" +
                "  if (m) return m[1];" +
                "}" +
                "return null;"
            );
            if (cat != null && !cat.isBlank()) {
                venue.setCategory(cat.trim());
                log.info("  category='{}'", venue.getCategory());
            }
            else {
                String title = driver.getTitle();

                if (title != null && title.contains(",")) {
                    String afterComma = title.substring(title.indexOf(",") + 1).trim();
                    afterComma = afterComma.split("[,—–]")[0].trim();

                    if (!afterComma.isBlank() && afterComma.length() < 60) {
                        venue.setCategory(afterComma);
                        log.info("  category (from title)='{}'", venue.getCategory());
                    }
                }
            }
        }
        catch (Exception e) {
            log.debug("Категория: {}", e.getMessage());
        }

        try {
            String rating = (String) ((JavascriptExecutor) driver).executeScript(
                "var meta = document.querySelector('meta[itemprop=\"ratingValue\"]');" +
                "if (meta) return meta.getAttribute('content');" +
                "var spans = document.querySelectorAll('[class*=\"rating-badge__rating\"], [class*=\"business-summary-rating-badge__rating\"], [class*=\"orgpage-header-view__rating\"]');" +
                "for (var s of spans) { var t = s.textContent.trim(); if (t && /^[0-9][.,][0-9]$/.test(t)) return t; }" +
                "return null;"
            );
            if (rating != null && !rating.isBlank()) {
                venue.setRating(rating.trim().replace(',', '.'));
                log.info("  rating='{}'", venue.getRating());
            }
        }
        catch (Exception e) {
            log.debug("Рейтинг: {}", e.getMessage());
        }

        try {
            String addr = findTextFirst(driver,
                "[itemprop='streetAddress']",
                "[class*='orgpage-contacts-view__address']",
                "[class*='business-contacts-view'] [class*='address']",
                "[class*='contact-item_type_address'] [class*='contact-item__text']",
                "[class*='card-contact-view_type_address'] span"
            );
            if (addr != null && !addr.isBlank()) {
                venue.setAddress(addr.trim());
                log.info("  address='{}'", venue.getAddress());
            }
        }
        catch (Exception e) {
            log.debug("Адрес: {}", e.getMessage());
        }

        try {
            List<WebElement> phoneLinks = driver.findElements(By.cssSelector("a[href^='tel:']"));

            if (!phoneLinks.isEmpty()) {
                String href = phoneLinks.get(0).getAttribute("href");
                String phone = (href != null && href.startsWith("tel:")) ? href.substring(4) : phoneLinks.get(0).getText().trim();

                if (!phone.isBlank()) {
                    venue.setPhone(phone.trim());
                    log.info("  phone (direct)='{}'", venue.getPhone());
                }
            }

            if (venue.getPhone() == null) {
                List<WebElement> showPhoneBtns = driver.findElements(By.cssSelector(
                    "[class*='business-contacts-view__show-phones'], " +
                    "[class*='orgpage-contacts-view__show-phone'], " +
                    "button[class*='show-phone'], " +
                    "[class*='phone-show'], " +
                    "[class*='contact-item_type_phone'] button"
                ));

                if (showPhoneBtns.isEmpty()) {
                    showPhoneBtns = driver.findElements(By.xpath(
                        "//*[contains(text(),'Показать телефон') or contains(text(),'показать телефон') or contains(text(),'Показать номер')]"
                    ));
                }

                if (!showPhoneBtns.isEmpty()) {
                    ((JavascriptExecutor) driver).executeScript("arguments[0].click();", showPhoneBtns.get(0));
                    sleep(1500);
                    phoneLinks = driver.findElements(By.cssSelector("a[href^='tel:']"));

                    if (!phoneLinks.isEmpty()) {
                        String href = phoneLinks.get(0).getAttribute("href");
                        String phone = (href != null && href.startsWith("tel:")) ? href.substring(4) : phoneLinks.get(0).getText().trim();

                        if (!phone.isBlank()) {
                            venue.setPhone(phone.trim());
                            log.info("  phone (after click)='{}'", venue.getPhone());
                        }
                    }
                }
            }

            if (venue.getPhone() == null) {
                String phone = (String) ((JavascriptExecutor) driver).executeScript(
                    "var scripts = document.querySelectorAll('script');" +
                    "for (var s of scripts) {" +
                    "  var txt = s.textContent || '';" +
                    "  var m = txt.match(/\"phones\":\\s*\\[\\s*\\{[^}]*\"formatted\":\\s*\"([^\"]+)\"/);" +
                    "  if (m) return m[1];" +
                    "  var m2 = txt.match(/\\+7[\\s\\-\\(]?[\\d\\s\\-\\(\\)]{9,15}/);" +
                    "  if (m2) return m2[0];" +
                    "}" +
                    "return null;"
                );

                if (phone != null && !phone.isBlank()) {
                    venue.setPhone(phone.trim());
                    log.info("  phone (from JS)='{}'", venue.getPhone());
                }
            }
        }
        catch (Exception e) {
            log.debug("Телефон: {}", e.getMessage());
        }

        try {
            String desc = (String) ((JavascriptExecutor) driver).executeScript(
                "var scripts = document.querySelectorAll('script');" +
                "for (var s of scripts) {" +
                "  var txt = s.textContent || '';" +
                "  var m = txt.match(/\"previewData\":\\s*\\{[^}]*\"description\":\\s*\"([^\"]+)\"/);" +
                "  if (m) return m[1];" +
                "}" +
                "var el = document.querySelector('[class*=\"business-description-view__text\"], [class*=\"orgpage-info-view__description\"], [class*=\"orgpage-description\"]');" +
                "return el ? el.textContent.trim() : null;"
            );

            if (desc != null && !desc.isBlank()) {
                venue.setDescription(desc.trim());
                log.info("  description='{}'", desc.substring(0, Math.min(80, desc.length())));
            }
        }
        catch (Exception e) {
            log.debug("Описание: {}", e.getMessage());
        }
    }

    private String findTextFirst(WebDriver driver, String... selectors) {
        for (String sel : selectors) {
            try {
                List<WebElement> els = driver.findElements(By.cssSelector(sel));
                for (WebElement el : els) {
                    String t = el.getText().trim();
                    if (!t.isEmpty()) {
                        log.debug("  [{}] → '{}'", sel, t.substring(0, Math.min(60, t.length())));
                        return t;
                    }
                }
            }
            catch (Exception ignored) {}
        }
        return null;
    }

    private List<VenueReview> scrapeReviews(ChromeDriver driver, Venue venue) {
        List<VenueReview> reviews = new ArrayList<>();
        try {
            WebElement panel = findScrollablePanel(driver);
            log.info(panel != null ? "Найдена прокручиваемая панель" : "Панель не найдена - скроллим window");

            boolean clickedReviewTab = clickReviewsTab(driver);
            if (clickedReviewTab) {
                log.info("Вкладка отзывов нажата, ждём загрузки...");
                sleep(3000);
                panel = findScrollablePanel(driver);
            }
            else {
                log.warn("Вкладка отзывов не найдена - пробуем скроллить вниз");
            }

            scrollToLoadReviews(driver, panel, 10);
            boolean reviewsVisible = waitForReviews(driver, 12);

            if (!reviewsVisible) {
                log.warn("Отзывы не появились за 12с - пробуем ещё прокрутить");
                scrollToLoadReviews(driver, panel, 5);
                reviewsVisible = waitForReviews(driver, 8);
            }
            if (!reviewsVisible) {
                log.warn("Отзывы так и не появились - сохраняем HTML для диагностики");
                savePageHtml(driver, "yandex_reviews_fail.html");
            } else {
                log.info("Отзывы появились в DOM, продолжаем прокрутку...");
                scrollToLoadReviews(driver, panel, 8);
            }
            expandAllReviews(driver);

            List<WebElement> reviewCards = findReviewCards(driver);
            if (reviewCards.isEmpty()) {
                log.warn("Карточки отзывов не найдены ни одним селектором");
                savePageHtml(driver, "yandex_no_reviews.html");
            }
            else {
                log.info("Найдено {} карточек отзывов", reviewCards.size());
            }

            java.util.Set<String> seenTexts = new java.util.HashSet<>();
            for (WebElement card : reviewCards) {
                try {
                    VenueReview review = parseReviewCard(driver, card, venue);
                    if (review == null)
                        continue;

                    String text = review.getText();
                    if (text == null || text.isBlank())
                        continue;
                    String[] words = text.trim().split("\\s+");
                    if (words.length < 5) {
                        log.debug("Отзыв слишком короткий ({} слов), пропускаем: '{}'", words.length, text);
                        continue;
                    }

                    String textLower = text.toLowerCase();
                    if (textLower.contains("знаток города") || textLower.contains("знаток местных мест")
                            || textLower.contains("уровня") && textLower.contains("знаток")) {
                        log.debug("Пропускаем псевдо-отзыв (статус пользователя): '{}'", text);
                        continue;
                    }

                    String author = review.getAuthor();
                    if (author != null && !author.isBlank()) {
                        String authorLower = author.toLowerCase().trim();
                        if (textLower.startsWith(authorLower)) {
                            log.debug("Пропускаем текст, начинающийся с имени автора: '{}'", text);
                            continue;
                        }
                    }

                    String normalizedText = text.toLowerCase().replaceAll("\\s+", " ").trim();
                    if (seenTexts.contains(normalizedText)) {
                        log.debug("Дубликат отзыва, пропускаем: '{}'", text.substring(0, Math.min(60, text.length())));
                        continue;
                    }
                    seenTexts.add(normalizedText);

                    reviews.add(review);
                }
                catch (Exception e) {
                    log.debug("Ошибка обработки карточки отзыва: {}", e.getMessage());
                }
            }

            log.info("Итого распарсено {} отзывов с текстом (дубликаты и короткие отфильтрованы)", reviews.size());
        }
        catch (Exception e) {
            log.warn("Ошибка скрапинга отзывов: {}", e.getMessage(), e);
        }
        return reviews;
    }

    private WebElement findScrollablePanel(ChromeDriver driver) {
        String[] panelSelectors = {
            ".scroll__content",
            "[class*='scroll__content']",
            "[class*='sidebar-panel__content']",
            "[class*='card-panel__content']",
            "[class*='orgpage__panel']",
            "[class*='panel-content']",
            "[class*='business-card-panel']",
        };
        for (String sel : panelSelectors) {
            try {
                List<WebElement> els = driver.findElements(By.cssSelector(sel));
                for (WebElement el : els) {
                    if (el.isDisplayed()) {
                        Long height = (Long) ((JavascriptExecutor) driver)
                            .executeScript("return arguments[0].scrollHeight;", el);
                        if (height != null && height > 300) {
                            return el;
                        }
                    }
                }
            }
            catch (Exception ignored) {}
        }

        try {
            Object result = ((JavascriptExecutor) driver).executeScript(
                "var all = document.querySelectorAll('*');" +
                "var best = null, bestH = 0;" +
                "for (var i = 0; i < all.length; i++) {" +
                "  var s = window.getComputedStyle(all[i]);" +
                "  var overflow = s.overflow + s.overflowY;" +
                "  if (overflow.includes('auto') || overflow.includes('scroll')) {" +
                "    var sh = all[i].scrollHeight;" +
                "    if (sh > bestH && sh > 400) { bestH = sh; best = all[i]; }" +
                "  }" +
                "}" +
                "return best;"
            );

            if (result instanceof WebElement) {
                log.info("Панель найдена через JS (scrollHeight={})",
                    ((JavascriptExecutor) driver).executeScript("return arguments[0].scrollHeight;", result));
                return (WebElement) result;
            }
        }
        catch (Exception ignored) {}
        return null;
    }

    private boolean clickReviewsTab(ChromeDriver driver) {
        sleep(2000);

        String[] xpathExprs = {
            "//*[contains(normalize-space(.),'Отзывы') and (self::a or self::button or self::li or self::span or self::div) and not(.//*[contains(normalize-space(.),'Отзывы')])]",
            "//*[starts-with(normalize-space(text()),'Отзывы')]",
            "//*[normalize-space(text())='Отзывы']"
        };

        for (String xpath : xpathExprs) {
            try {
                List<WebElement> els = driver.findElements(By.xpath(xpath));
                for (WebElement el : els) {
                    try {
                        if (!el.isDisplayed())
                            continue;
                        String text = el.getText().trim();
                        if (!text.toLowerCase().contains("отзыв"))
                            continue;
                        log.info("Найдена вкладка отзывов (xpath): tag={}, text='{}'", el.getTagName(), text);
                        scrollToElement(driver, el);
                        sleep(400);
                        try {
                            el.click();
                        }
                        catch (Exception ex) {
                            ((JavascriptExecutor) driver).executeScript("arguments[0].click();", el);
                        }
                        return true;
                    }
                    catch (Exception ignored) {}
                }
            }
            catch (Exception ignored) {}
        }

        String[] tabCssSelectors = {
            "[class*='tabs-select-view__title']",
            "[class*='tabs-select-view__tab']",
            "[class*='business-header-tab']",
            "[class*='orgpage-header-view__tab']",
            "[class*='header-tab']",
            "li[class*='tab']",
            "button[class*='tab']",
            "a[class*='tab']",
            "[role='tab']"
        };
        for (String sel : tabCssSelectors) {
            try {
                List<WebElement> tabs = driver.findElements(By.cssSelector(sel));
                for (WebElement tab : tabs) {
                    try {
                        if (!tab.isDisplayed())
                            continue;
                        String text = tab.getText().toLowerCase().trim();
                        if (!text.contains("отзыв"))
                            continue;

                        log.info("Найдена вкладка отзывов (css={}): '{}'", sel, tab.getText().trim());

                        scrollToElement(driver, tab);
                        sleep(400);
                        try {
                            tab.click();
                        }
                        catch (Exception ex) {
                            ((JavascriptExecutor) driver).executeScript("arguments[0].click();", tab);
                        }
                        return true;
                    }
                    catch (Exception ignored) {}
                }
            }
            catch (Exception ignored) {}
        }

        log.warn("Вкладка отзывов не найдена");
        return false;
    }

    private void scrollToElement(ChromeDriver driver, WebElement el) {
        try {
            ((JavascriptExecutor) driver).executeScript(
                "arguments[0].scrollIntoView({block: 'center', behavior: 'smooth'});", el);
            sleep(300);
        }
        catch (Exception ignored) {}
    }

    private boolean waitForReviews(ChromeDriver driver, int seconds) {
        try {
            new WebDriverWait(driver, Duration.ofSeconds(seconds)).until(
                ExpectedConditions.presenceOfElementLocated(By.cssSelector(
                    "[class*='business-review-view'], " +
                    "[class*='orgpage-review-view'], " +
                    "[class*='review-view']"
                ))
            );
            return true;
        }
        catch (Exception e) {
            return false;
        }
    }

    private void scrollToLoadReviews(ChromeDriver driver, WebElement panel, int times) {
        for (int i = 0; i < times; i++) {
            try {
                if (panel != null) {
                    ((JavascriptExecutor) driver).executeScript(
                        "arguments[0].scrollTop = arguments[0].scrollTop + 800;", panel
                    );
                }
                else {
                    ((JavascriptExecutor) driver).executeScript(
                        "window.scrollBy(0, 800);"
                    );
                }
                sleep(900);
            }
            catch (Exception ignored) { break; }
        }

        sleep(1000);
    }

    private void expandAllReviews(ChromeDriver driver) {
        try {
            List<WebElement> expandBtns = driver.findElements(By.cssSelector(
                "[class*='business-review-view__expand'], " +
                "[class*='more-link'], " +
                "span[class*='more'], " +
                "button[class*='expand'], " +
                "[class*='read-more'], " +
                "[class*='spoiler__button']"
            ));
            int expanded = 0;
            for (WebElement btn : expandBtns) {
                try {
                    if (btn.isDisplayed()) {
                        ((JavascriptExecutor) driver).executeScript("arguments[0].click();", btn);
                        expanded++;
                        sleep(150);
                    }
                }
                catch (Exception ignored) {}
            }
            if (expanded > 0) {
                log.info("Раскрыто {} кнопок 'читать полностью'", expanded);
                sleep(800);
            }
        }
        catch (Exception ignored) {}
    }

    private List<WebElement> findReviewCards(ChromeDriver driver) {
        String[] cardSelectors = {
            "[class*='business-review-view']",
            "[class*='orgpage-review-view']",
            "[class*='review-view']",
            "li[class*='business-reviews-list__item']",
            "li[class*='reviews-list__item']",
            "[class*='reviews-list'] li",
            "[data-review-id]",
            "[data-log-node*='review']"
        };

        for (String sel : cardSelectors) {
            try {
                List<WebElement> found = driver.findElements(By.cssSelector(sel));
                List<WebElement> nonEmpty = found.stream()
                    .filter(el -> { try { return !el.getText().isBlank(); } catch (Exception e) { return false; } })
                    .toList();
                if (!nonEmpty.isEmpty()) {
                    log.info("Карточки отзывов найдены (sel={}): {} шт.", sel, nonEmpty.size());
                    try {
                        Object html = ((JavascriptExecutor) driver)
                            .executeScript("return arguments[0].innerHTML;", nonEmpty.get(0));
                        String htmlStr = html != null ? html.toString() : "";
                        log.info("HTML первой карточки (первые 600 симв): {}",
                            htmlStr.substring(0, Math.min(600, htmlStr.length())));
                    }
                    catch (Exception ignored) {}

                    return nonEmpty;
                }
            }
            catch (Exception ignored) {}
        }

        try {
            Object allClasses = ((JavascriptExecutor) driver).executeScript(
                "var els = document.querySelectorAll('[class]');" +
                "var classes = new Set();" +
                "for(var i=0;i<Math.min(els.length,200);i++){" +
                "  var c=els[i].className; if(typeof c==='string') c.split(' ').forEach(function(s){if(s) classes.add(s);});" +
                "}" +
                "return Array.from(classes).filter(function(c){return c.toLowerCase().includes('review') || c.toLowerCase().includes('отзыв');}).join(', ');"
            );
            log.warn("CSS-классы с 'review' на странице: {}", allClasses);
        }
        catch (Exception ignored) {}

        return new ArrayList<>();
    }

    private VenueReview parseReviewCard(ChromeDriver driver, WebElement card, Venue venue) {
        VenueReview review = new VenueReview();
        review.setVenue(venue);

        try {
            String author = findTextIn(card,
                "[class*='business-review-view__author-name']",
                "[class*='user-icon-view__name']",
                "[class*='business-review-view__author']",
                "[class*='orgpage-review-view__author']",
                "[class*='review-view__author']",
                "[class*='user-name']"
            );

            if (author != null && !author.isBlank())
                review.setAuthor(author.trim());
        }
        catch (Exception ignored) {}

        try {
            List<WebElement> ratingEls = card.findElements(By.cssSelector(
                "[aria-label*='Оценка'], [aria-label*='оценка'], [aria-label*='звезд'], [aria-label*='звёзд'], " +
                "[class*='business-rating'], [class*='stars-rating'], [class*='rating-badge']"
            ));
            boolean ratingFound = false;

            for (WebElement rEl : ratingEls) {
                String aria = rEl.getAttribute("aria-label");
                if (aria != null && !aria.isBlank()) {
                    java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d+)").matcher(aria);
                    if (m.find()) {
                        review.setRating(m.group(1));
                        ratingFound = true;
                        break;
                    }
                }
            }

            if (!ratingFound) {
                List<WebElement> fullStars = card.findElements(By.cssSelector(
                    "[class*='_star_full'], [class*='star_full'], " +
                    "[class*='icon_color_yellow'], [class*='rating__star_full'], " +
                    "[class*='business-rating-badge-view__star'], svg[class*='icon_full']"
                ));

                if (!fullStars.isEmpty()) {
                    review.setRating(String.valueOf(fullStars.size()));
                }
            }
        }
        catch (Exception ignored) {}

        try {
            try {
                List<WebElement> moreBtns = card.findElements(By.cssSelector(
                    "[class*='business-review-view__expand'], span[class*='expand'], " +
                    "button[class*='more'], [class*='read-more'], [class*='spoiler__button']"
                ));

                if (!moreBtns.isEmpty() && moreBtns.getFirst().isDisplayed()) {
                    ((JavascriptExecutor) driver).executeScript("arguments[0].click();", moreBtns.getFirst());
                    sleep(400);
                }
            }
            catch (Exception ignored) {}

            String text = findTextIn(card,
                "[class*='business-review-view__body-text']",
                "[class*='business-review-view__paragraph']",
                "[class*='review-body__text']",
                "[class*='orgpage-review-view__body']",
                "[class*='review-view__body-text']",
                "[class*='review-view__body']",
                "[class*='common-text']",
                "[class*='text__text']",
                "p[class*='text']",
                "span[class*='text']"
            );

            if (text == null || text.isBlank()) {
                try {
                    Object jsText = ((JavascriptExecutor) driver)
                        .executeScript("return arguments[0].innerText;", card);
                    if (jsText instanceof String s && !s.isBlank() && s.length() > 10) {
                        text = s;
                    }
                }
                catch (Exception ignored) {}
            }

            if (text != null && !text.isBlank()) review.setText(text.trim());
        }
        catch (Exception ignored) {}

        try {
            List<WebElement> timeEls = card.findElements(By.tagName("time"));
            if (!timeEls.isEmpty()) {
                String dt = timeEls.getFirst().getAttribute("datetime");
                if (dt == null || dt.isBlank())
                    dt = timeEls.getFirst().getText().trim();
                if (!dt.isBlank())
                    review.setReviewDate(dt.trim());
            }
            if (review.getReviewDate() == null) {
                String date = findTextIn(card,
                    "[class*='business-review-view__date']",
                    "[class*='orgpage-review-view__date']",
                    "meta[itemprop='datePublished']",
                    "[class*='review-date']",
                    "span[class*='date']"
                );
                if (date != null && !date.isBlank())
                    review.setReviewDate(date.trim());
            }
        }
        catch (Exception ignored) {}

        return review;
    }

    private String buildSearchQuery(String name, String address) {
        if (address != null && !address.isBlank()) {
            return name + ", " + address;
        }
        return name;
    }

    private String findTextIn(WebElement parent, String... selectors) {
        for (String sel : selectors) {
            try {
                List<WebElement> els = parent.findElements(By.cssSelector(sel));
                if (!els.isEmpty()) {
                    String content = els.get(0).getAttribute("content");
                    if (content != null && !content.isBlank())
                        return content.trim();
                    String t = els.get(0).getText().trim();
                    if (!t.isEmpty())
                        return t;
                }
            }
            catch (Exception ignored) {}
        }
        return null;
    }

    private void savePageHtml(ChromeDriver driver, String filename) {
        try {
            String src = driver.getPageSource();
            Path out = Paths.get(System.getProperty("user.dir"), filename);
            Files.writeString(out, src, StandardCharsets.UTF_8);
            log.info("HTML страницы сохранён: {}", out.toAbsolutePath());
        }
        catch (Exception e) {
            log.warn("Не удалось сохранить HTML: {}", e.getMessage());
        }
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private String encodeUrl(String s) {
        return java.net.URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}