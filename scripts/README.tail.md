
## Limitações e premissas

- A amostra é de 1/3 dos clientes: ×3 dá o período de 90 dias e ×12 dá o ano. O custo por conversa é a média do canal informada nos parâmetros.
- Não existe data de recebimento, então as janelas de 7 e 30 dias usam os **dias desde o pedido** como proxy. É uma premissa conservadora: o prazo real conta a partir do recebimento.
- As taxas de captura das iniciativas são declaradas e conservadoras (ex.: o rastreio proativo evita 40% e não 100%). O valor da cosmetovigilância e da higiene de PII é regulatório e de LGPD, por isso não entra em R$.
- As ações do agente são **simuladas**: geram protocolo, id e log no navegador e não tocam sistemas reais.

## Como foi construído

Com o Claude Code como ferramenta principal, em etapas paralelas com subagentes dedicados: classificação em lote, análise de negócio, dashboard, agente com tool calling, auditoria de políticas, validação dos números com uma contagem independente em pandas e revisão de release.
