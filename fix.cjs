const fs = require('fs');

let content = fs.readFileSync('src/pages/Logistica.tsx', 'utf8');

content = content.replace(
  'const pendentes = chamados.filter((c) => c.status === "pendente" || c.status === "divergencia").length;',
  'const pendentes = chamados.filter((c) => c.status === "pendente" || c.status === "divergencia" || c.status === "em_atendimento").length;'
);

content = content.replace(
  'const aguardando = chamados.filter((c) => c.status === "entregue_no_posto" || c.status === "aguardando_confirmacao").length;',
  'const aguardando = chamados.filter((c) => c.status === "entregue_no_posto" || c.status === "aguardando_confirmacao" || c.status === "aguardando_validacao_operador" || c.status === "resolucao_pendente_validacao" || c.status === "resolucao_pendente").length;'
);

content = content.replace(
  'isWaiting: c.status === "entregue" || c.status === "aguardando_confirmacao"',
  'isWaiting: c.status === "entregue_no_posto" || c.status === "aguardando_confirmacao" || c.status === "aguardando_validacao_operador" || c.status === "resolucao_pendente_validacao"'
);

fs.writeFileSync('src/pages/Logistica.tsx', content, 'utf8');
console.log('Fixed Logistica.tsx');
