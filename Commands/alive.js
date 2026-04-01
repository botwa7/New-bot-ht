const config = require('../config');

async function run(sock, from, msg) {
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);

    const mem = process.memoryUsage();
    const memMB = (mem.heapUsed / 1024 / 1024).toFixed(1);

    await sock.sendMessage(from, {
        text:
`╔══════════════════════╗
║  🤖  *EDWA-MD ALIVE*  ║
╚══════════════════════╝

🟢 *Status :* En ligne
🏓 *Uptime :* ${h}h ${m}m ${s}s
💾 *Mémoire :* ${memMB} MB
🔌 *Plugins :* ${config.PLUGINS_LIST.length}
⚙️  *Prefix :* \`${config.PREFIX}\`
📦 *Version :* ${config.VERSION}
🌐 *Mode :* ${config.MODE}

✨ *Features actives :*
• 🔕 Anti-ViewOnce
• 🗑️ Anti-Delete
• ❤️ Auto React Status

━━━━━━━━━━━━━━━━━━━━━━━
👤 *Owner :* ${config.OWNER_NAME}
📣 *Channel :* ${config.CHANNEL_LINK}
━━━━━━━━━━━━━━━━━━━━━━━
_🇭🇹 Power by Boss Edwa_`,
        contextInfo: {
            externalAdReply: {
                title: '🤖 EDWA-MD — Online',
                body: `Uptime: ${h}h ${m}m ${s}s`,
                thumbnailUrl: 'https://i.imgur.com/3YNv8Qp.png',
                mediaType: 1,
                sourceUrl: config.CHANNEL_LINK,
                renderLargerThumbnail: false
            }
        }
    }, { quoted: msg });
}

module.exports = { run };
