const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
let globalSock = null;

app.use(express.json());
app.use('/static', express.static('public'));

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'session.html')); });

async function startBot() {
    // 1. Tcheke si gen yon SESSION_ID nan Environment Variables (Hosting)
    const sessionString = process.env.SESSION_ID || "";
    let isFirstTime = true; // Pou konnen si se kounye a li fèk skane kòd la

    if (sessionString) {
        isFirstTime = false; // Si gen yon SESSION_ID, se pa premye fwa
        if (!fs.existsSync('./auth')) fs.mkdirSync('./auth');
        try {
            const decryptedSession = Buffer.from(sessionString.replace("EDWA-MD;;;", ""), 'base64').toString();
            fs.writeFileSync('./auth/creds.json', decryptedSession);
        } catch (e) { console.log("Erè nan dekode SESSION_ID"); }
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        printQRInTerminal: false,
        connectTimeoutMs: 60000
    });

    globalSock = sock;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === 'open') {
            const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

            // SI SE PREMYE FWA (Li fèk skane sou sit la)
            if (isFirstTime) {
                const credsData = fs.readFileSync('./auth/creds.json', 'utf-8');
                const sessionID = Buffer.from(credsData).toString('base64');
                const finalSession = `EDWA-MD;;;${sessionID}`;

                console.log("\n🚀 SESSION GENERATED:\n" + finalSession + "\n");

                await sock.sendMessage(ownerJid, { 
                    text: `✅ *EDWA-MD KONEKTE AK SIKSÈ!*\n\nKopiye kòd anba a pou w mete l nan Panel Hosting ou (SESSION_ID):\n\n\`\`\`${finalSession}\`\`\`` 
                });
            } 
            // SI SE APRE DEPLWAYMAN (Bot la limen sou hosting lan)
            else {
                console.log("🚀 Bot la limen sou sèvè a!");
                await sock.sendMessage(ownerJid, { 
                    text: `🌟 *EDWA-MD DEPLOYED SUCCESSFULLY*\n\nBonjou Boss! Bot ou a limen kounye a sou sèvè hosting lan epi li pare pou l travay.\n\n*Prefix:* ${config.PREFIX}\n*Status:* Online 🟢` 
                });
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Kòmandman yo
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (text.startsWith(config.PREFIX)) {
            const args = text.slice(config.PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const commandPath = path.join(__dirname, 'commands', `${command}.js`);
            if (fs.existsSync(commandPath)) {
                try {
                    require(commandPath).run(sock, from, msg, args, config, msg.key.participant || from);
                } catch (e) { console.error(e); }
            }
        }
    });
}

app.listen(PORT, () => { 
    console.log(`🌐 Server running on port ${PORT}`);
    startBot(); 
});
