'use strict';

/**
 * 🐾 BOT WHATSAPP — PATINHAS FELIZES MARÍLIA
 * Biblioteca: @whiskeysockets/baileys (sem Puppeteer, sem Chrome)
 * Node.js >= 18
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  Browsers,
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const qrcode   = require('qrcode-terminal');
const pino     = require('pino');

// ─────────────────────────────────────────────────────────────
//  ⚙️  CONFIGURAÇÕES — EDITE AQUI ANTES DE RODAR
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  pixKey:    'chavepix@patinhasfelizes.com',      // 🔑 Sua chave Pix
  instagram: '@Patinhasfelizesmarilia',
  ownerPhone: '5514999999999',                    // 📱 Seu número (55 + DDD + número, SEM @)
  precos: {
    hospedagem: 50,
    creche:     { '1': 160, '2': 280, '3': 360 },
    domiciliar: { '1': 50,  '2': 100 },
  },
};

// ─────────────────────────────────────────────────────────────
//  🧠  GERENCIAMENTO DE SESSÕES
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
function genProto(prefix) {
  return `#${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
}

function addDays(dateStr, days) {
  const clean = dateStr.replace(/-/g, '/');
  const parts = clean.split('/');
  const date  = new Date(parseInt(parts[2] || 2026), parseInt(parts[1]) - 1, parseInt(parts[0]));
  date.setDate(date.getDate() + parseInt(days));
  return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
}

function normalizeHour(h) {
  const match = h.match(/(\d{1,2})[hH:]?(\d{0,2})/);
  if (!match) return h;
  return `${match[1].padStart(2,'0')}:${match[2] ? match[2].padStart(2,'0') : '00'}`;
}

function normalizeDate(input) {
  const clean = input.replace(/\s/g, '');
  const m1 = clean.match(/^(\d{2})[\/\-](\d{2})[\/\-]?(\d{2,4})?$/);
  if (m1) {
    const y = m1[3] ? (m1[3].length === 2 ? '20' + m1[3] : m1[3]) : '2026';
    return `${m1[1]}/${m1[2]}/${y}`;
  }
  const m2 = clean.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m2) return `${m2[1]}/${m2[2]}/${m2[3]}`;
  return input;
}

function isNao(text) {
  return ['não','nao','n','nenhuma'].includes(text.toLowerCase().trim());
}

function jid(phone) {
  return `${phone}@s.whatsapp.net`;
}

// ─────────────────────────────────────────────────────────────
//  💬  MENSAGENS
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
Ambiente residencial, seguro, limpo e aconchegante 🏡

💰 *Valor:* R$ 50,00 a diária (por pet)
💳 Pagamento realizado na entrada do pet.
📌 *Reserva:* Sinal de R$ 50,00, abatido no total.

🐾 *Itens para trazer:*
🍖 Alimentação  🦴 Caminha  🧸 Cobertinha  🥣 Comedouros  🐕 Guia  💊 Medicamentos  ⬜ Tapete higiênico

✅ Vacinas, vermifugação e antipulgas em dia.
📸 Enviamos fotos e vídeos durante toda a estadia 🥰
📝 Visita de cortesia gratuita antes da hospedagem 💖
📲 Instagram: @Patinhasfelizesmarilia
🐱 Gatos: ambiente separado, sem contato com cães ✨

Deseja continuar?
1️⃣ Sim  2️⃣ Voltar`,

  creche_info: `🐾 *CRECHE PET* 🐕

Seu pet passa o dia acompanhado, brincando e recebendo muito amor 🐶✨

⏰ *Funcionamento:* Seg a Sex, 7h30 às 19h00

💰 *Planos mensais:*
🐾 1x por semana — R$ 160,00
🐾 2x por semana — R$ 280,00
🐾 3x por semana — R$ 360,00

📌 Adaptamos o horário conforme sua necessidade.

Deseja continuar?
1️⃣ Sim  2️⃣ Voltar`,

  domiciliar_info: `🏡 *ATENDIMENTO DOMICILIAR* 🐶🐱

Vai viajar ou a rotina está corrida?
Seu pet não precisa sair de casa 💖

🐾 *O que está incluso na visita (40 min):*
🍖 Alimentação  🧹 Higienização  🎾 Brincadeiras  🐕 Passeio  💊 Medicação

📝 Visita de cortesia gratuita antes de iniciar 🐾

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
//  📋  RESUMOS
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

✅ Deseja confirmar?
1️⃣ Confirmar  2️⃣ Cancelar`;
}

function resumoCreche(d) {
  const plano = CONFIG.precos.creche[String(d.frequencia)];
  const freq  = { '1': '1x por semana', '2': '2x por semana', '3': '3x por semana' };
  return `📋 *RESUMO DA CRECHE*

🐾 Nome: ${d.nomePet}
🦴 Raça: ${d.racaPet}
💊 Cuidados: ${d.cuidadoPet || 'Não possui'}
🕒 Entrada: ${d.horaEntrada}
🕒 Saída: ${d.horaSaida}
📅 Frequência: ${freq[d.frequencia]}
💰 *Plano: R$ ${plano},00/mês*

✅ Deseja confirmar?
1️⃣ Sim  2️⃣ Não`;
}

function resumoDomiciliar(d) {
  const petsText = d.pets.map((p, i) =>
    `🐾 *PET ${i+1}*  Nome: ${p.nome}  Raça: ${p.raca}  Cuidados: ${p.cuidados || 'Não possui'}`
  ).join('\n');
  const valor = CONFIG.precos.domiciliar[String(d.visitas)];
  const vis   = d.visitas === '1' ? '1 visita ao dia' : '2 visitas ao dia';
  return `📋 *RESUMO DO ATENDIMENTO*

🏡 Serviço: Atendimento Domiciliar
📅 Data: ${d.data}
🐶 Quantidade de pets: ${d.pets.length}

${petsText}

📌 Plano: ${vis}
💰 *Valor total: R$ ${valor},00*
📝 Observações: ${d.observacao || 'Nenhuma'}

✅ Deseja confirmar?
1️⃣ Confirmar  2️⃣ Cancelar`;
}

// ─────────────────────────────────────────────────────────────
//  ✅  CONFIRMAÇÕES
// ─────────────────────────────────────────────────────────────
function confirmacaoHospedagem(proto) {
  return `✅ *Agendamento confirmado com sucesso!*
📌 Protocolo: ${proto}
📸 Enviaremos fotos e vídeos durante a estadia 🥰

💳 *Sinal da reserva:*
💰 *R$ 50,00*
🔑 Pix: *${CONFIG.pixKey}*
📌 Favor enviar o comprovante para confirmar o agendamento 🐾

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
📌 Favor enviar o comprovante para confirmar o agendamento 🐾

Obrigado pela confiança 💖`;
}

// ─────────────────────────────────────────────────────────────
//  🔔  NOTIFICAÇÕES AO DONO
// ─────────────────────────────────────────────────────────────
let sock; // referência global ao socket

async function notificarDono(texto) {
  try {
    await sock.sendMessage(jid(CONFIG.ownerPhone), { text: texto });
  } catch (err) {
    console.error('Erro ao notificar dono:', err.message);
  }
}

function buildNotifHospedagem(d, proto, phone) {
  const petsText = d.pets.map((p,i) =>
    `Pet ${i+1}: ${p.nome} (${p.raca}) — ${p.cuidados || 'sem cuidados especiais'}`
  ).join('\n');
  const total = d.dias * d.pets.length * CONFIG.precos.hospedagem;
  return `🐾 *NOVO AGENDAMENTO — HOSPEDAGEM*
📌 Protocolo: ${proto}
📱 Cliente: ${phone}
📅 Entrada: ${d.dataEntrada} às ${d.horaEntrada}
📅 Saída: ${d.dataSaida} às ${d.horaSaida}
🐶 Pets (${d.pets.length}):\n${petsText}
📝 Obs: ${d.observacao || 'Nenhuma'}
💰 Valor total: R$ ${total},00`;
}

function buildNotifCreche(d, proto, phone) {
  return `🐾 *NOVO CADASTRO — CRECHE*
📌 Protocolo: ${proto}
📱 Cliente: ${phone}
🐾 Pet: ${d.nomePet} (${d.racaPet})
🕒 ${d.horaEntrada} às ${d.horaSaida}
📅 Frequência: ${d.frequencia}x/semana
💰 R$ ${CONFIG.precos.creche[d.frequencia]},00/mês`;
}

function buildNotifDomiciliar(d, proto, phone) {
  const valor    = CONFIG.precos.domiciliar[String(d.visitas)];
  const petsText = d.pets.map((p,i) => `Pet ${i+1}: ${p.nome} (${p.raca})`).join('\n');
  return `🐾 *NOVO AGENDAMENTO — DOMICILIAR*
📌 Protocolo: ${proto}
📱 Cliente: ${phone}
📅 Data: ${d.data}
🐶 Pets:\n${petsText}
🕒 Visitas: ${d.visitas}x ao dia
💰 R$ ${valor},00
📝 Obs: ${d.observacao || 'Nenhuma'}`;
}

// ─────────────────────────────────────────────────────────────
//  🤖  HANDLER PRINCIPAL
// ─────────────────────────────────────────────────────────────
async function handleMessage(rawJid, text) {
  const phone = rawJid.replace('@s.whatsapp.net', '');

  // Ignora grupos e listas
  if (rawJid.includes('@g.us') || rawJid === 'status@broadcast') return;

  async function reply(msg) {
    await sock.sendMessage(rawJid, { text: msg });
  }

  // Comandos globais
  const globalKw = ['menu','inicio','início','voltar','oi','olá','ola',
                    'bom dia','boa tarde','boa noite','hi','hello','0'];
  if (globalKw.includes(text.toLowerCase().trim())) {
    resetSession(phone);
    await reply(M.menu);
    return;
  }

  const session  = getSession(phone);
  const { state, data } = session;
  let msg = null;

  switch (state) {

    // ── MENU ────────────────────────────────────────────────
    case 'MENU':
      if      (text === '1') { setState(phone, 'H_INFO');    msg = M.hospedagem_info; }
      else if (text === '2') { setState(phone, 'C_INFO');    msg = M.creche_info; }
      else if (text === '3') { setState(phone, 'D_INFO');    msg = M.domiciliar_info; }
      else if (text === '4') {
        setState(phone, 'ATENDENTE');
        msg = M.atendente;
        await notificarDono(`⚠️ *CLIENTE AGUARDANDO ATENDIMENTO*\n📱 Número: ${phone}`);
      }
      else msg = M.menu;
      break;

    // ── HOSPEDAGEM ──────────────────────────────────────────
    case 'H_INFO':
      if      (text === '1') { setState(phone, 'H_DATA_ENTRADA'); msg = '📅 Informe a *data de entrada* do pet.\n_Exemplos: 12/06/2026  12062026  12-06_'; }
      else if (text === '2') { resetSession(phone);               msg = M.menu; }
      else msg = 'Por favor, escolha:\n1️⃣ Sim  2️⃣ Voltar';
      break;

    case 'H_DATA_ENTRADA':
      data.dataEntrada = normalizeDate(text);
      setState(phone, 'H_HORA_ENTRADA');
      msg = '🕒 Informe o *horário de entrada*.\n_Exemplos: 14h  14:30  14h30_';
      break;

    case 'H_HORA_ENTRADA':
      data.horaEntrada = normalizeHour(text);
      setState(phone, 'H_DIAS');
      msg = '📆 *Quantos dias* o pet ficará hospedado?';
      break;

    case 'H_DIAS':
      data.dias      = parseInt(text) || 1;
      data.dataSaida = addDays(data.dataEntrada, data.dias);
      setState(phone, 'H_HORA_SAIDA');
      msg = '🚗 Informe o *horário previsto para retirada* do pet.';
      break;

    case 'H_HORA_SAIDA':
      data.horaSaida = normalizeHour(text);
      setState(phone, 'H_QTD_PETS');
      msg = '🐶 *Quantos pets* serão hospedados?';
      break;

    case 'H_QTD_PETS':
      data.qtdPets    = parseInt(text) || 1;
      data.pets       = [];
      data.currentPet = 0;
      setState(phone, 'H_PET_NOME');
      msg = `🐾 *Nome do pet ${data.currentPet + 1}:*`;
      break;

    case 'H_PET_NOME':
      data.tempNome = text;
      setState(phone, 'H_PET_RACA');
      msg = '🦴 Qual a *raça* do pet?';
      break;

    case 'H_PET_RACA':
      data.tempRaca = text;
      setState(phone, 'H_PET_CUIDADO');
      msg = '💊 O pet possui alguma *deficiência, alergia ou cuidado especial*?';
      break;

    case 'H_PET_CUIDADO':
      data.pets.push({ nome: data.tempNome, raca: data.tempRaca, cuidados: isNao(text) ? null : text });
      data.currentPet++;
      if (data.currentPet < data.qtdPets) {
        setState(phone, 'H_PET_NOME');
        msg = `🐾 *Nome do pet ${data.currentPet + 1}:*`;
      } else {
        setState(phone, 'H_OBSERVACAO');
        msg = '📝 Deseja adicionar alguma *observação*?\n_Caso não tenha, digite: Não_';
      }
      break;

    case 'H_OBSERVACAO':
      data.observacao = isNao(text) ? null : text;
      setState(phone, 'H_CONFIRMAR');
      msg = resumoHospedagem(data);
      break;

    case 'H_CONFIRMAR':
      if (text === '1') {
        const proto = genProto('HP');
        await notificarDono(buildNotifHospedagem(data, proto, phone));
        resetSession(phone);
        msg = confirmacaoHospedagem(proto);
      } else if (text === '2') {
        resetSession(phone);
        msg = '❌ Agendamento cancelado.\n\n' + M.menu;
      } else {
        msg = 'Por favor, escolha:\n1️⃣ Confirmar  2️⃣ Cancelar';
      }
      break;

    // ── CRECHE ──────────────────────────────────────────────
    case 'C_INFO':
      if      (text === '1') { setState(phone, 'C_PET_NOME'); msg = '🐾 *Nome do pet:*'; }
      else if (text === '2') { resetSession(phone);           msg = M.menu; }
      else msg = 'Por favor, escolha:\n1️⃣ Sim  2️⃣ Voltar';
      break;

    case 'C_PET_NOME':
      data.nomePet = text;
      setState(phone, 'C_PET_RACA');
      msg = '🦴 Qual a *raça*?';
      break;

    case 'C_PET_RACA':
      data.racaPet = text;
      setState(phone, 'C_PET_CUIDADO');
      msg = '💊 Possui algum *cuidado específico*?';
      break;

    case 'C_PET_CUIDADO':
      data.cuidadoPet = isNao(text) ? null : text;
      setState(phone, 'C_HORA_ENTRADA');
      msg = '🕒 Informe o *horário de entrada*.';
      break;

    case 'C_HORA_ENTRADA':
      data.horaEntrada = normalizeHour(text);
      setState(phone, 'C_HORA_SAIDA');
      msg = '🕒 Informe o *horário de saída*.';
      break;

    case 'C_HORA_SAIDA':
      data.horaSaida = normalizeHour(text);
      setState(phone, 'C_FREQUENCIA');
      msg = `📅 *Quantos dias por semana* o pet ficará na creche?
1️⃣ 1x por semana
2️⃣ 2x por semana
3️⃣ 3x por semana`;
      break;

    case 'C_FREQUENCIA':
      if (['1','2','3'].includes(text)) {
        data.frequencia = text;
        setState(phone, 'C_CONFIRMAR');
        msg = resumoCreche(data);
      } else {
        msg = 'Por favor, escolha 1️⃣, 2️⃣ ou 3️⃣';
      }
      break;

    case 'C_CONFIRMAR':
      if (text === '1') {
        const proto = genProto('CR');
        await notificarDono(buildNotifCreche(data, proto, phone));
        resetSession(phone);
        msg = confirmacaoCreche(proto);
      } else if (text === '2') {
        resetSession(phone);
        msg = '❌ Cadastro cancelado.\n\n' + M.menu;
      } else {
        msg = 'Por favor, escolha:\n1️⃣ Sim  2️⃣ Não';
      }
      break;

    // ── DOMICILIAR ──────────────────────────────────────────
    case 'D_INFO':
      if      (text === '1') { setState(phone, 'D_DATA'); msg = '📅 Informe a *data desejada* para o atendimento.'; }
      else if (text === '2') { resetSession(phone);       msg = M.menu; }
      else msg = 'Por favor, escolha:\n1️⃣ Sim  2️⃣ Voltar';
      break;

    case 'D_DATA':
      data.data = normalizeDate(text);
      setState(phone, 'D_QTD_PETS');
      msg = '🐶 *Quantos pets* serão atendidos?';
      break;

    case 'D_QTD_PETS':
      data.qtdPets    = parseInt(text) || 1;
      data.pets       = [];
      data.currentPet = 0;
      setState(phone, 'D_PET_NOME');
      msg = `🐾 *Nome do pet ${data.currentPet + 1}:*`;
      break;

    case 'D_PET_NOME':
      data.tempNome = text;
      setState(phone, 'D_PET_RACA');
      msg = '🦴 Qual a *raça*?';
      break;

    case 'D_PET_RACA':
      data.tempRaca = text;
      setState(phone, 'D_PET_CUIDADO');
      msg = '💊 Possui algum *cuidado específico*?';
      break;

    case 'D_PET_CUIDADO':
      data.pets.push({ nome: data.tempNome, raca: data.tempRaca, cuidados: isNao(text) ? null : text });
      data.currentPet++;
      if (data.currentPet < data.qtdPets) {
        setState(phone, 'D_PET_NOME');
        msg = `🐾 *Nome do pet ${data.currentPet + 1}:*`;
      } else {
        setState(phone, 'D_VISITAS');
        msg = `🕒 *Deseja:*
1️⃣ 1 visita ao dia — R$ 50,00
2️⃣ 2 visitas ao dia — R$ 100,00`;
      }
      break;

    case 'D_VISITAS':
      if (text === '1' || text === '2') {
        data.visitas = text;
        setState(phone, 'D_OBSERVACAO');
        msg = '📝 Deseja adicionar alguma *observação*?\n_Caso não tenha, digite: Não_';
      } else {
        msg = 'Por favor, escolha:\n1️⃣ 1 visita  2️⃣ 2 visitas';
      }
      break;

    case 'D_OBSERVACAO':
      data.observacao = isNao(text) ? null : text;
      setState(phone, 'D_CONFIRMAR');
      msg = resumoDomiciliar(data);
      break;

    case 'D_CONFIRMAR':
      if (text === '1') {
        const proto = genProto('AD');
        await notificarDono(buildNotifDomiciliar(data, proto, phone));
        resetSession(phone);
        msg = confirmacaoDomiciliar(proto);
      } else if (text === '2') {
        resetSession(phone);
        msg = '❌ Agendamento cancelado.\n\n' + M.menu;
      } else {
        msg = 'Por favor, escolha:\n1️⃣ Confirmar  2️⃣ Cancelar';
      }
      break;

    // ── ATENDENTE ───────────────────────────────────────────
    case 'ATENDENTE':
      msg = '⏳ Um atendente estará com você em breve 💖\nDigite *menu* para voltar ao início.';
      break;

    default:
      resetSession(phone);
      msg = M.menu;
  }

  if (msg) await reply(msg);
}

// ─────────────────────────────────────────────────────────────
//  🚀  CONEXÃO BAILEYS
// ─────────────────────────────────────────────────────────────
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version }          = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth:    state,
    browser: Browsers.ubuntu('Chrome'),
    logger:  pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  // QR Code
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.clear();
      console.log('\n╔════════════════════════════════════╗');
      console.log('║  📱 Escaneie o QR Code abaixo      ║');
      console.log('║  WhatsApp → Dispositivos vinculados ║');
      console.log('╚════════════════════════════════════╝\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect =
        new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️  Conexão fechada. Reconectando:', shouldReconnect);
      if (shouldReconnect) connectToWhatsApp();
      else console.log('❌ Desconectado. Delete a pasta auth_info e reinicie.');
    }

    if (connection === 'open') {
      console.log('\n✅ Bot conectado e pronto para uso!');
      console.log('🐾 Patinhas Felizes Marília — Bot ativo\n');
    }
  });

  // Salva credenciais
  sock.ev.on('creds.update', saveCreds);

  // Recebe mensagens
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const text = (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.buttonsResponseMessage?.selectedDisplayText ||
        ''
      ).trim();

      if (!text) continue;

      try {
        await handleMessage(from, text);
      } catch (err) {
        console.error('Erro ao processar mensagem:', err.message);
      }
    }
  });
}

connectToWhatsApp();
