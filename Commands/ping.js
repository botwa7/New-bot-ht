async function run(sock, from, msg, args, config) {
    const start = Date.now();
    const sent = await sock.sendMessage(from, { text: '🏓 Pong...' }, { quoted: msg });
    const ping = Date.now() - start;

    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);

    await sock.sendMessage(from, {
        text:
`🏓 *PONG !*

⚡ *Latence :* ${ping} ms
🕐 *Uptime :* ${h}h ${m}m ${s}s
🟢 *Status :* En ligne
🤖 *Bot :* ${config.BOT_NAME}

_🇭🇹 Power by Boss Edwa_`,
    }, { quoted: msg });
}

module.exports = { run };
