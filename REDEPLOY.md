# 🔄 REDEPLOY — Subir a demo do zero em um cluster RHDP novo

Checklist objetivo para quando o ambiente da demo.redhat.com expirar. Tempo total: **~20 minutos**, a maior parte esperando builds. Todas as correções descobertas na primeira instalação **já estão embutidas no repositório** — não há mais ajustes manuais de Dockerfile, imagem ou permissão de banco.

> ⚠️ **Regra de ouro:** o projeto DEVE se chamar `alchemist-battle`. Os Deployments apontam para `image-registry.openshift-image-registry.svc:5000/alchemist-battle/...` — outro nome de projeto quebra as imagens.

---

## 1. Solicitar e acessar o cluster (~10 min de provisionamento)

1. Em **https://demo.redhat.com**, solicite o mesmo item de catálogo (cluster OpenShift com admin, ex.: "OpenShift Single Node Cluster").
2. Quando chegar o e-mail/página com os acessos, abra o **console web** e faça login como admin.
3. Conecte o terminal: console → seu usuário (canto superior direito) → **Copy login command** → **Display Token** → cole o `oc login --token=...` no **Prompt de Comando ou PowerShell**.
4. Confirme: `oc whoami` deve responder `admin`.

> A CLI `oc` já está instalada no seu PC. Se trocar de máquina: console → ícone **?** → Command Line Tools.

## 2. Instalar o operador do banco (~3 min)

No console web: **Operators → OperatorHub** → busque **"Crunchy Postgres for Kubernetes"** → **Install** (padrões, *All namespaces*) → aguarde **Succeeded** em Installed Operators.

## 3. Criar o projeto

```
cd "C:\Users\cassi\Claude\Projects\Demonstrações Openshift\alchemist-battle"
oc new-project alchemist-battle
```

## 4. Construir as 4 imagens (~8 min, um por vez)

```
oc new-build --name=alchemist-backend-v1 --strategy=docker --binary
oc start-build alchemist-backend-v1 --from-dir=backend/v1 --follow

oc new-build --name=alchemist-backend-v2 --strategy=docker --binary
oc start-build alchemist-backend-v2 --from-dir=backend/v2 --follow

oc new-build --name=alchemist-frontend-v1 --strategy=docker --binary
oc start-build alchemist-frontend-v1 --from-dir=frontend/v1 --follow

oc new-build --name=alchemist-frontend-v2 --strategy=docker --binary
oc start-build alchemist-frontend-v2 --from-dir=frontend/v2 --follow
```

Cada um deve terminar com **`Push successful`**.

## 5. Subir o banco (~3 min)

```
oc apply -f k8s/database/postgrescluster.yaml
oc get pods -w
```

Aguarde os 2 pods `alchemist-db-instance1-...` chegarem a `4/4 Running` (`Ctrl+C` para sair). O arquivo já inclui o `databaseInitSQL` que entrega o schema ao usuário da aplicação — **a correção manual do `ALTER SCHEMA` não é mais necessária** em cluster novo. Confira o Secret:

```
oc get secret alchemist-db-pguser-alchemist
```

## 6. Subir o jogo (v1)

```
oc apply -k k8s/v1
oc get pods
```

Espere backend (3 pods) e frontend (2 pods) ficarem `1/1 Running`. Os logs do backend devem mostrar `esquema do banco verificado/criado`:

```
oc logs deploy/alchemist-backend --tail=3
```

## 7. Pegar as URLs e testar

```
oc get route alchemist-battle -o jsonpath="https://{.spec.host}"
```

- **Jogadores**: a URL acima.
- **Sala do Gerente**: a mesma URL **+ `/admin`** (sem senha — não exiba no telão).

Teste rápido: bata o ponto com um nome, abra `/admin` em outra aba, clique **▶ Iniciar o sprint** → letreiro Star Wars → desfile dos 12 chefes → batalha.

## 8. Parte 2 da demo (quando chegar a hora)

Com o jogo v1 rodando e a plateia clicando:

```
oc apply -k k8s/v2
```

Rolling update sem downtime → a tela de todos vira o **modo time único** com os bônus da Service IT/Red Hat. Para voltar: `oc apply -k k8s/v1`.

## 9. (Opcional) Fase 3 — GitOps

Requer o repo no GitHub (público) com `repoURL` ajustado em `argocd/*.yaml`:

1. OperatorHub → instalar **Red Hat OpenShift GitOps** → aguardar Succeeded.
2. `oc adm policy add-cluster-role-to-user cluster-admin -z openshift-gitops-argocd-application-controller -n openshift-gitops`
3. `oc apply -f argocd/application-database.yaml` e `oc apply -f argocd/application-game.yaml`
4. UI: `oc get route openshift-gitops-server -n openshift-gitops -o jsonpath="https://{.spec.host}"` → "Log in via OpenShift".

---

## Problemas conhecidos (e que já têm resposta)

| Sintoma | Solução |
|---|---|
| `Unauthorized` no terminal | Token expirou: repita o Copy login command (passo 1.3) |
| Build falha com `connection refused` interno | Cluster reiniciando/instável: espere 2 min e repita o `start-build` |
| Backend `1/1` mas jogo com "Reconectando" | `oc logs deploy/alchemist-backend` — se aparecer `permission denied for schema public` (só acontece se o passo 5 foi pulado/alterado): `oc exec -it $(oc get pod -l postgres-operator.crunchydata.com/role=master -o name) -c database -- psql -d alchemist -c "ALTER SCHEMA public OWNER TO alchemist;"` e `oc rollout restart deployment/alchemist-backend` |
| `PostgresCluster` não cria nada | Operador Crunchy não instalado (passo 2) |
| Navegador mostrando versão antiga | **Ctrl+F5** |
| Pods sumiram do nada | Cluster RHDP hibernou/expirou — verifique em demo.redhat.com |

## Ajustes finos (onde mexer)

| O quê | Onde |
|---|---|
| Duração da partida / abertura | `ROUND_SECONDS` / `INTRO_SECONDS` nos dois `backend/*/src/server.js` |
| Velocidade do letreiro | `CRAWL_SECONDS` nos `App.jsx` + duração do `crawl-up` nos `styles.css` |
| Chance/lista de incidentes e bônus | Topo dos dois `server.js` |
| Textos do letreiro e epílogos | `frontend/*/src/App.jsx` |

Depois de qualquer ajuste: `oc start-build <nome> --from-dir=<pasta> --follow` + `oc rollout restart deployment/<deployment>` + Ctrl+F5.
