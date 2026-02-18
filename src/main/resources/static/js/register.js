const { useEffect, useState } = React;

function RegisterPage() {
  const [csrf, setCsrf] = useState("");
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
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

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);

    if (!csrf) {
      setMsg({ type: "err", text: "CSRF-токен не получен. Обнови страницу." });
      return;
    }

    if (password !== confirm) {
      setMsg({ type: "err", text: "Пароли не совпадают" });
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);

      const payload = {
        login,
        email,
        password,
        creatingDate: today,
        role: { id: 2 }
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrf
        },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || ("Ошибка регистрации: " + res.status));
      }

      setMsg({ type: "ok", text: "Регистрация успешна. Сейчас перенаправим на вход..." });

      setTimeout(() => {
        window.location.href = "/login";
      }, 700);

    } catch (err) {
      setMsg({ type: "err", text: err.message || "Не удалось зарегистрироваться" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <div className="brand">
            <div className="logo" />
            <div>
              <h1 className="title">Регистрация</h1>
              <p className="subtitle">Создай аккаунт CityPortal (роль USER)</p>
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
              <div className="label">Email</div>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@mail.com"
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <div className="field">
              <div className="label">Пароль</div>
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="минимум 6 символов"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>

            <div className="field">
              <div className="label">Повтори пароль</div>
              <input
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="ещё раз"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>

            <div className="row">
              <span className="small">CSRF: {csrf ? "получен" : "нет"}</span>
              <a className="small" href="/login">Войти</a>
            </div>

            <button className="btn" disabled={loading}>
              {loading ? "Регистрируем..." : "Создать аккаунт"}
            </button>

            {msg && (
              <div className={"msg " + (msg.type === "ok" ? "ok" : "err")}>
                {msg.text}
              </div>
            )}
          </form>
        </div>

        <div className="footer">
          <span>© CityPortal</span>
          <span><a href="/">На главную</a></span>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<RegisterPage />);