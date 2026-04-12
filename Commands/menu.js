const config = require('../config');

async function run(sock, from, msg, args, config) {
    const totalPlugins = config.PLUGINS_LIST.length;
    
    const menuText = `
┏▣  *${config.BOT_NAME}* ◈
┃ *ᴏᴡɴᴇʀ* : ${config.OWNER_NAME}
┃ *ᴘʀғɪx* : [ ${config.PREFIX} ]
┃ *ʜsᴛ* : Termux/Replit
┃ *ᴘʟɢɪɴs* : ${totalPlugins}
┃ *ᴍᴏ* : ${config.MODE}
┃ *ᴠᴇʀsɪᴏɴ* : ${config.VERSION}
┃ *ꜰᴛ*: AntiViewOnce | AntiDelete
┗ 

┏▣  *GROUP MENU* 
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
┗ 

┏▣  *INFO* ◈
│➽ GitHub: ${config.REPO_LINK}
│➽ Channel: ${config.CHANNEL_LINK}
│➽ Owner: ${config.OWNER_LINK}
┗ 

*© Power by Boss Edwa 🇭🇹*
`;

    await sock.sendMessage(from, { text: menuText });
}

module.exports = { run };
