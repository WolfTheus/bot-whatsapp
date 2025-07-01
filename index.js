const express = require('express');
const bodyParser = require('body-parser');
const { MessagingResponse } = require('twilio').twiml;
const axios = require('axios');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const sessions = {};
const produtos = {
  1: "🎱 Mesa de Bilhar Tradicional – 2,23 x 1,23m, acabamento em verniz, campo de ardósia. Preço: R$ 2.798",
  2: "⚽ Mesa de Pebolim Profissional – Estrutura reforçada, pintura automotiva. Preço: R$ 1.350",
  3: "🔴 Conjunto de Bolas Snooker – 16 bolas oficiais, resina importada. Preço: R$ 190",
  4: "🪵 Taco Profissional Madeira – Ponta rosqueável, cabo emborrachado. Preço: R$ 120",
  5: "🧥 Capa para Mesa de Bilhar – Tecido resistente, várias cores. Preço: R$ 99"
};

app.post('/webhook', async (req, res) => {
  const msg = req.body.Body?.trim();
  const from = req.body.From;
  const phone = from.replace('whatsapp:', '');
  const twiml = new MessagingResponse();

  if (!sessions[phone]) {
    sessions[phone] = { step: 0, data: {} };
  }

  const session = sessions[phone];
  const step = session.step;
  const data = session.data;

  const reply = (text) => {
    twiml.message(text);
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
  };

  // Fluxo principal
  switch (step) {
    case 0:
      reply("👋 Olá! Bem-vindo ao atendimento da *Castillero Diversões*.\n\nEscolha uma opção:\n\n1️⃣ Fazer pedido\n2️⃣ Ver produtos\n3️⃣ Sobre nós");
      session.step = 1;
      break;

    case 1:
      if (msg === '1') {
        session.step = 2;
        reply("👤 Nome completo do cliente:");
      } else if (msg === '2') {
        let lista = "🛒 *Produtos Castillero Diversões:*\n";
        for (const [num, desc] of Object.entries(produtos)) {
          lista += `${num}️⃣ ${desc.split("–")[0].trim()}\n`;
        }
        lista += "\nDigite o número para ver mais detalhes ou *0* para voltar.";
        session.step = 20;
        reply(lista);
      } else if (msg === '3') {
        reply("🏆 *Sobre nós*\n\nA Castillero Diversões atua há mais de 20 anos na fabricação de mesas de bilhar, pebolim, ping pong e acessórios. Referência em qualidade e atendimento, oferece produtos sob medida para residências e estabelecimentos.\n\nDigite *1* para fazer pedido ou *2* para ver produtos.");
      } else {
        reply("❌ Opção inválida. Digite 1, 2 ou 3.");
      }
      break;

    case 20:
      if (msg === '0') {
        session.step = 0;
        reply("🔙 Retornando ao menu...");
      } else if (produtos[msg]) {
        reply(produtos[msg] + "\n\nDigite *1* para fazer pedido ou *0* para voltar ao menu.");
      } else {
        reply("❌ Produto não encontrado. Digite um número da lista ou *0* para voltar.");
      }
      break;

    // Pedido
    case 2:
      data.nome = msg;
      session.step = 3;
      reply("🪪 CPF ou CNPJ:");
      break;

    case 3:
      data.cpf = msg;
      session.step = 4;
      reply("📦 Qual produto deseja?");
      break;

    case 4:
      data.produto = msg;
      session.step = 5;
      reply("🔢 Quantidade:");
      break;

    case 5:
      data.quantidade = msg;
      session.step = 6;
      reply("🎁 Brindes inclusos? (se não, diga 'Nenhum')");
      break;

    case 6:
      data.brinde = msg;
      session.step = 7;
      reply("🧩 Acessórios adicionais? (se não, diga 'Nenhum')");
      break;

    case 7:
      data.acessorios = msg;
      session.step = 8;
      reply("📝 Observações do pedido?");
      break;

    case 8:
      data.observacoes = msg;
      session.step = 9;
      reply("📍 Endereço - Rua:");
      break;

    case 9:
      data.rua = msg;
      session.step = 10;
      reply("🏠 Número:");
      break;

    case 10:
      data.numero = msg;
      session.step = 11;
      reply("📍 Bairro:");
      break;

    case 11:
      data.bairro = msg;
      session.step = 12;
      reply("🏙️ Cidade:");
      break;

    case 12:
      data.cidade = msg;
      session.step = 13;
      reply("🗺️ Estado:");
      break;

    case 13:
      data.estado = msg;
      session.step = 14;
      reply("📮 CEP:");
      break;

    case 14:
      data.cep = msg;
      session.step = 15;

      const resumo = `
✅ *Pedido registrado com sucesso!*

👤 *Nome:* ${data.nome}
🪪 *CPF/CNPJ:* ${data.cpf}
📦 *Produto:* ${data.produto}
🔢 *Qtd:* ${data.quantidade}
🎁 *Brinde:* ${data.brinde}
🧩 *Acessórios:* ${data.acessorios}
📝 *Obs:* ${data.observacoes}
📍 *Endereço:* ${data.rua}, ${data.numero} - ${data.bairro}, ${data.cidade} - ${data.estado}, ${data.cep}
📱 *Telefone:* ${phone}
      `.trim();

      reply(resumo + "\n\n🚚 O proprietário entrará em contato para calcular o frete.\n\nSe quiser fazer outro pedido, digite *1*.");

      try {
        await axios.post("https://script.google.com/macros/s/SEU_WEBHOOK_DO_SHEETS/exec", {
          ...data,
          telefone: phone,
          datahora: new Date().toLocaleString("pt-BR")
        });
      } catch (error) {
        console.error("❌ Erro ao enviar para planilha:", error.message);
      }

      delete sessions[phone];
      break;

    default:
      reply("❗ Algo deu errado. Comece novamente digitando *1*.");
      delete sessions[phone];
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Bot rodando na porta " + PORT);
});
