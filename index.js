const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // RANJE ERÈ "CRYPTO IS NOT DEFINED" AN
const config = require('./config');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
let globalSock = null;

app.use(express.json());
app.use('/static', express.static('public'));

// Sèvi paj session.html la
app.get('/', (req, res) => { 
    res.sendFile(path.join(__dirname, 'session.html')); 
});

// API Status pou paj la ka konnen si bot la sou pye
app.get('/api/status', (req, res) => {
    res.json({ status: globalSock?.user ? 'connected' : 'disconnected' });
});

// API pou Pairing Code
app.post('/api/pair', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.json({ success: false, error: 'Nimewo obligatwa' });
    try {
        if (!globalSock) return res.json({ success: false, error: 'Bot la ap demare, tann 5 segonn' });
        const code = await globalSock.requestPairingCode(phone.trim());
        res.json({ success: true, code: code });
    } catch (e) { 
        res.json({ success: false, error: 'Erè: ' + e.message }); 
    }
});

async function startBot() {
    // Restaurasyon Sesyon si gen SESSION_ID nan Environment Variables
    const sessionString = process.env.SESSION_ID || "";
    let isFirstTime = true;

    if (sessionString && !fs.existsSync('./auth/creds.json')) {
        isFirstTime = false;
        if (!fs.existsSync('./auth')) fs.mkdirSync('./auth');
        try {
            const decrypted = Buffer.from(sessionString.replace("EDWA-MD;;;", ""), 'base64').toString();
            fs.writeFileSync('./auth/creds.json', decrypted);
        } catch (e) { console.log("Erè dekodaj sesyon"); }
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    globalSock = sock;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔁 Rekonekte...");
                setTimeout(startBot, 5000);
            } else {
                console.log("❌ Dekonekte nèt. Efase folder 'auth' la.");
                fs.rmSync('./auth', { recursive: true, force: true });
                startBot();
            }
        } else if (connection === 'open') {
            const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            
            if (isFirstTime || !process.env.SESSION_ID) {
                const credsData = fs.readFileSync('./auth/creds.json', 'utf-8');
                const sessionID = Buffer.from(credsData).toString('base64');
                const finalSession = `EDWA-MD;;;${sessionID}`;

                await sock.sendMessage(ownerJid, { 
                    text: `✅ *EDWA-MD KONEKTE!*\n\nKopiye SESSION_ID sa a pou w mete l sou panel la:\n\n\`\`\`${finalSession}\`\`\`` 
                });
            } else {
                await sock.sendMessage(ownerJid, { 
                    text: `🌟 *EDWA-MD ONLINE*\n\nBot la limen kounye a sou sèvè a!\nPrefix: ${config.PREFIX}` 
                });
            }
            console.log("✅ Bot pare!");
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Jesyon Kòmandman
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
    console.log(`🌐 Sèvè active sou port ${PORT}`);
    startBot();
});
￼Enter
