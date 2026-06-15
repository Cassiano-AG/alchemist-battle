// frontend/v2/src/App.jsx
// v2: MODO TIME ÚNICO (Parte 2 da demo). Toda a empresa no mesmo time:
// o chefe da vez é derrotado pela SOMA dos pontos de todos. Além dos
// incidentes, aparecem BÔNUS (Service IT, Red Hat, OpenShift) — juntos,
// dá para derrotar até o CEO.
import { useEffect, useRef, useState } from 'react';
import { Sprite, MAGE, MAGE_PALETTE, BOSSES, bossFor, bossIndex } from './sprites.jsx';

const POLL_MS = 1000;
const COMBO_WINDOW_MS = 1200;
const CRAWL_SECONDS = 34; // duração do letreiro de abertura
const MEDALS = ['🥇', '🥈', '🥉'];
const IS_ADMIN = window.location.pathname.startsWith('/admin');

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

let uid = 0;

// ---- Página do Mestre da Partida (/admin) ----
function AdminPanel() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = () =>
      fetch('/api/state').then((r) => r.json()).then(setState).catch(() => {});
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const act = async (path) => {
    setBusy(true);
    try { await fetch(path, { method: 'POST' }); } catch { /* polling atualiza */ }
    setBusy(false);
  };

  if (!state) return <div className="screen"><h1>🎛️ Sala do Gerente (PMO)</h1><p className="subtitle">carregando...</p></div>;

  const phase = state.round?.phase || 'lobby';
  return (
    <div className="screen admin">
      <h1>🎛️ Sala do Gerente (PMO)</h1>
      <span className="badge">
        {phase === 'lobby' && '🟡 LOBBY — aguardando o kick-off'}
        {phase === 'intro' && '🎬 APRESENTANDO OS CHEFES...'}
        {phase === 'playing' && `🟢 SPRINT EM ANDAMENTO — ${fmt(state.round.remaining)}`}
        {phase === 'ended' && '🔴 SPRINT ENCERRADO'}
      </span>

      <div className="admin-actions">
        {(phase === 'lobby' || phase === 'ended') && (
          <button className="start" disabled={busy} onClick={() => act('/api/admin/start')}>
            ▶ Iniciar o sprint ({fmt(state.round?.duration || 150)})
          </button>
        )}
        {phase !== 'lobby' && (
          <button className="stop" disabled={busy} onClick={() => act('/api/admin/lobby')}>
            🔁 Retrospectiva (voltar todos ao lobby)
          </button>
        )}
      </div>

      <section className="board">
        <h2>🧑‍💻 Analistas conectados ({state.lobby?.length || 0})</h2>
        <div className="chips">
          {(state.lobby || []).map((p) => (
            <span className="chip" key={p.username}>{p.username}</span>
          ))}
          {(state.lobby || []).length === 0 && <span className="muted">ninguém bateu o ponto ainda</span>}
        </div>
      </section>

      {phase !== 'lobby' && (
        <section className="board">
          <h2>🏢 Placar da Empresa</h2>
          <p className="team-total"><strong>{state.teamTotal || 0}</strong> pts de produtividade do time</p>
          <ol>
            {(state.leaderboard || []).map((p, i) => (
              <li key={p.username}>
                <span className="rank">{MEDALS[i] || `${i + 1}.`}</span>
                <span className="who">{p.username}</span>
                <strong>{p.points}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer>pod: <code>{state.pod}</code></footer>
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState(() => localStorage.getItem('alchemist_user') || '');
  const [joined, setJoined] = useState(() => Boolean(localStorage.getItem('alchemist_user')));
  const [myPoints, setMyPoints] = useState(0);
  const [teamTotal, setTeamTotal] = useState(0);
  const [board, setBoard] = useState([]);
  const [lobby, setLobby] = useState([]);
  const [round, setRound] = useState({ phase: 'lobby', remaining: 0, duration: 150 });
  const [config, setConfig] = useState({ version: 'v2', color: '#f59e0b' });
  const [servedBy, setServedBy] = useState('');
  const [offline, setOffline] = useState(false);
  const [bolts, setBolts] = useState([]);
  const [floats, setFloats] = useState([]);
  const [combo, setCombo] = useState(0);
  const [bossHit, setBossHit] = useState(false);
  const [spawnKey, setSpawnKey] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [events, setEvents] = useState([]);
  const [showBoard, setShowBoard] = useState(false);
  const epiTimer = useRef(null);
  const lastClickAt = useRef(0);
  const prevTeam = useRef(0);
  const prevPhase = useRef('lobby');
  const comboTimer = useRef(null);
  const crawlDelay = useRef(null);

  // O chefe da vez é do TIME: avança (e regride) pela soma de todos.
  const boss = bossFor(teamTotal);

  useEffect(() => {
    fetch('/api/config').then((r) => r.json()).then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (!joined || !username) return;
    fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    }).catch(() => {});
  }, [joined, username]);

  const pushToast = (msg, kind = '') => {
    const id = ++uid;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind ? 5200 : 2600);
  };

  // Mural lateral: histórico dos 5 últimos eventos (repetidos agrupam em ×N).
  const addEvent = (kind, emoji, name, delta) => {
    setEvents((ev) => {
      if (ev[0] && ev[0].name === name) {
        return [{ ...ev[0], count: ev[0].count + 1, id: ++uid }, ...ev.slice(1)];
      }
      return [{ id: ++uid, kind, emoji, name, delta, count: 1 }, ...ev].slice(0, 10);
    });
  };

  // Transições de chefe valem para o TIME (clique meu, do colega ou polling).
  const applyTeamTotal = (total) => {
    if (typeof total !== 'number') return;
    const before = bossFor(prevTeam.current);
    const after = bossFor(total);
    if (before !== after) {
      setSpawnKey((k) => k + 1);
      if (total > prevTeam.current) {
        if (before) pushToast(`✅ ${before.name}: resolvido!`);
        if (!after) pushToast('🏆 A TI VENCEU! Até o CEO aprovou o orçamento!', 'bonus');
      } else if (after) {
        pushToast(`😱 ${after.name} voltou!`, 'incident');
      }
    }
    prevTeam.current = total;
    setTeamTotal(total);
  };

  useEffect(() => {
    if (!joined) return;
    const tick = () =>
      fetch('/api/state')
        .then((r) => r.json())
        .then((d) => {
          setBoard(d.leaderboard || []);
          setLobby(d.lobby || []);
          if (d.round) {
            if (prevPhase.current !== 'playing' && d.round.phase === 'playing') {
              setMyPoints(0);
              prevTeam.current = 0;
              setTeamTotal(0);
              setEvents([]);
              setSpawnKey((k) => k + 1);
              pushToast('🚨 O sprint começou! Toda a empresa no mesmo time!');
            }
            if (d.round.phase !== 'intro') crawlDelay.current = null;
            if (prevPhase.current !== 'ended' && d.round.phase === 'ended') {
              // Primeiro o epílogo, depois o placar (botão ou automático em 15s).
              setShowBoard(false);
              clearTimeout(epiTimer.current);
              epiTimer.current = setTimeout(() => setShowBoard(true), 15000);
            }
            prevPhase.current = d.round.phase;
            setRound(d.round);
          }
          applyTeamTotal(d.teamTotal);
          setOffline(false);
        })
        .catch(() => setOffline(true));
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);

  const fireBolt = (crit) => {
    const id = ++uid;
    setBolts((b) => [...b, { id, crit, y: (Math.random() - 0.5) * 30 }]);
    setTimeout(() => setBolts((b) => b.filter((x) => x.id !== id)), 450);
  };

  const floatText = (text, crit) => {
    const id = ++uid;
    setFloats((f) => [...f, { id, text, crit, x: (Math.random() - 0.5) * 60 }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1000);
  };

  const attack = async () => {
    if (round.phase !== 'playing') return;
    const now = Date.now();
    setCombo((c) => (now - lastClickAt.current < COMBO_WINDOW_MS ? c + 1 : 1));
    lastClickAt.current = now;
    clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => setCombo(0), COMBO_WINDOW_MS);

    fireBolt(false);
    setBossHit(true);
    setTimeout(() => setBossHit(false), 140);

    try {
      const r = await fetch('/api/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (r.status === 409) return;
      if (!r.ok) throw new Error('falha');
      const d = await r.json();
      setServedBy(d.pod);
      setOffline(false);
      if (d.incident) {
        pushToast(`${d.incident.emoji} ${d.incident.name} (-${d.incident.loss})`, 'incident');
        addEvent('incident', d.incident.emoji, d.incident.name, d.incident.loss);
        floatText(`💸 -${d.incident.loss}`, true);
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
      } else if (d.bonus) {
        pushToast(`${d.bonus.emoji} ${d.bonus.name} (+${d.bonus.gain})`, 'bonus');
        addEvent('bonus', d.bonus.emoji, d.bonus.name, d.bonus.gain);
        floatText(`🎉 +${d.gained}`, true);
        fireBolt(true);
      } else {
        floatText(d.crit ? `💥 HOTFIX! -${d.gained}` : `-${d.gained}`, d.crit);
        if (d.crit) {
          fireBolt(true);
          setShaking(true);
          setTimeout(() => setShaking(false), 400);
        }
      }
      setMyPoints(d.points);
      applyTeamTotal(d.teamTotal);
    } catch {
      setOffline(true);
    }
  };

  const join = (e) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;
    localStorage.setItem('alchemist_user', name);
    setUsername(name);
    setJoined(true);
  };

  if (IS_ADMIN) return <AdminPanel />;

  if (!joined) {
    return (
      <div className="screen" style={{ '--accent': config.color }}>
        <h1>⚔️ Batalha do Backlog</h1>
        <p className="subtitle">
          Parte 2: agora é todo mundo no MESMO time — e com a Service IT e a Red Hat na retaguarda, dá para derrotar até o CEO.
        </p>
        <div className="preview">
          <Sprite map={MAGE} palette={MAGE_PALETTE} scale={5} />
          <span className="vs">VS</span>
          <Sprite map={BOSSES[0].map} palette={BOSSES[0].palette} scale={5} />
        </div>
        <form className="join" onSubmit={join}>
          <input
            value={username}
            maxLength={30}
            placeholder="Seu nome de analista"
            onChange={(e) => setUsername(e.target.value)}
          />
          <button type="submit">Bater o ponto</button>
        </form>
        <span className="badge">versão {config.version} · modo time único</span>
      </div>
    );
  }

  // ---- Lobby ----
  if (round.phase === 'lobby') {
    return (
      <div className="screen" style={{ '--accent': config.color }}>
        <h1>⚔️ Batalha do Backlog</h1>
        <span className="badge">versão {config.version} · lobby</span>
        {offline && <div className="warn">⚠️ Reconectando...</div>}
        <div className="preview">
          <Sprite map={MAGE} palette={MAGE_PALETTE} scale={6} className="idle" />
        </div>
        <p className="waiting">☕ Aguardando o gerente dar o kick-off<span className="dots">...</span></p>
        <section className="board">
          <h2>🧑‍💻 Analistas no lobby ({lobby.length})</h2>
          <div className="chips">
            {lobby.map((p) => (
              <span className={`chip ${p.username === username ? 'me' : ''}`} key={p.username}>
                {p.username}
              </span>
            ))}
          </div>
        </section>
        <div className="toasts">
          {toasts.map((t) => <div key={t.id} className={`toast ${t.kind || ''}`}>{t.msg}</div>)}
        </div>
      </div>
    );
  }

  // ---- Abertura: letreiro Star Wars + desfile dos chefes (timer parado) ----
  if (round.phase === 'intro') {
    const total = round.duration || 50;
    const elapsed = Math.max(0, total - round.remaining);
    if (elapsed < CRAWL_SECONDS) {
      // Sincroniza quem entrou no meio: a animação "volta no tempo" certo.
      if (crawlDelay.current === null) crawlDelay.current = elapsed;
      return (
        <div className="screen crawl-screen">
          <div className="stars" aria-hidden="true" />
          <div className="crawl">
            <div className="crawl-content" style={{ animationDelay: `-${crawlDelay.current}s` }}>
              <p className="crawl-pre">Há muito tempo, numa empresa não muito distante...</p>
              <h2 className="crawl-title">BATALHA DO BACKLOG</h2>
              <h3 className="crawl-ep">EPISÓDIO V — O TIME CONTRA-ATACA</h3>
              <p>Sozinho, o ANALISTA DE TI lutou bravamente. E perdeu. O CEO segue lendo sobre IA e Blockchain em pleno voo.</p>
              <p>Mas algo mudou na galáxia corporativa: a empresa INTEIRA resolveu entrar na batalha. Dev, Infra, Suporte — todos no MESMO time.</p>
              <p>E desta vez há reforços: a SERVICE IT assumiu a war room e a RED HAT chegou com os patches prontos. O OpenShift reinicia pods antes de alguém perceber.</p>
              <p>Os incidentes ainda virão. O estagiário ainda existe. Mas agora, cada clique soma para todos.</p>
              <p>JUNTOS, eles têm 2 MINUTOS E 30 SEGUNDOS para fazer o que ninguém conseguiu sozinho.</p>
              <p className="crawl-final">CONHEÇA (DE NOVO) OS 12 CHEFES DO BACKLOG...</p>
            </div>
          </div>
        </div>
      );
    }
    const paradeTotal = Math.max(1, total - CRAWL_SECONDS);
    const idx = Math.min(
      BOSSES.length - 1,
      Math.max(0, Math.floor(((elapsed - CRAWL_SECONDS) / paradeTotal) * BOSSES.length))
    );
    const b = BOSSES[idx];
    return (
      <div className="screen" style={{ '--accent': b.accent }}>
        <h1>⚔️ Batalha do Backlog</h1>
        <span className="badge">🎬 conheça seus inimigos</span>
        <div className="intro-card" key={idx}>
          <span className="boss-label">CHEFE {idx + 1} DE {BOSSES.length}</span>
          <Sprite map={b.map} palette={b.palette} scale={10} className="idle" />
          <span className="boss-name big" style={{ color: b.accent }}>{b.name}</span>
          <span className="intro-hp">{b.to - b.from} HP</span>
        </div>
        <p className="next">o sprint começa em <strong>{round.remaining}s</strong><span className="dots">...</span></p>
        <div className="toasts">
          {toasts.map((t) => <div key={t.id} className={`toast ${t.kind || ''}`}>{t.msg}</div>)}
        </div>
      </div>
    );
  }

  const hpMax = boss ? boss.to - boss.from : 1;
  const hpNow = boss ? boss.to - teamTotal : 0;
  const topPlayer = board[0];

  return (
    <div className="screen" style={{ '--accent': config.color }}>
      <header>
        <h1>⚔️ Batalha do Backlog</h1>
        <span className="badge">versão {config.version} · modo time único</span>
      </header>

      {offline && <div className="warn">⚠️ Reconectando à arena...</div>}

      <div className={`timer ${round.phase === 'playing' && round.remaining <= 10 ? 'urgent' : ''}`}>
        ⏳ {fmt(round.remaining)}
      </div>

      <div
        className={`arena ${shaking ? 'shake' : ''}`}
        onClick={attack}
        role="button"
        tabIndex={0}
        style={{ '--boss-glow': boss ? boss.accent : '#fbbf24' }}
      >
        {boss ? (
          <div className="boss-banner">
            <span className="boss-label">CHEFE {bossIndex(boss) + 1} DE {BOSSES.length} · TIME ÚNICO</span>
            <span className="boss-name" style={{ color: boss.accent }}>{boss.name}</span>
            <div className="hp-bar">
              <div
                className="hp-fill"
                style={{ width: `${(hpNow / hpMax) * 100}%`, background: boss.accent }}
              />
              <span className="hp-num">{hpNow} HP</span>
            </div>
          </div>
        ) : (
          <div className="boss-banner">
            <span className="boss-name">🏆 A TI VENCEU! Todos os chefes resolvidos!</span>
          </div>
        )}

        {combo >= 5 && (
          <div className="combo" style={{ fontSize: `${Math.min(1 + combo * 0.04, 2)}rem` }}>
            🔥 FLOW x{combo}
          </div>
        )}

        <div className="fighter mage">
          <Sprite map={MAGE} palette={MAGE_PALETTE} scale={6} className="idle" />
          <span className="tag">{username}</span>
        </div>

        {bolts.map((b) => (
          <span key={b.id} className={`bolt ${b.crit ? 'crit' : ''}`} style={{ '--y': `${b.y}px` }}>
            ☕
          </span>
        ))}

        {boss ? (
          <div key={spawnKey} className={`fighter boss spawn ${bossHit ? 'hit' : ''}`}>
            <Sprite map={boss.map} palette={boss.palette} scale={7} className="idle boss-idle" />
          </div>
        ) : (
          <div className="fighter boss">
            <div className="champion">🏆</div>
          </div>
        )}

        {floats.map((f) => (
          <span key={f.id} className={`float ${f.crit ? 'crit' : ''}`} style={{ '--x': `${f.x}px` }}>
            {f.text}
          </span>
        ))}

        <p className="hint">🖱️ clique para resolver chamados — o dano é do time inteiro!</p>
      </div>

      <button className="attack-btn" onClick={attack}>🖱️ Resolver chamado pelo time</button>

      <p className="mypoints">
        <strong>{username}</strong> · sua contribuição: <strong key={myPoints} className="bump">{myPoints}</strong> pts
      </p>

      <section className="board">
        <h2>🏢 Placar da Empresa</h2>
        <p className="team-total">
          <strong key={teamTotal} className="bump">{teamTotal}</strong> pts de produtividade do time
        </p>
        <ol>
          {board.map((p, i) => (
            <li key={p.username} className={p.username === username ? 'me' : ''}>
              <span className="rank">{MEDALS[i] || `${i + 1}.`}</span>
              <span className="who">{p.username}</span>
              <strong key={p.points} className="bump">{p.points}</strong>
            </li>
          ))}
        </ol>
      </section>

      <aside className="event-feed">
        <h3>📟 MURAL DO PLANTÃO</h3>
        {events.length === 0 ? (
          <span className="muted">tudo calmo... por enquanto</span>
        ) : (
          events.map((e) => (
            <div key={e.id} className={`event ${e.kind}`}>
              <span>{e.emoji}</span>
              <span className="ev-text">{e.name}</span>
              <span className="ev-delta">{e.kind === 'bonus' ? '+' : '-'}{e.delta}{e.count > 1 ? ` ×${e.count}` : ''}</span>
            </div>
          ))
        )}
      </aside>

      {round.phase === 'ended' && (
        <div className="overlay">
          {!showBoard ? (
            <div className="epilogue">
              {teamTotal >= 1000 ? (
                <>
                  <h2 className="epi-title">🏆 ATA DA VITÓRIA</h2>
                  <p className="epi-text">O impossível aconteceu: a TI venceu. <strong>Juntos.</strong></p>
                  <p className="epi-text">A Service IT assumiu a war room, a Red Hat trouxe os patches, o OpenShift segurou os pods — e até o CEO largou o artigo sobre Blockchain para aplaudir.</p>
                  <p className="epi-text">O estagiário? Promovido. <small>(Para bem longe do banco de prod.)</small></p>
                  <p className="epi-text">A retrospectiva foi cancelada por excesso de sucesso.</p>
                </>
              ) : (
                <>
                  <h2 className="epi-title">📋 RELATÓRIO DE FIM DE SPRINT</h2>
                  <p className="epi-text">Nem juntos desta vez... o backlog é implacável.</p>
                  <p className="epi-text">Mas o time sentiu o gosto: com a Service IT e a Red Hat na retaguarda, o CEO chegou a tremer. Peçam ao gerente para reabrir o sprint — dessa vez ele cai.</p>
                </>
              )}
              <button onClick={() => setShowBoard(true)}>📊 Ver o placar do sprint</button>
            </div>
          ) : (
            <>
              <h2>⏰ Fim do sprint!</h2>
              <p className="winner">
                🏢 O time fechou o sprint com <strong>{teamTotal}</strong> pts
                {teamTotal >= 1000 ? ' — e DERROTOU O CEO! 🏆' : '!'}
              </p>
              {topPlayer && (
                <p className="next">MVP do sprint: <strong>{topPlayer.username}</strong> ({topPlayer.points} pts)</p>
              )}
              <div className="overlay-board">
                <ol>
                  {board.map((p, i) => (
                    <li key={p.username} className={p.username === username ? 'me' : ''}>
                      <span>{MEDALS[i] || `${i + 1}.`}</span>
                      <span className="who">{p.username}</span>
                      <strong>{p.points}</strong>
                    </li>
                  ))}
                </ol>
              </div>
              <p className="next">aguardando o gerente abrir o próximo sprint<span className="dots">...</span></p>
            </>
          )}
        </div>
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind || ''}`}>{t.msg}</div>
        ))}
      </div>

      {servedBy && <footer>último chamado atendido pelo pod: <code>{servedBy}</code></footer>}
    </div>
  );
}
