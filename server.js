/* eslint-disable no-console */
/**
 * API Produção — NM Compensados
 * Server completo (Express + Postgres) com compatibilidade de variáveis Railway.
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");

/* ------------------------------------------------------------------ */
/*  COMPATIBILIDADE DE VARIÁVEIS (Railway troca os nomes às vezes)     */
/* ------------------------------------------------------------------ */
const pick = (...vals) => vals.find(v => typeof v === "string" && v.trim().length > 0);

// DB URL: aceita DATABASE_URL, URL_DO_BANCO_DE_DADOS, URL_PUBLICO_DO_BANCO_DE_DADOS, URL_PÚBLICO_DO_BANCO_DE_DADOS
const RAW_URL = pick(
  process.env.DATABASE_URL,
  process.env.URL_DO_BANCO_DE_DADOS,
  process.env.URL_PUBLICO_DO_BANCO_DE_DADOS,
  process.env.URL_PÚBLICO_DO_BANCO_DE_DADOS
);

// Porta: PORT ou PORTA
const PORT = Number(pick(process.env.PORT, process.env.PORTA, "3000"));

// CORS: CORS_ORIGINS ou CORS_ORIGENS (separadas por vírgula)
const CORS_RAW = pick(process.env.CORS_ORIGINS, process.env.CORS_ORIGENS, "");

// Nome do app
const APP_NAME = pick(process.env.APP_NAME, "nm-comp-api");

/* ----------------------------[ DB CONFIG ]--------------------------- */
if (!RAW_URL) {
  console.error("❌ Nenhuma variável de banco encontrada (DATABASE_URL/URL_DO_BANCO_DE_DADOS).");
  process.exit(1);
}
const DATABASE_URL = RAW_URL.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
// se não for localhost, força SSL (Railway)
const useSSL = !/localhost|127\.0\.0\.1/i.test(DATABASE_URL);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: useSSL ? { require: true, rejectUnauthorized: false } : false,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

async function q(text, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } catch (err) {
    console.error("[DB_ERR]", err.code, err.message);
    throw err;
  } finally {
    client.release();
  }
}

/* ---------------------------[ APP SETUP ]---------------------------- */
const app = express();

// ===== CORREÇÃO CORS DEFINITIVA =====
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Domínios permitidos
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://claude.ai',
    'https://2jq45so7ico1eojxltrk41ixe2lmjspb2osb676c71yhts577c-h802130808.scf.usercontent.goog',
    // Adicione aqui os domínios do seu frontend quando publicar
    'https://seu-frontend.netlify.app',
    'https://seu-frontend.vercel.app'
  ];
  
  // Se tem origins configurados via env, adiciona eles
  if (CORS_RAW) {
    const corsOrigins = CORS_RAW.split(",").map(s => s.trim()).filter(Boolean);
    allowedOrigins.push(...corsOrigins);
  }
  
  // Se o origin está na lista ou se não há origin (requisições diretas)
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  // Headers necessários para CORS
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '3600');
  
  // Responde imediatamente a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

console.log('🔒 CORS configurado para múltiplos domínios');

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.LOG_FORMAT || "tiny"));

app.use(
  rateLimit({
    windowMs: 60_000,
    max: Number(process.env.RATE_LIMIT_MAX || 200),
    standardHeaders: true,
    legacyHeaders: false,
  })
);

/* -------------------------[ SCHEMA & SEEDS ]------------------------- */
async function initSchema() {
  const ddl = `
  CREATE TABLE IF NOT EXISTS dim_familias (
    familiaid SERIAL PRIMARY KEY,
    familianome TEXT NOT NULL,
    sigla TEXT,
    ativo TEXT DEFAULT 'SIM'
  );

  CREATE TABLE IF NOT EXISTS dim_turnos (
    turnoid SERIAL PRIMARY KEY,
    turnonome TEXT NOT NULL,
    ativo TEXT DEFAULT 'SIM'
  );

  CREATE TABLE IF NOT EXISTS dim_setores (
    setorid SERIAL PRIMARY KEY,
    setornome TEXT NOT NULL,
    ativo TEXT DEFAULT 'SIM'
  );

  CREATE TABLE IF NOT EXISTS dim_produtos (
    produtoid SERIAL PRIMARY KEY,
    codigo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    familiaid INTEGER NOT NULL REFERENCES dim_familias(familiaid),
    comprimento_m DOUBLE PRECISION NOT NULL,
    largura_m DOUBLE PRECISION NOT NULL,
    bitola_m DOUBLE PRECISION NOT NULL,
    cubagem_m3 DOUBLE PRECISION,
    ativo TEXT DEFAULT 'SIM'
  );

  CREATE TABLE IF NOT EXISTS fact_producao (
    producaoid SERIAL PRIMARY KEY,
    data DATE NOT NULL,
    turnoid INTEGER NOT NULL REFERENCES dim_turnos(turnoid),
    setorid INTEGER NOT NULL REFERENCES dim_setores(setorid),
    produtoid INTEGER NOT NULL REFERENCES dim_produtos(produtoid),
    quantidade_chapas INTEGER NOT NULL CHECK (quantidade_chapas >= 0),
    comprimento_m DOUBLE PRECISION,
    largura_m DOUBLE PRECISION,
    bitola_m DOUBLE PRECISION,
    cubagem_m3 DOUBLE PRECISION
  );

  CREATE TABLE IF NOT EXISTS fact_descarte (
    descarteid SERIAL PRIMARY KEY,
    data DATE NOT NULL,
    turnoid INTEGER NOT NULL REFERENCES dim_turnos(turnoid),
    setorid INTEGER NOT NULL REFERENCES dim_setores(setorid),
    produtoid INTEGER NOT NULL REFERENCES dim_produtos(produtoid),
    tipo_descarte TEXT,
    quantidade_chapas INTEGER NOT NULL CHECK (quantidade_chapas >= 0),
    obs TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_producao_data ON fact_producao(data);
  CREATE INDEX IF NOT EXISTS idx_descarte_data ON fact_descarte(data);
  `;
  await q(ddl);

  // seeds idempotentes
  await q(`INSERT INTO dim_turnos (turnonome)
           SELECT 'Manhã'
           WHERE NOT EXISTS (SELECT 1 FROM dim_turnos)`);

  await q(`INSERT INTO dim_setores (setornome)
           SELECT 'Geral'
           WHERE NOT EXISTS (SELECT 1 FROM dim_setores)`);

  await q(`INSERT INTO dim_familias (familianome, sigla)
           SELECT 'Padrão','PAD'
           WHERE NOT EXISTS (SELECT 1 FROM dim_familias)`);

  await q(`INSERT INTO dim_produtos
          (codigo, descricao, familiaid, comprimento_m, largura_m, bitola_m, cubagem_m3, ativo)
          SELECT 'P001','Produto Padrão', 1, 2.5, 1.25, 0.015, (2.5*1.25*0.015), 'SIM'
          WHERE NOT EXISTS (SELECT 1 FROM dim_produtos)`);
}

/* ----------------------------[ HELPERS ]----------------------------- */
function parseIntOr(val, def) { const n = parseInt(val, 10); return Number.isFinite(n) ? n : def; }
function parseDateOr(val) { const d = new Date(val); return isNaN(d) ? null : d.toISOString().slice(0, 10); }
function safeCub(c, l, b, cubagemInformada) {
  const base = cubagemInformada ?? (Number(c) * Number(l) * Number(b));
  const n = Number(base);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/* ---------------------------[ HEALTH/INFO ]-------------------------- */
app.get("/healthz", async (_req, res) => {
  try { await q("SELECT 1"); res.json({ status: "ok", app: APP_NAME, db: "up" }); }
  catch { res.status(500).json({ status: "degraded", app: APP_NAME, db: "down" }); }
});
app.get("/version", (_req, res) => res.json({ app: APP_NAME, version: "1.0.0" }));
app.get("/test-connection", (_req, res) => res.json({ message: "API funcionando 🚀" }));

// Endpoints de debug
app.get("/debug", (req, res) => {
  res.json({
    message: "Debug endpoint funcionando",
    timestamp: new Date().toISOString(),
    headers: {
      origin: req.headers.origin,
      'user-agent': req.headers['user-agent'],
      host: req.headers.host
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: PORT,
      HAS_DATABASE_URL: !!RAW_URL,
      CORS_CONFIGURED: !!CORS_RAW
    }
  });
});

app.get("/cors-test", (req, res) => {
  res.json({ 
    message: "CORS teste OK",
    origin: req.headers.origin,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

/* -----------------------------[ LOOKUPS ]---------------------------- */
app.get("/turnos", async (_req, res, next) => {
  try { res.json((await q(`SELECT * FROM dim_turnos ORDER BY turnoid`)).rows); }
  catch (e) { next(e); }
});
app.get("/setores", async (_req, res, next) => {
  try { res.json((await q(`SELECT * FROM dim_setores ORDER BY setorid`)).rows); }
  catch (e) { next(e); }
});
app.get("/familias", async (_req, res, next) => {
  try { res.json((await q(`SELECT * FROM dim_familias ORDER BY familiaid`)).rows); }
  catch (e) { next(e); }
});

/* -----------------------------[ PRODUTOS ]--------------------------- */
app.get("/produtos", async (req, res, next) => {
  try {
    const page = Math.max(1, parseIntOr(req.query.page, 1));
    const pageSize = Math.min(100, Math.max(1, parseIntOr(req.query.pageSize, 50)));
    const off = (page - 1) * pageSize;

    const search = (req.query.search || "").trim();
    const where = search ? `WHERE codigo ILIKE $1 OR descricao ILIKE $1` : "";
    const params = search ? [`%${search}%`, pageSize, off] : [pageSize, off];

    const rows = (
      await q(
        `SELECT * FROM dim_produtos ${where} ORDER BY produtoid DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      )
    ).rows;

    const total = (
      await q(`SELECT COUNT(*)::int AS n FROM dim_produtos ${where}`, search ? [`%${search}%`] : [])
    ).rows[0].n;

    res.json({ page, pageSize, total, rows });
  } catch (e) { next(e); }
});

app.post("/produtos", async (req, res, next) => {
  try {
    const { Codigo, Descricao, FamiliaID, Comprimento_m, Largura_m, Bitola_m, Cubagem_m3, Ativo = "SIM" } = req.body || {};
    if (!Codigo || !Descricao || !FamiliaID || !Comprimento_m || !Largura_m || !Bitola_m) {
      return res.status(400).json({ error: "Campos obrigatórios: Codigo, Descricao, FamiliaID, Comprimento_m, Largura_m, Bitola_m" });
    }
    const cub = safeCub(Comprimento_m, Largura_m, Bitola_m, Cubagem_m3);
    const r = await q(
      `INSERT INTO dim_produtos (codigo, descricao, familiaid, comprimento_m, largura_m, bitola_m, cubagem_m3, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING produtoid`,
      [Codigo, Descricao, Number(FamiliaID), Number(Comprimento_m), Number(Largura_m), Number(Bitola_m), cub, Ativo]
    );
    res.status(201).json({ message: "Produto criado", id: r.rows[0].produtoid });
  } catch (e) { next(e); }
});

app.put("/produtos/:id", async (req, res, next) => {
  try {
    const id = parseIntOr(req.params.id, 0);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const { Codigo, Descricao, FamiliaID, Comprimento_m, Largura_m, Bitola_m, Cubagem_m3, Ativo = "SIM" } = req.body || {};
    const cub = safeCub(Comprimento_m, Largura_m, Bitola_m, Cubagem_m3);
    await q(
      `UPDATE dim_produtos
         SET codigo=$1, descricao=$2, familiaid=$3, comprimento_m=$4, largura_m=$5, bitola_m=$6, cubagem_m3=$7, ativo=$8
       WHERE produtoid=$9`,
      [Codigo, Descricao, Number(FamiliaID), Number(Comprimento_m), Number(Largura_m), Number(Bitola_m), cub, Ativo, id]
    );
    res.json({ message: "Produto atualizado" });
  } catch (e) { next(e); }
});

app.delete("/produtos/:id", async (req, res, next) => {
  try {
    const id = parseIntOr(req.params.id, 0);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const r = await q(`DELETE FROM dim_produtos WHERE produtoid=$1`, [id]);
    res.json({ message: "Produto excluído", rowCount: r.rowCount });
  } catch (e) { next(e); }
});

/* -----------------------------[ PRODUÇÃO ]--------------------------- */
app.get("/producao", async (req, res, next) => {
  try {
    const page = Math.max(1, parseIntOr(req.query.page, 1));
    const pageSize = Math.min(200, Math.max(1, parseIntOr(req.query.pageSize, 50)));
    const off = (page - 1) * pageSize;

    const dIni = parseDateOr(req.query.de);
    const dFim = parseDateOr(req.query.ate);
    const where = [];
    const params = [];

    if (dIni) { params.push(dIni); where.push(`p.data >= $${params.length}`); }
    if (dFim) { params.push(dFim); where.push(`p.data <= $${params.length}`); }
    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = (await q(`
      SELECT p.*, t.turnonome, s.setornome, pr.descricao AS produtodescricao, pr.codigo
        FROM fact_producao p
   LEFT JOIN dim_turnos t   ON t.turnoid   = p.turnoid
   LEFT JOIN dim_setores s  ON s.setorid   = p.setorid
   LEFT JOIN dim_produtos pr ON pr.produtoid = p.produtoid
      ${whereSQL}
    ORDER BY p.data DESC, p.producaoid DESC
       LIMIT ${pageSize} OFFSET ${off}
    `, params)).rows;

    const total = (await q(`SELECT COUNT(*)::int n FROM fact_producao p ${whereSQL}`, params)).rows[0].n;
    res.json({ page, pageSize, total, rows });
  } catch (e) { next(e); }
});

app.post("/producao", async (req, res, next) => {
  try {
    const { Data, TurnoID, SetorID, ProdutoID, Quantidade_Chapas } = req.body || {};
    if (!Data || !TurnoID || !SetorID || !ProdutoID || Quantidade_Chapas == null)
      return res.status(400).json({ error: "Campos obrigatórios: Data, TurnoID, SetorID, ProdutoID, Quantidade_Chapas" });

    const p = await q(`SELECT comprimento_m, largura_m, bitola_m FROM dim_produtos WHERE produtoid=$1`, [Number(ProdutoID)]);
    if (!p.rowCount) return res.status(400).json({ error: "Produto inválido" });

    const { comprimento_m: comp, largura_m: larg, bitola_m: bit } = p.rows[0];
    const chapas = Number(Quantidade_Chapas) || 0;
    const cubUnitario = safeCub(comp, larg, bit, null);
    const cub = cubUnitario * chapas;

    const r = await q(`
      INSERT INTO fact_producao
      (data, turnoid, setorid, produtoid, quantidade_chapas, comprimento_m, largura_m, bitola_m, cubagem_m3)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING producaoid
    `, [Data, Number(TurnoID), Number(SetorID), Number(ProdutoID),
        chapas, Number(comp), Number(larg), Number(bit), Number(cub)]);
    res.status(201).json({ message: "Produção registrada", id: r.rows[0].producaoid });
  } catch (e) { next(e); }
});

app.delete("/producao/:id", async (req, res, next) => {
  try {
    const id = parseIntOr(req.params.id, 0);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const r = await q(`DELETE FROM fact_producao WHERE producaoid=$1`, [id]);
    res.json({ message: "Produção excluída", rowCount: r.rowCount });
  } catch (e) { next(e); }
});

/* -----------------------------[ DESCARTE ]--------------------------- */
app.get("/descarte", async (req, res, next) => {
  try {
    const page = Math.max(1, parseIntOr(req.query.page, 1));
    const pageSize = Math.min(200, Math.max(1, parseIntOr(req.query.pageSize, 50)));
    const off = (page - 1) * pageSize;

    const dIni = parseDateOr(req.query.de);
    const dFim = parseDateOr(req.query.ate);
    const where = [];
    const params = [];

    if (dIni) { params.push(dIni); where.push(`d.data >= $${params.length}`); }
    if (dFim) { params.push(dFim); where.push(`d.data <= $${params.length}`); }
    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = (await q(`
      SELECT d.*, t.turnonome, s.setornome, pr.descricao AS produtodescricao, pr.codigo
        FROM fact_descarte d
   LEFT JOIN dim_turnos t   ON t.turnoid   = d.turnoid
   LEFT JOIN dim_setores s  ON s.setorid   = d.setorid
   LEFT JOIN dim_produtos pr ON pr.produtoid = d.produtoid
      ${whereSQL}
    ORDER BY d.data DESC, d.descarteid DESC
       LIMIT ${pageSize} OFFSET ${off}
    `, params)).rows;

    const total = (await q(`SELECT COUNT(*)::int n FROM fact_descarte d ${whereSQL}`, params)).rows[0].n;
    res.json({ page, pageSize, total, rows });
  } catch (e) { next(e); }
});

app.post("/descarte", async (req, res, next) => {
  try {
    const { Data, TurnoID, SetorID, ProdutoID, Quantidade_Chapas, Tipo_Descarte = "", Obs = "" } = req.body || {};
    if (!Data || !TurnoID || !SetorID || !ProdutoID || Quantidade_Chapas == null)
      return res.status(400).json({ error: "Campos obrigatórios: Data, TurnoID, SetorID, ProdutoID, Quantidade_Chapas" });

    const r = await q(`
      INSERT INTO fact_descarte (data, turnoid, setorid, produtoid, tipo_descarte, quantidade_chapas, obs)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING descarteid
    `, [Data, Number(TurnoID), Number(SetorID), Number(ProdutoID), String(Tipo_Descarte),
        Number(Quantidade_Chapas), String(Obs)]);
    res.status(201).json({ message: "Descarte registrado", id: r.rows[0].descarteid });
  } catch (e) { next(e); }
});

app.delete("/descarte/:id", async (req, res, next) => {
  try {
    const id = parseIntOr(req.params.id, 0);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const r = await q(`DELETE FROM fact_descarte WHERE descarteid=$1`, [id]);
    res.json({ message: "Descarte excluído", rowCount: r.rowCount });
  } catch (e) { next(e); }
});

/* ---------------------------[ DASHBOARD ]---------------------------- */
app.get("/dashboard-stats", async (_req, res, next) => {
  try {
    const [{ count: totalprodutos }]     = (await q(`SELECT COUNT(*)::int FROM dim_produtos`)).rows;
    const [{ totalproducaom3 }]          = (await q(`SELECT COALESCE(SUM(cubagem_m3),0) AS totalproducaom3 FROM fact_producao`)).rows;
    const [{ totaldescartechapas }]      = (await q(`SELECT COALESCE(SUM(quantidade_chapas),0) AS totaldescartechapas FROM fact_descarte`)).rows;
    const [{ totalchapas }]              = (await q(`SELECT COALESCE(SUM(quantidade_chapas),0) AS totalchapas FROM fact_producao`)).rows;

    const eficiencia = Number(totalchapas) > 0
      ? Number(((1 - (Number(totaldescartechapas) / Number(totalchapas))) * 100).toFixed(2))
      : 0;

    const producaoPorTurno = (await q(`
      SELECT t.turnonome, COALESCE(SUM(p.cubagem_m3),0) AS total
        FROM dim_turnos t
   LEFT JOIN fact_producao p ON p.turnoid = t.turnoid
    GROUP BY t.turnoid, t.turnonome
    ORDER BY t.turnoid
    `)).rows;

    const evolucaoProducao = (await q(`
      SELECT data::date AS data, COALESCE(SUM(cubagem_m3),0) AS total
        FROM fact_producao
    GROUP BY data::date
    ORDER BY data::date DESC
       LIMIT 14
    `)).rows;

    res.json({
      totalProdutos: Number(totalprodutos),
      totalProducaoM3: Number(totalproducaom3),
      totalDescarteChapas: Number(totaldescartechapas),
      eficiencia,
      producaoPorTurno,
      evolucaoProducao
    });
  } catch (e) { next(e); }
});

/* -------------------------[ 404 & ERRORS ]--------------------------- */
app.use((req, res) => res.status(404).json({ error: "Rota não encontrada" }));
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const code = err.code || "ERR";
  const msg = err.message || "Erro inesperado";
  console.error("💥", code, status, msg);
  if (msg && msg.includes("CORS")) return res.status(403).json({ error: msg });
  res.status(status).json({ error: msg, code });
});

/* ----------------------------[ START ]------------------------------- */
initSchema()
  .then(() => {
    const server = app.listen(PORT, () => console.log(`🚀 ${APP_NAME} on http://localhost:${PORT}`));
    const shutdown = (sig) => () => {
      console.log(`\n${sig} recebido. Encerrando...`);
      server.close(async () => { try { await pool.end(); } catch {} process.exit(0); });
    };
    process.on("SIGINT", shutdown("SIGINT"));
    process.on("SIGTERM", shutdown("SIGTERM"));
  })
  .catch((e) => {
    console.error("Erro ao iniciar schema:", e);
    process.exit(1);
  });