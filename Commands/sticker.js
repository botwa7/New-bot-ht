const { downloadContentFromMessage } = require('baileys');
const config = require('../config');

async function run(sock, from, msg, args) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
        || msg.message?.imageMessage
        || msg.message?.videoMessage;

    const imageMsg = msg.message?.imageMessage
        || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

    if (!imageMsg) {
        return await sock.sendMessage(from, {
            text: '⚠️ *Répondez à une image* pour créer un sticker.\n\n_Exemple: répondez à une photo avec_ \`.sticker\`'
        }, { quoted: msg });
    }

    try {
        const stream = await downloadContentFromMessage(imageMsg, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(from, {
            sticker: buffer
        }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, {
            text: `❌ Erreur lors de la création du sticker: ${e.message}`
        }, { quoted: msg });
    }
}

module.exports = { run };
