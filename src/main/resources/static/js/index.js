const { useEffect, useState } = React;

function Widget({ title, children }) {
  return (
    <div className="widget">
      <div className="widget-title">{title}</div>
      <div className="widget-body">{children}</div>
    </div>
  );
}

function CityPortalHome() {
  const [account, setAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  const [weather] = useState({ temp: "+3°C", desc: "Облачно", city: "Ваш город" });
  const [traffic] = useState({ level: "6/10", note: "Пробки средние" });
  const [taxi] = useState({ price: "≈ 450₽", eta: "7 мин" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/account", { credentials: "same-origin" });
        if (res.ok) {
          const data = await res.json();
          setAccount(data);
        }
      } catch (e) {
      } finally {
        setLoadingAccount(false);
      }
    })();
  }, []);

    async function getCsrfToken() {
      const res = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
      if (!res.ok) throw new Error("CSRF token request failed");
      const data = await res.json();
      return data.token;
    }

    async function logout() {
      try {
        const token = await getCsrfToken();

        await fetch("/logout", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-CSRF-TOKEN": token
          },
          body: new URLSearchParams({ _csrf: token }).toString()
        });

        window.location.href = "/login?logout";
      } catch (e) {
        console.error("Logout failed", e);
        window.location.href = "/login";
      }
    }

  return (
    <div className="home">
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo small" />
          <div>
            <div className="topbar-title">CityPortal</div>
            <div className="topbar-subtitle">Интерактивный портал города</div>
          </div>
        </div>

        <div className="topbar-right">
          {loadingAccount ? (
            <span className="small">Проверяем вход...</span>
          ) : account ? (
            <>
              <span className="small">Вы вошли как: <b>{account.login}</b></span>
              <a className="btn smallbtn secondary" href="/profile">Профиль</a>
              <button className="btn smallbtn secondary" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <a className="btn smallbtn secondary" href="/login">Войти</a>
              <a className="btn smallbtn" href="/register">Регистрация</a>
            </>
          )}
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <h1 className="hero-title">Добро пожаловать</h1>
          <p className="hero-text">
            Это тестовая главная страница.
          </p>

          <div className="hero-actions">
            <a className="btn" href="#widgets">Виджеты</a>
            <a className="btn secondary" href="#places">Заведения</a>
            <a className="btn secondary" href="#routes">Маршруты</a>
            <a className="btn secondary" href="#news">Афиша / Статьи</a>
          </div>
        </section>

        <section id="widgets" className="section">
          <h2 className="section-title">Виджеты</h2>

          <div className="grid">
            <Widget title="Погода">
              <div className="big">{weather.temp}</div>
              <div className="small">{weather.desc}</div>
              <div className="small muted">{weather.city}</div>
            </Widget>

            <Widget title="Пробки">
              <div className="big">{traffic.level}</div>
              <div className="small">{traffic.note}</div>
            </Widget>

            <Widget title="Такси">
              <div className="big">{taxi.price}</div>
              <div className="small">Подача: {taxi.eta}</div>
            </Widget>

            <Widget title="Карта / Маршруты">
              <div className="small">
                Тут будет карта (2GIS / Yandex / OSM) и построение маршрутов.
              </div>
              <button className="btn secondary" style={{ marginTop: 10 }}>
                Открыть карту (заглушка)
              </button>
            </Widget>
          </div>
        </section>

        <section id="places" className="section">
          <h2 className="section-title">Заведения</h2>
          <div className="block">
            <p className="small">
              Здесь будет агрегатор заведений + отзывы.
            </p>

            <div className="list">
              <div className="list-item">
                <div>
                  <b>Кофейня “Город”</b>
                  <div className="small muted">Рейтинг: 4.6 • 128 отзывов</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>

              <div className="list-item">
                <div>
                  <b>Фитнес “Pulse”</b>
                  <div className="small muted">Рейтинг: 4.3 • 54 отзыва</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>

              <div className="list-item">
                <div>
                  <b>Кинотеатр “Central”</b>
                  <div className="small muted">Рейтинг: 4.7 • 302 отзыва</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>
            </div>
          </div>
        </section>

        <section id="routes" className="section">
          <h2 className="section-title">Маршруты по городу</h2>
          <div className="block">
            <p className="small">
              Здесь будут готовые маршруты: прогулки, туристические места.
            </p>

            <div className="list">
              <div className="list-item">
                <div>
                  <b>Маршрут: Центр за 2 часа</b>
                  <div className="small muted">8 точек • пешком • 2.1 км</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>

              <div className="list-item">
                <div>
                  <b>Маршрут: Кофе + Парк</b>
                  <div className="small muted">4 точки • пешком • 1.4 км</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>
            </div>
          </div>
        </section>

        <section id="news" className="section">
          <h2 className="section-title">Афиша / Статьи</h2>
          <div className="block">
            <p className="small">
              Здесь будет афиша мероприятий и статьи.
            </p>

            <div className="list">
              <div className="list-item">
                <div>
                  <b>Концерт в парке (сегодня)</b>
                  <div className="small muted">19:00 • Центральный парк</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>

              <div className="list-item">
                <div>
                  <b>Гайд: 10 мест где вкусно поесть</b>
                  <div className="small muted">статья • 5 мин чтения</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>
            </div>
          </div>
        </section>

        <footer className="footer" style={{ marginTop: 24 }}>
          <span>© CityPortal</span>
        </footer>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<CityPortalHome />);