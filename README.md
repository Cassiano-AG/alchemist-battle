# ⚗️ Alchemist Battle

Jogo web de cliques em tempo real para demonstrações técnicas (pre-sales) de **Red Hat OpenShift**, em três fases: resiliência de pods (v1), rolling update com zero downtime (v2) e automação Dia 2 com Operadores + GitOps (ArgoCD).

> 🧭 **Primeira vez com OpenShift?** Siga o **[GUIA-EXECUCAO.md](GUIA-EXECUCAO.md)** — passo a passo do zero em um cluster da Red Hat Demo Platform (instalação do `oc`, operadores via OperatorHub, build das imagens no próprio cluster e roteiro completo das 3 fases).
>
> 🔄 **Cluster RHDP expirou?** Use o **[REDEPLOY.md](REDEPLOY.md)** — checklist de ~20 min para subir tudo de novo num ambiente novo, já com todas as correções embutidas.

## Arquitetura

```
Navegador ──HTTPS──> Route (edge TLS)
                       │
                Service alchemist-frontend (nginx não-privilegiado :8080)
                       │  proxy /api/
                Service alchemist-backend (Node.js/Express :8080, 3 réplicas)
                       │
                PostgreSQL (Crunchy Postgres Operator ou fallback)
```

## Estrutura do repositório

```
alchemist-battle/
├── backend/
│   ├── v1/                      # API: placar individual
│   └── v2/                      # API: modo guildas (Fogo, Água, Terra)
├── frontend/
│   ├── v1/                      # React + Vite (placar individual)
│   └── v2/                      # React + Vite (guerra de guildas)
├── db/
│   └── init.sql                 # Esquema (também criado pelo backend no boot)
├── k8s/
│   ├── v1/                      # Manifestos da v1 (kustomize)
│   ├── v2/                      # Manifestos da v2 (kustomize, mesmos nomes -> rolling update)
│   └── database/
│       ├── postgrescluster.yaml         # CR do Crunchy Postgres Operator
│       └── fallback-sem-operador/       # Postgres simples p/ clusters sem operador
└── argocd/
    ├── application-database.yaml
    └── application-game.yaml
```

## Pré-requisitos

- Cluster OpenShift 4.x e CLI `oc` logada com permissão no namespace `alchemist-battle`.
- Um registry acessível pelo cluster (ex.: quay.io). Substitua `SEU_USUARIO` nas imagens dos manifestos e nas Applications do ArgoCD.
- Fase 3: Operadores **OpenShift GitOps** e **Crunchy Postgres for Kubernetes** instalados via OperatorHub (console: Operators → OperatorHub → Install, escopo *All namespaces*).

## Build e push das imagens

```bash
# Backend
podman build -t quay.io/SEU_USUARIO/alchemist-backend:v1 backend/v1
podman build -t quay.io/SEU_USUARIO/alchemist-backend:v2 backend/v2
podman push quay.io/SEU_USUARIO/alchemist-backend:v1
podman push quay.io/SEU_USUARIO/alchemist-backend:v2

# Frontend
podman build -t quay.io/SEU_USUARIO/alchemist-frontend:v1 frontend/v1
podman build -t quay.io/SEU_USUARIO/alchemist-frontend:v2 frontend/v2
podman push quay.io/SEU_USUARIO/alchemist-frontend:v1
podman push quay.io/SEU_USUARIO/alchemist-frontend:v2
```

> Alternativa sem registry externo: `oc new-build` com os Dockerfiles e ajustar as imagens para o registry interno do cluster.

---

## Fase 1 — Resiliência (mata-pod)

```bash
oc new-project alchemist-battle

# Banco: com operador (recomendado)...
oc apply -f k8s/database/postgrescluster.yaml
# ...ou sem operador:
# oc apply -f k8s/database/fallback-sem-operador/postgres.yaml

# Jogo v1
oc apply -k k8s/v1

oc get route alchemist-battle -n alchemist-battle   # URL do jogo
```

**Roteiro da demo:** abra o jogo em alguns navegadores/celulares e deixe o público clicando. Em um terminal visível:

```bash
watch oc get pods -n alchemist-battle

# Em outro terminal, "mate" um pod do backend:
oc delete pod -n alchemist-battle $(oc get pod -n alchemist-battle -l app=alchemist-backend -o jsonpath='{.items[0].metadata.name}')
```

O que mostrar: o ReplicaSet recria o pod imediatamente; a `readinessProbe` (que valida a conexão com o banco em `/readyz`) só devolve o pod ao Service quando ele está pronto; o jogo nunca para — o rodapé da tela mostra qual pod atendeu cada clique, evidenciando o balanceamento entre as réplicas restantes.

## Fase 2 — Rolling update com zero downtime (v1 → v2)

Com o jogo v1 rodando e o público clicando:

```bash
oc apply -k k8s/v2
oc rollout status deployment/alchemist-backend -n alchemist-battle
```

Como os Deployments da v2 têm os **mesmos nomes** da v1 e usam `RollingUpdate` com `maxUnavailable: 0`, o OpenShift só remove um pod antigo quando o novo está `Ready` (probes), e o `preStop` + encerramento gracioso do Node garantem que nenhuma requisição em andamento caia. Em segundos a tela dos jogadores muda para o modo **Guerra de Guildas** (o frontend repõe o `/api/config` periodicamente) — sem nenhum erro no navegador.

Rollback instantâneo, se quiser mostrar: `oc apply -k k8s/v1`.

## Fase 3 — Operadores + GitOps (ArgoCD)

1. Faça fork/push deste repositório para o seu GitHub e substitua `repoURL` nos arquivos de `argocd/`.
2. Com OpenShift GitOps instalado:

```bash
oc apply -f argocd/application-database.yaml
oc apply -f argocd/application-game.yaml
```

**Demo de Operador (Dia 2):** mostre que o banco não é um Deployment comum — é um `PostgresCluster` gerenciado: o operador cria HA (2 instâncias), backups (pgBackRest) e o Secret de credenciais (`alchemist-db-pguser-alchemist`) consumido pelo backend. Delete o pod primário do Postgres e mostre o failover automático.

**Demo de GitOps (mudança de cor):** edite `GAME_COLOR` em `k8s/v1/kustomization.yaml` (ex.: `#22c55e`), commit e push. O `configMapGenerator` gera um ConfigMap com novo hash, o ArgoCD detecta o drift, sincroniza e dispara um rolling update automático — a cor do jogo muda na tela de todos sem nenhum comando no cluster.

**Demo de selfHeal:** altere algo direto no cluster (ex.: `oc scale deployment/alchemist-backend --replicas=1`) e mostre o ArgoCD restaurando o estado declarado no Git.

**Promoção v2 via Git:** mude `path: k8s/v1` para `path: k8s/v2` em `argocd/application-game.yaml`, commit, e o ArgoCD executa o rolling update da Fase 2 — agora 100% guiado pelo Git.

---

## Detalhes técnicos relevantes para a demo

- **Sem root:** backend em UBI9 Node 20 minimal (UID 1001) e frontend em `nginx-unprivileged` (porta 8080) — compatíveis com a SCC `restricted-v2` sem nenhuma permissão extra.
- **Probes:** `livenessProbe` (`/healthz`, processo vivo) e `readinessProbe` (`/readyz`, valida o PostgreSQL) em todos os Deployments, com `resources.requests/limits` definidos.
- **Zero downtime:** `maxUnavailable: 0`, `preStop: sleep 5` e tratamento de `SIGTERM` no backend.
- **Esquema único de banco** entre v1 e v2 (coluna `guild` opcional): o rolling update não exige migração, e os pontos individuais da v1 são preservados.
- **API:** `POST /api/click`, `GET /api/leaderboard`, `GET /api/config` (cor/versão/modo — usado pelo frontend a cada poucos segundos, o que faz a transição v1→v2 e a troca de cor aparecerem "ao vivo").

## Desenvolvimento local

```bash
# Banco
podman run -d --name pg -e POSTGRES_USER=alchemist -e POSTGRES_PASSWORD=alchemist \
  -e POSTGRES_DB=alchemist -p 5432:5432 docker.io/library/postgres:16-alpine

# Backend (porta 8080)
cd backend/v1 && npm install && npm start

# Frontend (porta 5173, proxy /api -> 8080)
cd frontend/v1 && npm install && npm run dev
```
