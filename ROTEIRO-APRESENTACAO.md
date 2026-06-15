# 🎤 Roteiro da Apresentação — Batalha do Backlog

Roteiro de palco para a demo, com falas sugeridas, comandos por momento e a mensagem de OpenShift amarrada a cada cena. Duração da parte de demo: **20–25 min** (ajustável). Adapte as falas ao seu estilo — elas estão aqui como ponto de partida, não como script rígido.

**O arco narrativo que sustenta tudo:**
> Parte 1 (v1): o analista sozinho, sem plataforma, contra o caos da TI — ele SEMPRE perde.
> Parte 2 (v2): a mesma TI, agora como um time, com OpenShift, Red Hat e Service IT na retaguarda — eles vencem.
> A atualização da v1 para a v2 acontece AO VIVO, sem derrubar nada — e essa transição é o próprio produto se vendendo.

---

## ✅ 15 minutos antes (bastidores)

- [ ] `oc get pods` — banco 4/4, backend 3/3, frontend 2/2, tudo `Running`
- [ ] Jogo na **v1** (`oc apply -k k8s/v1` se tiver dúvida)
- [ ] `/admin` aberto no SEU notebook (aba separada, fora do telão se possível)
- [ ] URL do jogo num slide com QR code (gere em qualquer gerador com a URL da Route)
- [ ] Dois terminais prontos: um com `oc get pods -w`, outro livre
- [ ] Celular próprio já com o jogo aberto (você também joga!)

---

## Bloco 0 — Fim da apresentação institucional (sua ponte para a demo)

Você termina os slides de OpenShift (plataforma, Kubernetes enterprise, segurança, operadores, GitOps...). A ponte:

> **"Tudo isso que eu mostrei em slides é fácil de falar. Difícil é provar. Então em vez de mais slides, eu trouxe um jogo — e vocês vão jogar agora, do celular de vocês. Ele se chama Batalha do Backlog, e eu prometo que vocês vão se reconhecer nele. Detalhe importante: esse jogo está rodando AGORA, num cluster OpenShift real, com banco de dados real, e ao longo da partida eu vou quebrar coisas de propósito para vocês verem o que acontece."**

📺 Mostre o slide com QR code + URL.

> **"Apontem a câmera, coloquem o nome de vocês e cliquem em BATER O PONTO. Vocês vão cair num lobby — esperem ali, a partida começa quando todo mundo entrar."**

💬 *Benefício a citar enquanto o pessoal entra:* "Reparem que vocês acessaram de qualquer rede, com HTTPS válido. Isso é uma **Route** do OpenShift — a aplicação ficou exposta para o mundo com 5 linhas de YAML, sem ninguém configurar load balancer ou certificado na mão."

---

## Bloco 1 — Lobby e abertura (~2 min)

Com a Sala do Gerente aberta, mostre a lista de analistas conectados crescendo.

> **"Estou vendo todo mundo chegar aqui na minha tela de gerente — sim, o jogo tem um PMO, o realismo é total. Quando eu clicar em INICIAR O SPRINT, prestem atenção na tela de vocês."**

Clique **▶ Iniciar o sprint**. Sobe o letreiro Star Wars (34s) + desfile dos 12 chefes (24s). Deixe rolar em silêncio — a plateia vai rir sozinha. Perto do fim do desfile:

> **"Esses são os 12 chefes. Sim, o último é o CEO que leu sobre IA e Blockchain no avião. Cada um de vocês está sozinho contra eles. 2 minutos e meio. Boa sorte — vocês vão precisar."**

---

## Bloco 2 — Parte 1: a batalha solo na v1 (~4 min)

A plateia clica. Incidentes começam a estourar ("O ESTAGIÁRIO APAGOU O BANCO DE PROD" sempre arranca reação). Deixe 30–40s de pura diversão. Então, o primeiro golpe de teatro:

### 💥 Demo 1: o mata-pod (resiliência)

Coloque o terminal com `oc get pods -w` no telão:

> **"Enquanto vocês lutam, deixa eu mostrar o que está por trás: o jogo roda em 3 réplicas do backend, aqui no cluster. E agora eu vou fazer o que toda TI teme: vou derrubar um servidor em produção, com todos vocês usando. Continuem clicando e me digam se sentirem alguma coisa."**

No segundo terminal:

```
oc delete pod -l app=alchemist-backend --field-selector=status.phase=Running --grace-period=0 --force
```

Aguarde 10s, aponte para o telão:

> **"Alguém perdeu um clique? Ninguém. Olhem o telão: o OpenShift detectou a falha e recriou o pod sozinho — em segundos, sem ninguém abrir chamado, sem ninguém ser acordado às 3 da manhã. Isso são os health checks e o self-healing da plataforma: eu declarei que quero 3 réplicas saudáveis, e o cluster GARANTE isso. Reparem no rodapé do jogo de vocês: ele mostra qual pod atendeu cada clique — o tráfego foi redistribuído na hora."**

### O fim da partida solo

O tempo acaba. Sobe o epílogo da derrota ("comportamento esperado em produção"). Deixe lerem, depois:

> **"Ninguém zerou, certo? Não foi falta de habilidade — eu calibrei o jogo assim de propósito. Reparem no mural de incidentes de vocês: quanto mais perto do fim, mais a gerência 'ajudava'. Sozinho, no modo herói, ninguém vence o backlog. E essa é exatamente a situação de muitas TIs hoje: pessoas excelentes, apagando incêndio um por um, perdendo para o volume. O problema não é o time — é lutar sem plataforma e sem retaguarda."**

📊 Clique para mostrar o placar geral e reconheça o MVP — a plateia gosta.

---

## Bloco 3 — A virada: rolling update ao vivo para a v2 (~5 min)

**Este é o clímax. Não anuncie o que vai acontecer — faça e deixe perceberem.**

Volte todos ao lobby (botão 🔁 na Sala do Gerente) e diga:

> **"Vamos jogar de novo. Mas antes, eu vou fazer mais uma coisa perigosa: vou fazer um DEPLOY em produção. Agora. Com todos vocês conectados. Uma versão nova do jogo inteiro — frontend e backend. Em qualquer infraestrutura tradicional isso significaria 'janela de manutenção sábado às 2h'. Aqui..."**

No terminal (pode estar no telão):

```
oc apply -k k8s/v2
```

> **"...aqui é uma linha. O OpenShift está subindo a versão nova, esperando ela ficar saudável, e SÓ ENTÃO desligando a antiga, pod por pod. É o rolling update: maxUnavailable zero. A tela de vocês vai mudar sozinha... agora."**

A tela de todos vira "modo time único". Dê o start na nova partida.

> **"E a versão 2 muda a regra do jogo: agora vocês são UM time. Todo clique soma no mesmo placar. E olhem o letreiro: desta vez vocês têm reforços."**

Durante a partida, os bônus verdes aparecem. Quando surgir um da Service IT ou Red Hat, aproveite:

> **"Esses bônus verdes que estão dando pontos para vocês — 'Service IT assumiu a war room', 'Red Hat respondeu com o patch pronto', 'OpenShift reiniciou o pod antes do usuário perceber' — não são piada interna. São literalmente o modelo que estamos propondo: a plataforma automatiza o Dia 2, a Red Hat dá o suporte enterprise, e a Service IT é o time estendido de vocês. No jogo, é isso que faz vocês vencerem. Na vida real, também."**

O time derrota o CEO → "ATA DA VITÓRIA" 🏆:

> **"Viram a diferença? Mesmas pessoas, mesmos 2 minutos e meio, mesmos incidentes. O que mudou foi a plataforma e a retaguarda. Sozinho, ninguém venceu. Juntos e bem equipados, vocês ZERARAM a TI."**

---

## Bloco 4 (opcional, se houver tempo/audiência técnica) — Dia 2 (~5 min)

Escolha 1 ou 2, não todos:

**a) Failover do banco (operadores):**
```
oc delete pod -l postgres-operator.crunchydata.com/role=master
```
> **"O banco desse jogo é um PostgreSQL gerenciado por um Operador. Acabei de matar o primário — e o jogo nem piscou, porque o operador promoveu a réplica sozinho. Backup, replicação, failover: ninguém aqui configurou nada disso na mão. Isso é o conceito de Operador: a automação do especialista, empacotada."**

**b) Escala ao vivo:**
```
oc scale deployment/alchemist-backend --replicas=6
```
> **"Black Friday chegando? Uma linha. Seis réplicas. Quinze segundos. Sem ticket de infraestrutura."**

**c) GitOps (se a Fase 3 estiver montada):** mude `GAME_COLOR` no Git, mostre o ArgoCD sincronizando e a cor do jogo mudando para todos.
> **"Ninguém tocou no cluster. Eu mudei um arquivo no Git, e a plataforma convergiu sozinha. Auditável, reversível, sem acesso manual a produção."**

---

## Encerramento (~2 min)

> **"Recapitulando o que vocês viveram — não o que eu contei, o que vocês VIVERAM: eu matei um servidor e vocês não perceberam. Eu fiz deploy em produção no meio do jogo e vocês não perderam um clique. O banco perdeu o primário e nada aconteceu. E quando o time jogou junto, com a plataforma certa e a retaguarda certa, o resultado mudou completamente. Era isso que eu queria mostrar: OpenShift não é um slide — é isso aqui funcionando. E a Service IT entra exatamente como entrou no jogo: do lado de vocês, na war room."**

CTA: próxima reunião / PoC / workshop.

---

## 🧯 Plano B (se algo der errado ao vivo)

| Imprevisto | Saída |
|---|---|
| Wi-Fi do local ruim para a plateia | Jogue você + 2 voluntários no 4G; o telão carrega a demo |
| Pod não volta após o mata-pod | `oc get events` no telão e narre o diagnóstico — vira demo de observabilidade |
| Cluster RHDP instável na hora | Tenha um vídeo de 60s do fluxo gravado como fallback (grave no ensaio!) |
| Alguém com nome impróprio no placar | Sala do Gerente → 🔁 Retrospectiva zera tudo; combine nomes no convite |
| Esqueceu de voltar para v1 antes da sessão | `oc apply -k k8s/v1` leva ~30s, dá para fazer falando |

**Mensagens-chave para repetir (sem decorar o resto):** self-healing real · deploy sem downtime real · Dia 2 automatizado por operadores · sozinho se perde, com plataforma + time se vence.
