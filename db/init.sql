-- db/init.sql
-- Esquema único compatível com v1 (individual) e v2 (guildas).
-- O backend também executa este DDL automaticamente no boot (idempotente),
-- então este arquivo serve como documentação/inicialização manual.

CREATE TABLE IF NOT EXISTS players (
    username   TEXT PRIMARY KEY,
    guild      TEXT CHECK (guild IN ('fogo', 'agua', 'terra')),
    points     INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_points ON players (points DESC);
CREATE INDEX IF NOT EXISTS idx_players_guild  ON players (guild);
