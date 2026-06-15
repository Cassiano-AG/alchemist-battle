# 🧭 Guia de Execução — Alchemist Battle no OpenShift (do zero)

Este guia assume que você **nunca usou OpenShift** e foi escrito para um cluster da **Red Hat Demo Platform (RHDP / demo.redhat.com)** — você tem acesso de **administrador**, o que permite executar as **3 fases completas** da demo, incluindo Operadores e GitOps.

---

## 1. Conceitos mínimos (2 minutos de leitura)

Você só precisa destes termos para seguir o guia:

| Termo | O que é, em uma frase |
|---|---|
| **Cluster** | O conjunto de servidores onde o OpenShift roda. O seu é da RHDP (trial de 60 dias). |
| **Projeto / Namespace** | Uma "pasta" dentro do cluster. Tudo que você criar vive dentro dela. |
| **Imagem** | O "pacote" com a aplicação pronta para rodar (gerada a partir dos Dockerfiles do repo). |
| **Pod** | Uma cópia da aplicação em execução. Nosso backend roda com 3 pods ao mesmo tempo. |
| **Route** | O endereço público (URL) que o OpenShift cria para acessar o jogo no navegador. |
| **Operador** | Um "robô" instalado no cluster que gerencia software complexo sozinho (ex.: PostgreSQL com alta disponibilidade e backups). |
| **ArgoCD / GitOps** | Ferramenta que mantém o cluster sempre igual ao que está descrito no Git: mudou no Git, muda no cluster — automaticamente. |

Fluxo completo: instalar a `oc` → conectar no cluster → criar o projeto → instalar o operador de banco → construir as imagens → subir o jogo → demos (mata-pod, rolling update, GitOps).

**Sobre o seu cluster:** ele tem **1 nó só** (single node) — perfeito para a demo de resiliência de *pods*; apenas não dá para demonstrar falha de *servidor*. A validade aparece no painel (ex.: "59 days remaining") e o agendamento/extensão é gerenciado em https://demo.redhat.com (serviços RHDP costumam ter auto-desligamento — verifique o *runtime* do seu serviço lá).

---

## 2. Instalar as ferramentas no seu computador (Windows)

Você precisa da CLI **`oc`** e do **Git**.

**Instalar a `oc`:**

1. No console web do cluster, clique no ícone **"?"** (canto superior direito) → **Command Line Tools**.
2. Baixe **oc for Windows** (.zip) e extraia em uma pasta fixa, ex.: `C:\oc\`.
3. Adicione ao PATH: menu Iniciar → digite "variáveis de ambiente" → Variáveis de Ambiente → em `Path` → Editar → Novo → `C:\oc\` → OK.
4. Abra um **novo** PowerShell e teste:

```powershell
oc version
```

**Instalar o Git** (se `git --version` falhar): https://git-scm.com/download/win — instale com as opções padrão.

---

## 3. Conectar o terminal ao cluster (login)

1. No console web, clique em **admin** (canto superior direito) → **Copy login command**.
2. Na página que abrir, clique em **Display Token**.
3. Copie o comando completo `oc login --token=... --server=...` e cole no PowerShell.

> 💡 A RHDP também envia (no e-mail/página do serviço) usuário e senha `kubeadmin` — servem para o console web. Para o terminal, o caminho do token acima é o mais simples.
>
> ⚠️ O token expira após algumas horas. Se aparecer `Unauthorized`, repita este passo.

---

## 4. Criar o projeto

Como você é admin, pode criar o projeto com o nome que os manifestos já esperam — **nenhum ajuste de namespace é necessário**:

```powershell
oc new-project alchemist-battle
```

---

## 5. Instalar o operador do PostgreSQL (Crunchy)

Pelo **console web**:

1. Menu lateral → **Operators → OperatorHub**.
2. Busque por **"Crunchy Postgres for Kubernetes"**.
3. Clique em **Install** e aceite os padrões (modo *All namespaces on the cluster*).
4. Aguarde aparecer em **Operators → Installed Operators** com status **Succeeded** (1–3 min).

É isso. Quando você criar o recurso `PostgresCluster` (seção 7), esse operador vai montar o banco com 2 instâncias, failover automático, backups e até o Secret de credenciais que o backend usa — sem você configurar nada disso na mão. Esse é exatamente o argumento da "automação de Dia 2" da Fase 3.

---

## 6. Construir as imagens dentro do próprio cluster

Você não precisa instalar Docker/Podman: o OpenShift constrói as imagens usando os Dockerfiles do repositório (*binary build* — você envia a pasta, ele constrói lá dentro).

Abra o PowerShell na pasta do projeto:

```powershell
cd "C:\Users\cassi\Claude\Projects\Demonstrações Openshift\alchemist-battle"
```

Execute os 4 blocos, um de cada vez (cada build leva 1–3 min; aguarde o `Push successful`):

```powershell
# Backend v1
oc new-build --name=alchemist-backend-v1 --strategy=docker --binary
oc start-build alchemist-backend-v1 --from-dir=backend/v1 --follow

# Backend v2
oc new-build --name=alchemist-backend-v2 --strategy=docker --binary
oc start-build alchemist-backend-v2 --from-dir=backend/v2 --follow

# Frontend v1
oc new-build --name=alchemist-frontend-v1 --strategy=docker --binary
oc start-build alchemist-frontend-v1 --from-dir=frontend/v1 --follow

# Frontend v2
oc new-build --name=alchemist-frontend-v2 --strategy=docker --binary
oc start-build alchemist-frontend-v2 --from-dir=frontend/v2 --follow
```

As imagens ficam no registry interno do cluster. Aponte os Deployments para elas (copie e cole exatamente assim — sem nada para substituir):

```powershell
$reg = 'image-registry.openshift-image-registry.svc:5000/alchemist-battle'
Get-ChildItem -Recurse -Include *.yaml -Path k8s | ForEach-Object {
  (Get-Content $_.FullName) `
    -replace 'quay.io/SEU_USUARIO/alchemist-backend:v1',  "$reg/alchemist-backend-v1:latest" `
    -replace 'quay.io/SEU_USUARIO/alchemist-backend:v2',  "$reg/alchemist-backend-v2:latest" `
    -replace 'quay.io/SEU_USUARIO/alchemist-frontend:v1', "$reg/alchemist-frontend-v1:latest" `
    -replace 'quay.io/SEU_USUARIO/alchemist-frontend:v2', "$reg/alchemist-frontend-v2:latest" `
    | Set-Content $_.FullName
}
```

---

## 7. Subir o banco de dados (via Operador)

```powershell
oc apply -f k8s/database/postgrescluster.yaml
oc get pods -w
```

Aguarde os pods `alchemist-db-instance1-...` ficarem `Running` (a primeira vez leva 2–4 min, inclui criação de volumes) e pressione `Ctrl+C`.

**O que aconteceu nos bastidores:** o operador criou 2 instâncias de PostgreSQL com replicação, um repositório de backup (pgBackRest) e o Secret `alchemist-db-pguser-alchemist` com host, porta, usuário e senha — que os Deployments do backend já consomem. Confira:

```powershell
oc get secret alchemist-db-pguser-alchemist
```

> 🔁 Plano B (se preferir não usar o operador nas Fases 1–2): `oc apply -f k8s/database/fallback-sem-operador/postgres.yaml` cria um PostgreSQL simples com o mesmo Secret.

---

## 8. Fase 1 — Subir o jogo (v1) e demonstrar resiliência

```powershell
oc apply -k k8s/v1
oc get pods
```

Em ~1 minuto: 3 pods `alchemist-backend-...` e 2 `alchemist-frontend-...` em `Running` e `READY 1/1`. Pegue a URL pública:

```powershell
oc get route alchemist-battle -o jsonpath='https://{.spec.host}'
```

Abra no navegador (e no celular — a URL é pública). Digite um nome, clique em **🧪 Criar Poção** e veja o placar atualizar sozinho a cada 2 segundos.

**A demo "mata-pod":**

1. Deixe o jogo aberto com gente clicando.
2. Em um terminal visível para a plateia:

```powershell
oc get pods -w
```

3. Em **outro** terminal, mate um pod do backend:

```powershell
oc delete pod -l app=alchemist-backend --field-selector=status.phase=Running --grace-period=0 --force
```

   (ou no console: Workloads → Pods → menu ⋮ do pod → Delete)

**O que narrar:** o jogo **não parou** — o rodapé da tela mostra qual pod atendeu cada clique, e dá para ver o tráfego migrando para os pods sobreviventes. No terminal, o OpenShift recria os pods em segundos, e a `readinessProbe` só os devolve ao balanceamento quando confirmam conexão com o banco. Ninguém executou nada para "consertar": o estado desejado (3 réplicas) é mantido pela plataforma.

**Bônus com o operador:** delete também o pod *primário* do PostgreSQL (`oc delete pod -l postgres-operator.crunchydata.com/role=master`) e mostre o failover automático — o jogo continua.

---

## 9. Fase 2 — Atualizar para a v2 (guildas) com zero downtime

Com o jogo v1 **rodando e gente clicando**:

```powershell
oc apply -k k8s/v2
oc rollout status deployment/alchemist-backend
```

**Na tela dos jogadores:** em segundos, sem recarregar a página e sem nenhum erro, o jogo vira o modo **Guerra de Guildas** (Fogo 🔥, Água 💧, Terra 🌿) — cada jogador escolhe uma guilda e os pontos somam para o time.

**O que narrar:** a v2 usa `RollingUpdate` com `maxUnavailable: 0` — o OpenShift sobe um pod novo, espera os *probes* confirmarem saúde, e só então remove um pod antigo, um por um. Nenhuma requisição cai, e os pontos da v1 são preservados no banco.

**Rollback ao vivo** (opcional, impressiona): `oc apply -k k8s/v1` — volta ao modo individual, também sem downtime.

---

## 10. Fase 3 — GitOps com ArgoCD

### 10.1 Publicar o repositório no GitHub

O GitOps precisa que o cluster leia seus manifestos do Git:

1. Crie uma conta em https://github.com (se não tiver) e crie um repositório **público** chamado `alchemist-battle` (sem README inicial).
2. No PowerShell, na pasta do projeto:

```powershell
git init
git add .
git commit -m "Alchemist Battle - demo OpenShift"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO-GITHUB/alchemist-battle.git
git push -u origin main
```

> No primeiro `push`, o Git abre uma janela do navegador para você autorizar com sua conta GitHub.
>
> ⚠️ Faça o push **depois** dos replaces da seção 6, para que o Git já contenha as imagens corretas.

3. Edite os dois arquivos da pasta `argocd/` e troque `SEU_USUARIO` na linha `repoURL` pelo seu usuário do GitHub. Commit e push:

```powershell
git add argocd
git commit -m "Ajusta repoURL"
git push
```

### 10.2 Instalar o OpenShift GitOps (ArgoCD)

1. Console → **Operators → OperatorHub** → busque **"Red Hat OpenShift GitOps"** → **Install** (padrões).
2. Aguarde **Succeeded** em Installed Operators (cria o namespace `openshift-gitops` com um ArgoCD pronto).
3. Dê ao ArgoCD permissão para gerenciar o cluster (aceitável em ambiente de demo):

```powershell
oc adm policy add-cluster-role-to-user cluster-admin -z openshift-gitops-argocd-application-controller -n openshift-gitops
```

4. Acesse a interface do ArgoCD:

```powershell
oc get route openshift-gitops-server -n openshift-gitops -o jsonpath='https://{.spec.host}'
```

Abra a URL e clique em **"Log in via OpenShift"** (use o mesmo login do console).

### 10.3 Entregar o jogo ao ArgoCD

```powershell
oc apply -f argocd/application-database.yaml
oc apply -f argocd/application-game.yaml
```

Na UI do ArgoCD aparecem os apps `alchemist-database` e `alchemist-game` — em ~1 min ficam **Synced / Healthy**, com o mapa visual de todos os recursos.

### 10.4 As demos de GitOps

**Mudança de cor via Git (a demo principal):**

1. Edite `k8s/v1/kustomization.yaml` e troque `GAME_COLOR=#7c3aed` por `GAME_COLOR=#22c55e` (verde).
2. `git add . ; git commit -m "Muda cor do jogo" ; git push`
3. Mostre na UI do ArgoCD: ele detecta a diferença, sincroniza e dispara um rolling update — e a cor do jogo **muda na tela de todos os jogadores**, sem você tocar no cluster. (A detecção automática leva até ~3 min; para acelerar, clique em **Refresh** no app.)

**selfHeal (proteção contra mudança manual):** sabote o cluster de propósito:

```powershell
oc scale deployment/alchemist-backend --replicas=1 -n alchemist-battle
```

Em segundos o ArgoCD detecta o desvio e **restaura as 3 réplicas** definidas no Git. Mensagem para o cliente: o Git é a fonte da verdade; mudança manual não sobrevive.

**Promoção v1 → v2 via Git:** edite `argocd/application-game.yaml`, troque `path: k8s/v1` por `path: k8s/v2`, e `oc apply -f argocd/application-game.yaml` (ou commit + push se preferir gerenciar até isso pelo Git). O ArgoCD executa o rolling update da Fase 2 — agora 100% guiado pelo Git.

---

## 11. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `Unauthorized` em qualquer comando | Token expirou | Repita a seção 3 (Copy login command) |
| Pod em `ImagePullBackOff` | Imagem com nome errado | Confira a seção 6; `oc describe pod <nome>` mostra a imagem buscada |
| Backend `Running` mas `0/1` (not ready) | Banco fora do ar ou Secret ausente | `oc get pods -l postgres-operator.crunchydata.com/cluster=alchemist-db` e `oc logs deploy/alchemist-backend` |
| `PostgresCluster` criado mas nada acontece | Operador Crunchy não instalado/pronto | Operators → Installed Operators → status deve ser **Succeeded** |
| Pods do banco em `Pending` | Volume não provisionado | `oc get pvc` e `oc describe pod <nome>` (o cluster tem 4 StorageClasses — a default deve atender) |
| App do ArgoCD `Unknown`/erro de repo | `repoURL` errado ou repo privado | Repo deve ser **público** e a URL terminar em `.git` |
| ArgoCD não aplica nada (`PermissionDenied`) | Faltou o passo 3 da seção 10.2 | Rode o `oc adm policy add-cluster-role-to-user ...` |
| Cluster sumiu / não responde | Serviço RHDP expirou ou auto-desligou | Verifique em https://demo.redhat.com (estenda o runtime/lifetime do serviço) |

**Comandos para investigar qualquer coisa:**

```powershell
oc get pods                       # estado geral
oc describe pod NOME-DO-POD       # por que um pod não sobe
oc logs deploy/alchemist-backend  # logs da aplicação
oc get events --sort-by=.lastTimestamp | Select-Object -Last 15
```

---

## 12. Limpeza (recomeçar do zero)

```powershell
oc delete -f argocd/application-game.yaml
oc delete -f argocd/application-database.yaml
oc delete project alchemist-battle
```

(Deletar o projeto remove jogo, banco, builds e imagens de uma vez.)

---

## Checklist do dia da demo

- [ ] Cluster RHDP ativo (verifique o tempo restante em demo.redhat.com)
- [ ] Token renovado (seção 3) e `oc project` apontando para `alchemist-battle`
- [ ] Pods do banco, backend (3) e frontend (2) em `Running` / `READY 1/1`
- [ ] URL da Route aberta no notebook e no celular
- [ ] UI do ArgoCD logada em outra aba (se a demo inclui a Fase 3)
- [ ] Dois terminais prontos: um com `oc get pods -w`, outro para os comandos
- [ ] v1 aplicada (se a demo inclui a transição v1 → v2)
