// backend/v1/src/server.js
// Alchemist Battle - Backend v1: competição individual.
// Fluxo de partida: lobby -> (mestre dá start em /admin) -> playing (2:30) -> ended.
const express = require('express');
const { Pool } = require('pg');

const PORT = parseInt(process.env.PORT || '8080', 10);
const APP_VERSION = 'v1';
const GAME_COLOR = process.env.GAME_COLOR || '#7c3aed';
const POD_NAME = process.env.HOSTNAME || 'local';

// Duração da partida (o cronômetro só começa DEPOIS da abertura).
const ROUND_SECONDS = 150;
// Abertura: letreiro estilo Star Wars (34s) + desfile dos 12 chefes (2s cada),
// tudo com o cronômetro parado.
const INTRO_SECONDS = 58;

// ---- Incidentes corporativos ----
// A cada clique há chance de algo dar MUITO errado e o jogador PERDER pontos
// conforme a gravidade. A chance ESCALA conforme o jogador avança — sozinho,
// fechar o jogo é quase impossível (essa é a moral da Parte 1 da demo).
const INCIDENTS = [
  { name: 'Bug em produção... causado pelo hotfix anterior', emoji: '🐛', loss: 5, weight: 20 },
  { name: 'A auditoria pediu evidências de 2019', emoji: '📋', loss: 8, weight: 16 },
  { name: 'O Jira caiu e levou o backlog junto', emoji: '📑', loss: 10, weight: 14 },
  { name: 'A impressora do financeiro virou prioridade P1', emoji: '🖨️', loss: 15, weight: 12 },
  { name: 'O MFA resetou e ninguém tem o backup code', emoji: '🔐', loss: 20, weight: 10 },
  { name: 'npm install puxou uma dependência quebrada', emoji: '📦', loss: 25, weight: 8 },
  { name: 'O CAB reprovou sua mudança às 17h58', emoji: '⛔', loss: 35, weight: 6 },
  { name: 'A região da nuvem caiu (era single-AZ para economizar)', emoji: '☁️', loss: 45, weight: 4 },
  { name: 'O ESTAGIÁRIO APAGOU O BANCO DE PROD', emoji: '🔥', loss: 60, weight: 2 }
];
// Na reta final (>= 700 pts), a "gerência" entra em cena com prioridades
// erradas — esses incidentes se somam aos normais.
const FINAL_INCIDENTS = [
  { name: 'O CEO pediu para "colocar IA" no formulário de férias', emoji: '🤖', loss: 30, weight: 10 },
  { name: 'Prioridade máxima: trocar o logo para o evento de amanhã', emoji: '🎨', loss: 35, weight: 9 },
  { name: 'Reorg surpresa: a TI agora se reporta ao Marketing', emoji: '📊', loss: 40, weight: 8 },
  { name: 'Congelamento de mudanças... exceto as do diretor', emoji: '🧊', loss: 45, weight: 7 },
  { name: 'O CEO viu um TikTok: agora tudo precisa ter Blockchain', emoji: '⛓️', loss: 50, weight: 6 },
  { name: 'Budget da TI cortado para patrocinar o camarote do evento', emoji: '💸', loss: 55, weight: 5 }
];

// Quanto mais perto do chefe final, mais caos.
function incidentChanceFor(points) {
  if (points >= 700) return 0.12; // reta final: a gerência "ajudando" — quase um paredão
  if (points >= 400) return 0.05;
  return 0.035;
}
function incidentPoolFor(points) {
  return points >= 700 ? INCIDENTS.concat(FINAL_INCIDENTS) : INCIDENTS;
}
function pickFrom(list) {
  const total = list.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * total;
  for (const i of list) {
    r -= i.weight;
    if (r <= 0) return i;
  }
  return list[0];
}

const dbConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'alchemist',
  user: process.env.PG_USER || 'alchemist',
  password: process.env.PG_PASSWORD || 'alchemist',
  max: 10,
  connectionTimeoutMillis: 3000
};

// O Crunchy Postgres Operator exige TLS por padrão; o Postgres "fallback"
// não suporta TLS. Começamos com TLS e, se o servidor não suportar,
// o loop de inicialização refaz o pool sem TLS (ver abaixo).
let pool = new Pool({ ...dbConfig, ssl: { rejectUnauthorized: false } });

const app = express();
app.use(express.json());

// DDL idempotente. O estado da partida vive no banco para ser
// compartilhado entre as réplicas do backend.
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      username   TEXT PRIMARY KEY,
      guild      TEXT CHECK (guild IN ('fogo', 'agua', 'terra')),
      points     INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_players_points ON players (points DESC)');
  await pool.query('DROP TABLE IF EXISTS game_round');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_state (
      id      INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      status  TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'intro', 'playing', 'ended')),
      ends_at TIMESTAMPTZ
    )`);
  await pool.query(`INSERT INTO match_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  // Migração idempotente: garante que bancos antigos aceitem o status 'intro'.
  await pool.query('ALTER TABLE match_state DROP CONSTRAINT IF EXISTS match_state_status_check');
  await pool.query(
    `ALTER TABLE match_state ADD CONSTRAINT match_state_status_check
     CHECK (status IN ('lobby', 'intro', 'playing', 'ended'))`
  );
}

// Estado atual. Encerra a partida automaticamente quando o tempo acaba
// (UPDATE atômico: qualquer réplica pode fazer a transição, só uma vence).
async function getMatchState() {
  // Fim da abertura -> liga o cronômetro de verdade (transição atômica).
  await pool.query(
    `UPDATE match_state SET status = 'playing', ends_at = now() + make_interval(secs => $1::int)
      WHERE status = 'intro' AND now() > ends_at`,
    [ROUND_SECONDS]
  );
  await pool.query(`UPDATE match_state SET status = 'ended' WHERE status = 'playing' AND now() > ends_at`);
  const { rows } = await pool.query(
    `SELECT status,
            COALESCE(GREATEST(0, CEIL(EXTRACT(EPOCH FROM (ends_at - now()))))::int, 0) AS remaining
       FROM match_state`
  );
  const r = rows[0];
  return {
    phase: r.status,
    remaining: r.remaining,
    duration: r.status === 'intro' ? INTRO_SECONDS : ROUND_SECONDS
  };
}

const BOARD_SQL = 'SELECT username, points FROM players ORDER BY points DESC, username ASC LIMIT 10';
const LOBBY_SQL = 'SELECT username FROM players ORDER BY updated_at ASC LIMIT 60';

// ---- Probes (usados pelo OpenShift) ----
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', version: APP_VERSION, pod: POD_NAME });
});

app.get('/readyz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ready: true, pod: POD_NAME });
  } catch (err) {
    res.status(503).json({ ready: false, error: err.message });
  }
});

// ---- API do jogo ----
app.get('/api/config', (_req, res) => {
  res.json({ version: APP_VERSION, mode: 'individual', color: GAME_COLOR, pod: POD_NAME });
});

// Entra no lobby (idempotente — manté os pontos se já existir).
app.post('/api/join', async (req, res) => {
  const username = String(req.body?.username || '').trim().slice(0, 30);
  if (!username) return res.status(400).json({ error: 'username é obrigatório' });
  try {
    await pool.query(
      `INSERT INTO players (username) VALUES ($1)
       ON CONFLICT (username) DO UPDATE SET updated_at = now()`,
      [username]
    );
    res.json({ username, pod: POD_NAME });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/click', async (req, res) => {
  const username = String(req.body?.username || '').trim().slice(0, 30);
  if (!username) return res.status(400).json({ error: 'username é obrigatório' });
  // Clique crítico: 10% de chance, vale 5 pontos. Decidido no servidor
  // para o placar ser justo entre todos os jogadores.
  const crit = Math.random() < 0.10;
  const gained = crit ? 5 : 1;
  try {
    const match = await getMatchState();
    if (match.phase !== 'playing') {
      return res.status(409).json({ error: 'a partida não está em andamento', match });
    }
    // A chance e o tipo de incidente dependem de onde o jogador está no jogo.
    const cur = await pool.query('SELECT points FROM players WHERE username = $1', [username]);
    const curPts = cur.rows[0]?.points || 0;
    const incident = Math.random() < incidentChanceFor(curPts) ? pickFrom(incidentPoolFor(curPts)) : null;
    if (incident) {
      // O clique azarado não pontua: o incidente desconta (nunca abaixo de 0).
      const { rows } = await pool.query(
        `INSERT INTO players (username, points) VALUES ($1, 0)
         ON CONFLICT (username)
         DO UPDATE SET points = GREATEST(0, players.points - $2), updated_at = now()
         RETURNING points`,
        [username, incident.loss]
      );
      return res.json({ username, points: rows[0].points, gained: 0, crit: false, incident, pod: POD_NAME });
    }
    const { rows } = await pool.query(
      `INSERT INTO players (username, points) VALUES ($1, $2)
       ON CONFLICT (username)
       DO UPDATE SET points = players.points + $2, updated_at = now()
       RETURNING points`,
      [username, gained]
    );
    res.json({ username, points: rows[0].points, gained, crit, pod: POD_NAME });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Estado completo (fase + lobby + placar) — o frontend faz polling aqui.
app.get('/api/state', async (_req, res) => {
  try {
    const match = await getMatchState();
    const [board, lobby] = await Promise.all([pool.query(BOARD_SQL), pool.query(LOBBY_SQL)]);
    res.json({
      mode: 'individual',
      round: match,
      leaderboard: board.rows,
      lobby: lobby.rows,
      pod: POD_NAME
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Controles do mestre da partida (página /admin) ----
// Inicia a partida: zera o placar e liga o cronômetro.
app.post('/api/admin/start', async (_req, res) => {
  try {
    await pool.query('UPDATE players SET points = 0');
    await pool.query(
      `UPDATE match_state SET status = 'intro', ends_at = now() + make_interval(secs => $1::int)`,
      [INTRO_SECONDS]
    );
    console.log(`[backend] partida iniciada pelo mestre (abertura de ${INTRO_SECONDS}s).`);
    res.json({ ok: true, phase: 'intro' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Volta todos para o lobby (sem cronômetro).
app.post('/api/admin/lobby', async (_req, res) => {
  try {
    await pool.query('UPDATE players SET points = 0');
    await pool.query(`UPDATE match_state SET status = 'lobby', ends_at = NULL`);
    console.log('[backend] jogo devolvido ao lobby pelo mestre.');
    res.json({ ok: true, phase: 'lobby' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const server = app.listen(PORT, async () => {
  console.log(`[backend ${APP_VERSION}] ouvindo na porta ${PORT} (pod: ${POD_NAME})`);
  // Retry sem desistir: o banco pode subir (ou ganhar permissões) depois do backend.
  for (let i = 1; ; i++) {
    try {
      await initSchema();
      console.log('[backend] esquema do banco verificado/criado.');
      return;
    } catch (err) {
      if (/does not support SSL/i.test(err.message)) {
        console.log('[backend] servidor sem TLS detectado, reconectando sem SSL...');
        pool = new Pool(dbConfig);
        continue;
      }
      console.log(`[backend] aguardando banco (tentativa ${i}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
});

// Encerramento gracioso: essencial para o rolling update sem perda de requisições.
process.on('SIGTERM', () => {
  console.log('[backend] SIGTERM recebido, encerrando graciosamente...');
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
});
