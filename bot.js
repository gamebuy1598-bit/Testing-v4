// ═══════════════════════════════════════════════════════════════
//  🌟 ULTIMATE DISCORD BOT - FIXED & WORKING VERSION
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes,
  PermissionFlagsBits, ActivityType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// ═══════════════ CONFIG ═══════════════
const CONFIG = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  BOT_NAME: process.env.BOT_NAME || 'Ultimate Bot',
  BOT_COLOR: process.env.BOT_COLOR || '#5865F2',
  BOT_FOOTER: process.env.BOT_FOOTER || 'Powered by Ultimate Bot ✨',
  PREFIX: process.env.BOT_PREFIX || '!',
  DAILY_MIN: parseInt(process.env.DAILY_REWARD_MIN) || 50,
  DAILY_MAX: parseInt(process.env.DAILY_REWARD_MAX) || 200,
  DAILY_COOLDOWN: parseInt(process.env.DAILY_COOLDOWN_HOURS) || 24,
  INACTIVE_DAYS: parseInt(process.env.INACTIVE_DAYS) || 7,
  AUTO_KICK: process.env.AUTO_KICK_ENABLED === 'true',
  KICK_DAYS: parseInt(process.env.KICK_AFTER_DAYS) || 14,
  ANIMATIONS: process.env.ENABLE_ANIMATIONS !== 'false',
};

// ═══════════════ VALIDATION ═══════════════
if (!CONFIG.TOKEN) {
  console.error('❌ TOKEN missing in .env');
  process.exit(1);
}
if (!CONFIG.CLIENT_ID) {
  console.error('❌ CLIENT_ID missing in .env');
  process.exit(1);
}

// ═══════════════ DATA ═══════════════
const DATA_FILE = path.join(__dirname, 'bot_data.json');
let DB = { users: {}, settings: {}, activity: {} };

function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      DB = { users: {}, settings: {}, activity: {}, ...data };
    }
  } catch (e) { console.error('DB Load:', e.message); }
}
function saveDB() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2)); }
  catch (e) { console.error('DB Save:', e.message); }
}
loadDB();

// ═══════════════ HELPERS ═══════════════
function getUser(id) {
  if (!DB.users[id]) {
    DB.users[id] = {
      coins: 0, lastDaily: 0, lastActivity: Date.now(),
      streak: 0, warnings: 0, xp: 0, level: 1, totalMessages: 0
    };
  }
  return DB.users[id];
}
function addCoins(id, amount) { const u = getUser(id); u.coins += amount; return u.coins; }
function addXP(id, amount) {
  const u = getUser(id);
  u.xp += amount;
  const needed = u.level * 100;
  if (u.xp >= needed) { u.xp -= needed; u.level++; return true; }
  return false;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];

function embed({ title, description, color, fields, thumbnail, image, footer, author }) {
  const e = new EmbedBuilder()
    .setColor(color || CONFIG.BOT_COLOR)
    .setFooter({ text: footer || CONFIG.BOT_FOOTER });
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  if (fields) e.addFields(fields);
  if (thumbnail) e.setThumbnail(thumbnail);
  if (image) e.setImage(image);
  if (author) e.setAuthor(author);
  e.setTimestamp();
  return e;
}

function progressBar(current, max, size = 12) {
  const filled = Math.max(0, Math.min(size, Math.round((current / max) * size)));
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

// ═══════════════ DATA LISTS ═══════════════
const FUN_FACTS = [
  '🐙 Octopuses have three hearts and blue blood!',
  '🍯 Honey never spoils. 3000-year-old honey is still edible!',
  '🌌 A day on Venus is longer than its year!',
  '🦈 Sharks existed before trees — over 400 million years!',
  '🧠 Your brain generates 20 watts of electricity!',
  '🐝 A bee can visit up to 5,000 flowers in a day!',
  '🌊 We\'ve explored less than 5% of the ocean!',
  '⚡ Lightning is 5 times hotter than the sun\'s surface!',
  '🐌 Snails can sleep for up to 3 years!',
  '🎈 Bananas are berries, but strawberries aren\'t!',
  '🦋 Butterflies taste with their feet!',
  '🐘 Elephants are the only animals that can\'t jump!',
];

const QUOTES = [
  '✨ "The only way to do great work is to love what you do." — Steve Jobs',
  '🔥 "Success is not final, failure is not fatal." — Winston Churchill',
  '💫 "Believe you can and you\'re halfway there." — Theodore Roosevelt',
  '🚀 "The future belongs to those who believe in their dreams." — Eleanor Roosevelt',
  '💪 "Don\'t watch the clock; do what it does. Keep going." — Sam Levenson',
  '🌟 "Everything you\'ve ever wanted is on the other side of fear." — George Addair',
  '🌱 "The best time to plant a tree was 20 years ago. The second best is now."',
  '⚡ "Your limitation—it\'s only your imagination."',
  '🎯 "Push yourself, because no one else will."',
  '🏆 "Great things never come from comfort zones."',
];

const TRIVIA = [
  { q: 'What is the capital of France?', a: ['Paris', 'London', 'Berlin', 'Madrid'], correct: 0 },
  { q: 'Which planet is the Red Planet?', a: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correct: 1 },
  { q: 'What is the largest ocean?', a: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correct: 3 },
  { q: 'Who painted the Mona Lisa?', a: ['Van Gogh', 'Picasso', 'Da Vinci', 'Michelangelo'], correct: 2 },
  { q: 'Chemical symbol for gold?', a: ['Go', 'Gd', 'Au', 'Ag'], correct: 2 },
  { q: 'How many continents?', a: ['5', '6', '7', '8'], correct: 2 },
  { q: 'Fastest land animal?', a: ['Lion', 'Cheetah', 'Tiger', 'Horse'], correct: 1 },
  { q: 'Sides in a hexagon?', a: ['5', '6', '7', '8'], correct: 1 },
];

const HUG_MSGS = [
  '🤗 **{a}** gives **{b}** a warm hug!',
  '💞 **{a}** wraps **{b}** in a big bear hug!',
  '🫂 **{a}** hugs **{b}** tightly!',
];
const WAVE_MSGS = [
  '👋 **{a}** waves at **{b}**!',
  '🌊 **{a}** waves happily to **{b}**!',
];
const HIGHFIVE_MSGS = [
  '🙌 **{a}** high-fives **{b}**! *SMACK!*',
  '✋💥 **{a}** and **{b}** high-five!',
];
const EIGHTBALL = [
  '🎱 It is certain.', '🎱 Without a doubt.', '🎱 Yes — definitely.',
  '🎱 You may rely on it.', '🎱 Most likely.', '🎱 Outlook good.',
  '🎱 Reply hazy, try again.', '🎱 Ask again later.',
  '🎱 Don\'t count on it.', '🎱 Very doubtful.', '🎱 Outlook not so good.',
];

// ═══════════════ COMMANDS ═══════════════
const commands = [
  new SlashCommandBuilder().setName('daily').setDescription('Claim your daily reward!'),
  new SlashCommandBuilder().setName('balance').setDescription('Check your coin balance'),
  new SlashCommandBuilder().setName('profile').setDescription('View your profile')
    .addUserOption(o => o.setName('user').setDescription('User to view')),
  new SlashCommandBuilder().setName('trivia').setDescription('Play trivia!'),
  new SlashCommandBuilder().setName('funfact').setDescription('Get a random fun fact!'),
  new SlashCommandBuilder().setName('quote').setDescription('Get a quote!'),
  new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin!'),
  new SlashCommandBuilder().setName('dice').setDescription('Roll a dice!')
    .addIntegerOption(o => o.setName('sides').setDescription('Sides (default 6)').setMinValue(2).setMaxValue(100)),
  new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball!')
    .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('hug').setDescription('Hug someone!')
    .addUserOption(o => o.setName('user').setDescription('User to hug').setRequired(true)),
  new SlashCommandBuilder().setName('wave').setDescription('Wave at someone!')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('highfive').setDescription('High-five someone!')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('nactive').setDescription('List inactive members'),
  new SlashCommandBuilder().setName('resetactivity').setDescription('Reset a user\'s activity')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('setinactive').setDescription('Mark user inactive')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('warn').setDescription('Warn a user')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  new SlashCommandBuilder().setName('warnings').setDescription('Check warnings')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('togglekick').setDescription('Toggle auto-kick'),
  new SlashCommandBuilder().setName('announce').setDescription('Send announcement')
    .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel')),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Server info'),
  new SlashCommandBuilder().setName('botinfo').setDescription('Bot info'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 richest'),
  new SlashCommandBuilder().setName('help').setDescription('Show all commands'),
].map(c => c.toJSON());

// ═══════════════ CLIENT ═══════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
});

// Error handlers
process.on('unhandledRejection', err => console.error('❌ Unhandled:', err));
process.on('uncaughtException', err => console.error('❌ Uncaught:', err));

// ═══════════════ REGISTER COMMANDS ═══════════════
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  try {
    console.log('🔄 Registering slash commands...');
    let data;
    if (CONFIG.GUILD_ID) {
      data = await rest.put(
        Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Registered ${data.length} commands to guild ${CONFIG.GUILD_ID}`);
    } else {
      data = await rest.put(
        Routes.applicationCommands(CONFIG.CLIENT_ID),
        { body: commands }
      );
      console.log(`✅ Registered ${data.length} global commands (may take 1hr to show)`);
    }
  } catch (e) {
    console.error('❌ Command registration failed:', e.message);
    if (e.rawError) console.error('Details:', JSON.stringify(e.rawError, null, 2));
  }
}

// ═══════════════ READY ═══════════════
client.once('ready', async () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log(`║  ✅ ${CONFIG.BOT_NAME} is ONLINE!`);
  console.log(`║  🤖 Logged in as: ${client.user.tag}`);
  console.log(`║  🌐 Servers: ${client.guilds.cache.size}`);
  console.log('╚════════════════════════════════════════╝\n');

  client.user.setPresence({
    activities: [{ name: '/help for commands ✨', type: ActivityType.Watching }],
    status: 'online',
  });

  await registerCommands();
});

// ═══════════════ ACTIVITY TRACKING ═══════════════
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot || !message.guild) return;

    // Prefix commands
    if (message.content.startsWith(CONFIG.PREFIX)) {
      const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
      const cmd = args.shift().toLowerCase();
      if (cmd === 'ping') {
        const sent = await message.reply('🏓 Pinging...');
        sent.edit(`🏓 Pong! \`${sent.createdTimestamp - message.createdTimestamp}ms\``);
        return;
      }
      if (cmd === 'hello') {
        message.reply(`👋 Hello ${message.author.username}!`);
        return;
      }
    }

    // Activity
    const uid = message.author.id;
    const gid = message.guild.id;
    if (!DB.activity[gid]) DB.activity[gid] = {};
    DB.activity[gid][uid] = Date.now();

    const u = getUser(uid);
    u.lastActivity = Date.now();
    u.totalMessages = (u.totalMessages || 0) + 1;

    const leveledUp = addXP(uid, randomInt(5, 15));
    if (leveledUp) {
      message.reply({
        embeds: [embed({
          title: '🎉 LEVEL UP!',
          description: `**${message.author.username}** reached **Level ${u.level}**!`,
          color: '#FFD700',
        })]
      }).then(m => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
    }

    if (Math.random() < 0.1) saveDB();
  } catch (e) { console.error('messageCreate error:', e.message); }
});

// ═══════════════ INTERACTION HANDLER ═══════════════
client.on('interactionCreate', async (interaction) => {
  try {
    // Buttons
    if (interaction.isButton()) return handleButton(interaction);
    if (!interaction.isChatInputCommand()) return;

    const cmd = interaction.commandName;
    console.log(`⚡ /${cmd} used by ${interaction.user.tag}`);

    // ═══ DAILY ═══
    if (cmd === 'daily') {
      const uid = interaction.user.id;
      const u = getUser(uid);
      const now = Date.now();
      const cdMs = CONFIG.DAILY_COOLDOWN * 60 * 60 * 1000;

      if (u.lastDaily && now - u.lastDaily < cdMs) {
        const remaining = cdMs - (now - u.lastDaily);
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        return interaction.reply({
          embeds: [embed({
            title: '⏰ Already Claimed!',
            description: `Come back in **${h}h ${m}m ${s}s**`,
            color: '#FF6B6B',
          })],
          ephemeral: true,
        });
      }

      const isStreak = u.lastDaily && (now - u.lastDaily < cdMs * 2);
      u.streak = isStreak ? (u.streak || 0) + 1 : 1;
      u.lastDaily = now;

      const base = randomInt(CONFIG.DAILY_MIN, CONFIG.DAILY_MAX);
      const streakBonus = Math.min(u.streak * 10, 200);
      const total = base + streakBonus;
      addCoins(uid, total);
      saveDB();

      await interaction.reply({
        embeds: [embed({
          title: '🎁 Daily Reward Claimed!',
          description: `You received **${total}** coins! 🪙\n\n` +
            `💰 Base: **${base}**\n` +
            `🔥 Streak Bonus: **+${streakBonus}** (Day ${u.streak})\n` +
            `💼 Balance: **${u.coins}** coins`,
          color: '#FFD700',
          thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
        })],
      });
    }

    // ═══ BALANCE ═══
    else if (cmd === 'balance') {
      const u = getUser(interaction.user.id);
      await interaction.reply({
        embeds: [embed({
          title: '💼 Your Wallet',
          description: `**Balance:** ${u.coins} 🪙\n**Level:** ${u.level} ⭐\n**XP:** ${u.xp}/${u.level * 100}\n${progressBar(u.xp, u.level * 100)}`,
          color: '#00FFAA',
          thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
        })],
      });
    }

    // ═══ PROFILE ═══
    else if (cmd === 'profile') {
      const target = interaction.options.getUser('user') || interaction.user;
      const u = getUser(target.id);
      const lastAct = u.lastActivity ? `<t:${Math.floor(u.lastActivity / 1000)}:R>` : 'Never';

      await interaction.reply({
        embeds: [embed({
          title: `👤 ${target.username}'s Profile`,
          thumbnail: target.displayAvatarURL({ dynamic: true, size: 256 }),
          fields: [
            { name: '💰 Coins', value: `\`${u.coins}\``, inline: true },
            { name: '⭐ Level', value: `\`${u.level}\``, inline: true },
            { name: '🔥 Streak', value: `\`${u.streak || 0} days\``, inline: true },
            { name: '💬 Messages', value: `\`${u.totalMessages || 0}\``, inline: true },
            { name: '⚠️ Warnings', value: `\`${u.warnings || 0}\``, inline: true },
            { name: '📅 Last Active', value: lastAct, inline: true },
            { name: '📊 XP', value: `${progressBar(u.xp, u.level * 100)} \`${u.xp}/${u.level * 100}\`` },
          ],
        })],
      });
    }

    // ═══ TRIVIA ═══
    else if (cmd === 'trivia') {
      const q = pickRandom(TRIVIA);
      const letters = ['🇦', '🇧', '🇨', '🇩'];
      const row = new ActionRowBuilder();
      q.a.forEach((ans, i) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`trivia_${interaction.id}_${i}`)
            .setLabel(`${letters[i]} ${ans}`)
            .setStyle(ButtonStyle.Secondary)
        );
      });

      const msg = await interaction.reply({
        embeds: [embed({
          title: '🧠 TRIVIA TIME!',
          description: `**${q.q}**\n\n⏱️ **15 seconds!**`,
          color: '#9B59B6',
        })],
        components: [row],
        fetchReply: true,
      });

      client.triviaSessions = client.triviaSessions || {};
      client.triviaSessions[interaction.id] = {
        correct: q.correct,
        userId: interaction.user.id,
        answered: false,
        q,
      };

      setTimeout(async () => {
        const session = client.triviaSessions?.[interaction.id];
        if (!session || session.answered) return;
        delete client.triviaSessions[interaction.id];
        const disabledRow = new ActionRowBuilder();
        q.a.forEach((ans, i) => {
          disabledRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`done_${i}`)
              .setLabel(`${letters[i]} ${ans}`)
              .setStyle(i === q.correct ? ButtonStyle.Success : ButtonStyle.Secondary)
              .setDisabled(true)
          );
        });
        await msg.edit({
          embeds: [embed({
            title: '⏰ Time\'s Up!',
            description: `Correct answer: **${letters[q.correct]} ${q.a[q.correct]}**`,
            color: '#FF6B6B',
          })],
          components: [disabledRow],
        }).catch(() => {});
      }, 15000);
    }

    // ═══ FUNFACT ═══
    else if (cmd === 'funfact') {
      await interaction.reply({
        embeds: [embed({
          title: '🧠 Random Fun Fact',
          description: pickRandom(FUN_FACTS),
          color: '#F39C12',
          footer: { text: '💡 Mind = Blown' },
        })],
      });
    }

    // ═══ QUOTE ═══
    else if (cmd === 'quote') {
      await interaction.reply({
        embeds: [embed({
          title: '💫 Motivational Quote',
          description: pickRandom(QUOTES),
          color: '#E91E63',
        })],
      });
    }

    // ═══ COINFLIP ═══
    else if (cmd === 'coinflip') {
      await interaction.reply({
        embeds: [embed({ title: '🪙 Flipping...', color: '#FFD700' })],
      });
      await sleep(800);
      const result = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
      const emoji = result === 'HEADS' ? '👑' : '🦅';
      await interaction.editReply({
        embeds: [embed({
          title: `${emoji} ${result}!`,
          description: `Coin landed on **${result}**!`,
          color: result === 'HEADS' ? '#FFD700' : '#C0C0C0',
        })],
      });
    }

    // ═══ DICE ═══
    else if (cmd === 'dice') {
      const sides = interaction.options.getInteger('sides') || 6;
      await interaction.reply({
        embeds: [embed({ title: '🎲 Rolling...', color: '#3498DB' })],
      });
      await sleep(600);
      const roll = randomInt(1, sides);
      await interaction.editReply({
        embeds: [embed({
          title: `🎲 You rolled a ${roll}!`,
          description: `**d${sides}** → **${roll}**`,
          color: roll === sides ? '#00FF00' : '#3498DB',
        })],
      });
    }

    // ═══ 8BALL ═══
    else if (cmd === '8ball') {
      const q = interaction.options.getString('question');
      await interaction.reply({
        embeds: [embed({ title: '🎱 Shaking...', color: '#9B59B6' })],
      });
      await sleep(800);
      await interaction.editReply({
        embeds: [embed({
          title: '🎱 Magic 8-Ball',
          description: `**Q:** ${q}\n\n**A:** ${pickRandom(EIGHTBALL)}`,
          color: '#9B59B6',
        })],
      });
    }

    // ═══ HUG ═══
    else if (cmd === 'hug') {
      const target = interaction.options.getUser('user');
      const msg = pickRandom(HUG_MSGS)
        .replace('{a}', `<@${interaction.user.id}>`)
        .replace('{b}', `<@${target.id}>`);
      await interaction.reply({
        embeds: [embed({ title: '🤗 Hug!', description: msg, color: '#FF69B4' })],
      });
    }

    // ═══ WAVE ═══
    else if (cmd === 'wave') {
      const target = interaction.options.getUser('user');
      const msg = pickRandom(WAVE_MSGS)
        .replace('{a}', `<@${interaction.user.id}>`)
        .replace('{b}', `<@${target.id}>`);
      await interaction.reply({
        embeds: [embed({ title: '👋 Wave!', description: msg, color: '#00BCD4' })],
      });
    }

    // ═══ HIGHFIVE ═══
    else if (cmd === 'highfive') {
      const target = interaction.options.getUser('user');
      const msg = pickRandom(HIGHFIVE_MSGS)
        .replace('{a}', `<@${interaction.user.id}>`)
        .replace('{b}', `<@${target.id}>`);
      await interaction.reply({
        embeds: [embed({ title: '🙌 High-Five!', description: msg, color: '#FF9800' })],
      });
    }

    // ═══ NACTIVE ═══
    else if (cmd === 'nactive') {
      await interaction.deferReply();
      const gid = interaction.guild.id;
      const now = Date.now();
      const threshold = CONFIG.INACTIVE_DAYS * 86400000;
      const act = DB.activity[gid] || {};
      const members = await interaction.guild.members.fetch();

      const inactive = [];
      members.forEach(m => {
        if (m.user.bot) return;
        const last = act[m.id];
        if (!last || (now - last) > threshold) inactive.push({ member: m, last });
      });

      if (!inactive.length) {
        return interaction.editReply({
          embeds: [embed({
            title: '✅ No Inactive Members',
            description: `Everyone active in last **${CONFIG.INACTIVE_DAYS} days**!`,
            color: '#00FF00',
          })],
        });
      }

      inactive.sort((a, b) => (a.last || 0) - (b.last || 0));
      const list = inactive.slice(0, 20).map(i =>
        `<@${i.member.id}> — ${i.last ? `<t:${Math.floor(i.last / 1000)}:R>` : 'Never'}`
      ).join('\n');

      await interaction.editReply({
        embeds: [embed({
          title: `💤 Inactive Members (${inactive.length})`,
          description: `Inactive for **${CONFIG.INACTIVE_DAYS}+ days**:\n\n${list}`,
          color: '#FFA500',
        })],
      });
    }

    // ═══ RESET ACTIVITY ═══
    else if (cmd === 'resetactivity') {
      const target = interaction.options.getUser('user');
      const gid = interaction.guild.id;
      if (!DB.activity[gid]) DB.activity[gid] = {};
      DB.activity[gid][target.id] = Date.now();
      getUser(target.id).lastActivity = Date.now();
      saveDB();
      await interaction.reply({
        embeds: [embed({
          title: '🔄 Activity Reset',
          description: `Reset for **${target.username}**.`,
          color: '#00FF00',
        })],
      });
    }

    // ═══ SET INACTIVE ═══
    else if (cmd === 'setinactive') {
      const target = interaction.options.getUser('user');
      const gid = interaction.guild.id;
      if (!DB.activity[gid]) DB.activity[gid] = {};
      DB.activity[gid][target.id] = Date.now() - (CONFIG.INACTIVE_DAYS + 1) * 86400000;
      saveDB();
      await interaction.reply({
        embeds: [embed({
          title: '💤 Marked Inactive',
          description: `**${target.username}** marked as inactive.`,
          color: '#FFA500',
        })],
      });
    }

    // ═══ WARN ═══
    else if (cmd === 'warn') {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason';
      const u = getUser(target.id);
      u.warnings = (u.warnings || 0) + 1;
      saveDB();

      await interaction.reply({
        embeds: [embed({
          title: '⚠️ User Warned',
          description: `<@${target.id}> warned!\n**Reason:** ${reason}\n**Total:** ${u.warnings}`,
          color: '#FF6B6B',
          thumbnail: target.displayAvatarURL({ dynamic: true }),
        })],
      });

      target.send({
        embeds: [embed({
          title: '⚠️ Warning!',
          description: `**Server:** ${interaction.guild.name}\n**Reason:** ${reason}\n**Total:** ${u.warnings}`,
          color: '#FF6B6B',
        })],
      }).catch(() => {});
    }

    // ═══ WARNINGS ═══
    else if (cmd === 'warnings') {
      const target = interaction.options.getUser('user');
      const u = getUser(target.id);
      await interaction.reply({
        embeds: [embed({
          title: `⚠️ ${target.username}'s Warnings`,
          description: `**Total:** ${u.warnings || 0}`,
          color: u.warnings > 0 ? '#FF6B6B' : '#00FF00',
        })],
      });
    }

    // ═══ TOGGLE KICK ═══
    else if (cmd === 'togglekick') {
      const gid = interaction.guild.id;
      if (!DB.settings[gid]) DB.settings[gid] = { autoKick: CONFIG.AUTO_KICK };
      DB.settings[gid].autoKick = !DB.settings[gid].autoKick;
      saveDB();
      const state = DB.settings[gid].autoKick;
      await interaction.reply({
        embeds: [embed({
          title: `${state ? '✅' : '❌'} Auto-Kick ${state ? 'ON' : 'OFF'}`,
          description: state ? `Kick after ${CONFIG.KICK_DAYS} days.` : 'Disabled.',
          color: state ? '#00FF00' : '#FF6B6B',
        })],
      });
    }

    // ═══ ANNOUNCE ═══
    else if (cmd === 'announce') {
      const message = interaction.options.getString('message');
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      await channel.send({
        embeds: [embed({
          title: '📢 ANNOUNCEMENT',
          description: message,
          color: '#FFD700',
          author: {
            name: interaction.user.username,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
          },
        })],
      });

      await interaction.reply({
        embeds: [embed({
          title: '✅ Sent!',
          description: `Posted in ${channel}.`,
          color: '#00FF00',
        })],
        ephemeral: true,
      });
    }

    // ═══ SERVER INFO ═══
    else if (cmd === 'serverinfo') {
      const g = interaction.guild;
      const owner = await g.fetchOwner();
      await interaction.reply({
        embeds: [embed({
          title: `🏰 ${g.name}`,
          thumbnail: g.iconURL({ dynamic: true }),
          fields: [
            { name: '🆔 ID', value: `\`${g.id}\``, inline: true },
            { name: '👑 Owner', value: owner.user.tag, inline: true },
            { name: '📅 Created', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '👥 Members', value: `\`${g.memberCount}\``, inline: true },
            { name: '💬 Channels', value: `\`${g.channels.cache.size}\``, inline: true },
            { name: '🎭 Roles', value: `\`${g.roles.cache.size}\``, inline: true },
          ],
        })],
      });
    }

    // ═══ BOT INFO ═══
    else if (cmd === 'botinfo') {
      const uptime = process.uptime();
      const d = Math.floor(uptime / 86400);
      const h = Math.floor((uptime % 86400) / 3600);
      const m = Math.floor((uptime % 3600) / 60);
      const s = Math.floor(uptime % 60);
      const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

      await interaction.reply({
        embeds: [embed({
          title: `🤖 ${CONFIG.BOT_NAME}`,
          thumbnail: client.user.displayAvatarURL({ dynamic: true }),
          fields: [
            { name: '⏱️ Uptime', value: `\`${d}d ${h}h ${m}m ${s}s\``, inline: true },
            { name: '🌐 Servers', value: `\`${client.guilds.cache.size}\``, inline: true },
            { name: '👥 Users', value: `\`${client.users.cache.size}\``, inline: true },
            { name: '📡 Ping', value: `\`${client.ws.ping}ms\``, inline: true },
            { name: '💾 Memory', value: `\`${memMB} MB\``, inline: true },
            { name: '📚 Commands', value: `\`${commands.length}\``, inline: true },
          ],
        })],
      });
    }

    // ═══ LEADERBOARD ═══
    else if (cmd === 'leaderboard') {
      const sorted = Object.entries(DB.users)
        .map(([id, data]) => ({ id, coins: data.coins || 0, level: data.level || 1 }))
        .sort((a, b) => b.coins - a.coins)
        .slice(0, 10);

      const medals = ['🥇', '🥈', '🥉'];
      const list = sorted.map((u, i) => {
        const medal = medals[i] || `**${i + 1}.**`;
        return `${medal} <@${u.id}> — 🪙 **${u.coins}** • ⭐ ${u.level}`;
      }).join('\n') || 'No data yet!';

      await interaction.reply({
        embeds: [embed({
          title: '🏆 Coin Leaderboard',
          description: list,
          color: '#FFD700',
        })],
      });
    }

    // ═══ HELP ═══
    else if (cmd === 'help') {
      await interaction.reply({
        embeds: [embed({
          title: `📖 ${CONFIG.BOT_NAME} — Commands`,
          description: 'Everything you need!',
          fields: [
            { name: '💰 Economy', value: '`/daily` `/balance` `/profile` `/leaderboard`' },
            { name: '🎮 Fun', value: '`/trivia` `/funfact` `/quote` `/coinflip` `/dice` `/8ball`' },
            { name: '🤝 Social', value: '`/hug` `/wave` `/highfive`' },
            { name: '📊 Activity', value: '`/nactive` `/resetactivity` `/setinactive` `/togglekick`' },
            { name: '🛡️ Moderation', value: '`/warn` `/warnings` `/announce`' },
            { name: 'ℹ️ Info', value: '`/serverinfo` `/botinfo` `/help`' },
          ],
          footer: { text: `${CONFIG.BOT_FOOTER} • Prefix: ${CONFIG.PREFIX}` },
        })],
      });
    }

  } catch (err) {
    console.error('❌ INTERACTION ERROR:');
    console.error('Command:', interaction.commandName);
    console.error('Error:', err);
    console.error('Stack:', err.stack);

    const errMsg = { content: `❌ Error: \`${err.message}\``, ephemeral: true };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errMsg);
      } else {
        await interaction.reply(errMsg);
      }
    } catch {}
  }
});

// ═══════════════ BUTTON HANDLER ═══════════════
async function handleButton(interaction) {
  if (!interaction.customId.startsWith('trivia_')) return;

  const parts = interaction.customId.split('_');
  const sessionId = parts[1];
  const idx = parseInt(parts[2]);
  const session = client.triviaSessions?.[sessionId];

  if (!session) {
    return interaction.reply({ content: '⏰ Trivia expired!', ephemeral: true });
  }
  if (session.answered) {
    return interaction.reply({ content: '❌ Already answered!', ephemeral: true });
  }
  if (interaction.user.id !== session.userId) {
    return interaction.reply({ content: '❌ Not your trivia!', ephemeral: true });
  }

  session.answered = true;
  const isCorrect = idx === session.correct;
  const q = session.q;

  if (isCorrect) {
    addCoins(interaction.user.id, 100);
    addXP(interaction.user.id, 50);
    saveDB();
    await interaction.update({
      embeds: [embed({
        title: '✅ CORRECT!',
        description: `+100 coins 🪙 +50 XP!`,
        color: '#00FF00',
      })],
      components: [],
    });
  } else {
    await interaction.update({
      embeds: [embed({
        title: '❌ WRONG!',
        description: `Correct: **${q.a[q.correct]}**`,
        color: '#FF0000',
      })],
      components: [],
    });
  }
  delete client.triviaSessions[sessionId];
}

// ═══════════════ AUTO-KICK LOOP ═══════════════
setInterval(async () => {
  for (const guild of client.guilds.cache.values()) {
    const settings = DB.settings[guild.id];
    if (!settings || !settings.autoKick) continue;

    try {
      const members = await guild.members.fetch();
      const now = Date.now();
      const threshold = CONFIG.KICK_DAYS * 86400000;
      const act = DB.activity[guild.id] || {};

      for (const m of members.values()) {
        if (m.user.bot || m.id === guild.ownerId) continue;
        const last = act[m.id];
        if (last && (now - last) > threshold) {
          await m.kick(`Inactive ${CONFIG.KICK_DAYS}+ days`).catch(() => {});
        }
      }
    } catch {}
  }
}, 3600000);

// ═══════════════ SAVE ON EXIT ═══════════════
process.on('SIGINT', () => { saveDB(); console.log('\n💾 Saved. Bye!'); process.exit(0); });
process.on('SIGTERM', () => { saveDB(); process.exit(0); });
setInterval(saveDB, 300000);

// ═══════════════ LOGIN ═══════════════
client.login(CONFIG.TOKEN).catch(err => {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
});
