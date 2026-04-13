require('dotenv').config();

const makeWASocket = require('baileys').default;
const {
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    downloadContentFromMessage,
    getContentType,
    proto
} = require('baileys');
const { NodeCache } = require('@cacheable/node-cache');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 5000;

let botSock = null;
let qrClients = [];
let lastSessionID = null;
let isReconnecting = false;   // prevents multiple parallel reconnect loops
let deployMsgSent = false;    // ensures deployment DM is sent only once

app.use(express.json());
app.use('/static', express.static('public'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ── Session endpoint ──────────────────────────────────────────────────────────
app.get('/api/session', (req, res) => {
    if (lastSessionID) {
        res.json({ success: true, session: lastSessionID });
    } else {
        res.json({ success: false, error: 'No session yet.' });
    }
});

// ── Deploy with SESSION_ID from panel ────────────────────────────────────────
app.post('/api/deploy', async (req, res) => {
    const { session } = req.body;
    if (!session || !session.startsWith('EDWA-MD;;;')) {
        return res.json({ success: false, error: 'SESSION_ID invalide.' });
    }
    try {
        if (!fs.existsSync('./auth')) fs.mkdirSync('./auth');
        const decoded = Buffer.from(session.replace('EDWA-MD;;;', ''), 'base64').toString();
        fs.writeFileSync('./auth/creds.json', decoded);
        closeSock();
        await startMainBot();
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────

const msgRetryCounterCache = new NodeCache();

// ── Wire command handler + auto features ─────────────────────────────────────
function wireCommandHandler(sock) {
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            if (!msg.message) continue;

            const from = msg.key.remoteJid;
            const fromMe = msg.key.fromMe;
            const msgType = getContentType(msg.message);

            // ── Auto react to status updates ──────────────────────────────
            if (config.AUTO_STATUS_REACT && from === 'status@broadcast') {
                try {
                    await sock.readMessages([msg.key]);
                    await sock.sendMessage(from, {
                        react: { text: '❤️', key: msg.key }
                    });
                } catch (_) {}
                continue;
            }

            // ── Anti-ViewOnce: re-send visible ───────────────────────────
            if (config.ANTI_VIEW_ONCE && !fromMe) {
                const viewOnceKey = msg.message.viewOnceMessage
                    || msg.message.viewOnceMessageV2
                    || msg.message.viewOnceMessageV2Extension;
                if (viewOnceKey) {
                    try {
                        const inner = viewOnceKey.message;
                        const innerType = getContentType(inner);
                        const mediaMsg = inner[innerType];
                        if (mediaMsg) {
                            const stream = await downloadContentFromMessage(mediaMsg, innerType.replace('Message', ''));
                            let buffer = Buffer.from([]);
                            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                            await sock.sendMessage(from, {
                                [innerType]: buffer,
                                caption: '🔍 *Anti-ViewOnce EDWA-MD*'
                            }, { quoted: msg });
                        }
                    } catch (_) {}
                }
            }

            if (fromMe) continue;

            // ── Anti-Delete ───────────────────────────────────────────────
            if (config.ANTI_DELETE && msgType === 'protocolMessage'
                && msg.message.protocolMessage?.type === proto.Message.ProtocolMessage.Type.REVOKE) {
                const deletedKey = msg.message.protocolMessage.key;
                try {
                    await sock.sendMessage(from, {
                        text: `⚠️ *Anti-Delete EDWA-MD*\nUn message a été supprimé par @${deletedKey.participant?.split('@')[0] || 'quelqu\'un'}.`,
                        mentions: deletedKey.participant ? [deletedKey.participant] : []
                    });
                } catch (_) {}
                continue;
            }

            // ── Command dispatch ──────────────────────────────────────────
            const text = msg.message?.conversation
                || msg.message?.extendedTextMessage?.text
                || msg.message?.imageMessage?.caption
                || msg.message?.videoMessage?.caption
                || '';

            if (text.startsWith(config.PREFIX)) {
                const args = text.slice(config.PREFIX.length).trim().split(/ +/);
                const command = args.shift().toLowerCase();
                const commandPath = path.join(__dirname, 'Commands', `${command}.js`);
                if (fs.existsSync(commandPath)) {
                    try {
                        delete require.cache[require.resolve(commandPath)];
                        await require(commandPath).run(sock, from, msg, args, config, msg.key.participant || from);
                    } catch (e) { console.error(`[CMD ${command}]`, e.message); }
                }
            }
        }
    });
}

// ── Build SESSION_ID from saved creds file ────────────────────────────────────
function buildSessionID() {
    try {
        const credsData = fs.readFileSync('./auth/creds.json', 'utf-8');
        return `EDWA-MD;;;${Buffer.from(credsData).toString('base64')}`;
    } catch (_) { return null; }
}

// ── Send deployment success DM ────────────────────────────────────────────────
async function sendDeploymentSuccess(sock) {
    if (deployMsgSent) return;
    deployMsgSent = true;

    // Wait briefly to ensure creds are saved to disk
    await new Promise(r => setTimeout(r, 2000));

    const sessionID = buildSessionID();
    if (sessionID) {
        lastSessionID = sessionID;
        console.log('\n====== SESSION ID ======\n' + sessionID + '\n========================\n');
    }

    try {
        const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        await sock.sendMessage(ownerJid, {
            text:
`✅ *DÉPLOIEMENT RÉUSSI !*

🤖 *Bot :* ${config.BOT_NAME}
👤 *Owner :* ${config.OWNER_NAME}
⚙️ *Prefix :* [ ${config.PREFIX} ]
📦 *Version :* ${config.VERSION}
🟢 *Status :* Opérationnel

📋 *Votre SESSION_ID :*
\`\`\`${sessionID || 'Récupérez sur /api/session'}\`\`\`

_Sauvegardez ce SESSION_ID pour redéployer sans scanner à nouveau._

🇭🇹 *Power by Boss Edwa*`
        });
        console.log('✅ Deployment success DM sent to owner');
    } catch (e) {
        console.error('DM failed:', e.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────

function closeSock() {
    if (botSock) {
        try { botSock.ws?.close(); } catch (_) {}
        botSock = null;
    }
}

function clearAuth() {
    if (fs.existsSync('./auth')) fs.rmSync('./auth', { recursive: true, force: true });
    fs.mkdirSync('./auth');
    deployMsgSent = false;
}

async function createSocket(authDir = './auth') {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        msgRetryCounterCache,
        printQRInTerminal: false,
        connectTimeoutMs: 60000,
        generateHighQualityLinkPreview: true,
        getMessage: async () => ({ conversation: '' })
    });

    sock.ev.on('creds.update', saveCreds);
    return { sock, state };
}

// ── Main bot (auto-reconnect, persistent) ─────────────────────────────────────
async function startMainBot() {
    if (isReconnecting) return;
    isReconnecting = true;

    const sessionString = process.env.SESSION_ID || '';

    if (sessionString && !fs.existsSync('./auth/creds.json')) {
        if (!fs.existsSync('./auth')) fs.mkdirSync('./auth');
        try {
            const decoded = Buffer.from(sessionString.replace('EDWA-MD;;;', ''), 'base64').toString();
            fs.writeFileSync('./auth/creds.json', decoded);
        } catch (e) { console.log('Erreur décodage SESSION_ID'); }
    }

    // No credentials at all — wait for user to connect via panel
    if (!fs.existsSync('./auth/creds.json')) {
        console.log('⏳ Aucune session — ouvrez le panel pour vous connecter.');
        isReconnecting = false;
        return;
    }

    let sock;
    try {
        const result = await createSocket('./auth');
        sock = result.sock;
    } catch (e) {
        console.error('Erreur création socket:', e.message);
        isReconnecting = false;
        return;
    }

    botSock = sock;
    isReconnecting = false;
    wireCommandHandler(sock);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                console.log('⚠️ Session expirée (loggedOut) — effacement auth, reconnectez via le panel.');
                clearAuth();
            } else {
                // Only reconnect if we still have valid credentials
                if (fs.existsSync('./auth/creds.json')) {
                    console.log(`Reconnexion... (raison: ${reason})`);
                    setTimeout(() => startMainBot(), 5000);
                } else {
                    console.log('⏳ Pas de session valide — ouvrez le panel pour reconnecter.');
                }
            }
        } else if (connection === 'open') {
            console.log('✅ Bot opérationnel !');
            await sendDeploymentSuccess(sock);
        }
    });
}

// ── QR Code via Server-Sent Events ────────────────────────────────────────────
app.get('/api/qr', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    qrClients.push(res);
    closeSock();
    clearAuth();

    try {
        const { sock } = await createSocket('./auth');
        botSock = sock;
        wireCommandHandler(sock);

        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;

            if (qr) {
                try {
                    const qrBase64 = await QRCode.toDataURL(qr);
                    qrClients.forEach(c => {
                        try { c.write(`data: ${JSON.stringify({ type: 'qr', qr: qrBase64 })}\n\n`); } catch (_) {}
                    });
                } catch (e) { console.error('QR error:', e.message); }
            }

            if (connection === 'open') {
                console.log('✅ Bot connecté via QR !');
                qrClients.forEach(c => {
                    try { c.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`); c.end(); } catch (_) {}
                });
                qrClients = [];
                await sendDeploymentSuccess(sock);
            }

            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                if (reason === DisconnectReason.loggedOut) {
                    console.log('⚠️ Session expirée (loggedOut) — effacement auth.');
                    clearAuth();
                } else if (fs.existsSync('./auth/creds.json')) {
                    setTimeout(() => startMainBot(), 5000);
                }
            }
        });
    } catch (e) {
        console.error('QR session error:', e.message);
        try { res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`); res.end(); } catch (_) {}
        qrClients = qrClients.filter(c => c !== res);
    }

    req.on('close', () => { qrClients = qrClients.filter(c => c !== res); });
});

// ── Pairing Code ──────────────────────────────────────────────────────────────
app.post('/api/pair', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.json({ success: false, error: 'Numéro requis.' });

    const cleanPhone = phone.replace(/[^0-9]/g, '');

    try {
        closeSock();
        clearAuth();

        const { sock, state } = await createSocket('./auth');
        botSock = sock;

        if (!state.creds.registered) {
            const code = await sock.requestPairingCode(cleanPhone);
            console.log(`✅ Pairing code: ${code}`);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                if (connection === 'open') {
                    console.log('✅ Bot connecté via pairing code !');
                    await sendDeploymentSuccess(sock);
                    wireCommandHandler(sock);
                }
                if (connection === 'close') {
                    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    if (reason === DisconnectReason.loggedOut) {
                        console.log('⚠️ Session expirée (loggedOut) — effacement auth.');
                        clearAuth();
                    } else if (fs.existsSync('./auth/creds.json')) {
                        console.log('Reconnexion après pairing...');
                        setTimeout(() => startMainBot(), 5000);
                    }
                }
            });

            return res.json({ success: true, code });
        } else {
            sock.ws?.close();
            return res.json({ success: false, error: 'Déjà enregistré. Utilisez QR ou redémarrez.' });
        }
    } catch (e) {
        console.error('Pairing error:', e.message);
        return res.json({ success: false, error: e.message });
    }
});

// ── Server ────────────────────────────────────────────────────────────────────
let currentPort = PORT;
const server = app.listen(currentPort, '0.0.0.0');

server.on('listening', () => {
    console.log(`🌐 Serveur démarré sur le port ${currentPort}`);
    const hasSavedSession = fs.existsSync('./auth/creds.json');
    if (process.env.SESSION_ID || hasSavedSession) {
        console.log(process.env.SESSION_ID ? '🔑 SESSION_ID trouvé — démarrage du bot...' : '💾 Session sauvegardée trouvée — reconnexion...');
        startMainBot();
    } else {
        console.log('⏳ Aucune session — ouvrez le panel pour vous connecter.');
    }
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        currentPort++;
        console.log(`Port ${currentPort - 1} occupé — essai sur le port ${currentPort}...`);
        server.listen(currentPort, '0.0.0.0');
    }
});

