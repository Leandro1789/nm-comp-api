
// --- PATCH DE ESTABILIDADE (carregamento infinito) ---
// 1) fetch com timeout
function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  return fetch(url, { ...opts, headers, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

// 2) Se existir apiFetch global, envolvemos com timeout
if (typeof window !== "undefined") {
  const g = window;
  if (typeof g.API_BASE_URL === "string") {
    // ok
  }
  // Wrapper seguro que cai para fetchWithTimeout
  g.apiFetch = async function(path, options = {}) {
    if (!g.API_BASE_URL) throw new Error("Defina a conexão primeiro.");
    const url = `${g.API_BASE_URL}${path}`;
    const res = await fetchWithTimeout(url, options, 8000);
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `Erro HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  };

  // 3) conectarBanco: usa Promise.allSettled e sempre esconde loading
  g.conectarBanco = async function() {
    try {
      const host = document.getElementById("dbHost")?.value || "localhost";
      const port = document.getElementById("dbPort")?.value || "3001";
      g.API_BASE_URL = `http://${host}:${port}`;

      if (typeof updateConnectionStatus === "function") updateConnectionStatus("connecting");
      if (typeof showLoading === "function") showLoading(true);

      const ping = await g.apiFetch("/test-connection");
      if (typeof updateConnectionStatus === "function") updateConnectionStatus("connected");
      if (typeof showNotification === "function") showNotification(`Conectado: ${ping.message}`, "success");

      const tasks = [
        (async () => { try { await g.carregarDashboard?.(); } catch (e) { console.error("dashboard:", e); } })(),
        (async () => { try { await g.sincronizarProdutos?.(); } catch (e) { console.error("produtos:", e); } })(),
        (async () => { try { await g.sincronizarTurnos?.(); } catch (e) { console.error("turnos:", e); } })(),
        (async () => { try { await g.sincronizarSetores?.(); } catch (e) { console.error("setores:", e); } })(),
        (async () => { try { await g.sincronizarConsulta?.(); } catch (e) { console.error("consulta:", e); } })(),
      ];

      await Promise.allSettled(tasks);
    } catch (err) {
      console.error(err);
      if (typeof updateConnectionStatus === "function") updateConnectionStatus("disconnected");
      if (typeof showNotification === "function") showNotification(`Falha na conexão: ${err.message}`, "error");
    } finally {
      if (typeof showLoading === "function") showLoading(false);
      // failsafe: força esconder depois de 1s
      setTimeout(() => { try { if (typeof showLoading === "function") showLoading(false); } catch(e){} }, 1000);
    }
  };

  // 4) carregarDashboard: ignora gráficos se Chart não estiver carregado
  g.carregarDashboard = async function() {
    try {
      const data = await g.apiFetch("/dashboard-stats");
      const $ = (id) => document.getElementById(id);
      if ($("totalProdutos")) $("totalProdutos").textContent = data.totalProdutos ?? 0;
      if ($("totalProducao")) $("totalProducao").textContent = (Number(data.totalProducaoM3) || 0).toFixed(4);
      if ($("totalDescarte")) $("totalDescarte").textContent = data.totalDescarteChapas ?? 0;
      if ($("eficiencia")) $("eficiencia").textContent = `${(Number(data.eficiencia) || 0).toFixed(2)}%`;

      if (typeof Chart === "undefined") {
        console.warn("Chart.js não carregado: pulando gráficos.");
        return;
      }
      const tcv = document.getElementById("chartProducaoTurno");
      if (tcv && data.producaoPorTurno) {
        const ctx = tcv.getContext("2d");
        new Chart(ctx, {
          type: "bar",
          data: {
            labels: data.producaoPorTurno.map(r => r.TurnoNome),
            datasets: [{ label: "m³ por turno", data: data.producaoPorTurno.map(r => Number(r.total)||0) }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
      const ecv = document.getElementById("chartEvolucaoProducao");
      if (ecv && data.evolucaoProducao) {
        const ctx = ecv.getContext("2d");
        new Chart(ctx, {
          type: "line",
          data: {
            labels: data.evolucaoProducao.map(r => new Date(r.Data).toLocaleDateString()),
            datasets: [{ label: "m³ (últimos dias)", data: data.evolucaoProducao.map(r => Number(r.total)||0), fill:false }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    } catch (err) {
      console.error(err);
      if (typeof showNotification === "function") showNotification(`Erro no dashboard: ${err.message}`, "error");
    }
  };

  // 5) Captura global de erros para não travar a página
  window.addEventListener("error", (e) => {
    console.error("Erro não tratado:", e?.error || e?.message || e);
    try { if (typeof showLoading === "function") showLoading(false); } catch(_) {}
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("Promise rejeitada:", e?.reason || e);
    try { if (typeof showLoading === "function") showLoading(false); } catch(_) {}
  });
}
