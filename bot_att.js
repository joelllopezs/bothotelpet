'use strict';

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const qrcode   = require('qrcode-terminal');
const pino     = require('pino');

const CONFIG = {
  pixKey:     '(14) 99720-0278',
  instagram:  '@Patinhasfelizesmarilia',
  ownerPhone: '5514999999999',
  precos: {
    hospedagem: 50,
    creche: { '1': 160, '2': 280, '3': 360, '4': 440, '5': 520 },
    domiciliar: { '1': 50, '2': 100 },
  },
};

const sessions = new Map();
function getSession(phone) { if (!sessions.has(phone)) resetSession(phone); return sessions.get(phone); }
function resetSession(phone) { sessions.set(phone, { state: 'MENU', data: { pets: [], currentPet: 0 } }); return sessions.get(phone); }
function setState(phone, state, extra = {}) { const s = getSession(phone); s.state = state; Object.assign(s.data, extra); }

function genProto(p) { return `#${p}${Math.floor(1000 + Math.random() * 9000)}`; }
function addDays(dateStr, days) {
  const parts = dateStr.replace(/-/g,'/').split('/');
  const date = new Date(parseInt(parts[2]||2026), parseInt(parts[1])-1, parseInt(parts[0]));
  date.setDate(date.getDate() + parseInt(days));
  return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
}
function normalizeHour(h) { const m = h.match(/(\d{1,2})[hH:]?(\d{0,2})/); if (!m) return h; return `${m[1].padStart(2,'0')}:${m[2]?m[2].padStart(2,'0'):'00'}`; }
function normalizeDate(input) {
  const c = input.replace(/\s/g,'');
  const m1 = c.match(/^(\d{2})[\/\-](\d{2})[\/\-]?(\d{2,4})?$/);
  if (m1) { const y = m1[3]?(m1[3].length===2?'20'+m1[3]:m1[3]):'2026'; return `${m1[1]}/${m1[2]}/${y}`; }
  const m2 = c.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m2) return `${m2[1]}/${m2[2]}/${m2[3]}`;
  return input;
}
function isNao(t) { return ['não','nao','n','nenhuma'].includes(t.toLowerCase().trim()); }
function jid(p) { return `${p}@s.whatsapp.net`; }

const M = {
  menu: `🤖 *Olá! Seja bem-vindo(a)* 💖\nAqui seu pet recebe muito carinho, cuidado e atenção como parte da família 🐶🐱\n\nEscolha uma opção:\n1️⃣ Hospedagem Para Gatos e Cães\n2️⃣ Creche Pet\n3️⃣ Atendimento Domiciliar\n4️⃣ Falar com atendente`,

  hospedagem_info: `🏡 *Hospedagem Para Gatos e Cães* 😺🐶\n\n🐱 *HOSPEDAGEM EXCLUSIVA PARA GATOS* 🐱\n\nVai viajar ou precisa de um lugar seguro e confortável para o seu gatinho?\nAqui ele recebe todo o cuidado, carinho e atenção que merece! 🥰\n\n🏡 Hospedagem exclusiva para gatos\n🚫 Sem contato com cães\n🧸 Ambiente seguro com enriquecimento ambiental e área para brincar\n🍽️ Rotina respeitada (alimentação, higiene e descanso)\n💊 Administração de medicamentos, se necessário\n📸 Envio diário de fotos e vídeos para você acompanhar tudo 😺\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🐶 *Hospedagem Dog* 🐶\n\nSeu pet será acolhido com muito amor, carinho e cuidado, como parte da família! 💕\nA hospedagem é realizada na minha residência, em ambiente seguro, limpo e aconchegante, preparado para que ele se sinta realmente em casa. 🏡\n\n💰 *Valor:* R$ 50,00 a diária (por pet)\n💳 Pagamento realizado na entrada do pet.\n📌 *Reserva:* Sinal de R$ 50,00, abatido no total.\n\n🐾 *Itens para trazer:*\n🍖 Alimentação  🦴 Caminha  🧸 Cobertinha  🥣 Comedouros  🐕 Guia  💊 Medicamentos  ⬜ Tapete higiênico (cães)  ⬜ Areia (caso use diferente da que fornecemos)\n\n✅ Vacinas, vermifugação e antipulgas em dia.\n📸 Enviamos fotos e vídeos durante toda a estadia 🥰\n📝 Visita de cortesia gratuita antes da hospedagem 💖\n📲 Instagram: @Patinhasfelizesmarilia\n\nDeseja continuar com o agendamento?\n1️⃣ Sim  2️⃣ Voltar  3️⃣ Falar com atendente`,

  creche_info: `🐾 *Sobre a nossa Creche Pet*\n\nA creche da Patinhas Felizes é voltada para adaptação, socialização e bem-estar dos cães 💜\n\nDiferente de uma creche comum, aqui trabalhamos com *vagas limitadas por dia* e um cuidado mais direcionado, respeitando o perfil, o tempo e a necessidade de cada pet.\nNosso objetivo é proporcionar uma experiência segura, divertida e equilibrada 🐶✨\n\n🕒 *Funcionamento:* Segunda a sexta, das 7h30 às 19h00\n\n💰 *Planos mensais:*\n🐾 1x por semana — R$ 160,00\n🐾 2x por semana — R$ 280,00\n🐾 3x por semana — R$ 360,00\n🐾 4x por semana — R$ 440,00\n🐾 5x por semana — R$ 520,00\n\n📌 Adaptamos o horário de entrada conforme seu horário de trabalho, se necessário.\n\nDeseja continuar?\n1️⃣ Sim  2️⃣ Voltar  3️⃣ Falar com atendente`,

  domiciliar_info: `🏡 *ATENDIMENTO DOMICILIAR* 🐶🐱\n\nVai viajar ou a rotina está corrida?\nSeu pet não precisa sair de casa 💖\nCuidamos dele no ambiente onde ele se sente mais seguro 🏡\n\n🐾 *Incluso na visita (40 min):*\n🍖 Alimentação  🧹 Higienização  🎾 Brincadeiras  💊 Medicação (se necessário – falar com atendente)\n\n📝 Visita de cortesia gratuita antes de iniciar 🐾\n\n💰 *Valores:*\n🐾 1 visita ao dia — R$ 50,00\n🐾 2 visitas ao dia — R$ 100,00\n\nDeseja continuar?\n1️⃣ Sim  2️⃣ Voltar  3️⃣ Falar com atendente`,

  atendente: `Por favor aguarde, em alguns instantes um dos nossos atendentes irá entrar em contato. Obrigada 🐾`,
};

function resumoHospedagem(d) {
  const pets = d.pets.map((p,i) => `🐾 *PET ${i+1}*  Nome: ${p.nome}  Raça: ${p.raca}  Cuidados: ${p.cuidados||'Não possui'}`).join('\n');
  const total = d.dias * d.pets.length * CONFIG.precos.hospedagem;
  return `📋 *RESUMO DO AGENDAMENTO*\n\n🏡 Serviço: Hospedagem Pet\n📅 Entrada: ${d.dataEntrada}\n🕒 Horário entrada: ${d.horaEntrada}\n📅 Saída prevista: ${d.dataSaida}\n🚗 Horário retirada: ${d.horaSaida}\n🐶 Quantidade de pets: ${d.pets.length}\n\n${pets}\n\n📝 Observações: ${d.observacao||'Nenhuma'}\n💰 *VALOR TOTAL: R$ ${total},00*\n🧮 ${d.dias} dias × ${d.pets.length} pets × R$ ${CONFIG.precos.hospedagem} diária\n📌 Sinal da reserva: R$ 50,00\n\n✅ Deseja confirmar o agendamento?\n1️⃣ Confirmar  2️⃣ Cancelar  3️⃣ Falar com atendente`;
}

function resumoCreche(d) {
  const plano = CONFIG.precos.creche[String(d.frequencia)];
  const freq = {'1':'1x por semana','2':'2x por semana','3':'3x por semana','4':'4x por semana','5':'5x por semana'};
  return `📋 *RESUMO DA CRECHE*\n\n🐾 Nome: ${d.nomePet}\n🦴 Raça: ${d.racaPet}\n💊 Cuidados: ${d.cuidadoPet||'Não possui'}\n📅 Frequência: ${freq[d.frequencia]}\n💰 *Plano escolhido: R$ ${plano},00 mensal*\n\n✅ Deseja confirmar?\n1️⃣ Sim  2️⃣ Não  3️⃣ Falar com atendente`;
}

function resumoDomiciliar(d) {
  const pets = d.pets.map((p,i) => `🐾 *PET ${i+1}*  Nome: ${p.nome}  Raça: ${p.raca}  Cuidados: ${p.cuidados||'Não possui'}`).join('\n');
  const valor = CONFIG.precos.domiciliar[String(d.visitas)];
  const vis = d.visitas==='1'?'1 visita ao dia':'2 visitas ao dia';
  return `📋 *RESUMO DO ATENDIMENTO*\n\n🏡 Serviço: Atendimento Domiciliar\n📅 Data: ${d.data}\n📍 Endereço: ${d.endereco}\n🐶 Quantidade de pets: ${d.pets.length}\n\n${pets}\n\n📌 Plano: ${vis}\n💰 *Valor total: R$ ${valor},00*\n📝 Observações: ${d.observacao||'Nenhuma'}\n\n✅ Deseja confirmar?\n1️⃣ Confirmar  2️⃣ Cancelar  3️⃣ Falar com atendente`;
}

function confirmacaoHospedagem(proto) {
  return `✅ *Agendamento confirmado com sucesso!*\n📌 Protocolo: ${proto}\n📸 Durante a hospedagem enviaremos fotos e vídeos do seu pet 🥰\n\n💳 *Reserva da hospedagem*\nPara garantir a vaga, pague o sinal de:\n💰 *R$ 50,00*\n🔑 Pix: *${CONFIG.pixKey}*\n📌 Favor enviar o comprovante do pagamento para confirmar definitivamente o agendamento 🐾\n\nObrigado pela confiança 💖`;
}

function confirmacaoCreche(proto) {
  return `✅ *Cadastro realizado com sucesso!*\n📌 Protocolo: ${proto}\n\n💳 *Forma de pagamento:*\n🔑 Pix: *${CONFIG.pixKey}*\n📌 Favor enviar o comprovante para confirmação do agendamento 🐾\n\nObrigado pela preferência 🐾💖`;
}

function confirmacaoDomiciliar(proto) {
  return `✅ *Atendimento agendado com sucesso!*\n📌 Protocolo: ${proto}\n\n💳 *Forma de pagamento:*\n🔑 Pix: *${CONFIG.pixKey}*\n📌 Favor enviar o comprovante para confirmação do agendamento 🐾\n\nObrigado pela confiança 💖`;
}

let sock;
async function notificarDono(texto) { try { await sock.sendMessage(jid(CONFIG.ownerPhone), { text: texto }); } catch(e) { console.error('Notif erro:', e.message); } }
async function transferirAtendente(phone, servico) { await notificarDono(`👤 *CLIENTE SOLICITOU ATENDENTE*\n📱 Número: ${phone}\n🐾 Interesse: ${servico}`); }

async function handleMessage(rawJid, text) {
  if (rawJid.includes('@g.us') || rawJid === 'status@broadcast') return;
  const phone = rawJid.replace('@s.whatsapp.net','');
  const reply = async (msg) => sock.sendMessage(rawJid, { text: msg });

  const globalKw = ['menu','inicio','início','voltar','oi','olá','ola','bom dia','boa tarde','boa noite','hi','hello','0'];
  if (globalKw.includes(text.toLowerCase().trim())) { resetSession(phone); await reply(M.menu); return; }

  const { state, data } = getSession(phone);

  // Bot para quando está com atendente — humano responde
  if (state === 'ATENDENTE') return;

  let msg = null;

  switch (state) {
    case 'MENU':
      if (text==='1') { setState(phone,'H_INFO'); msg=M.hospedagem_info; }
      else if (text==='2') { setState(phone,'C_INFO'); msg=M.creche_info; }
      else if (text==='3') { setState(phone,'D_INFO'); msg=M.domiciliar_info; }
      else if (text==='4') { setState(phone,'ATENDENTE'); await transferirAtendente(phone,'Menu principal'); msg=M.atendente; }
      else msg=M.menu;
      break;

    // ── HOSPEDAGEM ──────────────────────────────────────
    case 'H_INFO':
      if (text==='1') { setState(phone,'H_DATA_ENTRADA'); msg='📅 Informe a *data de entrada* do pet.\n_Exemplos: 12/06/2026  12062026  12-06_'; }
      else if (text==='2') { resetSession(phone); msg=M.menu; }
      else if (text==='3') { setState(phone,'ATENDENTE'); await transferirAtendente(phone,'Hospedagem'); msg=M.atendente; }
      else msg='Por favor, escolha:\n1️⃣ Sim  2️⃣ Voltar  3️⃣ Falar com atendente';
      break;
    case 'H_DATA_ENTRADA': data.dataEntrada=normalizeDate(text); setState(phone,'H_HORA_ENTRADA'); msg='🕒 Informe o *horário de entrada*.\n_Exemplos: 14h  14:30  14h30_'; break;
    case 'H_HORA_ENTRADA': data.horaEntrada=normalizeHour(text); setState(phone,'H_DIAS'); msg='📆 *Quantos dias* o pet ficará hospedado?'; break;
    case 'H_DIAS': data.dias=parseInt(text)||1; data.dataSaida=addDays(data.dataEntrada,data.dias); setState(phone,'H_HORA_SAIDA'); msg='🚗 Informe o *horário previsto para retirada* do pet.'; break;
    case 'H_HORA_SAIDA': data.horaSaida=normalizeHour(text); setState(phone,'H_QTD_PETS'); msg='🐶 *Quantos pets* serão hospedados?'; break;
    case 'H_QTD_PETS': data.qtdPets=parseInt(text)||1; data.pets=[]; data.currentPet=0; setState(phone,'H_PET_NOME'); msg=`🐾 *Nome do pet ${data.currentPet+1}:*`; break;
    case 'H_PET_NOME': data.tempNome=text; setState(phone,'H_PET_RACA'); msg='🦴 Qual a *raça* do pet?'; break;
    case 'H_PET_RACA': data.tempRaca=text; setState(phone,'H_PET_CUIDADO'); msg='💊 O pet possui alguma *deficiência, alergia ou cuidado especial*?'; break;
    case 'H_PET_CUIDADO':
      data.pets.push({nome:data.tempNome,raca:data.tempRaca,cuidados:isNao(text)?null:text});
      data.currentPet++;
      if (data.currentPet<data.qtdPets) { setState(phone,'H_PET_NOME'); msg=`🐾 *Nome do pet ${data.currentPet+1}:*`; }
      else { setState(phone,'H_OBSERVACAO'); msg='📝 Deseja adicionar alguma *observação*?\n_Caso não tenha, digite: Não_'; }
      break;
    case 'H_OBSERVACAO': data.observacao=isNao(text)?null:text; setState(phone,'H_CONFIRMAR'); msg=resumoHospedagem(data); break;
    case 'H_CONFIRMAR':
      if (text==='1') { const p=genProto('HP'); await notificarDono(buildNotifH(data,p,phone)); resetSession(phone); msg=confirmacaoHospedagem(p); }
      else if (text==='2') { resetSession(phone); msg='❌ Agendamento cancelado.\n\n'+M.menu; }
      else if (text==='3') { setState(phone,'ATENDENTE'); await transferirAtendente(phone,'Hospedagem — resumo enviado'); msg=M.atendente; }
      else msg='Por favor, escolha:\n1️⃣ Confirmar  2️⃣ Cancelar  3️⃣ Falar com atendente';
      break;

    // ── CRECHE ──────────────────────────────────────────
    case 'C_INFO':
      if (text==='1') { setState(phone,'C_PET_NOME'); msg='🐾 *Nome do pet:*'; }
      else if (text==='2') { resetSession(phone); msg=M.menu; }
      else if (text==='3') { setState(phone,'ATENDENTE'); await transferirAtendente(phone,'Creche'); msg=M.atendente; }
      else msg='Por favor, escolha:\n1️⃣ Sim  2️⃣ Voltar  3️⃣ Falar com atendente';
      break;
    case 'C_PET_NOME': data.nomePet=text; setState(phone,'C_PET_RACA'); msg='🦴 Qual a *raça*?'; break;
    case 'C_PET_RACA': data.racaPet=text; setState(phone,'C_PET_CUIDADO'); msg='💊 Possui algum *cuidado específico*?'; break;
    case 'C_PET_CUIDADO':
      data.cuidadoPet=isNao(text)?null:text;
      setState(phone,'C_FREQUENCIA');
      msg='📅 *Quantos dias por semana* o pet ficará na creche?\n1️⃣ 1x por semana — R$ 160,00\n2️⃣ 2x por semana — R$ 280,00\n3️⃣ 3x por semana — R$ 360,00\n4️⃣ 4x por semana — R$ 440,00\n5️⃣ 5x por semana — R$ 520,00';
      break;
    case 'C_FREQUENCIA':
      if (['1','2','3','4','5'].includes(text)) { data.frequencia=text; setState(phone,'C_CONFIRMAR'); msg=resumoCreche(data); }
      else msg='Por favor, escolha entre 1️⃣ e 5️⃣';
      break;
    case 'C_CONFIRMAR':
      if (text==='1') { const p=genProto('CR'); await notificarDono(buildNotifC(data,p,phone)); resetSession(phone); msg=confirmacaoCreche(p); }
      else if (text==='2') { resetSession(phone); msg='❌ Cadastro cancelado.\n\n'+M.menu; }
      else if (text==='3') { setState(phone,'ATENDENTE'); await transferirAtendente(phone,'Creche — resumo enviado'); msg=M.atendente; }
      else msg='Por favor, escolha:\n1️⃣ Sim  2️⃣ Não  3️⃣ Falar com atendente';
      break;

    // ── DOMICILIAR ──────────────────────────────────────
    case 'D_INFO':
      if (text==='1') { setState(phone,'D_DATA'); msg='📅 Informe a *data desejada* para o atendimento.'; }
      else if (text==='2') { resetSession(phone); msg=M.menu; }
      else if (text==='3') { setState(phone,'ATENDENTE'); await transferirAtendente(phone,'Domiciliar'); msg=M.atendente; }
      else msg='Por favor, escolha:\n1️⃣ Sim  2️⃣ Voltar  3️⃣ Falar com atendente';
      break;
    case 'D_DATA': data.data=normalizeDate(text); setState(phone,'D_ENDERECO'); msg='📍 Qual o *endereço* para o atendimento?\n_Exemplo: Rua Serafim, 1233 — Marília_'; break;
    case 'D_ENDERECO': data.endereco=text; setState(phone,'D_QTD_PETS'); msg='🐶 *Quantos pets* serão atendidos?'; break;
    case 'D_QTD_PETS': data.qtdPets=parseInt(text)||1; data.pets=[]; data.currentPet=0; setState(phone,'D_PET_NOME'); msg=`🐾 *Nome do pet ${data.currentPet+1}:*`; break;
    case 'D_PET_NOME': data.tempNome=text; setState(phone,'D_PET_RACA'); msg='🦴 Qual a *raça*?'; break;
    case 'D_PET_RACA': data.tempRaca=text; setState(phone,'D_PET_CUIDADO'); msg='💊 Possui algum *cuidado específico*?'; break;
    case 'D_PET_CUIDADO':
      data.pets.push({nome:data.tempNome,raca:data.tempRaca,cuidados:isNao(text)?null:text});
      data.currentPet++;
      if (data.currentPet<data.qtdPets) { setState(phone,'D_PET_NOME'); msg=`🐾 *Nome do pet ${data.currentPet+1}:*`; }
      else { setState(phone,'D_VISITAS'); msg='🕒 *Deseja:*\n1️⃣ 1 visita ao dia — R$ 50,00\n2️⃣ 2 visitas ao dia — R$ 100,00'; }
      break;
    case 'D_VISITAS':
      if (text==='1'||text==='2') { data.visitas=text; setState(phone,'D_OBSERVACAO'); msg='📝 Deseja adicionar alguma *observação*?\n_Caso não tenha, digite: Não_'; }
      else msg='Por favor, escolha:\n1️⃣ 1 visita  2️⃣ 2 visitas';
      break;
    case 'D_OBSERVACAO': data.observacao=isNao(text)?null:text; setState(phone,'D_CONFIRMAR'); msg=resumoDomiciliar(data); break;
    case 'D_CONFIRMAR':
      if (text==='1') { const p=genProto('AD'); await notificarDono(buildNotifD(data,p,phone)); resetSession(phone); msg=confirmacaoDomiciliar(p); }
      else if (text==='2') { resetSession(phone); msg='❌ Agendamento cancelado.\n\n'+M.menu; }
      else if (text==='3') { setState(phone,'ATENDENTE'); await transferirAtendente(phone,'Domiciliar — resumo enviado'); msg=M.atendente; }
      else msg='Por favor, escolha:\n1️⃣ Confirmar  2️⃣ Cancelar  3️⃣ Falar com atendente';
      break;

    default: resetSession(phone); msg=M.menu;
  }

  if (msg) await reply(msg);
}

function buildNotifH(d,proto,phone) {
  const pets=d.pets.map((p,i)=>`Pet ${i+1}: ${p.nome} (${p.raca}) — ${p.cuidados||'sem cuidados'}`).join('\n');
  const total=d.dias*d.pets.length*CONFIG.precos.hospedagem;
  return `🐾 *NOVO AGENDAMENTO — HOSPEDAGEM*\n📌 ${proto}\n📱 ${phone}\n📅 Entrada: ${d.dataEntrada} às ${d.horaEntrada}\n📅 Saída: ${d.dataSaida} às ${d.horaSaida}\n🐶 Pets:\n${pets}\n📝 ${d.observacao||'Sem obs'}\n💰 R$ ${total},00`;
}
function buildNotifC(d,proto,phone) {
  return `🐾 *NOVO CADASTRO — CRECHE*\n📌 ${proto}\n📱 ${phone}\n🐾 ${d.nomePet} (${d.racaPet})\n📅 ${d.frequencia}x/semana\n💰 R$ ${CONFIG.precos.creche[d.frequencia]},00/mês`;
}
function buildNotifD(d,proto,phone) {
  const pets=d.pets.map((p,i)=>`Pet ${i+1}: ${p.nome} (${p.raca})`).join('\n');
  const valor=CONFIG.precos.domiciliar[String(d.visitas)];
  return `🐾 *NOVO AGENDAMENTO — DOMICILIAR*\n📌 ${proto}\n📱 ${phone}\n📅 ${d.data}\n📍 ${d.endereco}\n🐶 Pets:\n${pets}\n🕒 ${d.visitas}x ao dia\n💰 R$ ${valor},00\n📝 ${d.observacao||'Sem obs'}`;
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, browser: Browsers.ubuntu('Chrome'), logger: pino({ level: 'silent' }), printQRInTerminal: false });
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) { console.clear(); console.log('\n╔════════════════════════════════════╗\n║  📱 Escaneie o QR Code abaixo      ║\n║  WhatsApp → Dispositivos vinculados ║\n╚════════════════════════════════════╝\n'); qrcode.generate(qr, { small: true }); }
    if (connection==='close') { const r=new Boom(lastDisconnect?.error)?.output?.statusCode!==DisconnectReason.loggedOut; if(r) connectToWhatsApp(); else console.log('❌ Delete a pasta auth_info e reinicie.'); }
    if (connection==='open') { console.log('\n✅ Bot conectado!\n🐾 Patinhas Felizes — ativo\n'); }
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type!=='notify') return;
    for (const msg of messages) {
      if (!msg.message||msg.key.fromMe) continue;
      const from=msg.key.remoteJid;
      const text=(msg.message?.conversation||msg.message?.extendedTextMessage?.text||'').trim();
      if (!text) continue;
      try { await handleMessage(from, text); } catch(e) { console.error('Erro:',e.message); }
    }
  });
}

connectToWhatsApp();
