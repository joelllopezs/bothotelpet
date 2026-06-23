# 🐾 Bot WhatsApp — Patinhas Felizes Marília

Bot de atendimento automatizado para pet shop, desenvolvido com **Node.js** e a biblioteca **Baileys** (sem Puppeteer, sem Chrome).

---

## 💡 Funcionalidades

- Menu de atendimento automático via WhatsApp
- Fluxo completo de agendamento para **Hospedagem Pet**
- Fluxo completo de cadastro para **Creche Pet**
- Fluxo completo de agendamento para **Atendimento Domiciliar**
- Coleta de dados dos pets (nome, raça, cuidados especiais)
- Geração de **protocolo automático** por atendimento
- Notificação instantânea ao dono/atendente via WhatsApp
- Transferência para atendimento humano em qualquer etapa
- Reconexão automática em caso de queda de conexão

---

## 🛠️ Tecnologias

- [Node.js](https://nodejs.org) >= 18
- [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
- [qrcode-terminal](https://www.npmjs.com/package/qrcode-terminal)
- [@hapi/boom](https://www.npmjs.com/package/@hapi/boom)
- [pino](https://www.npmjs.com/package/pino)

---

## 🚀 Como instalar e rodar

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/seu-repositorio.git
cd seu-repositorio
```

### 2. Instale as dependências

```bash
npm install @whiskeysockets/baileys qrcode-terminal @hapi/boom pino
```

### 3. Configure o bot

Abra o arquivo `bot.js` e edite o bloco `CONFIG` no início do arquivo:

```js
const CONFIG = {
  pixKey:     'sua-chave-pix',
  instagram:  '@seuinstagram',
  ownerPhone: '5514999999999', // 55 + DDD + número, sem espaços
  ...
};
```

### 4. Rode o bot

```bash
node bot.js
```

Um QR Code aparecerá no terminal. Escaneie pelo WhatsApp:
> **WhatsApp → Dispositivos vinculados → Vincular dispositivo**

Quando aparecer `✅ Bot conectado!` o bot está ativo.

---

## ⚙️ Manter o bot sempre ativo (PM2)

```bash
npm install -g pm2
pm2 start bot.js --name patinhas-bot
pm2 startup
pm2 save
```

| Comando | Ação |
|---|---|
| `pm2 status` | Ver status do bot |
| `pm2 logs patinhas-bot` | Ver logs em tempo real |
| `pm2 stop patinhas-bot` | Parar o bot |
| `pm2 restart patinhas-bot` | Reiniciar o bot |

---

## 📁 Estrutura do projeto

```
patinhas-bot/
├── bot.js            # Código principal do bot
├── auth_info/        # Sessão do WhatsApp (gerada automaticamente, não subir no Git)
├── node_modules/     # Dependências (não subir no Git)
└── README.md
```

---

## 🔒 .gitignore recomendado

```
node_modules/
auth_info/
.wwebjs_auth/
.wwebjs_cache/
```

---

## 📋 Fluxo de atendimento

```
Menu Principal
├── 1️⃣ Hospedagem Para Gatos e Cães
│   └── Data entrada → Hora entrada → Dias → Hora saída
│       → Quantidade de pets → Nome/Raça/Cuidados (por pet)
│       → Observações → Resumo → Confirmar / Cancelar / Atendente
│
├── 2️⃣ Creche Pet
│   └── Nome/Raça/Cuidados → Frequência semanal
│       → Resumo → Confirmar / Cancelar / Atendente
│
├── 3️⃣ Atendimento Domiciliar
│   └── Data → Endereço → Quantidade de pets → Nome/Raça/Cuidados
│       → Visitas por dia → Observações → Resumo → Confirmar / Cancelar / Atendente
│
└── 4️⃣ Falar com atendente
    └── Bot para de responder → Humano assume o atendimento
```

---

## 💰 Tabela de preços

| Serviço | Valor |
|---|---|
| Hospedagem | R$ 50,00 / diária / pet |
| Creche 1x por semana | R$ 160,00 / mês |
| Creche 2x por semana | R$ 280,00 / mês |
| Creche 3x por semana | R$ 360,00 / mês |
| Creche 4x por semana | R$ 440,00 / mês |
| Creche 5x por semana | R$ 520,00 / mês |
| Domiciliar 1 visita/dia | R$ 50,00 |
| Domiciliar 2 visitas/dia | R$ 100,00 |

---

## 📱 Contato

- Instagram: [@Patinhasfelizesmarilia](https://instagram.com/Patinhasfelizesmarilia)
- Pix: (14) 99720-0278

---

## 👨‍💻 Desenvolvido por

**LopeX** — Automação, Chatbots e Soluções em IA
> Instagram: [@lopex.ia](https://instagram.com/lopex.ia)

---

> ⚠️ **Aviso:** Este bot utiliza a biblioteca Baileys que conecta via WhatsApp Web. Use um número exclusivo para o bot. O número vinculado não pode ser usado simultaneamente no celular.
