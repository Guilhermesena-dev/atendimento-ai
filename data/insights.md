## Números e respostas

Amostra de 4.000 conversas (1/3 dos clientes, 90 dias). x3 = período, x12 = ano. Custo: WhatsApp R$ 4,80, e-mail R$ 7,20, Reclame Aqui R$ 42,00.

| Indicador | Valor |
| --- | --- |
| Conversas no período / ano | 12.000 / 48.000 |
| Custo no período / ano | R$ 108.299 / R$ 433.195 |
| Conversas por pedido | 0,072 |
| Evitáveis em tese | 53,3% |
| Evitadas (conservador) / economia por ano | 6.569 / R$ 84.871 |
| Recontato / SLA estourado | 50,9% / 15,2% |
| Tags manuais divergentes | 24,5% |
| Reação adversa sem tag própria | 40 (~480/ano) |

### Por que os clientes entram em contato?

**Principalmente para saber do pedido: 'onde está meu pedido' e atraso somam 1373 de 4000 conversas (34,3%) e R$ 163.210/ano, e o 3º motivo é o abandono do bot (459).** (confiança: alta)

- 872 'onde está meu pedido' (21,8%): 871 em trânsito e 1 já entregue(s); o status já estava disponível em todos.
- 501 atrasos (12,5%), dos quais 94 já no Reclame Aqui.
- 459 abandonos no bot (11,5%): 308 sem tag nenhuma e 151 como 'Outros'.
- Pós-entrega (avaria, item faltante, troca, erro de personalização): 961 conversas.
- 24,5% das tags manuais divergem do motivo real; a tag atual não serve para gestão.
- 0,072 conversas por pedido no período (~72 a cada 1.000 pedidos).

### O que atacar primeiro?

**Cosmetovigilância primeiro (gate regulatório: 40 reações adversas sem registro); depois 'Rastreio proativo (push no WhatsApp)' e 'Escalonamento no 3º contato (prevenção de Reclame Aqui)', ambos de esforço baixo e que juntos economizam ~R$ 78.344/ano.** (confiança: média)

- 1. Tag e protocolo de cosmetovigilância (score gate, esforço baixo)
- 2. Rastreio proativo (push no WhatsApp) (score 195.852, esforço baixo)
- 3. Escalonamento no 3º contato (prevenção de Reclame Aqui) (score 188.244, esforço baixo)
- 4. Reenvio, estorno e nova produção automáticos via agente (score 59.011, esforço médio)
- 5. Higiene de PII e defesa contra prompt injection (score 48.751, esforço baixo)
- 6. Recuperação do abandono no bot (score 14.018, esforço médio)
- Critério: custo anual dos contatos-alvo x fator de risco / esforço; obrigação legal entra antes.

### Quais contatos poderiam ter sido evitados?

**53,3% das conversas seriam evitáveis em tese; sendo conservador, as iniciativas evitam ~6.569 conversas/ano, convertem outros ~747 Reclame Aqui em atendimento prioritário e economizam ~R$ 84.871/ano no total.** (confiança: média)

- 'Onde está meu pedido': 872 conversas, 871 em trânsito e 1 já entregue(s) (status disponível).
- Atraso: 501, o atraso é conhecido antes do cliente reclamar.
- Abandono no bot: 459, e 18 novas conversas do mesmo cliente em até 7 dias.
- Recontato sobre o mesmo pedido nos demais motivos: 300 conversas.
- 50,9% das conversas são recontato e 61,2% dos Reclame Aqui vieram depois de outro contato.
- Rastreio proativo (push no WhatsApp): 5.388 contatos/ano, R$ 50.556/ano
- Recuperação do abandono no bot: 65 contatos/ano, R$ 480/ano
- Escalonamento no 3º contato (prevenção de Reclame Aqui): 747 contatos/ano, R$ 27.788/ano
- Reenvio, estorno e nova produção automáticos via agente: 1.116 contatos/ano, R$ 6.048/ano

### O que pode ser automatizado e o que precisa de humano?

**42,6% das conversas cabem em fluxo automático pela política vigente; 57,4% precisam de humano (Reclame Aqui, 3+ contatos, reação adversa, valor alto, endereço após separação, injeção).** (confiança: média)

- Automático: rastreio, reenvio por avaria/faltante (foto, 7 dias), nova produção por erro de personalização, reembolso por arrependimento (7 dias), troca de fragrância dentro da regra, dúvidas de produto.
- Humano: reação adversa (40), Reclame Aqui (407), clientes com 3+ contatos (2016 conversas), pedido >= R$ 300 com impacto financeiro, endereço após separação, injeção de prompt (4).
- Dos 1044 contatos de reenvio/estorno/nova produção, 432 (41,4%) caem em fluxo automático.
- O agente executa a ação (consultar pedido, aprovar reenvio/estorno, abrir protocolo, escalar) e registra tudo; o humano fica com exceções.

### Motivos

| Motivo | Conversas | % | Custo/ano | RA | % recontato | % evitável | Rota |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Onde está meu pedido | 872 | 21,8% | R$ 89.568 | 76 | 59,5% | 100,0% | híbrido |
| Atraso na entrega | 501 | 12,5% | R$ 73.642 | 94 | 53,1% | 100,0% | híbrido |
| Abandono no bot | 459 | 11,5% | R$ 26.438 | 0 | 51,2% | 100,0% | híbrido |
| Promoção/cupom/brinde | 301 | 7,5% | R$ 35.338 | 36 | 50,2% | 15,6% | híbrido |
| Avaria/vazamento | 297 | 7,4% | R$ 31.291 | 27 | 53,5% | 30,6% | híbrido |
| Item faltante | 274 | 6,8% | R$ 24.595 | 16 | 65,3% | 28,1% | híbrido |
| Troca | 265 | 6,6% | R$ 28.814 | 27 | 34,7% | 0,0% | híbrido |
| Dúvida de produto | 218 | 5,5% | R$ 22.421 | 19 | 33,5% | 0,0% | híbrido |
| Cobrança duplicada | 189 | 4,7% | R$ 30.384 | 42 | 59,8% | 27,0% | híbrido |
| Arrependimento/cancelamento | 159 | 4,0% | R$ 18.446 | 19 | 32,7% | 0,0% | híbrido |
| Pagamento/financeiro | 146 | 3,6% | R$ 18.144 | 20 | 49,3% | 17,8% | híbrido |
| Erro de personalização | 125 | 3,1% | R$ 13.306 | 12 | 49,6% | 6,4% | híbrido |
| Endereço | 116 | 2,9% | R$ 11.419 | 9 | 35,3% | 0,0% | humano |
| Reação adversa | 40 | 1,0% | R$ 5.213 | 6 | 27,5% | 0,0% | humano |
| Elogio | 38 | 0,9% | R$ 4.176 | 4 | 23,7% | 0,0% | híbrido |

### Iniciativas (conservador)

| Iniciativa | Tipo | Contatos evitados/ano | Economia/ano | Esforço | Premissa |
| --- | --- | ---: | ---: | --- | --- |
| Rastreio proativo (push no WhatsApp) | evitar | 5.388 | R$ 50.556 | baixo | Evita 40% dos 872 'onde está meu pedido' (871 em trânsito e 1 já entregue(s)) e 20% dos 501 contatos de atraso da amostra. Não 100%: parte do público contata mesmo informado. |
| Recuperação do abandono no bot | evitar | 65 | R$ 480 | médio | 459 abandonos geraram 18 novas conversas do mesmo cliente em até 7 dias (excluindo rastreio/atraso, já contados). Evita 30% delas. O custo do abandono em si não é contado como economia. |
| Escalonamento no 3º contato (prevenção de Reclame Aqui) | humano | 747 | R$ 27.788 | baixo | 249 dos 407 Reclame Aqui (61,2%) vieram de clientes que já tinham contatado antes. Evita 25% deles; cada um vira um atendimento prioritário no WhatsApp (economia de R$ 42,00 - R$ 4,80 = R$ 37,20). Não conta o ganho reputacional. |
| Reenvio, estorno e nova produção automáticos via agente | automatizar | 1.116 | R$ 6.048 | médio | Dos 1044 contatos desses motivos, 186 são recontatos sobre o mesmo pedido (fora RA). Resolver no 1º contato evita 50% deles. O custo do 1º contato é mantido (não assumimos que a automação o torna gratuito). |
| Tag e protocolo de cosmetovigilância | risco | 0 | R$ 0 | baixo | 40 casos na amostra (~480/ano), 0 com tag própria; foram marcados como Outros (11), Troca (10), Reclamação produto (7), Dúvida (7), Avaria (5). O valor é conformidade sanitária e segurança do consumidor, não economia: não contamos R$. |
| Higiene de PII e defesa contra prompt injection | risco | 0 | R$ 0 | baixo | 310 conversas (7,8%) com PII em texto aberto e 4 tentativas de instruir a IA na amostra. Valor é LGPD/fraude; não contamos R$. |

### Atacar primeiro

Critério: score = custo_ano dos contatos-alvo (R$, amostra x 12) x fator_risco / peso do esforço (baixo = 1, médio = 2, alto = 3). fator_risco: 1,0 só custo; 1,2 gera Reclame Aqui; 1,5 reputacional/LGPD. Obrigações regulatórias com prazo legal (cosmetovigilância, 24h) são um gate: entram em 1º lugar independentemente do score, porque o custo de não cumprir não é medido em R$ por conversa.

| # | Iniciativa | Score | Custo-alvo/ano | Risco | Esforço |
| ---: | --- | ---: | ---: | --- | --- |
| 1 | Tag e protocolo de cosmetovigilância | gate | R$ 5.213 | regulatório (gate) | baixo |
| 2 | Rastreio proativo (push no WhatsApp) | 195.852 | R$ 163.210 | 1,2 | baixo |
| 3 | Escalonamento no 3º contato (prevenção de Reclame Aqui) | 188.244 | R$ 125.496 | 1,5 | baixo |
| 4 | Reenvio, estorno e nova produção automáticos via agente | 59.011 | R$ 118.022 | 1,0 | médio |
| 5 | Higiene de PII e defesa contra prompt injection | 48.751 | R$ 32.501 | 1,5 | baixo |
| 6 | Recuperação do abandono no bot | 14.018 | R$ 28.037 | 1,0 | médio |
