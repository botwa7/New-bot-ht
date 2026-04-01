const config = require('../config');

async function run(sock, from, msg, args, _cfg) {
    const totalPlugins = config.PLUGINS_LIST.length;
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);
    const uptimeStr = `${h}h ${m}m ${s}s`;

    
    const menuText =
`╔══════════════════════╗
║  🤖  *EDWA-MD*  🤖   ║
╚══════════════════════╝

👤 *Owner :* ${config.OWNER_NAME}
⚙️  *Prefix :* \`${config.PREFIX}\`
📦 *Version :* ${config.VERSION}
🔁 *Uptime :* ${uptimeStr}
🟢 *Mode :* ${config.MODE}
🔌 *Plugins :* ${totalPlugins}
✨ *Feat :* AntiViewOnce | AntiDelete | AutoReact

━━━━━━━━━━━━━━━━━━━━━━━

👥 *GESTION DE GROUPE*
┌─────────────────────
│ 👑 \`promote\` @user
│ 🔽 \`demote\` @user
│ 🚪 \`kick\` @user
│ ➕ \`add\` <numéro>
│ 🔗 \`antilink\` on/off
│ 🤬 \`antibadword\` on/off
│ 👋 \`welcome\` on/off
│ 🚶 \`goodbye\` on/off
│ 👁️  \`hidetag\` <msg>
│ 📢 \`tagall\`
│ 🖼️  \`setppgroup\` (reply img)
│ 📝 \`setdesc\` <texte>
│ 🔒 \`close\` / \`open\`
│ ℹ️  \`groupinfo\`
└─────────────────────

🛠️ *OWNER & MOD*
┌─────────────────────
│ ⚠️  \`warn\` @user
│ 💾 \`save\` (reply media)
│ 📡 \`repo\`
│ 👤 \`owner\`
│ 🏓 \`ping\`
│ 🤖 \`alive\`
│ 🖼️  \`sticker\` (reply img)
│ 🔄 \`update\`
└─────────────────────

━━━━━━━━━━━━━━━━━━━━━━━
🔗 *GitHub:* ${config.REPO_LINK}
📣 *Channel:* ${config.CHANNEL_LINK}
━━━━━━━━━━━━━━━━━━━━━━━
_🇭🇹 Power by Boss Edwa_`;

    await sock.sendMessage(from, {
        text: menuText,
        contextInfo: {
            externalAdReply: {
                title: '🤖 EDWA-MD — Menu',
                body: `${totalPlugins} commandes • Prefix: ${config.PREFIX}`,
                thumbnailUrl: 'https://i.imgur.com/3YNv8Qp.png',
                mediaType: 1,
                sourceUrl: config.CHANNEL_LINK,
                renderLargerThumbnail: false
            }
        }
    }, { quoted: msg });
}

module.exports = { run };
