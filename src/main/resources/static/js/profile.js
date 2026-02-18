const { useEffect, useState } = React;

async function getCsrfToken() {
  const res = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
  if (!res.ok) throw new Error("CSRF token request failed");
  const data = await res.json();
  return data.token;
}

function ProfilePage() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/account", { credentials: "same-origin" });
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error("Не удалось получить профиль");
        const data = await res.json();
        setAccount(data);
      } catch (e) {
        setMsg({ type: "err", text: e.message || "Ошибка" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      window.location.href = "/login";
    }
  }

  return (
    <div className="home">
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo small" />
          <div>
            <div className="topbar-title">Профиль</div>
            <div className="topbar-subtitle">CityPortal</div>
          </div>
        </div>

        <div className="topbar-right">
          <a className="btn smallbtn secondary" href="/">Главная</a>
          <button className="btn smallbtn secondary" onClick={logout}>Выйти</button>
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <h1 className="hero-title">Ваш аккаунт</h1>
          <p className="hero-text">Тестовая страница профиля.</p>
        </section>

        <section className="section">
          <h2 className="section-title">Данные</h2>

          <div className="block">
            {loading ? (
              <p className="small">Загрузка...</p>
            ) : account ? (
              <div className="list">
                <div className="list-item">
                  <div>
                    <b>Login</b>
                    <div className="small muted">{account.login}</div>
                  </div>
                </div>

                <div className="list-item">
                  <div>
                    <b>Email</b>
                    <div className="small muted">{account.email}</div>
                  </div>
                </div>

                <div className="list-item">
                  <div>
                    <b>Дата создания</b>
                    <div className="small muted">{account.creatingDate || "-"}</div>
                  </div>
                </div>

                <div className="list-item">
                  <div>
                    <b>Роль</b>
                    <div className="small muted">
                      {account.role?.name ? account.role.name : "(не загружено)"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="small">Профиль пустой</p>
            )}

            {msg && (
              <div className={"msg " + (msg.type === "ok" ? "ok" : "err")}>
                {msg.text}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ProfilePage />);