'use strict';

/**
 * 🐾 BOT WHATSAPP — PATINHAS FELIZES MARÍLIA
 * Biblioteca: whatsapp-web.js (gratuita, QR Code)
 * Node.js >= 18
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ─────────────────────────────────────────────────────────────
//  ⚙️  CONFIGURAÇÕES — EDITE AQUI ANTES DE RODAR
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  pixKey: 'chavepix@patinhasfelizes.com',       // 🔑 Sua chave Pix
  instagram: '@Patinhasfelizesmarilia',
  ownerPhone: '5514996732253',             // 📱 Seu número (55 + DDD + número)
  precos: {
    hospedagem: 50,                             // R$ por diária / por pet
    creche: { '1': 160, '2': 280, '3': 360 },  // R$ por plano mensal
    domiciliar: { '1': 50, '2': 100 },         // R$ por dia
  },
};

// ─────────────────────────────────────────────────────────────
//  🧠  GERENCIAMENTO DE SESSÕES (memória por usuário)
// ─────────────────────────────────────────────────────────────
const sessions = new Map();

function getSession(phone) {
  if (!sessions.has(phone)) resetSession(phone);
  return sessions.get(phone);
}

function resetSession(phone) {
  sessions.set(phone, { state: 'MENU', data: { pets: [], currentPet: 0 } });
  return sessions.get(phone);
}

function setState(phone, state, extra = {}) {
  const s = getSession(phone);
  s.state = state;
  Object.assign(s.data, extra);
}

// ─────────────────────────────────────────────────────────────
//  🛠️  UTILITÁRIOS
// ─────────────────────────────────────────────────────────────

/** Gera protocolo aleatório: ex. #HP2048 */
function genProto(prefix) {
  return `#${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Adiciona N dias a uma data DD/MM/YYYY */
function addDays(dateStr, days) {
  const clean = dateStr.replace(/-/g, '/');
  const parts = clean.split('/');
  let d = parseInt(parts[0]);
  let m = parseInt(parts[1]) - 1;
  let y = parseInt(parts[2] || 2026);
  const date = new Date(y, m, d);
  date.setDate(date.getDate() + parseInt(days));
  return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
}

/** Normaliza hora: "14h", "14:30", "14h30" → "14:00" ou "14:30" */
function normalizeHour(h) {
  const match = h.match(/(\d{1,2})[hH:]?(\d{0,2})/);
  if (!match) return h;
  const hh = match[1].padStart(2, '0');
  const mm = match[2] ? match[2].padStart(2, '0') : '00';
  return `${hh}:${mm}`;
}

/** Normaliza data: aceita DD/MM/YYYY, DDMMYYYY, DD-MM, DD/MM */
function normalizeDate(input) {
  const clean = input.replace(/\s/g, '');
  // DD/MM/YYYY ou DD-MM-YYYY
  const m1 = clean.match(/^(\d{2})[\/\-](\d{2})[\/\-]?(\d{2,4})?$/);
  if (m1) {
    const y = m1[3] ? (m1[3].length === 2 ? '20' + m1[3] : m1[3]) : '2026';
    return `${m1[1]}/${m1[2]}/${y}`;
  }
  // DDMMYYYY
  const m2 = clean.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m2) return `${m2[1]}/${m2[2]}/${m2[3]}`;
  return input;
}

/** Verifica se é resposta negativa */
function isNao(text) {
  return ['não', 'nao', 'n', 'nenhuma'].includes(text.toLowerCase().trim());
}

// ─────────────────────────────────────────────────────────────
//  💬  MENSAGENS DO BOT
// ─────────────────────────────────────────────────────────────
const M = {

  menu: `🤖 *Olá! Seja bem-vindo(a)* 💖
Aqui seu pet recebe muito carinho, cuidado e atenção como parte da família 🐶🐱

Escolha uma opção:
1️⃣ Hospedagem Pet
2️⃣ Creche Pet
3️⃣ Atendimento Domiciliar
4️⃣ Falar com atendente`,

  hospedagem_info: `🏡 *Hospedagem Pet* 😺🐶

Seu pet será acolhido com muito amor, carinho e cuidado, como parte da família 💕
A hospedagem é realizada em ambiente residencial, seguro, limpo e aconchegante, preparado para que ele se sinta realmente em casa 🏡

💰 *Valor da hospedagem:* R$ 50,00 a diária (por pet)
💳 Pagamento realizado na entrada do pet.
📌 *Reserva da vaga:* Pagamento antecipado de R$ 50,00, abatido no total da estadia.

🐾 *Itens importantes para trazer:*
🍖 Alimentação  🦴 Caminha  🧸 Cobertinha  🥣 Comedouros  🐕 Guia  💊 Medicamentos  ⬜ Tapete higiênico

✅ *Importante:* Vacinas, vermifugação e prevenção contra pulgas e carrapatos devem estar em dia.
📸 Enviamos fotos e vídeos durante toda a estadia 🥰
📝 *Visita de cortesia* gratuita para conhecer seu pet antes da hospedagem 💖
📲 Instagram: @Patinhasfelizesmarilia
🐱 *Gatos:* ambiente separado, seguro, sem contato com cães ✨

Deseja continuar com o agendamento?
1️⃣ Sim  2️⃣ Voltar`,

  creche_info: `🐾 *CRECHE PET* 🐕

Seu pet passa o dia acompanhado, brincando, gastando energia e recebendo muito amor 🐶✨

⏰ *Horário de funcionamento:* Segunda a sexta-feira, das 7h30 às 19h00

💰 *Planos mensais:*
🐾 1x por semana — R$ 160,00
🐾 2x por semana — R$ 280,00
🐾 3x por semana — R$ 360,00

📌 Adaptamos o horário de entrada conforme seu horário de trabalho.

Deseja continuar?
1️⃣ Sim  2️⃣ Voltar`,

  domiciliar_info: `🏡 *ATENDIMENTO DOMICILIAR* 🐶🐱

Vai viajar ou a rotina está corrida?
Seu pet não precisa sair de casa 💖
Cuidamos dele no ambiente onde ele se sente mais seguro 🏡

🐾 *O que está incluso na visita (40 min):*
🍖 Alimentação  🧹 Higienização  🎾 Brincadeiras  🐕 Passeio  💊 Medicação

📝 *Visita de cortesia* gratuita para conhecer seu pet e sua rotina 🐾

💰 *Valores:*
🐾 1 visita ao dia — R$ 50,00
🐾 2 visitas ao dia — R$ 100,00

Deseja continuar?
1️⃣ Sim  2️⃣ Voltar`,

  atendente: `⏳ *Aguarde um momento!*
Vamos te encaminhar para um atendente assim que possível 💖

Em breve alguém entrará em contato com você 🐾
_(Digite *menu* a qualquer momento para voltar ao início)_`,
};

// ─────────────────────────────────────────────────────────────
//  📋  MENSAGENS DE RESUMO
// ─────────────────────────────────────────────────────────────

function resumoHospedagem(d) {
  const petsText = d.pets.map((p, i) =>
    `🐾 *PET ${i+1}*  Nome: ${p.nome}  Raça: ${p.raca}  Cuidados: ${p.cuidados || 'Não possui'}`
  ).join('\n');
  const total = d.dias * d.pets.length * CONFIG.precos.hospedagem;
  return `📋 *RESUMO DO AGENDAMENTO*

🏡 Serviço: Hospedagem Pet
📅 Entrada: ${d.dataEntrada}
🕒 Horário entrada: ${d.horaEntrada}
📅 Saída prevista: ${d.dataSaida}
🚗 Horário retirada: ${d.horaSaida}
🐶 Quantidade de pets: ${d.pets.length}

${petsText}

📝 Observações: ${d.observacao || 'Nenhuma'}
💰 *VALOR TOTAL: R$ ${total},00*
🧮 ${d.dias} dias × ${d.pets.length} pets × R$ ${CONFIG.precos.hospedagem} diária
📌 Sinal da reserva: R$ 50,00

✅ Deseja confirmar o agendamento?
1️⃣ Confirmar  2️⃣ Cancelar`;
}

function resumoCreche(d) {
  const plano = CONFIG.precos.creche[String(d.frequencia)];
  const freqTexto = { '1': '1x por semana', '2': '2x por semana', '3': '3x por semana' };
  return `📋 *RESUMO DA CRECHE*

🐾 Nome: ${d.nomePet}
🦴 Raça: ${d.racaPet}
💊 Cuidados: ${d.cuidadoPet || 'Não possui'}
🕒 Entrada: ${d.horaEntrada}
🕒 Saída: ${d.horaSaida}
📅 Frequência: ${freqTexto[d.frequencia]}
💰 *Plano: R$ ${plano},00/mês*

✅ Deseja confirmar?
1️⃣ Sim  2️⃣ Não`;
}

function resumoDomiciliar(d) {
  const petsText = d.pets.map((p, i) =>
    `🐾 *PET ${i+1}*  Nome: ${p.nome}  Raça: ${p.raca}  Cuidados: ${p.cuidados || 'Não possui'}`
  ).join('\n');
  const valor = CONFIG.precos.domiciliar[String(d.visitas)];
  const visitasTexto = d.visitas === '1' ? '1 visita ao dia' : '2 visitas ao dia';
  return `📋 *RESUMO DO ATENDIMENTO*

🏡 Serviço: Atendimento Domiciliar
📅 Data: ${d.data}
🐶 Quantidade de pets: ${d.pets.length}

${petsText}

📌 Plano: ${visitasTexto}
💰 *Valor total: R$ ${valor},00*
📝 Observações: ${d.observacao || 'Nenhuma'}

✅ Deseja confirmar?
1️⃣ Confirmar  2️⃣ Cancelar`;
}

// ─────────────────────────────────────────────────────────────
//  ✅  MENSAGENS DE CONFIRMAÇÃO
// ─────────────────────────────────────────────────────────────

function confirmacaoHospedagem(proto) {
  return `✅ *Agendamento confirmado com sucesso!*
📌 Protocolo: ${proto}
📸 Durante a hospedagem enviaremos fotos e vídeos do seu pet 🥰

💳 *Sinal da reserva — Para garantir a vaga:*
💰 *R$ 50,00*
🔑 Pix: *${CONFIG.pixKey}*
📌 Favor enviar o comprovante para confirmar definitivamente o agendamento 🐾

Obrigado pela confiança 💖`;
}

function confirmacaoCreche(proto) {
  return `✅ *Cadastro realizado com sucesso!*
📌 Protocolo: ${proto}
Obrigado pela preferência 🐾💖`;
}

function confirmacaoDomiciliar(proto) {
  return `✅ *Atendimento agendado com sucesso!*
📌 Protocolo: ${proto}

💳 *Forma de pagamento:*
🔑 Pix: *${CONFIG.pixKey}*
📌 Favor enviar o comprovante para confirmação do agendamento 🐾

Obrigado pela confiança 💖`;
}

// ─────────────────────────────────────────────────────────────
//  🤖  HANDLER PRINCIPAL DE MENSAGENS
// ─────────────────────────────────────────────────────────────
async function handleMessage(msg) {
  // Ignora: grupos, status, próprias mensagens
  if (msg.from.includes('@g.us')) return;
  if (msg.from === 'status@broadcast') return;
  if (msg.fromMe) return;

  const phone = msg.from;
  const text  = msg.body.trim();

  // ── Comandos globais (funcionam em qualquer estado) ──────────
  const globalKeywords = ['menu', 'inicio', 'início', 'voltar', 'oi', 'olá', 'ola',
                          'bom dia', 'boa tarde', 'boa noite', 'hi', 'hello', '0'];
  if (globalKeywords.includes(text.toLowerCase())) {
    resetSession(phone);
    await msg.reply(M.menu);
    return;
  }

  const session = getSession(phone);
  const { state, data } = session;
  let reply = null;

  switch (state) {

    // ═══════════════════════════════════════════════════════════
    //  MENU PRINCIPAL
    // ═══════════════════════════════════════════════════════════
    case 'MENU':
      if      (text === '1') { setState(phone, 'H_INFO');    reply = M.hospedagem_info; }
      else if (text === '2') { setState(phone, 'C_INFO');    reply = M.creche_info; }
      else if (text === '3') { setState(phone, 'D_INFO');    reply = M.domiciliar_info; }
      else if (text === '4') { setState(phone, 'ATENDENTE'); reply = M.atendente;
        // Notifica o dono
        await notificarDono(`⚠️ *NOVO CLIENTE AGUARDANDO ATENDIMENTO*\n📱 Número: ${phone.replace('@c.us','')}`);
      }
      else reply = M.menu;
      break;

    // ═══════════════════════════════════════════════════════════
    //  🏡  HOSPEDAGEM PET
    // ═══════════════════════════════════════════════════════════
    case 'H_INFO':
      if      (text === '1') { setState(phone, 'H_DATA_ENTRADA'); reply = '📅 Informe a *data de entrada* do pet.\n_Exemplos: 12/06/2026  12062026  12-06_'; }
      else if (text === '2') { resetSession(phone);               reply = M.menu; }
      else reply = 'Por favor, escolha:\n1️⃣ Sim  2️⃣ Voltar';
      break;

    case 'H_DATA_ENTRADA':
      data.dataEntrada = normalizeDate(text);
      setState(phone, 'H_HORA_ENTRADA');
      reply = '🕒 Informe o *horário de entrada*.\n_Exemplos: 14h  14:30  14h30_';
      break;

    case 'H_HORA_ENTRADA':
      data.horaEntrada = normalizeHour(text);
      setState(phone, 'H_DIAS');
      reply = '📆 *Quantos dias* o pet ficará hospedado?';
      break;

    case 'H_DIAS':
      data.dias = parseInt(text) || 1;
      data.dataSaida = addDays(data.dataEntrada, data.dias);
      setState(phone, 'H_HORA_SAIDA');
      reply = '🚗 Informe o *horário previsto para retirada* do pet.';
      break;

    case 'H_HORA_SAIDA':
      data.horaSaida = normalizeHour(text);
      setState(phone, 'H_QTD_PETS');
      reply = '🐶 *Quantos pets* serão hospedados?';
      break;

    case 'H_QTD_PETS':
      data.qtdPets    = parseInt(text) || 1;
      data.pets       = [];
      data.currentPet = 0;
      setState(phone, 'H_PET_NOME');
      reply = `🐾 *Nome do pet ${data.currentPet + 1}:*`;
      break;

    case 'H_PET_NOME':
      data.tempNome = text;
      setState(phone, 'H_PET_RACA');
      reply = '🦴 Qual a *raça* do pet?';
      break;

    case 'H_PET_RACA':
      data.tempRaca = text;
      setState(phone, 'H_PET_CUIDADO');
      reply = '💊 O pet possui alguma *deficiência, alergia ou cuidado especial*?';
      break;

    case 'H_PET_CUIDADO':
      data.pets.push({
        nome:     data.tempNome,
        raca:     data.tempRaca,
        cuidados: isNao(text) ? null : text,
      });
      data.currentPet++;
      if (data.currentPet < data.qtdPets) {
        setState(phone, 'H_PET_NOME');
        reply = `🐾 *Nome do pet ${data.currentPet + 1}:*`;
      } else {
        setState(phone, 'H_OBSERVACAO');
        reply = '📝 Deseja adicionar alguma *observação*?\n_Caso não tenha, digite: Não_';
      }
      break;

    case 'H_OBSERVACAO':
      data.observacao = isNao(text) ? null : text;
      setState(phone, 'H_CONFIRMAR');
      reply = resumoHospedagem(data);
      break;

    case 'H_CONFIRMAR':
      if (text === '1') {
        const proto = genProto('HP');
        const notif = buildNotifHospedagem(data, proto, phone);
        await notificarDono(notif);
        resetSession(phone);
        reply = confirmacaoHospedagem(proto);
      } else if (text === '2') {
        resetSession(phone);
        reply = '❌ Agendamento cancelado.\n\n' + M.menu;
      } else {
        reply = 'Por favor, escolha:\n1️⃣ Confirmar  2️⃣ Cancelar';
      }
      break;

    // ═══════════════════════════════════════════════════════════
    //  🐾  CRECHE PET
    // ═══════════════════════════════════════════════════════════
    case 'C_INFO':
      if      (text === '1') { setState(phone, 'C_PET_NOME'); reply = '🐾 *Nome do pet:*'; }
      else if (text === '2') { resetSession(phone);           reply = M.menu; }
      else reply = 'Por favor, escolha:\n1️⃣ Sim  2️⃣ Voltar';
      break;

    case 'C_PET_NOME':
      data.nomePet = text;
      setState(phone, 'C_PET_RACA');
      reply = '🦴 Qual a *raça*?';
      break;

    case 'C_PET_RACA':
      data.racaPet = text;
      setState(phone, 'C_PET_CUIDADO');
      reply = '💊 Possui algum *cuidado específico*?';
      break;

    case 'C_PET_CUIDADO':
      data.cuidadoPet = isNao(text) ? null : text;
      setState(phone, 'C_HORA_ENTRADA');
      reply = '🕒 Informe o *horário de entrada*.';
      break;

    case 'C_HORA_ENTRADA':
      data.horaEntrada = normalizeHour(text);
      setState(phone, 'C_HORA_SAIDA');
      reply = '🕒 Informe o *horário de saída*.';
      break;

    case 'C_HORA_SAIDA':
      data.horaSaida = normalizeHour(text);
      setState(phone, 'C_FREQUENCIA');
      reply = `📅 *Quantos dias por semana* o pet ficará na creche?
1️⃣ 1x por semana
2️⃣ 2x por semana
3️⃣ 3x por semana`;
      break;

    case 'C_FREQUENCIA':
      if (['1','2','3'].includes(text)) {
        data.frequencia = text;
        setState(phone, 'C_CONFIRMAR');
        reply = resumoCreche(data);
      } else {
        reply = 'Por favor, escolha 1️⃣, 2️⃣ ou 3️⃣';
      }
      break;

    case 'C_CONFIRMAR':
      if (text === '1') {
        const proto = genProto('CR');
        await notificarDono(buildNotifCreche(data, proto, phone));
        resetSession(phone);
        reply = confirmacaoCreche(proto);
      } else if (text === '2') {
        resetSession(phone);
        reply = '❌ Cadastro cancelado.\n\n' + M.menu;
      } else {
        reply = 'Por favor, escolha:\n1️⃣ Sim  2️⃣ Não';
      }
      break;

    // ═══════════════════════════════════════════════════════════
    //  🏠  ATENDIMENTO DOMICILIAR
    // ═══════════════════════════════════════════════════════════
    case 'D_INFO':
      if      (text === '1') { setState(phone, 'D_DATA'); reply = '📅 Informe a *data desejada* para o atendimento.'; }
      else if (text === '2') { resetSession(phone);       reply = M.menu; }
      else reply = 'Por favor, escolha:\n1️⃣ Sim  2️⃣ Voltar';
      break;

    case 'D_DATA':
      data.data = normalizeDate(text);
      setState(phone, 'D_QTD_PETS');
      reply = '🐶 *Quantos pets* serão atendidos?';
      break;

    case 'D_QTD_PETS':
      data.qtdPets    = parseInt(text) || 1;
      data.pets       = [];
      data.currentPet = 0;
      setState(phone, 'D_PET_NOME');
      reply = `🐾 *Nome do pet ${data.currentPet + 1}:*`;
      break;

    case 'D_PET_NOME':
      data.tempNome = text;
      setState(phone, 'D_PET_RACA');
      reply = '🦴 Qual a *raça*?';
      break;

    case 'D_PET_RACA':
      data.tempRaca = text;
      setState(phone, 'D_PET_CUIDADO');
      reply = '💊 Possui algum *cuidado específico*?';
      break;

    case 'D_PET_CUIDADO':
      data.pets.push({
        nome:     data.tempNome,
        raca:     data.tempRaca,
        cuidados: isNao(text) ? null : text,
      });
      data.currentPet++;
      if (data.currentPet < data.qtdPets) {
        setState(phone, 'D_PET_NOME');
        reply = `🐾 *Nome do pet ${data.currentPet + 1}:*`;
      } else {
        setState(phone, 'D_VISITAS');
        reply = `🕒 *Deseja:*
1️⃣ 1 visita ao dia — R$ 50,00
2️⃣ 2 visitas ao dia — R$ 100,00`;
      }
      break;

    case 'D_VISITAS':
      if (text === '1' || text === '2') {
        data.visitas = text;
        setState(phone, 'D_OBSERVACAO');
        reply = '📝 Deseja adicionar alguma *observação*?\n_Caso não tenha, digite: Não_';
      } else {
        reply = 'Por favor, escolha:\n1️⃣ 1 visita  2️⃣ 2 visitas';
      }
      break;

    case 'D_OBSERVACAO':
      data.observacao = isNao(text) ? null : text;
      setState(phone, 'D_CONFIRMAR');
      reply = resumoDomiciliar(data);
      break;

    case 'D_CONFIRMAR':
      if (text === '1') {
        const proto = genProto('AD');
        await notificarDono(buildNotifDomiciliar(data, proto, phone));
        resetSession(phone);
        reply = confirmacaoDomiciliar(proto);
      } else if (text === '2') {
        resetSession(phone);
        reply = '❌ Agendamento cancelado.\n\n' + M.menu;
      } else {
        reply = 'Por favor, escolha:\n1️⃣ Confirmar  2️⃣ Cancelar';
      }
      break;

    // ═══════════════════════════════════════════════════════════
    //  👩‍💼  ATENDENTE
    // ═══════════════════════════════════════════════════════════
    case 'ATENDENTE':
      reply = '⏳ Um atendente estará com você em breve 💖\nDigite *menu* para voltar ao início.';
      break;

    default:
      resetSession(phone);
      reply = M.menu;
  }

  if (reply) {
    await msg.reply(reply);
  }
}

// ─────────────────────────────────────────────────────────────
//  🔔  NOTIFICAÇÃO AO DONO
// ─────────────────────────────────────────────────────────────
async function notificarDono(texto) {
  try {
    await client.sendMessage(CONFIG.ownerPhone, texto);
  } catch (err) {
    console.error('Erro ao notificar dono:', err.message);
  }
}

function buildNotifHospedagem(d, proto, phone) {
  const petsText = d.pets.map((p, i) =>
    `Pet ${i+1}: ${p.nome} (${p.raca}) — ${p.cuidados || 'sem cuidados especiais'}`
  ).join('\n');
  const total = d.dias * d.pets.length * CONFIG.precos.hospedagem;
  return `🐾 *NOVO AGENDAMENTO — HOSPEDAGEM*
📌 Protocolo: ${proto}
📱 Cliente: ${phone.replace('@c.us','')}
📅 Entrada: ${d.dataEntrada} às ${d.horaEntrada}
📅 Saída: ${d.dataSaida} às ${d.horaSaida}
🐶 Pets (${d.pets.length}): \n${petsText}
📝 Obs: ${d.observacao || 'Nenhuma'}
💰 Valor total: R$ ${total},00`;
}

function buildNotifCreche(d, proto, phone) {
  return `🐾 *NOVO CADASTRO — CRECHE*
📌 Protocolo: ${proto}
📱 Cliente: ${phone.replace('@c.us','')}
🐾 Pet: ${d.nomePet} (${d.racaPet})
🕒 ${d.horaEntrada} às ${d.horaSaida}
📅 Frequência: ${d.frequencia}x/semana
💰 R$ ${CONFIG.precos.creche[d.frequencia]},00/mês`;
}

function buildNotifDomiciliar(d, proto, phone) {
  const valor = CONFIG.precos.domiciliar[String(d.visitas)];
  const petsText = d.pets.map((p, i) =>
    `Pet ${i+1}: ${p.nome} (${p.raca})`
  ).join('\n');
  return `🐾 *NOVO AGENDAMENTO — DOMICILIAR*
📌 Protocolo: ${proto}
📱 Cliente: ${phone.replace('@c.us','')}
📅 Data: ${d.data}
🐶 Pets: \n${petsText}
🕒 Visitas: ${d.visitas}x ao dia
💰 R$ ${valor},00
📝 Obs: ${d.observacao || 'Nenhuma'}`;
}

// ─────────────────────────────────────────────────────────────
//  🚀  INICIALIZAÇÃO DO WHATSAPP CLIENT
// ─────────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'patinhas-felizes' }),
  puppeteer: {
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
    ],
  },
});

client.on('qr', (qr) => {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║  📱 Escaneie o QR Code abaixo      ║');
  console.log('║  Abra o WhatsApp → Dispositivos    ║');
  console.log('║  vinculados → Vincular dispositivo ║');
  console.log('╚════════════════════════════════════╝\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('\n✅ Bot conectado e pronto para uso!');
  console.log('🐾 Patinhas Felizes Marília — Bot ativo\n');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Falha de autenticação:', msg);
});

client.on('disconnected', (reason) => {
  console.warn('⚠️  Bot desconectado:', reason);
  console.log('🔄 Tentando reconectar...');
  client.initialize();
});

client.on('message', handleMessage);

client.initialize();
