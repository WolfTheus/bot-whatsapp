const express = require('express');
const bodyParser = require('body-parser');
const { MessagingResponse } = require('twilio').twiml;
const axios = require('axios');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const sessions = {};

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

  switch (step) {
    case 0:
      reply("Olá! Bem-vindo ao atendimento.\nEscolha uma opção:\n1️⃣ Fazer pedido\n2️⃣ Saber mais");
      session.step = 1;
      break;

    case 1:
      if (msg === '1') {
        session.step = 2;
        reply("👤 Nome completo do cliente:");
      } else if (msg === '2') {
        reply("🎯 Somos fabricantes de mesas de sinuca, pebolim, ping pong e acessórios.\nDigite 1 para fazer pedido.");
      } else {
        reply("❌ Opção inválida. Digite 1 ou 2.");
      }
      break;

    case 2:
      data.nome = msg;
      session.step = 3;
      reply("🔢 CPF ou CNPJ:");
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
      reply("🎁 Há algum brinde incluso? (se não, diga 'Nenhum')");
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
✅ Pedido concluído:
👤 Nome: ${data.nome}
🪪 CPF/CNPJ: ${data.cpf}
📦 Produto: ${data.produto}
🔢 Quantidade: ${data.quantidade}
🎁 Brinde: ${data.brinde}
🧩 Acessórios: ${data.acessorios}
📝 Obs: ${data.observacoes}
📍 Endereço: ${data.rua}, ${data.numero} - ${data.bairro}, ${data.cidade} - ${data.estado}, ${data.cep}
📱 Tel: ${phone}
      `.trim();

      reply(resumo + "\n\n🚚 O proprietário entrará em contato para calcular o frete. Obrigado!");

      try {
        await axios.post("https://script.google.com/macros/s/AKfycbzADoRkMrVPOBk90OFweQNvSRCSZrLYarfj9s8layaM2tc6lU2tpUQDEZfd_9BoBtpm/exec", {
          ...data,
          telefone: phone,
          datahora: new Date().toLocaleString("pt-BR")
        });
      } catch (error) {
        console.error("❌ Erro ao enviar dados para o Google Sheets:", error.message);
      }

      // encerra a sessão
      delete sessions[phone];
      break;

    default:
      reply("❗ Algo deu errado. Comece novamente digitando *1*.");
      delete sessions[phone];
  }
});

// Porta dinâmica para Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Bot rodando na porta " + PORT);
});
