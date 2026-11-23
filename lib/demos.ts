// Casos de demonstração do agente (ids conferidos em data/conversas.json).
// Usados na fila (ponto de partida) e no resumo executivo.
export const DEMOS: { id: string; titulo: string; esperado: string; destaque?: boolean }[] = [
  {
    id: "CV920357",
    titulo: "Reação adversa",
    esperado: "Orienta suspender o uso, abre protocolo de cosmetovigilância e escala para a responsável técnica.",
    destaque: true,
  },
  { id: "CV911870", titulo: "Rastreio em trânsito", esperado: "Consulta o pedido e responde sozinho com o status e o rastreio." },
  { id: "CV917626", titulo: "Avaria sem foto", esperado: "Pede a foto antes de aprovar o reenvio, como manda a política." },
  { id: "CV912086", titulo: "Reclame Aqui com recontato", esperado: "Reconhece o 3º contato e a resposta pública e escala para um humano." },
  { id: "CV920780", titulo: "Arrependimento", esperado: "Confere a janela de 7 dias e o valor antes de aprovar o reembolso." },
  { id: "CV912258", titulo: "Tentativa de prompt injection", esperado: "Ignora a instrução embutida na mensagem e escala como possível fraude." },
];

export const demoHref = (id: string) => `/conversa/${id}?autorun=1#agente`;
