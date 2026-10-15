// ═══════════════════════════════════════════════════════════
//   ✨ NEXUS GUARDIAN ✨ - Advanced Discord Bot
//   All-in-one: Moderation, Tickets, Giveaways, Utility
// ═══════════════════════════════════════════════════════════

require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  PermissionFlagsBits, ChannelType, Collection, ActivityType, AttachmentBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const axios = require('axios');
const QRCode = require('qr-image');
const ms = require('ms');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════
//   DATABASE (JSON file based - no extra files needed)
// ═══════════════════════════════════════════════════════════
const DB_FILE = './database.json';
let db = {
  warnings: {},      // { guildId: { userId: [{ reason, mod, time, id }] } }
  whitelist: {},     // { guildId: [userId] }
  badwords: {},      // { guildId: [words] }
  afk: {},           // { userId: { reason, time, guild } }
  reminders: [],     // [{ userId, channelId, time, message }]
  giveaways: {},     // { messageId: {...} }
  tickets: {},       // { channelId: { user, type, claimed, ratings } }
  stats: {},         // { guildId: { tickets, giveaways, warnings } }
  birthdays: {},     // { guildId: { userId: "MM-DD" } }
  starboard: {},     // { messageId: originalMessageId }
  customCmds: {},    // { guildId: { name: { response } } }
  suggestions: {},   // { messageId: { up, down, author } }
  tickets_counter: 0,
  dm_logs: []
};

if (fs.existsSync(DB_FILE)) {
  try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch (e) {}
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
setInterval(saveDB, 30000); // autosave

// ═══════════════════════════════════════════════════════════
//   CONFIG FROM .env
// ═══════════════════════════════════════════════════════════
const CFG = {
  token: process.env.BOT_TOKEN,
  name: process.env.BOT_NAME || '✨ Nexus Guardian ✨',
  status: process.env.BOT_STATUS || '🛡️ Protecting your server',
  statusType: process.env.BOT_STATUS_TYPE || 'WATCHING',
  prefix: process.env.BOT_PREFIX || '!',
  color: parseInt((process.env.BOT_COLOR || '#5865F2').replace('#', ''), 16),
  footer: process.env.BOT_FOOTER || 'Powered by Nexus Guardian',
  ownerId: process.env.OWNER_ID || '',
  modLog: process.env.MOD_LOG_CHANNEL || '',
  msgLog: process.env.MESSAGE_LOG_CHANNEL || '',
  joinLog: process.env.JOIN_LOG_CHANNEL || '',
  dmLog: process.env.DM_LOG_CHANNEL || '',
  welcomeCh: process.env.WELCOME_CHANNEL || '',
  goodbyeCh: process.env.GOODBYE_CHANNEL || '',
  welcomeMsg: process.env.WELCOME_MESSAGE || 'Welcome {user} to **{server}**! 🎉',
  goodbyeMsg: process.env.GOODBYE_MESSAGE || '**{user}** has left the server. 👋',
  autoRole: process.env.AUTO_ROLE_ID || '',
  starboard: process.env.STARBOARD_CHANNEL || '',
  starEmoji: process.env.STARBOARD_EMOJI || '⭐',
  starThreshold: parseInt(process.env.STARBOARD_THRESHOLD || '3'),
  suggestionCh: process.env.SUGGESTION_CHANNEL || '',
  ticketCat: process.env.TICKET_CATEGORY || '',
  ticketLog: process.env.TICKET_LOG_CHANNEL || '',
  ticketRole: process.env.TICKET_SUPPORT_ROLE || '',
  antiNuke: process.env.ANTI_NUKE === 'true',
  antiSpam: process.env.ANTI_SPAM === 'true',
  spamThreshold: parseInt(process.env.SPAM_THRESHOLD || '5'),
  spamInterval: parseInt(process.env.SPAM_INTERVAL || '3000'),
  nukeThreshold: parseInt(process.env.NUKE_THRESHOLD || '3'),
  nukeInterval: parseInt(process.env.NUKE_INTERVAL || '10000'),
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  weatherKey: process.env.WEATHER_API_KEY || ''
};

// ═══════════════════════════════════════════════════════════
//   CLIENT SETUP
// ═══════════════════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember, Partials.User]
});

// ═══════════════════════════════════════════════════════════
//   UTILITIES
// ═══════════════════════════════════════════════════════════
const animEmojis = ['⏳', '⌛', '🔄', '💫', '✨', '🌟', '⭐'];
const animLine = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

const baseEmbed = (title, desc, color) => new EmbedBuilder()
  .setTitle(title || null)
  .setDescription(desc || null)
  .setColor(color || CFG.color)
  .setFooter({ text: `${CFG.footer} • ${animEmojis[Math.floor(Math.random()*animEmojis.length)]}` })
  .setTimestamp();

const successEmbed = (title, desc) => baseEmbed(`✅ ${title}`, desc, 0x57F287);
const errorEmbed = (title, desc) => baseEmbed(`❌ ${title}`, desc, 0xED4245);
const warnEmbed = (title, desc) => baseEmbed(`⚠️ ${title}`, desc, 0xFEE75C);
const infoEmbed = (title, desc) => baseEmbed(`ℹ️ ${title}`, desc, 0x5865F2);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const isWhitelisted = (guildId, userId) =>
  db.whitelist[guildId]?.includes(userId) || userId === CFG.ownerId;

const hasPerm = (member, perm) => member.permissions.has(perm) || isWhitelisted(member.guild.id, member.id);

async function sendLog(guild, channelId, embed) {
  if (!channelId) return;
  try {
    const ch = guild.channels.cache.get(channelId);
    if (ch) await ch.send({ embeds: [embed] });
  } catch (e) {}
}

async function dmUser(user, embed) {
  try { await user.send({ embeds: [embed] }); return true; } catch { return false; }
}

// ═══════════════════════════════════════════════════════════
//   READY EVENT
// ═══════════════════════════════════════════════════════════
client.once('ready', async () => {
  console.log(`
╔═══════════════════════════════════════════╗
   ✨ ${CFG.name} is ONLINE!
   🤖 Logged in as: ${client.user.tag}
   📊 Serving ${client.guilds.cache.size} guilds
   👥 ${client.users.cache.size} users
╚═══════════════════════════════════════════╝
  `);
  const typeMap = { PLAYING: 0, STREAMING: 1, LISTENING: 2, WATCHING: 3, COMPETING: 5 };
  client.user.setPresence({
    activities: [{ name: CFG.status, type: typeMap[CFG.statusType] ?? 3 }],
    status: 'online'
  });

  // Start reminder checker
  setInterval(checkReminders, 30000);
  // Start giveaway ender
  setInterval(checkGiveaways, 15000);
  // Birthday checker (runs once a day)
  setInterval(checkBirthdays, 3600000);
});

// ═══════════════════════════════════════════════════════════
//   MESSAGE CREATE - MAIN HANDLER
// ═══════════════════════════════════════════════════════════
const spamTracker = new Map();
const nukeTracker = new Map();

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;

  // Anti-link (normal users can't post links)
  if (message.content.match(/https?:\/\/\S+/gi)) {
    if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) {
      try {
        await message.delete();
        const w = await message.channel.send({ embeds: [warnEmbed('Links Not Allowed', `${message.author}, normal members cannot post links here!`)] });
        setTimeout(() => w.delete().catch(()=>{}), 5000);
        return;
      } catch {}
    }
  }

  // Bad words filter
  const bads = db.badwords[message.guild.id] || [];
  if (bads.length) {
    const lower = message.content.toLowerCase();
    if (bads.some(w => lower.includes(w.toLowerCase()))) {
      try {
        await message.delete();
        const w = await message.channel.send({ embeds: [warnEmbed('Bad Word Detected', `${message.author}, watch your language!`)] });
        setTimeout(() => w.delete().catch(()=>{}), 5000);
        return;
      } catch {}
    }
  }

  // Anti-spam
  if (CFG.antiSpam && !hasPerm(message.member, PermissionFlagsBits.ManageMessages)) {
    const key = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();
    const arr = (spamTracker.get(key) || []).filter(t => now - t < CFG.spamInterval);
    arr.push(now);
    spamTracker.set(key, arr);
    if (arr.length >= CFG.spamThreshold) {
      spamTracker.delete(key);
      try {
        await message.member.timeout(60000, 'Spam detected');
        await message.channel.send({ embeds: [warnEmbed('Spam Detected', `${message.author} has been timed out for spamming.`)] });
        await sendLog(message.guild, CFG.modLog, warnEmbed('Anti-Spam Triggered', `${message.author.tag} (${message.author.id}) muted for spam.`));
      } catch {}
      return;
    }
  }

  // AFK check - remove if author was AFK
  if (db.afk[message.author.id] && message.guild.id === db.afk[message.author.id].guild) {
    delete db.afk[message.author.id];
    const m = await message.channel.send({ embeds: [successEmbed('Welcome Back', `Welcome back ${message.author}, I removed your AFK status!`)] });
    setTimeout(() => m.delete().catch(()=>{}), 5000);
  }

  // AFK check - notify if mentioned
  if (message.mentions.users.size) {
    for (const u of message.mentions.users.values()) {
      if (db.afk[u.id]) {
        const afk = db.afk[u.id];
        const t = Math.floor((Date.now() - afk.time) / 1000);
        const m = await message.channel.send({ embeds: [infoEmbed('User AFK', `**${u.username}** is AFK: ${afk.reason}\n⏱️ ${Math.floor(t/60)}m ago`)] });
        setTimeout(() => m.delete().catch(()=>{}), 7000);
      }
    }
  }

  // Prefix command handler
  if (!message.content.startsWith(CFG.prefix)) return;
  const args = message.content.slice(CFG.prefix.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // Custom commands
  const customCmds = db.customCmds[message.guild.id] || {};
  if (customCmds[cmd]) {
    let resp = customCmds[cmd].response
      .replace(/{user}/g, message.author.toString())
      .replace(/{username}/g, message.author.username)
      .replace(/{server}/g, message.guild.name)
      .replace(/{count}/g, message.guild.memberCount)
      .replace(/{channel}/g, message.channel.toString());
    return message.reply(resp);
  }

  try {
    const handler = commands[cmd];
    if (handler) await handler(message, args);
  } catch (e) {
    console.error(e);
    message.reply({ embeds: [errorEmbed('Error', `\`\`\`${e.message}\`\`\``)] });
  }
});

// ═══════════════════════════════════════════════════════════
//   COMMANDS
// ═══════════════════════════════════════════════════════════
const commands = {};

// ────── HELP ──────
commands.help = async (message) => {
  const embed = new EmbedBuilder()
    .setTitle(`✨ ${CFG.name} - Command Center`)
    .setDescription(`${animLine}\n**🎯 Prefix:** \`${CFG.prefix}\`\n${animLine}`)
    .setColor(CFG.color)
    .addFields(
      { name: '🛡️ Moderation', value: '`ban` `kick` `timeout` `warn` `warnings` `clearwarns` `purge` `slowmode` `lock` `unlock` `nuke`', inline: false },
      { name: '✅ Whitelist', value: '`whitelist add/remove/list` `badwords add/remove/list`', inline: false },
      { name: '🎫 Tickets', value: '`ticket-panel` `ticket-close` `ticket-claim` `ticket-rate`', inline: false },
      { name: '🎉 Giveaways', value: '`gstart` `gend` `greroll`', inline: false },
      { name: '📢 DM System', value: '`dm` `dmall` `dmrole` `dmlogs`', inline: false },
      { name: '👋 Welcome', value: '`setwelcome` `setgoodbye` `autorole`', inline: false },
      { name: '💤 AFK', value: '`afk [reason]`', inline: false },
      { name: '🎂 Birthdays', value: '`birthday set MM-DD` `birthday list`', inline: false },
      { name: '💡 Suggestions', value: '`suggest <idea>` `setsuggestion #ch`', inline: false },
      { name: '🛠️ Utility', value: '`weather` `translate` `convert` `qr` `poll` `remind` `ping` `stats`', inline: false },
      { name: '📊 Info', value: '`serverinfo` `userinfo` `roleinfo` `avatar` `banner` `membercount`', inline: false },
      { name: '⚙️ Custom Cmds', value: '`addcmd name response` `delcmd name` `listcmds`', inline: false },
      { name: '🌐 Monitoring', value: '`monitor add url` `monitor list` `monitor remove url`', inline: false },
      { name: '🎭 Roles', value: '`addrole` `removerole` `createrole` `deleterole`', inline: false }
    )
    .setFooter({ text: CFG.footer })
    .setTimestamp();
  message.reply({ embeds: [embed] });
};

// ────── PING ──────
commands.ping = async (message) => {
  const sent = await message.reply({ embeds: [infoEmbed('Pinging...', '⏳ Calculating latency...')] });
  const ping = sent.createdTimestamp - message.createdTimestamp;
  const ws = client.ws.ping;
  sent.edit({ embeds: [
    new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(CFG.color)
      .addFields(
        { name: '📡 Bot Latency', value: `\`${ping}ms\``, inline: true },
        { name: '🌐 API Latency', value: `\`${ws}ms\``, inline: true },
        { name: '📊 Status', value: ping < 200 ? '🟢 Excellent' : ping < 500 ? '🟡 Good' : '🔴 Poor', inline: true }
      )
      .setFooter({ text: CFG.footer }).setTimestamp()
  ]});
};

// ────── STATS ──────
commands.stats = async (message) => {
  const g = db.stats[message.guild.id] || { tickets: 0, giveaways: 0, warnings: 0 };
  const up = process.uptime();
  const embed = new EmbedBuilder()
    .setTitle(`📊 ${CFG.name} Statistics`)
    .setColor(CFG.color)
    .addFields(
      { name: '🤖 Bot', value: `Servers: **${client.guilds.cache.size}**\nUsers: **${client.users.cache.size}**\nUptime: **${Math.floor(up/86400)}d ${Math.floor(up%86400/3600)}h ${Math.floor(up%3600/60)}m**`, inline: true },
      { name: '📈 Server Stats', value: `Tickets: **${g.tickets}**\nGiveaways: **${g.giveaways}**\nWarnings: **${g.warnings}**`, inline: true },
      { name: '💾 Memory', value: `**${(process.memoryUsage().heapUsed/1024/1024).toFixed(2)} MB**`, inline: true }
    )
    .setFooter({ text: CFG.footer }).setTimestamp();
  message.reply({ embeds: [embed] });
};

// ────── SERVER INFO ──────
commands.serverinfo = async (message) => {
  const g = message.guild;
  const embed = new EmbedBuilder()
    .setTitle(`📋 ${g.name}`)
    .setThumbnail(g.iconURL({ dynamic: true, size: 256 }))
    .setColor(CFG.color)
    .addFields(
      { name: '👑 Owner', value: `<@${g.ownerId}>`, inline: true },
      { name: '🆔 ID', value: g.id, inline: true },
      { name: '📅 Created', value: `<t:${Math.floor(g.createdTimestamp/1000)}:R>`, inline: true },
      { name: '👥 Members', value: `${g.memberCount}`, inline: true },
      { name: '💬 Channels', value: `${g.channels.cache.size}`, inline: true },
      { name: '🎭 Roles', value: `${g.roles.cache.size}`, inline: true },
      { name: '😀 Emojis', value: `${g.emojis.cache.size}`, inline: true },
      { name: '🚀 Boosts', value: `${g.premiumSubscriptionCount || 0} (Tier ${g.premiumTier})`, inline: true },
      { name: '🔒 Verification', value: `${g.verificationLevel}`, inline: true }
    )
    .setFooter({ text: CFG.footer }).setTimestamp();
  message.reply({ embeds: [embed] });
};

// ────── USER INFO ──────
commands.userinfo = async (message, args) => {
  const user = message.mentions.users.first() || message.author;
  const member = await message.guild.members.fetch(user.id).catch(() => null);
  const embed = new EmbedBuilder()
    .setTitle(`👤 ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setColor(member?.displayHexColor || CFG.color)
    .addFields(
      { name: '🆔 ID', value: user.id, inline: true },
      { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
      { name: '📅 Created', value: `<t:${Math.floor(user.createdTimestamp/1000)}:R>`, inline: true },
      { name: '📥 Joined', value: member ? `<t:${Math.floor(member.joinedTimestamp/1000)}:R>` : 'N/A', inline: true },
      { name: '🎭 Top Role', value: member ? `${member.roles.highest}` : 'N/A', inline: true },
      { name: '🎨 Color', value: member?.displayHexColor || 'N/A', inline: true },
      { name: '📛 Nickname', value: member?.nickname || 'None', inline: true },
      { name: '📋 Roles', value: member ? member.roles.cache.filter(r => r.id !== message.guild.id).map(r => r).slice(0,10).join(', ') || 'None' : 'N/A', inline: false }
    )
    .setFooter({ text: CFG.footer }).setTimestamp();
  message.reply({ embeds: [embed] });
};

// ────── AVATAR ──────
commands.avatar = async (message, args) => {
  const user = message.mentions.users.first() || message.author;
  const embed = new EmbedBuilder()
    .setTitle(`🖼️ ${user.username}'s Avatar`)
    .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
    .setColor(CFG.color)
    .setFooter({ text: CFG.footer });
  message.reply({ embeds: [embed] });
};

// ────── BANNER ──────
commands.banner = async (message, args) => {
  const user = await client.users.fetch(message.mentions.users.first()?.id || message.author.id, { force: true });
  if (!user.banner) return message.reply({ embeds: [errorEmbed('No Banner', 'This user has no banner.')] });
  const embed = new EmbedBuilder()
    .setTitle(`🖼️ ${user.username}'s Banner`)
    .setImage(user.bannerURL({ dynamic: true, size: 1024 }))
    .setColor(CFG.color).setFooter({ text: CFG.footer });
  message.reply({ embeds: [embed] });
};

// ────── MEMBER COUNT ──────
commands.membercount = async (message) => {
  const g = message.guild;
  const bots = g.members.cache.filter(m => m.user.bot).size;
  const embed = baseEmbed('👥 Member Count', null)
    .addFields(
      { name: '📊 Total', value: `${g.memberCount}`, inline: true },
      { name: '👤 Humans', value: `${g.memberCount - bots}`, inline: true },
      { name: '🤖 Bots', value: `${bots}`, inline: true }
    );
  message.reply({ embeds: [embed] });
};

// ────── ROLE INFO ──────
commands.roleinfo = async (message, args) => {
  const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
  if (!role) return message.reply({ embeds: [errorEmbed('Not Found', 'Please mention a role.')] });
  const embed = baseEmbed(`🎭 ${role.name}`, null)
    .setColor(role.hexColor)
    .addFields(
      { name: '🆔 ID', value: role.id, inline: true },
      { name: '🎨 Color', value: role.hexColor, inline: true },
      { name: '👥 Members', value: `${role.members.size}`, inline: true },
      { name: '📅 Created', value: `<t:${Math.floor(role.createdTimestamp/1000)}:R>`, inline: true },
      { name: '📌 Position', value: `${role.position}`, inline: true },
      { name: '💬 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true }
    );
  message.reply({ embeds: [embed] });
};

// ═══════════════════════════════════════════════════════════
//   MODERATION COMMANDS
// ═══════════════════════════════════════════════════════════

commands.ban = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.BanMembers)) return message.reply({ embeds: [errorEmbed('No Permission', 'You cannot ban members.')] });
  const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(()=>null);
  if (!target) return message.reply({ embeds: [errorEmbed('User Not Found', 'Please mention a user or provide ID.')] });
  if (target.id === message.author.id) return message.reply({ embeds: [errorEmbed('Wait...', 'You cannot ban yourself!')] });
  if (!target.bannable) return message.reply({ embeds: [errorEmbed('Cannot Ban', 'I cannot ban this user.')] });
  const reason = args.slice(1).join(' ') || 'No reason provided';
  await dmUser(target.user, errorEmbed('You Have Been Banned', `**Server:** ${message.guild.name}\n**Reason:** ${reason}`));
  await target.ban({ reason });
  const embed = successEmbed('User Banned', `**User:** ${target.user.tag}\n**Reason:** ${reason}\n**Mod:** ${message.author}`);
  message.reply({ embeds: [embed] });
  sendLog(message.guild, CFG.modLog, embed);
};

commands.kick = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.KickMembers)) return message.reply({ embeds: [errorEmbed('No Permission', 'You cannot kick members.')] });
  const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(()=>null);
  if (!target) return message.reply({ embeds: [errorEmbed('User Not Found', 'Please mention a user.')] });
  if (!target.kickable) return message.reply({ embeds: [errorEmbed('Cannot Kick', 'I cannot kick this user.')] });
  const reason = args.slice(1).join(' ') || 'No reason provided';
  await dmUser(target.user, warnEmbed('You Have Been Kicked', `**Server:** ${message.guild.name}\n**Reason:** ${reason}`));
  await target.kick(reason);
  const embed = successEmbed('User Kicked', `**User:** ${target.user.tag}\n**Reason:** ${reason}\n**Mod:** ${message.author}`);
  message.reply({ embeds: [embed] });
  sendLog(message.guild, CFG.modLog, embed);
};

commands.timeout = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ModerateMembers)) return message.reply({ embeds: [errorEmbed('No Permission', 'You cannot timeout members.')] });
  const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(()=>null);
  if (!target) return message.reply({ embeds: [errorEmbed('User Not Found', 'Mention a user.')] });
  const duration = ms(args[1]);
  if (!duration || duration > 2419200000) return message.reply({ embeds: [errorEmbed('Invalid Duration', 'Example: `10m`, `1h`, `1d` (max 28d)')] });
  const reason = args.slice(2).join(' ') || 'No reason';
  await target.timeout(duration, reason);
  const embed = warnEmbed('User Timed Out', `**User:** ${target.user.tag}\n**Duration:** ${ms(duration, { long: true })}\n**Reason:** ${reason}\n**Mod:** ${message.author}`);
  message.reply({ embeds: [embed] });
  sendLog(message.guild, CFG.modLog, embed);
};

commands.warn = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ModerateMembers)) return message.reply({ embeds: [errorEmbed('No Permission', 'You cannot warn members.')] });
  const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(()=>null);
  if (!target) return message.reply({ embeds: [errorEmbed('User Not Found', 'Mention a user.')] });
  const reason = args.slice(1).join(' ') || 'No reason';
  if (!db.warnings[message.guild.id]) db.warnings[message.guild.id] = {};
  if (!db.warnings[message.guild.id][target.id]) db.warnings[message.guild.id][target.id] = [];
  const w = { reason, mod: message.author.tag, time: Date.now(), id: Date.now().toString(36) };
  db.warnings[message.guild.id][target.id].push(w);
  db.stats[message.guild.id] = db.stats[message.guild.id] || { tickets:0, giveaways:0, warnings:0 };
  db.stats[message.guild.id].warnings++;
  saveDB();
  const count = db.warnings[message.guild.id][target.id].length;
  await dmUser(target.user, warnEmbed('You Have Been Warned', `**Server:** ${message.guild.name}\n**Reason:** ${reason}\n**Total Warnings:** ${count}`));
  const embed = warnEmbed('User Warned', `**User:** ${target.user.tag}\n**Reason:** ${reason}\n**Total Warnings:** ${count}`);
  message.reply({ embeds: [embed] });
  sendLog(message.guild, CFG.modLog, embed);
};

commands.warnings = async (message, args) => {
  const target = message.mentions.users.first() || message.author;
  const warns = db.warnings[message.guild.id]?.[target.id] || [];
  if (!warns.length) return message.reply({ embeds: [infoEmbed('No Warnings', `**${target.username}** has no warnings.`)] });
  const list = warns.map((w, i) => `**${i+1}.** ${w.reason} — by *${w.mod}* <t:${Math.floor(w.time/1000)}:R>`).join('\n');
  message.reply({ embeds: [warnEmbed(`${target.username}'s Warnings (${warns.length})`, list)] });
};

commands.clearwarns = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ModerateMembers)) return message.reply({ embeds: [errorEmbed('No Permission', 'No perms.')] });
  const target = message.mentions.users.first();
  if (!target) return message.reply({ embeds: [errorEmbed('Missing User', 'Mention a user.')] });
  if (db.warnings[message.guild.id]) db.warnings[message.guild.id][target.id] = [];
  saveDB();
  message.reply({ embeds: [successEmbed('Warnings Cleared', `Cleared all warnings for **${target.username}**`)] });
};

commands.purge = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) return message.reply({ embeds: [errorEmbed('No Permission', 'No perms.')] });
  const amount = parseInt(args[0]);
  if (!amount || amount < 1 || amount > 100) return message.reply({ embeds: [errorEmbed('Invalid Amount', '1-100')] });
  const filterUser = message.mentions.users.first();
  const msgs = await message.channel.messages.fetch({ limit: 100 });
  let toDelete = msgs.filter(m => Date.now() - m.createdTimestamp < 1209600000);
  if (filterUser) toDelete = toDelete.filter(m => m.author.id === filterUser.id);
  const del = toDelete.first(amount);
  const deleted = await message.channel.bulkDelete(del, true);
  const m = await message.channel.send({ embeds: [successEmbed('Purged', `Deleted **${deleted.size}** messages${filterUser ? ` from **${filterUser.tag}**` : ''}`)] });
  setTimeout(() => m.delete().catch(()=>{}), 5000);
};

commands.slowmode = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ManageChannels)) return message.reply({ embeds: [errorEmbed('No Permission', 'No perms.')] });
  const t = args[0] === 'off' ? 0 : ms(args[0])/1000;
  if (isNaN(t)) return message.reply({ embeds: [errorEmbed('Invalid', 'Example: `10s`, `1m`, `off`')] });
  await message.channel.setRateLimitPerUser(t);
  message.reply({ embeds: [successEmbed('Slowmode', t === 0 ? 'Slowmode disabled.' : `Slowmode set to **${ms(t*1000, { long: true })}**`)] });
};

commands.lock = async (message) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ManageChannels)) return message.reply({ embeds: [errorEmbed('No Permission', 'No perms.')] });
  await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
  message.reply({ embeds: [successEmbed('Channel Locked', '🔒 Channel locked.')] });
};

commands.unlock = async (message) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ManageChannels)) return message.reply({ embeds: [errorEmbed('No Permission', 'No perms.')] });
  await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
  message.reply({ embeds: [successEmbed('Channel Unlocked', '🔓 Channel unlocked.')] });
};

commands.nuke = async (message) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ManageChannels)) return message.reply({ embeds: [errorEmbed('No Permission', 'No perms.')] });
  const pos = message.channel.position;
  const clone = await message.channel.clone();
  await message.channel.delete();
  clone.setPosition(pos);
  clone.send({ embeds: [successEmbed('Channel Nuked', '💥 This channel has been nuked!')] });
};

// ────── ROLE MANAGEMENT ──────
commands.addrole = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ManageRoles)) return message.reply({ embeds: [errorEmbed('No Permission', 'No perms.')] });
  const t = message.mentions.members.first();
  const r = message.mentions.roles.first();
  if (!t || !r) return message.reply({ embeds: [errorEmbed('Missing Args', '`addrole @user @role`')] });
  await t.roles.add(r);
  message.reply({ embeds: [successEmbed('Role Added', `${r} added to ${t.user.tag}`)] });
};

commands.removerole = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ManageRoles)) return message.reply({ embeds: [errorEmbed('No Permission', 'No perms.')] });
  const t = message.mentions.members.first();
  const r = message.mentions.roles.first();
  if (!t || !r) return message.reply({ embeds: [errorEmbed('Missing Args', '`removerole @user @role`')] });
  await t.roles.remove(r);
  message.reply({ embeds: [successEmbed('Role Removed', `${r} removed from ${t.user.tag}`)] });
};

commands.createrole = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ManageRoles)) return message.reply({ embeds: [errorEmbed('No Permission', 'No perms.')] });
  const name = args.join(' ') || 'New Role';
  const r = await message.guild.roles.create({ name, reason: `Created by ${message.author.tag}` });
  message.reply({ embeds: [successEmbed('Role Created', `${r} created.`)] });
};

commands.deleterole = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ManageRoles)) return message.reply({ embeds: [errorEmbed('No Permission', 'No perms.')] });
  const r = message.mentions.roles.first();
  if (!r) return message.reply({ embeds: [errorEmbed('Missing', 'Mention a role.')] });
  await r.delete();
  message.reply({ embeds: [successEmbed('Role Deleted', `Role **${r.name}** deleted.`)] });
};

// ═══════════════════════════════════════════════════════════
//   WHITELIST / BADWORDS
// ═══════════════════════════════════════════════════════════

commands.whitelist = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) return message.reply({ embeds: [errorEmbed('No Permission', 'Admin only.')] });
  if (!db.whitelist[message.guild.id]) db.whitelist[message.guild.id] = [];
  const sub = args[0]?.toLowerCase();
  if (sub === 'add') {
    const u = message.mentions.users.first();
    if (!u) return message.reply({ embeds: [errorEmbed('Missing', 'Mention a user.')] });
    if (db.whitelist[message.guild.id].includes(u.id)) return message.reply({ embeds: [warnEmbed('Already', 'User already whitelisted.')] });
    db.whitelist[message.guild.id].push(u.id);
    saveDB();
    return message.reply({ embeds: [successEmbed('Whitelisted', `${u.tag} added to whitelist.`)] });
  }
  if (sub === 'remove') {
    const u = message.mentions.users.first();
    db.whitelist[message.guild.id] = db.whitelist[message.guild.id].filter(i => i !== u?.id);
    saveDB();
    return message.reply({ embeds: [successEmbed('Removed', `${u?.tag} removed.`)] });
  }
  if (sub === 'list' || !sub) {
    const list = db.whitelist[message.guild.id].map(id => `<@${id}>`).join(', ') || 'None';
    return message.reply({ embeds: [infoEmbed('Whitelist', list)] });
  }
  message.reply({ embeds: [infoEmbed('Usage', '`whitelist add/remove/list`')] });
};

commands.badwords = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) return message.reply({ embeds: [errorEmbed('No Permission', 'Admin only.')] });
  if (!db.badwords[message.guild.id]) db.badwords[message.guild.id] = [];
  const sub = args[0]?.toLowerCase();
  if (sub === 'add') {
    const word = args[1]?.toLowerCase();
    if (!word) return message.reply({ embeds: [errorEmbed('Missing', 'Provide a word.')] });
    db.badwords[message.guild.id].push(word);
    saveDB();
    return message.reply({ embeds: [successEmbed('Added', `\`${word}\` added to filter.`)] });
  }
  if (sub === 'remove') {
    const word = args[1]?.toLowerCase();
    db.badwords[message.guild.id] = db.badwords[message.guild.id].filter(w => w !== word);
    saveDB();
    return message.reply({ embeds: [successEmbed('Removed', `\`${word}\` removed.`)] });
  }
  if (sub === 'list') {
    const list = db.badwords[message.guild.id].join(', ') || 'None';
    return message.reply({ embeds: [infoEmbed('Bad Words', list)] });
  }
  message.reply({ embeds: [infoEmbed('Usage', '`badwords add/remove/list <word>`')] });
};

// ═══════════════════════════════════════════════════════════
//   AFK
// ═══════════════════════════════════════════════════════════
commands.afk = async (message, args) => {
  const reason = args.join(' ') || 'AFK';
  db.afk[message.author.id] = { reason, time: Date.now(), guild: message.guild.id };
  saveDB();
  message.reply({ embeds: [infoEmbed('AFK Set', `💤 **${message.author.username}** is now AFK: *${reason}*`)] });
};

// ═══════════════════════════════════════════════════════════
//   BIRTHDAY
// ═══════════════════════════════════════════════════════════
commands.birthday = async (message, args) => {
  const sub = args[0]?.toLowerCase();
  if (sub === 'set') {
    const date = args[1];
    if (!date || !/^\d{2}-\d{2}$/.test(date)) return message.reply({ embeds: [errorEmbed('Invalid', 'Use `MM-DD` format, e.g. `12-25`')] });
    if (!db.birthdays[message.guild.id]) db.birthdays[message.guild.id] = {};
    db.birthdays[message.guild.id][message.author.id] = date;
    saveDB();
    return message.reply({ embeds: [successEmbed('Birthday Set', `Your birthday is set to **${date}**! 🎂`)] });
  }
  if (sub === 'list') {
    const list = db.birthdays[message.guild.id] || {};
    const text = Object.entries(list).map(([id, d]) => `<@${id}> — ${d}`).join('\n') || 'None';
    return message.reply({ embeds: [infoEmbed('Birthdays', text)] });
  }
  message.reply({ embeds: [infoEmbed('Usage', '`birthday set MM-DD` or `birthday list`')] });
};

// ═══════════════════════════════════════════════════════════
//   SUGGESTIONS
// ═══════════════════════════════════════════════════════════
commands.setsuggestion = async (message) => {
  if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) return message.reply({ embeds: [errorEmbed('No Perm', 'Admin only.')] });
  const ch = message.mentions.channels.first();
  if (!ch) return message.reply({ embeds: [errorEmbed('Missing', 'Mention a channel.')] });
  CFG.suggestionCh = ch.id;
  message.reply({ embeds: [successEmbed('Set', `Suggestions will go to ${ch}`)] });
};

commands.suggest = async (message, args) => {
  const idea = args.join(' ');
  if (!idea) return message.reply({ embeds: [errorEmbed('Missing', 'Provide your suggestion.')] });
  const ch = CFG.suggestionCh ? message.guild.channels.cache.get(CFG.suggestionCh) : message.channel;
  const embed = new EmbedBuilder()
    .setTitle('💡 New Suggestion')
    .setDescription(idea)
    .setColor(0xFFC107)
    .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
    .setFooter({ text: `Suggestion by ${message.author.tag}` })
    .setTimestamp();
  const msg = await ch.send({ embeds: [embed] });
  await msg.react('👍'); await msg.react('👎');
  db.suggestions[msg.id] = { up: 0, down: 0, author: message.author.id, idea };
  saveDB();
  message.reply({ embeds: [successEmbed('Suggestion Sent', `Posted in ${ch}`)] });
};

// ═══════════════════════════════════════════════════════════
//   UTILITY - WEATHER
// ═══════════════════════════════════════════════════════════
commands.weather = async (message, args) => {
  const city = args.join(' ');
  if (!city) return message.reply({ embeds: [errorEmbed('Missing', 'Provide a city name.')] });
  if (!CFG.weatherKey) return message.reply({ embeds: [errorEmbed('No API Key', 'Set WEATHER_API_KEY in .env')] });
  try {
    const { data } = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${CFG.weatherKey}&units=metric`);
    const embed = new EmbedBuilder()
      .setTitle(`🌤️ Weather in ${data.name}, ${data.sys.country}`)
      .setThumbnail(`https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`)
      .setColor(CFG.color)
      .addFields(
        { name: '🌡️ Temp', value: `${data.main.temp}°C (feels ${data.main.feels_like}°C)`, inline: true },
        { name: '💧 Humidity', value: `${data.main.humidity}%`, inline: true },
        { name: '🌬️ Wind', value: `${data.wind.speed} m/s`, inline: true },
        { name: '☁️ Condition', value: data.weather[0].description, inline: true },
        { name: '🌅 Sunrise', value: `<t:${data.sys.sunrise}:t>`, inline: true },
        { name: '🌇 Sunset', value: `<t:${data.sys.sunset}:t>`, inline: true }
      )
      .setFooter({ text: CFG.footer }).setTimestamp();
    message.reply({ embeds: [embed] });
  } catch {
    message.reply({ embeds: [errorEmbed('Not Found', 'Could not fetch weather. Check city name.')] });
  }
};

// ────── TRANSLATE ──────
commands.translate = async (message, args) => {
  const lang = args[0];
  const text = args.slice(1).join(' ');
  if (!lang || !text) return message.reply({ embeds: [errorEmbed('Usage', '`translate <lang> <text>` e.g. `translate es Hello world`')] });
  try {
    const { data } = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`);
    const embed = baseEmbed('🌐 Translation', null)
      .addFields(
        { name: '📝 Original', value: text, inline: false },
        { name: '🎯 Translated', value: data.responseData.translatedText, inline: false }
      );
    message.reply({ embeds: [embed] });
  } catch {
    message.reply({ embeds: [errorEmbed('Failed', 'Translation failed.')] });
  }
};

// ────── CURRENCY CONVERT ──────
commands.convert = async (message, args) => {
  const [amount, from, to] = args;
  if (!amount || !from || !to) return message.reply({ embeds: [errorEmbed('Usage', '`convert <amount> <from> <to>` e.g. `convert 100 USD INR`')] });
  try {
    const { data } = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
    const rate = data.rates[to.toUpperCase()];
    if (!rate) throw new Error('Invalid currency');
    const result = (parseFloat(amount) * rate).toFixed(2);
    const embed = baseEmbed('💱 Currency Conversion', null)
      .addFields(
        { name: '💰 Amount', value: `${amount} ${from.toUpperCase()}`, inline: true },
        { name: '➡️ Result', value: `${result} ${to.toUpperCase()}`, inline: true },
        { name: '📊 Rate', value: `1 ${from.toUpperCase()} = ${rate} ${to.toUpperCase()}`, inline: false }
      );
    message.reply({ embeds: [embed] });
  } catch {
    message.reply({ embeds: [errorEmbed('Failed', 'Conversion failed. Check currency codes.')] });
  }
};

// ────── QR CODE ──────
commands.qr = async (message, args) => {
  const text = args.join(' ');
  if (!text) return message.reply({ embeds: [errorEmbed('Missing', 'Provide text to generate QR.')] });
  const qr = QRCode.image(text, { type: 'png', size: 10 });
  const buffer = [];
  qr.on('data', d => buffer.push(d));
  qr.on('end', () => {
    const attachment = new AttachmentBuilder(Buffer.concat(buffer), { name: 'qr.png' });
    message.reply({ embeds: [baseEmbed('📱 QR Code', `Content: \`${text}\``).setImage('attachment://qr.png')], files: [attachment] });
  });
};

// ────── POLL ──────
commands.poll = async (message, args) => {
  const q = args.join(' ');
  if (!q) return message.reply({ embeds: [errorEmbed('Missing', 'Provide a question.')] });
  const embed = baseEmbed('📊 Poll', q).setFooter({ text: `Poll by ${message.author.tag}` });
  const msg = await message.channel.send({ embeds: [embed] });
  await msg.react('1️⃣'); await msg.react('2️⃣'); await msg.react('3️⃣');
  await msg.react('4️⃣'); await msg.react('5️⃣'); await msg.react('❌');
};

// ────── REMIND ──────
commands.remind = async (message, args) => {
  const time = ms(args[0]);
  const msg = args.slice(1).join(' ');
  if (!time || !msg) return message.reply({ embeds: [errorEmbed('Usage', '`remind <time> <message>` e.g. `remind 10m Take a break`')] });
  const id = Date.now().toString(36);
  db.reminders.push({ id, userId: message.author.id, channelId: message.channel.id, time: Date.now() + time, message: msg });
  saveDB();
  message.reply({ embeds: [successEmbed('Reminder Set', `⏰ I'll remind you in **${ms(time, { long: true })}**: ${msg}`)] });
};

async function checkReminders() {
  const now = Date.now();
  const due = db.reminders.filter(r => r.time <= now);
  for (const r of due) {
    try {
      const ch = await client.channels.fetch(r.channelId);
      await ch.send({ content: `<@${r.userId}>`, embeds: [warnEmbed('⏰ Reminder', r.message)] });
    } catch {}
  }
  if (due.length) {
    db.reminders = db.reminders.filter(r => r.time > now);
    saveDB();
  }
}

// ═══════════════════════════════════════════════════════════
//   DM SYSTEM
// ═══════════════════════════════════════════════════════════

commands.dm = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) return message.reply({ embeds: [errorEmbed('No Perm', 'Admin only.')] });
  const u = message.mentions.users.first();
  const text = args.slice(1).join(' ');
  if (!u || !text) return message.reply({ embeds: [errorEmbed('Usage', '`dm @user <message>`')] });
  const embed = new EmbedBuilder()
    .setTitle('📩 Message from Staff')
    .setDescription(text)
    .setColor(CFG.color)
    .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
    .setFooter({ text: CFG.footer }).setTimestamp();
  const ok = await dmUser(u, embed);
  message.reply({ embeds: [ok ? successEmbed('DM Sent', `Delivered to ${u.tag}`) : errorEmbed('Failed', 'Could not DM user.')] });
  sendLog(message.guild, CFG.dmLog, baseEmbed('📤 DM Sent', `To: ${u.tag}\nBy: ${message.author.tag}\nMessage: ${text}`));
};

commands.dmall = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) return message.reply({ embeds: [errorEmbed('No Perm', 'Admin only.')] });
  const text = args.join(' ');
  if (!text) return message.reply({ embeds: [errorEmbed('Usage', '`dmall <message>`')] });
  await message.reply({ embeds: [infoEmbed('Starting', '⏳ Sending DMs to all members...')] });
  const members = await message.guild.members.fetch();
  let sent = 0, failed = 0;
  for (const m of members.values()) {
    if (m.user.bot) continue;
    const embed = new EmbedBuilder()
      .setTitle(`📢 Announcement from ${message.guild.name}`)
      .setDescription(text)
      .setColor(CFG.color).setFooter({ text: CFG.footer }).setTimestamp();
    const ok = await dmUser(m.user, embed);
    ok ? sent++ : failed++;
    await sleep(1500);
  }
  message.channel.send({ embeds: [successEmbed('DM All Complete', `✅ Sent: **${sent}**\n❌ Failed: **${failed}**`)] });
};

commands.dmrole = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) return message.reply({ embeds: [errorEmbed('No Perm', 'Admin only.')] });
  const role = message.mentions.roles.first();
  const text = args.slice(1).join(' ');
  if (!role || !text) return message.reply({ embeds: [errorEmbed('Usage', '`dmrole @role <message>`')] });
  await message.reply({ embeds: [infoEmbed('Starting', `⏳ Sending DMs to ${role.name}...`)] });
  let sent = 0, failed = 0;
  for (const m of role.members.values()) {
    if (m.user.bot) continue;
    const embed = new EmbedBuilder()
      .setTitle(`📢 Message for ${role.name}`)
      .setDescription(text)
      .setColor(role.hexColor).setFooter({ text: CFG.footer }).setTimestamp();
    const ok = await dmUser(m.user, embed);
    ok ? sent++ : failed++;
    await sleep(1500);
  }
  message.channel.send({ embeds: [successEmbed('DM Role Complete', `✅ Sent: **${sent}**\n❌ Failed: **${failed}**`)] });
};

commands.dmlogs = async (message) => {
  if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) return message.reply({ embeds: [errorEmbed('No Perm', 'Admin only.')] });
  const logs = db.dm_logs.slice(-15).reverse();
  if (!logs.length) return message.reply({ embeds: [infoEmbed('DM Logs', 'No DM logs yet.')] });
  const text = logs.map(l => `**${l.type}** → ${l.target} | *${l.text.slice(0,60)}*`).join('\n');
  message.reply({ embeds: [infoEmbed('Recent DM Logs', text)] });
};

// ═══════════════════════════════════════════════════════════
//   GIVEAWAY SYSTEM
// ═══════════════════════════════════════════════════════════

commands.gstart = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) return message.reply({ embeds: [errorEmbed('No Perm', 'No perms.')] });
  const time = ms(args[0]);
  const winners = parseInt(args[1]);
  const prize = args.slice(2).join(' ');
  if (!time || !winners || !prize) return message.reply({ embeds: [errorEmbed('Usage', '`gstart <time> <winners> <prize>` e.g. `gstart 1m 1 Nitro`')] });
  const endAt = Date.now() + time;
  const embed = new EmbedBuilder()
    .setTitle('🎉 GIVEAWAY 🎉')
    .setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endAt/1000)}:R>\n\nReact with 🎉 to enter!`)
    .setColor(0xFF69B4)
    .setFooter({ text: `Hosted by ${message.author.tag}` })
    .setTimestamp(endAt);
  const msg = await message.channel.send({ embeds: [embed] });
  await msg.react('🎉');
  db.giveaways[msg.id] = { prize, winners, endAt, channelId: msg.channel.id, host: message.author.id, ended: false };
  db.stats[message.guild.id] = db.stats[message.guild.id] || { tickets:0, giveaways:0, warnings:0 };
  db.stats[message.guild.id].giveaways++;
  saveDB();
};

commands.gend = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) return message.reply({ embeds: [errorEmbed('No Perm', 'No perms.')] });
  const msgId = args[0];
  if (!msgId || !db.giveaways[msgId]) return message.reply({ embeds: [errorEmbed('Not Found', 'Giveaway not found.')] });
  db.giveaways[msgId].endAt = Date.now();
  saveDB();
  await endGiveaway(msgId);
  message.reply({ embeds: [successEmbed('Ended', 'Giveaway ended.')] });
};

commands.greroll = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) return message.reply({ embeds: [errorEmbed('No Perm', 'No perms.')] });
  const msgId = args[0];
  const g = db.giveaways[msgId];
  if (!g) return message.reply({ embeds: [errorEmbed('Not Found', 'Giveaway not found.')] });
  const ch = await client.channels.fetch(g.channelId);
  const msg = await ch.messages.fetch(msgId);
  const reaction = msg.reactions.cache.get('🎉');
  const users = await reaction.users.fetch();
  const eligible = users.filter(u => !u.bot).map(u => u);
  if (!eligible.length) return message.reply({ embeds: [errorEmbed('No Entries', 'Nobody entered.')] });
  const winner = eligible[Math.floor(Math.random()*eligible.length)];
  ch.send({ embeds: [baseEmbed('🎉 Rerolled Winner', `Congratulations ${winner}! You won **${g.prize}**!`)] });
};

async function checkGiveaways() {
  for (const [id, g] of Object.entries(db.giveaways)) {
    if (!g.ended && g.endAt <= Date.now()) {
      await endGiveaway(id);
    }
  }
}

async function endGiveaway(msgId) {
  const g = db.giveaways[msgId];
  if (!g || g.ended) return;
  g.ended = true;
  try {
    const ch = await client.channels.fetch(g.channelId);
    const msg = await ch.messages.fetch(msgId);
    const reaction = msg.reactions.cache.get('🎉');
    const users = reaction ? await reaction.users.fetch() : new Map();
    const eligible = users.filter(u => !u.bot).map(u => u);
    let winners = [];
    for (let i = 0; i < g.winners && eligible.length; i++) {
      const idx = Math.floor(Math.random() * eligible.length);
      winners.push(eligible.splice(idx, 1)[0]);
    }
    const embed = new EmbedBuilder()
      .setTitle('🎊 Giveaway Ended 🎊')
      .setDescription(`**Prize:** ${g.prize}\n**Winners:** ${winners.length ? winners.map(w => `<@${w.id}>`).join(', ') : 'No valid entries'}`)
      .setColor(0xFF69B4).setTimestamp();
    await msg.edit({ embeds: [embed] });
    if (winners.length) ch.send({ content: winners.map(w => `<@${w.id}>`).join(' '), embeds: [baseEmbed('🎉 Congratulations!', `You won **${g.prize}**! Contact <@${g.host}> to claim.`)] });
  } catch (e) { console.error(e); }
  saveDB();
}

// ═══════════════════════════════════════════════════════════
//   TICKET SYSTEM
// ═══════════════════════════════════════════════════════════

commands['ticket-panel'] = async (message) => {
  if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) return message.reply({ embeds: [errorEmbed('No Perm', 'Admin only.')] });
  const embed = new EmbedBuilder()
    .setTitle('🎫 Support Ticket System')
    .setDescription(`${animLine}\n**Need help?** Create a ticket below!\n\n**Available Categories:**\n🛠️ General Support\n🐛 Bug Report\n💰 Billing Issue\n📋 Other\n${animLine}`)
    .setColor(CFG.color)
    .setFooter({ text: CFG.footer })
    .setTimestamp();
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket_create')
    .setPlaceholder('🎫 Select a ticket category...')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('General Support').setValue('general').setEmoji('🛠️').setDescription('Get help with general issues'),
      new StringSelectMenuOptionBuilder().setLabel('Bug Report').setValue('bug').setEmoji('🐛').setDescription('Report a bug'),
      new StringSelectMenuOptionBuilder().setLabel('Billing Issue').setValue('billing').setEmoji('💰').setDescription('Billing related'),
      new StringSelectMenuOptionBuilder().setLabel('Other').setValue('other').setEmoji('📋').setDescription('Anything else')
    );
  const row = new ActionRowBuilder().addComponents(menu);
  message.channel.send({ embeds: [embed], components: [row] });
};

commands['ticket-close'] = async (message) => {
  const t = db.tickets[message.channel.id];
  if (!t) return message.reply({ embeds: [errorEmbed('Not a Ticket', 'This is not a ticket channel.')] });
  const embed = warnEmbed('Closing Ticket', '⏳ Generating transcript and closing in 5 seconds...');
  await message.reply({ embeds: [embed] });
  await sleep(5000);
  delete db.tickets[message.channel.id];
  saveDB();
  message.channel.delete().catch(()=>{});
};

commands['ticket-claim'] = async (message) => {
  const t = db.tickets[message.channel.id];
  if (!t) return message.reply({ embeds: [errorEmbed('Not a Ticket', 'This is not a ticket.')] });
  if (t.claimed) return message.reply({ embeds: [warnEmbed('Already Claimed', `Claimed by <@${t.claimed}>`)] });
  t.claimed = message.author.id;
  saveDB();
  message.reply({ embeds: [successEmbed('Ticket Claimed', `🎯 Claimed by ${message.author}`)] });
};

commands['ticket-rate'] = async (message, args) => {
  const r = parseInt(args[0]);
  if (!r || r < 1 || r > 5) return message.reply({ embeds: [errorEmbed('Invalid', 'Rate 1-5 stars.')] });
  const t = db.tickets[message.channel.id];
  if (t) { t.rating = r; saveDB(); }
  message.reply({ embeds: [successEmbed('Thanks!', `You rated support: ${'⭐'.repeat(r)}`)] });
};

// ═══════════════════════════════════════════════════════════
//   CUSTOM COMMANDS
// ═══════════════════════════════════════════════════════════

commands.addcmd = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) return message.reply({ embeds: [errorEmbed('No Perm', 'Admin only.')] });
  const name = args[0]?.toLowerCase();
  const resp = args.slice(1).join(' ');
  if (!name || !resp) return message.reply({ embeds: [errorEmbed('Usage', '`addcmd <name> <response>`\nPlaceholders: `{user}` `{username}` `{server}` `{count}` `{channel}`')] });
  if (!db.customCmds[message.guild.id]) db.customCmds[message.guild.id] = {};
  db.customCmds[message.guild.id][name] = { response: resp, creator: message.author.id };
  saveDB();
  message.reply({ embeds: [successEmbed('Command Added', `\`${CFG.prefix}${name}\` is now a custom command!`)] });
};

commands.delcmd = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) return message.reply({ embeds: [errorEmbed('No Perm', 'Admin only.')] });
  const name = args[0]?.toLowerCase();
  if (!db.customCmds[message.guild.id]?.[name]) return message.reply({ embeds: [errorEmbed('Not Found', 'Command not found.')] });
  delete db.customCmds[message.guild.id][name];
  saveDB();
  message.reply({ embeds: [successEmbed('Deleted', `\`${name}\` removed.`)] });
};

commands.listcmds = async (message) => {
  const cmds = Object.keys(db.customCmds[message.guild.id] || {});
  message.reply({ embeds: [infoEmbed('Custom Commands', cmds.map(c => `\`${CFG.prefix}${c}\``).join(', ') || 'None yet')] });
};

// ═══════════════════════════════════════════════════════════
//   WEBSITE MONITOR
// ═══════════════════════════════════════════════════════════
const monitors = []; // { url, channelId, guildId, lastUp }

commands.monitor = async (message, args) => {
  if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) return message.reply({ embeds: [errorEmbed('No Perm', 'Admin only.')] });
  const sub = args[0]?.toLowerCase();
  if (sub === 'add') {
    const url = args[1];
    if (!url) return message.reply({ embeds: [errorEmbed('Missing', 'Provide URL.')] });
    monitors.push({ url, channelId: message.channel.id, guildId: message.guild.id, lastUp: true });
    return message.reply({ embeds: [successEmbed('Monitoring', `Now monitoring: ${url}`)] });
  }
  if (sub === 'list') {
    return message.reply({ embeds: [infoEmbed('Monitors', monitors.map(m => `${m.url} → <#${m.channelId}>`).join('\n') || 'None')] });
  }
  if (sub === 'remove') {
    const i = monitors.findIndex(m => m.url === args[1]);
    if (i >= 0) monitors.splice(i, 1);
    return message.reply({ embeds: [successEmbed('Removed', 'Monitor removed.')] });
  }
  message.reply({ embeds: [infoEmbed('Usage', '`monitor add/list/remove <url>`')] });
};

setInterval(async () => {
  for (const m of monitors) {
    try {
      const res = await axios.get(m.url, { timeout: 5000 }).catch(e => e.response || { status: 500 });
      const isUp = res.status >= 200 && res.status < 400;
      if (m.lastUp && !isUp) {
        const ch = await client.channels.fetch(m.channelId).catch(()=>null);
        if (ch) ch.send({ embeds: [errorEmbed('🔴 Website Down', `**URL:** ${m.url}\n**Status:** ${res.status}`)] });
        m.lastUp = false;
      } else if (!m.lastUp && isUp) {
        const ch = await client.channels.fetch(m.channelId).catch(()=>null);
        if (ch) ch.send({ embeds: [successEmbed('🟢 Website Up', `**URL:** ${m.url}`)] });
        m.lastUp = true;
      }
    } catch {}
  }
}, 60000);

// ═══════════════════════════════════════════════════════════
//   GREETINGS (WELCOME / GOODBYE)
// ═══════════════════════════════════════════════════════════

client.on('guildMemberAdd', async (member) => {
  // Auto role
  if (CFG.autoRole) {
    try {
      const r = member.guild.roles.cache.get(CFG.autoRole);
      if (r) await member.roles.add(r);
    } catch {}
  }
  // Welcome
  if (CFG.welcomeCh) {
    const ch = member.guild.channels.cache.get(CFG.welcomeCh);
    if (ch) {
      const msg = CFG.welcomeMsg
        .replace(/{user}/g, member.toString())
        .replace(/{username}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{count}/g, member.guild.memberCount);
      const embed = new EmbedBuilder()
        .setTitle(`👋 Welcome to ${member.guild.name}!`)
        .setDescription(msg)
        .setColor(0x57F287)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: `${CFG.footer} • Member #${member.guild.memberCount}` })
        .setTimestamp();
      ch.send({ embeds: [embed] }).catch(()=>{});
    }
  }
  // Join log
  if (CFG.joinLog) {
    const ch = member.guild.channels.cache.get(CFG.joinLog);
    if (ch) ch.send({ embeds: [baseEmbed('📥 Member Joined', `**User:** ${member.user.tag} (${member.id})\n**Account Created:** <t:${Math.floor(member.user.createdTimestamp/1000)}:R>`)] }).catch(()=>{});
  }
});

client.on('guildMemberRemove', async (member) => {
  if (CFG.goodbyeCh) {
    const ch = member.guild.channels.cache.get(CFG.goodbyeCh);
    if (ch) {
      const msg = CFG.goodbyeMsg
        .replace(/{user}/g, member.user.username)
        .replace(/{username}/g, member.user.username)
        .replace(/{server}/g, member.guild.name);
      const embed = new EmbedBuilder()
        .setTitle('👋 Goodbye!')
        .setDescription(msg)
        .setColor(0xED4245)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: CFG.footer })
        .setTimestamp();
      ch.send({ embeds: [embed] }).catch(()=>{});
    }
  }
});

// ═══════════════════════════════════════════════════════════
//   STARBOARD
// ═══════════════════════════════════════════════════════════
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
  if (reaction.emoji.name !== CFG.starEmoji) return;
  if (reaction.count < CFG.starThreshold) return;
  if (!CFG.starboard) return;
  const msg = reaction.message;
  if (msg.channel.id === CFG.starboard) return;
  if (db.starboard[msg.id]) return;
  const ch = msg.guild.channels.cache.get(CFG.starboard);
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL() })
    .setDescription(msg.content || '*No content*')
    .addFields({ name: 'Original', value: `[Jump to message](${msg.url})` })
    .setFooter({ text: `${CFG.starEmoji} ${reaction.count} | #${msg.channel.name}` })
    .setTimestamp(msg.createdTimestamp);
  if (msg.attachments.size) embed.setImage(msg.attachments.first().url);
  const sent = await ch.send({ embeds: [embed] });
  db.starboard[sent.id] = msg.id;
  saveDB();
});

// ═══════════════════════════════════════════════════════════
//   ANTI-NUKE (Channel/Role delete protection)
// ═══════════════════════════════════════════════════════════
client.on('channelDelete', async (channel) => {
  if (!CFG.antiNuke || !channel.guild) return;
  const audits = await channel.guild.fetchAuditLogs({ limit: 1, type: 12 }).catch(() => null);
  const entry = audits?.entries.first();
  if (!entry || Date.now() - entry.createdTimestamp > 10000) return;
  const exec = entry.executor;
  if (!exec || exec.id === client.user.id) return;
  const member = await channel.guild.members.fetch(exec.id).catch(()=>null);
  if (!member || isWhitelisted(channel.guild.id, member.id)) return;
  // Track
  const key = `${channel.guild.id}-${exec.id}`;
  const now = Date.now();
  const arr = (nukeTracker.get(key) || []).filter(t => now - t < CFG.nukeInterval);
  arr.push(now);
  nukeTracker.set(key, arr);
  if (arr.length >= CFG.nukeThreshold) {
    try {
      await member.roles.set([], 'Anti-Nuke: Mass channel deletion');
      await member.kick('Anti-Nuke triggered');
    } catch {}
    const logEmbed = errorEmbed('🚨 ANTI-NUKE TRIGGERED', `**User:** ${exec.tag}\n**Action:** Mass channel deletion\n**Punishment:** Removed all roles + kicked`);
    sendLog(channel.guild, CFG.modLog, logEmbed);
  }
});

client.on('roleDelete', async (role) => {
  if (!CFG.antiNuke) return;
  const audits = await role.guild.fetchAuditLogs({ limit: 1, type: 32 }).catch(() => null);
  const entry = audits?.entries.first();
  if (!entry || Date.now() - entry.createdTimestamp > 10000) return;
  const exec = entry.executor;
  if (!exec || exec.id === client.user.id) return;
  const member = await role.guild.members.fetch(exec.id).catch(()=>null);
  if (!member || isWhitelisted(role.guild.id, member.id)) return;
  const key = `${role.guild.id}-${exec.id}-role`;
  const now = Date.now();
  const arr = (nukeTracker.get(key) || []).filter(t => now - t < CFG.nukeInterval);
  arr.push(now);
  nukeTracker.set(key, arr);
  if (arr.length >= CFG.nukeThreshold) {
    try {
      await member.roles.set([], 'Anti-Nuke: Mass role deletion');
      await member.kick('Anti-Nuke triggered');
    } catch {}
    sendLog(role.guild, CFG.modLog, errorEmbed('🚨 ANTI-NUKE (Roles)', `**User:** ${exec.tag}\n**Action:** Mass role deletion`));
  }
});

// ═══════════════════════════════════════════════════════════
//   INTERACTIONS (Tickets, Buttons, Menus)
// ═══════════════════════════════════════════════════════════

client.on('interactionCreate', async (interaction) => {
  // Ticket create via select menu
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_create') {
    await interaction.deferReply({ ephemeral: true });
    const type = interaction.values[0];
    const guild = interaction.guild;
    const existing = Object.entries(db.tickets).find(([id, t]) => t.user === interaction.user.id && t.guild === guild.id);
    if (existing) {
      return interaction.editReply({ embeds: [errorEmbed('Already Open', `You already have a ticket: <#${existing[0]}>`)] });
    }
    const chName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,15)}-${Math.floor(Math.random()*1000)}`;
    const overwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
    ];
    if (CFG.ticketRole) overwrites.push({ id: CFG.ticketRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
    const ch = await guild.channels.create({
      name: chName, type: ChannelType.GuildText,
      parent: CFG.ticketCat || null, permissionOverwrites: overwrites,
      topic: `Ticket by ${interaction.user.tag} | Type: ${type}`
    });
    db.tickets[ch.id] = { user: interaction.user.id, guild: guild.id, type, claimed: null, rating: null, created: Date.now() };
    db.stats[guild.id] = db.stats[guild.id] || { tickets:0, giveaways:0, warnings:0 };
    db.stats[guild.id].tickets++;
    db.tickets_counter++;
    saveDB();
    const embed = new EmbedBuilder()
      .setTitle(`🎫 Ticket #${db.tickets_counter} — ${type.toUpperCase()}`)
      .setDescription(`Hello ${interaction.user}, thanks for opening a ticket!\n\n**Category:** ${type}\n**Support team will be with you shortly.**\n\nUse \`${CFG.prefix}ticket-close\` to close this ticket.`)
      .setColor(CFG.color)
      .setFooter({ text: CFG.footer }).setTimestamp();
    const btns = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close_btn').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_claim_btn').setLabel('Claim').setEmoji('🎯').setStyle(ButtonStyle.Success)
    );
    await ch.send({ content: `<@${interaction.user.id}>${CFG.ticketRole ? ` <@&${CFG.ticketRole}>` : ''}`, embeds: [embed], components: [btns] });
    interaction.editReply({ embeds: [successEmbed('Ticket Created', `Your ticket: ${ch}`)] });
    if (CFG.ticketLog) {
      const logCh = guild.channels.cache.get(CFG.ticketLog);
      if (logCh) logCh.send({ embeds: [infoEmbed('🎫 Ticket Created', `**User:** ${interaction.user.tag}\n**Type:** ${type}\n**Channel:** ${ch}`)] });
    }
  }

  // Buttons
  if (interaction.isButton()) {
    if (interaction.customId === 'ticket_close_btn') {
      const t = db.tickets[interaction.channel.id];
      if (!t) return interaction.reply({ embeds: [errorEmbed('Not a Ticket', 'N/A')], ephemeral: true });
      if (interaction.user.id !== t.user && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ embeds: [errorEmbed('No Perm', 'Only ticket owner or staff.')], ephemeral: true });
      }
      await interaction.reply({ embeds: [warnEmbed('Closing', '🔒 Closing in 5 seconds...')] });
      await sleep(5000);
      delete db.tickets[interaction.channel.id];
      saveDB();
      interaction.channel.delete().catch(()=>{});
    }
    if (interaction.customId === 'ticket_claim_btn') {
      const t = db.tickets[interaction.channel.id];
      if (!t) return interaction.reply({ embeds: [errorEmbed('Not a Ticket', 'N/A')], ephemeral: true });
      if (t.claimed) return interaction.reply({ embeds: [warnEmbed('Already Claimed', `By <@${t.claimed}>`)], ephemeral: true });
      t.claimed = interaction.user.id;
      saveDB();
      interaction.reply({ embeds: [successEmbed('Claimed', `🎯 Claimed by ${interaction.user}`)] });
    }
  }
});

// ═══════════════════════════════════════════════════════════
//   BIRTHDAY CHECKER
// ═══════════════════════════════════════════════════════════
async function checkBirthdays() {
  const now = new Date();
  const mmdd = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  for (const [guildId, list] of Object.entries(db.birthdays)) {
    for (const [userId, date] of Object.entries(list)) {
      if (date === mmdd) {
        try {
          const guild = await client.guilds.fetch(guildId);
          const member = await guild.members.fetch(userId).catch(()=>null);
          if (member) {
            const genCh = guild.channels.cache.find(c => c.name.includes('general') && c.type === ChannelType.GuildText) || guild.systemChannel;
            if (genCh) genCh.send({ embeds: [
              new EmbedBuilder()
                .setTitle('🎂 Happy Birthday! 🎉')
                .setDescription(`🎈 Let's all wish **${member.user.username}** a very Happy Birthday! 🎁🎊`)
                .setColor(0xFF69B4)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: CFG.footer }).setTimestamp()
            ]});
          }
        } catch {}
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
//   ERROR HANDLING
// ═══════════════════════════════════════════════════════════
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));
process.on('uncaughtException', (err) => console.error('Uncaught:', err));

// ═══════════════════════════════════════════════════════════
//   LOGIN
// ═══════════════════════════════════════════════════════════
client.login(CFG.token).catch(e => {
  console.error('❌ Login failed! Check BOT_TOKEN in .env');
  process.exit(1);
});
