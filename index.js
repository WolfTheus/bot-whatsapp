const express = require('express');
const bodyParser = require('body-parser');
const { MessagingResponse } = require('twilio').twiml;
const axios = require('axios');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// === CONFIGURAÇÕES ===
const SHEETBEST_WEBHOOK = 'https://sheetbest.io/api/v1/4cc94d34462e'; // webhook real que você tem
const PORT = 3000;  // porta local
const BASE_URL = 'https://8d5b-2804-14c-79c1-7a99-164d-68d7-c964.ngrok-free.app'; // seu ngrok ou domínio público

// Dados temporários para cada cliente (telefone)
const sessions = {};

// Catálogo fixo de produtos
const produtos = {
  1: "🎱 Mesa de Bilhar Tradicional – 2,23 x 1,23m, acabamento em verniz, campo de ardósia. Preço: R$ 2.798",
  2: "⚽ Mesa de Pebolim Profissional – Estrutura reforçada, pintura automotiva. Preço: R$ 1.350",
  3: "🔴 Conjunto de Bolas Snooker – 16 bolas oficiais, resina importada. Preço: R$ 190",
  4: "🪵 Taco Profissional Madeira – Ponta rosqueável, cabo emborrachado. Preço: R$ 120",
  5: "🧥 Capa para Mesa de Bilhar – Tecido resistente, várias cores. Preço: R$ 99"
};

app.post('/webhook', async (req, res) => {
  const msg = req.body.Body?.trim();
  const from = req.body.From || '';
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

  try {
    switch (step) {
      case 0:
        reply(
          "👋 Olá! Bem-vindo ao atendimento da *Castillero Diversões*.\n\n" +
          "Escolha uma opção:\n" +
          "1️⃣ Fazer pedido\n" +
          "2️⃣ Ver produtos\n" +
          "3️⃣ Sobre nós"
        );
        session.step = 1;
        break;

      case 1:
        if (msg === '1') {
          session.step = 2;
          reply("👤 Por favor, informe seu nome completo:");
        } else if (msg === '2') {
          let lista = "🛒 *Produtos Castillero Diversões:*\n\n";
          for (const [num, desc] of Object.entries(produtos)) {
            lista += `${num}️⃣ ${desc.split("–")[0].trim()}\n`;
          }
          lista += "\nDigite o número para ver mais detalhes ou *0* para voltar ao menu.";
          session.step = 20;
          reply(lista);
        } else if (msg === '3') {
          reply(
            "🏆 *Sobre nós*\n\n" +
            "A Castillero Diversões atua há mais de 20 anos na fabricação de mesas de bilhar, pebolim, ping pong e acessórios. " +
            "Referência em qualidade e atendimento, oferece produtos sob medida para residências e estabelecimentos.\n\n" +
            "Digite *1* para fazer pedido ou *2* para ver produtos."
          );
        } else {
          reply("❌ Opção inválida. Por favor digite *1*, *2* ou *3*.");
        }
        break;

      case 20:
        if (msg === '0') {
          session.step = 0;
          reply("🔙 Retornando ao menu principal...");
        } else if (produtos[msg]) {
          reply(
            produtos[msg] + "\n\n" +
            "Digite *1* para fazer pedido ou *0* para voltar ao menu principal."
          );
          session.step = 21;
          session.data.produto = msg;
        } else {
          reply("❌ Produto não encontrado. Digite um número válido ou *0* para voltar.");
        }
        break;

      case 21:
        if (msg === '1') {
          session.step = 2;
          reply("👤 Por favor, informe seu nome completo:");
        } else if (msg === '0') {
          session.step = 0;
          reply("🔙 Retornando ao menu principal...");
        } else {
          reply("❌ Resposta inválida. Digite *1* para pedir este produto ou *0* para voltar.");
        }
        break;

      case 2:
        data.nome = msg;
        session.step = 3;
        reply("🪪 Informe seu CPF ou CNPJ:");
        break;

      case 3:
        data.cpf = msg;
        session.step = 4;
        reply("📦 Qual o código do produto que deseja? (Exemplo: 1, 2, 3...)");
        break;

      case 4:
        if (!produtos[msg]) {
          reply("❌ Código de produto inválido. Digite um número válido da lista.");
          return;
        }
        data.produto = msg;
        session.step = 5;
        reply("🔢 Quantidade:");
        break;

      case 5:
        if (!/^\d+$/.test(msg)) {
          reply("❌ Quantidade inválida. Digite um número inteiro.");
          return;
        }
        data.quantidade = msg;
        session.step = 6;
        reply("🎁 Brindes inclusos? Se não houver, digite 'Nenhum':");
        break;

      case 6:
        data.brinde = msg;
        session.step = 7;
        reply("🧩 Acessórios adicionais? Se não houver, digite 'Nenhum':");
        break;

      case 7:
        data.acessorios = msg;
        session.step = 8;
        reply("📝 Observações do pedido:");
        break;

      case 8:
        data.observacoes = msg;
        session.step = 9;

        // Agora envia os dados para o Sheetbest e finaliza
        const payload = {
          nome: data.nome,
          cpf_cnpj: data.cpf,
          produto: produtos[data.produto],
          quantidade: data.quantidade,
          brinde: data.brinde,
          acessorios: data.acessorios,
          observacoes: data.observacoes,
          telefone: phone
        };

        try {
          await axios.post(SHEETBEST_WEBHOOK, payload);
          reply(
            "✅ Pedido registrado com sucesso!\n\n" +
            "Muito obrigado pela preferência. Entraremos em contato em breve."
          );
          delete sessions[phone]; // limpa sessão
        } catch (err) {
          console.error(err);
          reply("❌ Ocorreu um erro ao registrar seu pedido. Tente novamente mais tarde.");
        }
        break;

      default:
        session.step = 0;
        reply("🔄 Vamos começar novamente.\nDigite *1* para fazer pedido ou *2* para ver produtos.");
        break;
    }
  } catch (error) {
    console.error(error);
    reply("❌ Algo deu errado. Por favor, tente novamente.");
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Webhook público: ${BASE_URL}/webhook`);
});
