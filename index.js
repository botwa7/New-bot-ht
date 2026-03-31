// 1. Deklarasyon modil yo (Mwen ajoute crypto la pou erè a pa parèt ankò)
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const crypto = require('crypto'); 
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
let globalSock = null;

app.use(express.json());

// 2. Sèvi paj index.html ou a (Mwen wè ou rele l index.html nan fichye ou a)
app.get('/', (req, res) => { 
    res.sendFile(path.join(__dirname, 'index.html')); 
});

// 3. API pou Pairing Code (Lojik ki nan index.html ou a ap chèche wout sa a)
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
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    globalSock = sock;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(startBot, 5000);
            }
        } else if (connection === 'open') {
            console.log("✅ EDWA-MD KONEKTE!");
            const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            
            // Jenerasyon Session ID pou DM
            const credsData = fs.readFileSync('./auth/creds.json', 'utf-8');
            const sessionID = Buffer.from(credsData).toString('base64');
            const finalSession = `EDWA-MD;;;${sessionID}`;

            await sock.sendMessage(ownerJid, { text: `🚀 SESSION ID PARE:\n\n${finalSession}` });
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

app.listen(PORT, () => {
    console.log(`🌐 Sèvè active sou: http://localhost:${PORT}`);
    startBot();
});

