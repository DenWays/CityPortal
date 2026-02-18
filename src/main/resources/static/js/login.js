const { useEffect, useState } = React;

function LoginPage() {
  const [csrf, setCsrf] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
        if (!res.ok) throw new Error("Не удалось получить CSRF-токен");
        const data = await res.json();
        setCsrf(data.token || "");
      } catch (e) {
        setMsg({ type: "err", text: e.message || "Ошибка получения CSRF" });
      }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.has("error")) {
      setMsg({ type: "err", text: "Неверный логин или пароль" });
    } else if (params.has("logout")) {
      setMsg({ type: "ok", text: "Вы вышли из аккаунта" });
    }
  }, []);

  function onSubmit(e) {
    e.preventDefault();

    if (!csrf) {
      setMsg({ type: "err", text: "CSRF-токен не получен. Обнови страницу." });
      return;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/login";

    const add = (name, value) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    add("_csrf", csrf);
    add("username", login);
    add("password", password);

    document.body.appendChild(form);
    form.submit();
  }

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <div className="brand">
            <div className="logo" />
            <div>
              <h1 className="title">CityPortal</h1>
              <p className="subtitle">Вход в аккаунт (Spring Security formLogin)</p>
            </div>
          </div>
        </div>

        <div className="card-body">
          <form onSubmit={onSubmit}>
            <div className="field">
              <div className="label">Логин</div>
              <input
                className="input"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="например: danat"
                autoComplete="username"
                required
              />
            </div>

            <div className="field">
              <div className="label">Пароль</div>
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            <div className="row">
              <span className="small">CSRF: {csrf ? "получен" : "нет"}</span>
              <a className="small" href="/register">Регистрация</a>
            </div>

            <button className="btn" type="submit">
              Войти
            </button>

            <a href="/" className="btn secondary" style={{ display: "block", textAlign: "center" }}>
              На главную
            </a>

            {msg && (
              <div className={"msg " + (msg.type === "ok" ? "ok" : "err")}>
                {msg.text}
              </div>
            )}
          </form>
        </div>

        <div className="footer">
          <span>© CityPortal</span>
          <span>Backend: Spring Boot</span>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<LoginPage />);