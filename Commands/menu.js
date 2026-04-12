const { generateWAMessageFromContent, proto } = require('baileys');
const config = require('../config');

async function run(sock, from, msg, args, cfg) {
    const totalPlugins = cfg.PLUGINS_LIST.length;
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);
    const uptimeStr = `${h}h ${m}m ${s}s`;

    const menuText =
`┏▣  *${cfg.BOT_NAME}* ◈
┃ *ᴏᴡɴᴇʀ* : ${cfg.OWNER_NAME}
┃ *ᴘʀᴇFɪx* : [ ${cfg.PREFIX} ]
┃ *ʜᴏsᴛ* : Replit
┃ *ᴘʟᴜɢɪɴs* : ${totalPlugins}
┃ *ᴍᴏᴅᴇ* : ${cfg.MODE}
┃ *ᴠᴇʀsɪᴏɴ* : ${cfg.VERSION}
┃ *ᴜᴘᴛɪᴍᴇ* : ${uptimeStr}
┗ 

┏▣  *GROUP MENU* ◈
│➽ promote @user
│➽ demote @user
│➽ kick @user
│➽ add <num>
│➽ antilink <on/off>
│➽ antibadword <on/off>
│➽ welcome <on/off>
│➽ goodbye <on/off>
│➽ hidetag <msg>
│➽ tagall
│➽ setppgroup (reply img)
│➽ setdesc <text>
│➽ close / open
│➽ groupinfo
┗▣

┏▣  *OWNER & MOD* ◈
│➽ warn @user
│➽ save (reply foto/vido)
│➽ repo
│➽ owner
│➽ ping
│➽ alive
│➽ sticker (reply img)
│➽ update
┗▣

*© Power by Boss Edwa 🇭🇹*`;

    const buttons = [
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🏓 Ping', id: `${cfg.PREFIX}ping` }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🤖 Alive', id: `${cfg.PREFIX}alive` }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '👤 Owner', id: `${cfg.PREFIX}owner` }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📡 Repo', id: `${cfg.PREFIX}repo` }) },
    ];

    try {
        const interactive = generateWAMessageFromContent(from, {
            interactiveMessage: proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({ text: menuText }),
                footer: proto.Message.InteractiveMessage.Footer.create({ text: '🇭🇹 Power by Boss Edwa' }),
                header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: false }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons })
            })
        }, { userJid: sock.user.id });

        await sock.relayMessage(from, interactive.message, { messageId: interactive.key.id });
    } catch (e) {
        await sock.sendMessage(from, { text: menuText }, { quoted: msg });
    }
}

module.exports = { run };
