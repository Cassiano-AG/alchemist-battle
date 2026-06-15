// backend/v2/src/server.js
// Batalha do Backlog - Backend v2: MODO TIME ÚNICO (Parte 2 da demo).
// Toda a empresa luta junta: o progresso nos chefes é a SOMA dos pontos de
// todos os jogadores. Além dos incidentes, acontecem BÔNUS (Service IT,
// Red Hat, OpenShift) que dão pontos extras — em time, dá para vencer.
// Mesmo esquema de banco da v1 -> rolling update v1 -> v2 sem migração.
const express = require('express');
const { Pool } = require('pg');

const PORT = parseInt(process.env.PORT || '8080', 10);
const APP_VERSION = 'v2';
const GAME_COLOR = process.env.GAME_COLOR || '#f59e0b';
const POD_NAME = process.env.HOSTNAME || 'local';

const ROUND_SECONDS = 150;
// Abertura: letreiro estilo Star Wars (34s) + desfile dos 12 chefes (2s cada),
// tudo com o cronômetro parado.
const INTRO_SECONDS = 58;

// ---- Incidentes (chance fixa e menor que na v1: o time se protege) ----
const INCIDENT_CHANCE = 0.03;
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

// Quando o TIME chega à reta final (>= 700), a gerência entra em cena com
// prioridades erradas — as piadas do chefão aparecem para todo mundo.
const FINAL_INCIDENTS = [
  { name: 'O CEO pediu para "colocar IA" no formulário de férias', emoji: '🤖', loss: 30, weight: 10 },
  { name: 'Prioridade máxima: trocar o logo para o evento de amanhã', emoji: '🎨', loss: 35, weight: 9 },
  { name: 'Reorg surpresa: a TI agora se reporta ao Marketing', emoji: '📊', loss: 40, weight: 8 },
  { name: 'Congelamento de mudanças... exceto as do diretor', emoji: '🧊', loss: 45, weight: 7 },
  { name: 'O CEO viu um TikTok: agora tudo precisa ter Blockchain', emoji: '⛓️', loss: 50, weight: 6 },
  { name: 'Budget da TI cortado para patrocinar o camarote do evento', emoji: '💸', loss: 55, weight: 5 }
];

// ---- Bônus (a cavalaria chegou): pontos extras para o time ----
const BONUS_CHANCE = 0.05;
const BONUSES = [
  { name: 'O OpenShift reiniciou o pod antes do usuário perceber', emoji: '♻️', gain: 10, weight: 18 },
  { name: 'Pipeline GitOps: deploy em 30 segundos, zero downtime', emoji: '🚀', gain: 15, weight: 16 },
  { name: 'A Service IT entrou na war room e assumiu o incidente', emoji: '🤝', gain: 20, weight: 14 },
  { name: 'Suporte Red Hat respondeu em minutos com o patch pronto', emoji: '🐧', gain: 20, weight: 14 },
  { name: 'Auto-scaling segurou o pico de acessos sozinho', emoji: '📈', gain: 25, weight: 10 },
  { name: 'Backup automático restaurou o banco em 2 minutos', emoji: '💾', gain: 25, weight: 10 },
  { name: 'Time treinado pela Service IT resolveu sem abrir chamado', emoji: '🎓', gain: 30, weight: 8 },
  { name: 'Consultor da Service IT achou a causa raiz em 5 minutos', emoji: '🧙', gain: 35, weight: 6 },
  { name: 'Migração para OpenShift entregue pela Service IT antes do prazo', emoji: '🏆', gain: 50, weight: 4 }
];

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

const BOARD_SQL = 'SELECT username, points FROM players ORDER BY points DESC, username ASC LIMIT 8';
const LOBBY_SQL = 'SELECT username FROM players ORDER BY updated_at ASC LIMIT 60';
const TEAM_SQL = 'SELECT COALESCE(SUM(points), 0)::int AS total FROM players';

async function teamTotal() {
  const { rows } = await pool.query(TEAM_SQL);
  return rows[0].total;
}

// ---- Probes ----
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
  res.json({ version: APP_VERSION, mode: 'team', color: GAME_COLOR, pod: POD_NAME });
});

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
  const crit = Math.random() < 0.10;
  let gained = crit ? 5 : 1;
  try {
    const match = await getMatchState();
    if (match.phase !== 'playing') {
      return res.status(409).json({ error: 'a partida não está em andamento', match });
    }
    // Um único sorteio decide: incidente, bônus ou clique normal.
    // Na reta final do TIME, os incidentes de gerência entram no sorteio.
    const totalBefore = await teamTotal();
    const incidentPool = totalBefore >= 700 ? INCIDENTS.concat(FINAL_INCIDENTS) : INCIDENTS;
    const roll = Math.random();
    const incident = roll < INCIDENT_CHANCE ? pickFrom(incidentPool) : null;
    const bonus = !incident && roll < INCIDENT_CHANCE + BONUS_CHANCE ? pickFrom(BONUSES) : null;
    let rows;
    if (incident) {
      ({ rows } = await pool.query(
        `INSERT INTO players (username, points) VALUES ($1, 0)
         ON CONFLICT (username)
         DO UPDATE SET points = GREATEST(0, players.points - $2), updated_at = now()
         RETURNING points`,
        [username, incident.loss]
      ));
      gained = 0;
    } else {
      if (bonus) gained += bonus.gain;
      ({ rows } = await pool.query(
        `INSERT INTO players (username, points) VALUES ($1, $2)
         ON CONFLICT (username)
         DO UPDATE SET points = players.points + $2, updated_at = now()
         RETURNING points`,
        [username, gained]
      ));
    }
    const total = await teamTotal();
    res.json({
      username,
      points: rows[0].points,
      gained,
      crit: incident ? false : crit,
      incident,
      bonus,
      teamTotal: total,
      pod: POD_NAME
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leaderboard', async (_req, res) => {
  try {
    const [board, total] = await Promise.all([pool.query(BOARD_SQL), teamTotal()]);
    res.json({ mode: 'team', teamTotal: total, leaderboard: board.rows, pod: POD_NAME });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Estado completo (fase + time + contribuições + lobby) — polling do frontend.
app.get('/api/state', async (_req, res) => {
  try {
    const match = await getMatchState();
    const [board, lobby, total] = await Promise.all([
      pool.query(BOARD_SQL),
      pool.query(LOBBY_SQL),
      teamTotal()
    ]);
    res.json({
      mode: 'team',
      round: match,
      teamTotal: total,
      leaderboard: board.rows,
      lobby: lobby.rows,
      pod: POD_NAME
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Controles do mestre da partida (página /admin) ----
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

process.on('SIGTERM', () => {
  console.log('[backend] SIGTERM recebido, encerrando graciosamente...');
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
});
