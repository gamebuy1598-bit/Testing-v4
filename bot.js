// ═══════════════════════════════════════════════════════════════
//  🌟 ULTIMATE DISCORD BOT - SINGLE FILE EDITION
//  Features: Activity Tracking, Rewards, Economy, Fun, Moderation
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes,
  PermissionFlagsBits, ActivityType, Collection
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// ═══════════════ CONFIG FROM .env ═══════════════
const CONFIG = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  BOT_NAME: process.env.BOT_NAME || 'Ultimate Bot',
  BOT_COLOR: process.env.BOT_COLOR || '#5865F2',
  BOT_FOOTER: process.env.BOT_FOOTER || 'Powered by Ultimate Bot ✨',
  BOT_THUMBNAIL: process.env.BOT_THUMBNAIL || '',
  PREFIX: process.env.BOT_PREFIX || '!',
  DAILY_MIN: parseInt(process.env.DAILY_REWARD_MIN) || 50,
  DAILY_MAX: parseInt(process.env.DAILY_REWARD_MAX) || 200,
  DAILY_COOLDOWN: parseInt(process.env.DAILY_COOLDOWN_HOURS) || 24,
  INACTIVE_DAYS: parseInt(process.env.INACTIVE_DAYS) || 7,
  AUTO_KICK: process.env.AUTO_KICK_ENABLED === 'true',
  KICK_DAYS: parseInt(process.env.KICK_AFTER_DAYS) || 14,
  ANIMATIONS: process.env.ENABLE_ANIMATIONS !== 'false',
  ANIM_SPEED: parseInt(process.env.ANIMATION_SPEED) || 1500,
  ANNOUNCE_CH: process.env.ANNOUNCE_CHANNEL_ID || '',
  LOG_CH: process.env.LOG_CHANNEL_ID || '',
  WELCOME_CH: process.env.WELCOME_CHANNEL_ID || '',
};

// ═══════════════ DATA STORAGE (JSON file) ═══════════════
const DATA_FILE = path.join(__dirname, 'bot_data.json');
let DB = {
  users: {},          // { userId: { coins, lastDaily, lastActivity, streak, warnings, xp, level } }
  settings: {},       // { guildId: { autoKick } }
  activity: {},       // { guildId: { userId: lastMessageTimestamp } }
};

function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      DB = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (!DB.users) DB.users = {};
      if (!DB.settings) DB.settings = {};
      if (!DB.activity) DB.activity = {};
    }
  } catch (e) { console.error('DB Load Error:', e); }
}

function saveDB() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2)); }
  catch (e) { console.error('DB Save Error:', e); }
}

loadDB();

// ═══════════════ USER HELPERS ═══════════════
function getUser(id) {
  if (!DB.users[id]) {
    DB.users[id] = {
      coins: 0, lastDaily: 0, lastActivity: Date.now(),
      streak: 0, warnings: 0, xp: 0, level: 1, totalMessages: 0
    };
  }
  return DB.users[id];
}

function addCoins(id, amount) {
  const u = getUser(id);
  u.coins += amount;
  return u.coins;
}

function addXP(id, amount) {
  const u = getUser(id);
  u.xp += amount;
  const needed = u.level * 100;
  if (u.xp >= needed) {
    u.xp -= needed;
    u.level++;
    return true; // leveled up
  }
  return false;
}

// ═══════════════ UTILITIES ═══════════════
const sleep = ms => new Promise(r => setTimeout(r, ms));

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ═══════════════ EMBED BUILDER ═══════════════
function embed({ title, description, color, fields, thumbnail, image, footer, author, timestamp = true }) {
  const e = new EmbedBuilder()
    .setColor(color || CONFIG.BOT_COLOR)
    .setFooter({ text: footer || CONFIG.BOT_FOOTER, iconURL: CONFIG.BOT_THUMBNAIL || undefined });
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  if (fields) e.addFields(fields);
  if (thumbnail) e.setThumbnail(thumbnail);
  if (image) e.setImage(image);
  if (author) e.setAuthor(author);
  if (timestamp) e.setTimestamp();
  return e;
}

// ═══════════════ ANIMATED SEND ═══════════════
async function animatedSend(channel, embedData, frames = 3) {
  if (!CONFIG.ANIMATIONS) return channel.send({ embeds: [embedData] });

  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const msg = await channel.send({
    embeds: [embed({
      title: `${spinnerFrames[0]} Loading...`,
      description: 'Just a moment...',
      color: CONFIG.BOT_COLOR,
    })]
  });

  for (let i = 0; i < spinnerFrames.length; i++) {
    await sleep(80);
    try {
      await msg.edit({
        embeds: [embed({
          title: `${spinnerFrames[i]} Loading...`,
          description: 'Just a moment...',
          color: CONFIG.BOT_COLOR,
        })]
      });
    } catch {}
  }

  await msg.edit({ embeds: [embedData] });
  return msg;
}

// ═══════════════ PROGRESS BAR ═══════════════
function progressBar(current, max, size = 12) {
  const filled = Math.round((current / max) * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

// ═══════════════ RANDOM DATA ═══════════════
const FUN_FACTS = [
  '🐙 Octopuses have three hearts and blue blood!',
  '🍯 Honey never spoils. Archaeologists have found 3000-year-old honey in Egyptian tombs that is still edible!',
  '🌌 A day on Venus is longer than its year!',
  '🦈 Sharks existed before trees. They\'ve been around for over 400 million years!',
  '🧠 Your brain generates about 20 watts of electricity — enough to power a dim light bulb!',
  '🐝 A single bee can visit up to 5,000 flowers in a single day!',
  '🌊 The ocean covers 71% of Earth but we\'ve explored less than 5% of it!',
  '⚡ A bolt of lightning is 5 times hotter than the surface of the sun!',
  '🐌 Snails can sleep for up to 3 years!',
  '🎈 Bananas are berries, but strawberries aren\'t!',
  '🦋 Butterflies taste with their feet!',
  '🌙 The Moon is drifting away from Earth at about 3.8 cm per year!',
  '🐘 Elephants are the only animals that can\'t jump!',
  '🍎 Apples float in water because they\'re 25% air!',
  '🐜 Ants can lift 50 times their own body weight!',
];

const QUOTES = [
  '✨ "The only way to do great work is to love what you do." — Steve Jobs',
  '🔥 "Success is not final, failure is not fatal: it is the courage to continue that counts." — Winston Churchill',
  '💫 "Believe you can and you\'re halfway there." — Theodore Roosevelt',
  '🚀 "The future belongs to those who believe in the beauty of their dreams." — Eleanor Roosevelt',
  '💪 "Don\'t watch the clock; do what it does. Keep going." — Sam Levenson',
  '🌟 "Everything you\'ve ever wanted is on the other side of fear." — George Addair',
  '🌱 "The best time to plant a tree was 20 years ago. The second best time is now." — Chinese Proverb',
  '⚡ "Your limitation—it\'s only your imagination." — Unknown',
  '🎯 "Push yourself, because no one else is going to do it for you." — Unknown',
  '🏆 "Great things never come from comfort zones." — Unknown',
  '💎 "Dream it. Wish it. Do it." — Unknown',
  '🌈 "Success doesn\'t just find you. You have to go out and get it." — Unknown',
];

const TRIVIA = [
  { q: 'What is the capital of France?', a: ['Paris', 'London', 'Berlin', 'Madrid'], correct: 0 },
  { q: 'Which planet is known as the Red Planet?', a: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correct: 1 },
  { q: 'What is the largest ocean on Earth?', a: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correct: 3 },
  { q: 'Who painted the Mona Lisa?', a: ['Van Gogh', 'Picasso', 'Da Vinci', 'Michelangelo'], correct: 2 },
  { q: 'What is the chemical symbol for gold?', a: ['Go', 'Gd', 'Au', 'Ag'], correct: 2 },
  { q: 'How many continents are there?', a: ['5', '6', '7', '8'], correct: 2 },
  { q: 'What is the fastest land animal?', a: ['Lion', 'Cheetah', 'Tiger', 'Horse'], correct: 1 },
  { q: 'Which gas do plants absorb?', a: ['Oxygen', 'Nitrogen', 'CO2', 'Hydrogen'], correct: 2 },
  { q: 'How many sides does a hexagon have?', a: ['5', '6', '7', '8'], correct: 1 },
  { q: 'What is the smallest prime number?', a: ['0', '1', '2', '3'], correct: 2 },
];

const HUG_MSGS = [
  '🤗 **{a}** gives **{b}** a warm, cozy hug!',
  '💞 **{a}** wraps **{b}** in a big bear hug!',
  '🫂 **{a}** hugs **{b}** tightly!',
  '💖 **{a}** sends **{b}** a super soft hug!',
];

const WAVE_MSGS = [
  '👋 **{a}** waves at **{b}**!',
  '🌊 **{a}** waves happily to **{b}**!',
  '✋ **{a}** gives **{b}** a friendly wave!',
];

const HIGHFIVE_MSGS = [
  '🙌 **{a}** high-fives **{b}**! *SMACK!*',
  '✋💥 **{a}** and **{b}** high-five!',
  '🎉 **{a}** gives **{b}** an epic high-five!',
];

const EIGHTBALL = [
  '🎱 It is certain.', '🎱 Without a doubt.', '🎱 Yes — definitely.',
  '🎱 You may rely on it.', '🎱 Most likely.', '🎱 Outlook good.',
  '🎱 Signs point to yes.', '🎱 Reply hazy, try again.',
  '🎱 Ask again later.', '🎱 Cannot predict now.',
  '🎱 Don\'t count on it.', '🎱 My reply is no.',
  '🎱 Very doubtful.', '🎱 Outlook not so good.',
];

// ═══════════════ COMMANDS DEFINITION ═══════════════
const commands = [
  new SlashCommandBuilder().setName('daily').setDescription('Claim your daily reward!'),
  new SlashCommandBuilder().setName('balance').setDescription('Check your coin balance'),
  new SlashCommandBuilder().setName('profile').setDescription('View your profile')
    .addUserOption(o => o.setName('user').setDescription('User to view')),
  new SlashCommandBuilder().setName('trivia').setDescription('Play a trivia question!'),
  new SlashCommandBuilder().setName('funfact').setDescription('Get a random fun fact!'),
  new SlashCommandBuilder().setName('quote').setDescription('Get a motivational quote!'),
  new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin!'),
  new SlashCommandBuilder().setName('dice').setDescription('Roll a dice!')
    .addIntegerOption(o => o.setName('sides').setDescription('Number of sides (default 6)').setMinValue(2).setMaxValue(100)),
  new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball!')
    .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('hug').setDescription('Hug someone!')
    .addUserOption(o => o.setName('user').setDescription('User to hug').setRequired(true)),
  new SlashCommandBuilder().setName('wave').setDescription('Wave at someone!')
    .addUserOption(o => o.setName('user').setDescription('User to wave at').setRequired(true)),
  new SlashCommandBuilder().setName('highfive').setDescription('High-five someone!')
    .addUserOption(o => o.setName('user').setDescription('User to high-five').setRequired(true)),

  // Activity
  new SlashCommandBuilder().setName('nactive').setDescription('List inactive members'),
  new SlashCommandBuilder().setName('resetactivity').setDescription('Reset a user\'s activity')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('setinactive').setDescription('Set a user as inactive')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // Moderation
  new SlashCommandBuilder().setName('warn').setDescription('Warn a user')
    .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('warnings').setDescription('Check warnings for a user')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('togglekick').setDescription('Toggle auto-kick of inactive members')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('announce').setDescription('Send an announcement')
    .addStringOption(o => o.setName('message').setDescription('Message to announce').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Target channel'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // Info
  new SlashCommandBuilder().setName('serverinfo').setDescription('Server information'),
  new SlashCommandBuilder().setName('botinfo').setDescription('Bot information'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 richest users'),
  new SlashCommandBuilder().setName('help').setDescription('Show all commands'),
].map(c => c.toJSON());

// ═══════════════ CLIENT ═══════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
});

// ═══════════════ ACTIVITY TRACKING (on message) ═══════════════
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const uid = message.author.id;
  const gid = message.guild.id;
  const now = Date.now();

  if (!DB.activity[gid]) DB.activity[gid] = {};
  DB.activity[gid][uid] = now;

  const u = getUser(uid);
  u.lastActivity = now;
  u.totalMessages = (u.totalMessages || 0) + 1;

  // XP per message (random 5-15)
  const leveledUp = addXP(uid, randomInt(5, 15));

  if (leveledUp && CONFIG.ANIMATIONS) {
    try {
      const msg = await message.reply({
        embeds: [embed({
          title: '🎉 LEVEL UP!',
          description: `**${message.author.username}** reached **Level ${u.level}**!`,
          color: '#FFD700',
          thumbnail: message.author.displayAvatarURL({ dynamic: true }),
        })]
      });
      setTimeout(() => msg.delete().catch(() => {}), 8000);
    } catch {}
  }

  // Save periodically
  if (Math.random() < 0.05) saveDB();
});

// ═══════════════ READY EVENT ═══════════════
client.once('ready', async () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║  ✅ ${CONFIG.BOT_NAME} is ONLINE!`);
  console.log(`║  🤖 Logged in as: ${client.user.tag}`);
  console.log(`║  🌐 Servers: ${client.guilds.cache.size}`);
  console.log(`╚════════════════════════════════════════╝\n`);

  client.user.setPresence({
    activities: [{ name: '✨ /help for commands', type: ActivityType.Watching }],
    status: 'online',
  });

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  try {
    if (CONFIG.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: commands });
      console.log('✅ Slash commands registered (guild).');
    } else {
      await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: commands });
      console.log('✅ Slash commands registered (global).');
    }
  } catch (e) {
    console.error('❌ Command registration failed:', e);
  }
});

// ═══════════════ INTERACTION HANDLER ═══════════════
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) return handleButton(interaction);
    if (!interaction.isChatInputCommand()) return;

    const { commandName: cmd } = interaction;

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
            description: `You already claimed your daily reward!\n\n**Come back in:**\n\`${h}h ${m}m ${s}s\``,
            color: '#FF6B6B',
          })],
          ephemeral: true,
        });
      }

      // Streak check
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
            `💼 Total Balance: **${u.coins}** coins`,
          color: '#FFD700',
          thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
          footer: { text: `${CONFIG.BOT_FOOTER} • Streak: ${u.streak} 🔥` },
        })],
      });

      // Fire animation
      const anim = await interaction.followUp({ content: '🪙', ephemeral: false });
      const coins = ['🪙', '💰', '💵', '💎', '✨'];
      for (let i = 0; i < 5; i++) {
        await sleep(400);
        await anim.edit({ content: `${coins[i % coins.length]} +${Math.floor(total / 5) * (i + 1)}` });
      }
      await anim.edit({ content: `✨ **+${total} coins!** ✨` });
      setTimeout(() => anim.delete().catch(() => {}), 5000);
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
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
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
            { name: '📊 XP Progress', value: `${progressBar(u.xp, u.level * 100)} \`${u.xp}/${u.level * 100}\``, inline: false },
          ],
          color: CONFIG.BOT_COLOR,
        })],
      });
    }

    // ═══ TRIVIA ═══
    else if (cmd === 'trivia') {
      const q = pickRandom(TRIVIA);
      const row = new ActionRowBuilder();
      const letters = ['🇦', '🇧', '🇨', '🇩'];
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
          description: `**${q.q}**\n\n⏱️ You have **15 seconds** to answer!`,
          color: '#9B59B6',
          footer: { text: 'Choose your answer below!' },
        })],
        components: [row],
        fetchReply: true,
      });

      client.triviaSessions = client.triviaSessions || {};
      client.triviaSessions[interaction.id] = {
        correct: q.correct,
        userId: interaction.user.id,
        answered: false,
      };

      setTimeout(async () => {
        const session = client.triviaSessions?.[interaction.id];
        if (!session || session.answered) return;
        delete client.triviaSessions[interaction.id];
        const disabledRow = new ActionRowBuilder();
        q.a.forEach((ans, i) => {
          disabledRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`trivia_done_${i}`)
              .setLabel(`${letters[i]} ${ans}`)
              .setStyle(i === q.correct ? ButtonStyle.Success : ButtonStyle.Secondary)
              .setDisabled(true)
          );
        });
        await msg.edit({
          embeds: [embed({
            title: '⏰ Time\'s Up!',
            description: `Nobody answered!\n\n**Correct Answer:** ${letters[q.correct]} ${q.a[q.correct]}`,
            color: '#FF6B6B',
          })],
          components: [disabledRow],
        }).catch(() => {});
      }, 15000);
    }

    // ═══ FUN FACT ═══
    else if (cmd === 'funfact') {
      await animatedSend(interaction.channel, embed({
        title: '🧠 Random Fun Fact',
        description: pickRandom(FUN_FACTS),
        color: '#F39C12',
        footer: { text: '💡 Mind = Blown' },
      }));
      await interaction.reply({ content: '✅ Fun fact sent!', ephemeral: true });
    }

    // ═══ QUOTE ═══
    else if (cmd === 'quote') {
      await animatedSend(interaction.channel, embed({
        title: '💫 Motivational Quote',
        description: pickRandom(QUOTES),
        color: '#E91E63',
        footer: { text: '🌟 Stay motivated!' },
      }));
      await interaction.reply({ content: '✅ Quote sent!', ephemeral: true });
    }

    // ═══ COINFLIP ═══
    else if (cmd === 'coinflip') {
      await interaction.reply({
        embeds: [embed({ title: '🪙 Flipping...', description: '** **', color: '#FFD700' })],
      });
      const frames = ['🪙', '🌀', '💫', '✨'];
      for (let i = 0; i < 4; i++) {
        await sleep(400);
        await interaction.editReply({
          embeds: [embed({ title: `${frames[i]} Flipping...`, description: '** **', color: '#FFD700' })],
        });
      }
      const result = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
      const emoji = result === 'HEADS' ? '👑' : '🦅';
      await interaction.editReply({
        embeds: [embed({
          title: `${emoji} ${result}!`,
          description: `The coin landed on **${result}**!`,
          color: result === 'HEADS' ? '#FFD700' : '#C0C0C0',
        })],
      });
    }

    // ═══ DICE ═══
    else if (cmd === 'dice') {
      const sides = interaction.options.getInteger('sides') || 6;
      await interaction.reply({
        embeds: [embed({ title: '🎲 Rolling...', description: '** **', color: '#3498DB' })],
      });
      const diceFrames = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      for (let i = 0; i < 6; i++) {
        await sleep(150);
        await interaction.editReply({
          embeds: [embed({
            title: `🎲 ${diceFrames[i % 6]}`,
            description: `Rolling a **d${sides}**...`,
            color: '#3498DB',
          })],
        });
      }
      const roll = randomInt(1, sides);
      await interaction.editReply({
        embeds: [embed({
          title: `🎲 You rolled a ${roll}!`,
          description: `**d${sides}** → **${roll}**`,
          color: roll === sides ? '#00FF00' : '#3498DB',
          footer: { text: roll === sides ? '🎉 MAX ROLL!' : roll === 1 ? '😢 Minimum roll!' : '' },
        })],
      });
    }

    // ═══ 8BALL ═══
    else if (cmd === '8ball') {
      const q = interaction.options.getString('question');
      await interaction.reply({
        embeds: [embed({ title: '🎱 Shaking...', description: '** **', color: '#9B59B6' })],
      });
      await sleep(800);
      const ans = pickRandom(EIGHTBALL);
      await interaction.editReply({
        embeds: [embed({
          title: '🎱 Magic 8-Ball',
          description: `**Question:** ${q}\n\n**Answer:** ${ans}`,
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
        embeds: [embed({
          title: '🤗 Hug!',
          description: msg,
          color: '#FF69B4',
          image: 'https://media.tenor.com/8f0r1KKQ6k8AAAAC/hug-hugs.gif',
        })],
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
      const threshold = CONFIG.INACTIVE_DAYS * 24 * 60 * 60 * 1000;
      const act = DB.activity[gid] || {};

      const members = await interaction.guild.members.fetch();
      const inactive = [];

      members.forEach(m => {
        if (m.user.bot) return;
        const last = act[m.id];
        if (!last || (now - last) > threshold) inactive.push({ member: m, last });
      });

      if (inactive.length === 0) {
        return interaction.editReply({
          embeds: [embed({
            title: '✅ No Inactive Members',
            description: `Everyone has been active in the last **${CONFIG.INACTIVE_DAYS} days**! 🎉`,
            color: '#00FF00',
          })],
        });
      }

      inactive.sort((a, b) => (a.last || 0) - (b.last || 0));
      const list = inactive.slice(0, 20).map(i => {
        const time = i.last ? `<t:${Math.floor(i.last / 1000)}:R>` : 'Never';
        return `<@${i.member.id}> — ${time}`;
      }).join('\n');

      await interaction.editReply({
        embeds: [embed({
          title: `💤 Inactive Members (${inactive.length})`,
          description: `Inactive for **${CONFIG.INACTIVE_DAYS}+ days**:\n\n${list}${inactive.length > 20 ? `\n\n*...and ${inactive.length - 20} more*` : ''}`,
          color: '#FFA500',
          footer: { text: `Total inactive: ${inactive.length}` },
        })],
      });
    }

    // ═══ RESET ACTIVITY ═══
    else if (cmd === 'resetactivity') {
      const target = interaction.options.getUser('user');
      const gid = interaction.guild.id;
      if (!DB.activity[gid]) DB.activity[gid] = {};
      DB.activity[gid][target.id] = Date.now();
      const u = getUser(target.id);
      u.lastActivity = Date.now();
      saveDB();
      await interaction.reply({
        embeds: [embed({
          title: '🔄 Activity Reset',
          description: `Successfully reset activity for **${target.username}**.`,
          color: '#00FF00',
        })],
      });
    }

    // ═══ SET INACTIVE ═══
    else if (cmd === 'setinactive') {
      const target = interaction.options.getUser('user');
      const gid = interaction.guild.id;
      if (!DB.activity[gid]) DB.activity[gid] = {};
      DB.activity[gid][target.id] = Date.now() - (CONFIG.INACTIVE_DAYS + 1) * 24 * 60 * 60 * 1000;
      saveDB();
      await interaction.reply({
        embeds: [embed({
          title: '💤 Marked Inactive',
          description: `**${target.username}** has been marked as inactive.`,
          color: '#FFA500',
        })],
      });
    }

    // ═══ WARN ═══
    else if (cmd === 'warn') {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason specified';
      const u = getUser(target.id);
      u.warnings = (u.warnings || 0) + 1;
      saveDB();

      await interaction.reply({
        embeds: [embed({
          title: '⚠️ User Warned',
          description: `<@${target.id}> has been warned!\n\n**Reason:** ${reason}\n**Total Warnings:** ${u.warnings}`,
          color: '#FF6B6B',
          thumbnail: target.displayAvatarURL({ dynamic: true }),
        })],
      });

      try {
        await target.send({
          embeds: [embed({
            title: '⚠️ You have been warned!',
            description: `**Server:** ${interaction.guild.name}\n**Reason:** ${reason}\n**Total Warnings:** ${u.warnings}`,
            color: '#FF6B6B',
          })],
        });
      } catch {}
    }

    // ═══ WARNINGS ═══
    else if (cmd === 'warnings') {
      const target = interaction.options.getUser('user');
      const u = getUser(target.id);
      await interaction.reply({
        embeds: [embed({
          title: `⚠️ ${target.username}'s Warnings`,
          description: `**Total Warnings:** ${u.warnings || 0}`,
          color: u.warnings > 0 ? '#FF6B6B' : '#00FF00',
          thumbnail: target.displayAvatarURL({ dynamic: true }),
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
          title: `${state ? '✅' : '❌'} Auto-Kick ${state ? 'Enabled' : 'Disabled'}`,
          description: state
            ? `Inactive members will be auto-kicked after **${CONFIG.KICK_DAYS} days**.`
            : `Auto-kick has been disabled.`,
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
          footer: { text: `Announced in ${interaction.guild.name}` },
        })],
      });

      await interaction.reply({
        embeds: [embed({
          title: '✅ Announcement Sent',
          description: `Your announcement has been posted in ${channel}.`,
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
            { name: '👑 Owner', value: `${owner.user.tag}`, inline: true },
            { name: '📅 Created', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '👥 Members', value: `\`${g.memberCount}\``, inline: true },
            { name: '💬 Channels', value: `\`${g.channels.cache.size}\``, inline: true },
            { name: '🎭 Roles', value: `\`${g.roles.cache.size}\``, inline: true },
            { name: '😀 Emojis', value: `\`${g.emojis.cache.size}\``, inline: true },
            { name: '🚀 Boost Level', value: `\`Level ${g.premiumTier}\``, inline: true },
            { name: '💎 Boosts', value: `\`${g.premiumSubscriptionCount || 0}\``, inline: true },
          ],
          color: CONFIG.BOT_COLOR,
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

      const mem = process.memoryUsage();
      const memMB = (mem.heapUsed / 1024 / 1024).toFixed(2);

      await interaction.reply({
        embeds: [embed({
          title: `🤖 ${CONFIG.BOT_NAME}`,
          description: `Your all-in-one server management bot!`,
          thumbnail: client.user.displayAvatarURL({ dynamic: true }),
          fields: [
            { name: '⏱️ Uptime', value: `\`${d}d ${h}h ${m}m ${s}s\``, inline: true },
            { name: '🌐 Servers', value: `\`${client.guilds.cache.size}\``, inline: true },
            { name: '👥 Users', value: `\`${client.users.cache.size}\``, inline: true },
            { name: '📡 Ping', value: `\`${client.ws.ping}ms\``, inline: true },
            { name: '💾 Memory', value: `\`${memMB} MB\``, inline: true },
            { name: '📚 Commands', value: `\`${commands.length}\``, inline: true },
            { name: '📦 discord.js', value: `\`v14\``, inline: true },
            { name: '🟢 Node', value: `\`${process.version}\``, inline: true },
          ],
          color: CONFIG.BOT_COLOR,
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
        return `${medal} <@${u.id}> — 🪙 **${u.coins}** • ⭐ Lvl ${u.level}`;
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
          description: '**Everything you need to manage your server!**',
          fields: [
            { name: '💰 Economy', value: '`/daily` `/balance` `/profile` `/leaderboard`', inline: false },
            { name: '🎮 Fun', value: '`/trivia` `/funfact` `/quote` `/coinflip` `/dice` `/8ball`', inline: false },
            { name: '🤝 Social', value: '`/hug` `/wave` `/highfive`', inline: false },
            { name: '📊 Activity', value: '`/nactive` `/resetactivity` `/setinactive` `/togglekick`', inline: false },
            { name: '🛡️ Moderation', value: '`/warn` `/warnings` `/announce`', inline: false },
            { name: 'ℹ️ Info', value: '`/serverinfo` `/botinfo` `/help`', inline: false },
          ],
          color: CONFIG.BOT_COLOR,
          footer: { text: `${CONFIG.BOT_FOOTER} • Prefix commands also work!` },
        })],
      });
    }
  } catch (err) {
    console.error('Interaction Error:', err);
    if (interaction.replied || interaction.deferred) {
      interaction.followUp({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    } else {
      interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
  }
});

// ═══════════════ BUTTON HANDLER (Trivia) ═══════════════
async function handleButton(interaction) {
  if (!interaction.customId.startsWith('trivia_')) return;
  if (interaction.customId.startsWith('trivia_done')) return;

  const [, sessionId, idx] = interaction.customId.split('_');
  const session = client.triviaSessions?.[sessionId];
  if (!session) return interaction.reply({ content: '⏰ This trivia has expired!', ephemeral: true });
  if (session.answered) return interaction.reply({ content: '❌ Already answered!', ephemeral: true });
  if (interaction.user.id !== session.userId) {
    return interaction.reply({ content: '❌ Not your trivia!', ephemeral: true });
  }

  session.answered = true;
  const isCorrect = parseInt(idx) === session.correct;
  const q = TRIVIA.find(t => t.correct === session.correct);

  if (isCorrect) {
    addCoins(interaction.user.id, 100);
    addXP(interaction.user.id, 50);
    saveDB();
    await interaction.update({
      embeds: [embed({
        title: '✅ CORRECT!',
        description: `Great job! You earned **100 coins** 🪙 and **50 XP**!`,
        color: '#00FF00',
        footer: { text: '🧠 Big brain energy!' },
      })],
      components: [],
    });
  } else {
    await interaction.update({
      embeds: [embed({
        title: '❌ WRONG!',
        description: `The correct answer was: **${q.a[q.correct]}**`,
        color: '#FF0000',
        footer: { text: '💡 Better luck next time!' },
      })],
      components: [],
    });
  }
  delete client.triviaSessions[sessionId];
}

// ═══════════════ PREFIX COMMANDS (bonus) ═══════════════
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(CONFIG.PREFIX)) return;

  const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const prefixReplies = {
    ping: async () => {
      const sent = await message.reply('🏓 Pinging...');
      const ping = sent.createdTimestamp - message.createdTimestamp;
      sent.edit(`🏓 **Pong!**\n📡 Latency: \`${ping}ms\`\n💓 API: \`${client.ws.ping}ms\``);
    },
    hello: () => message.reply(`👋 Hello ${message.author.username}!`),
    help: () => message.reply(`Use \`/help\` for slash commands, or type \`${CONFIG.PREFIX}ping\`, \`${CONFIG.PREFIX}hello\``),
  };

  if (prefixReplies[cmd]) {
    try { await prefixReplies[cmd](); } catch {}
  }
});

// ═══════════════ AUTO-KICK LOOP ═══════════════
setInterval(async () => {
  for (const guild of client.guilds.cache.values()) {
    const settings = DB.settings[guild.id];
    if (!settings || !settings.autoKick) continue;

    try {
      const members = await guild.members.fetch();
      const now = Date.now();
      const threshold = CONFIG.KICK_DAYS * 24 * 60 * 60 * 1000;
      const act = DB.activity[guild.id] || {};

      for (const m of members.values()) {
        if (m.user.bot || m.id === guild.ownerId) continue;
        const last = act[m.id];
        if (last && (now - last) > threshold) {
          try {
            await m.kick(`Inactive for ${CONFIG.KICK_DAYS}+ days (auto-kick)`);
            console.log(`👢 Kicked ${m.user.tag} from ${guild.name}`);
          } catch {}
        }
      }
    } catch {}
  }
}, 60 * 60 * 1000); // every hour

// ═══════════════ WELCOME MESSAGES ═══════════════
client.on('guildMemberAdd', async (member) => {
  const chId = CONFIG.WELCOME_CH;
  if (!chId) return;
  const ch = member.guild.channels.cache.get(chId);
  if (!ch) return;

  try {
    await ch.send({
      embeds: [embed({
        title: '🎉 Welcome!',
        description: `Hey ${member}, welcome to **${member.guild.name}**!\n\nYou're member **#${member.guild.memberCount}**! 🎊`,
        color: '#00FF00',
        thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
        footer: { text: '✨ We\'re glad to have you!' },
      })],
    });
  } catch {}
});

// ═══════════════ SAVE DATA ON EXIT ═══════════════
process.on('SIGINT', () => { saveDB(); console.log('\n💾 Data saved. Bye!'); process.exit(0); });
process.on('SIGTERM', () => { saveDB(); process.exit(0); });
setInterval(saveDB, 5 * 60 * 1000); // autosave every 5 mins

// ═══════════════ LOGIN ═══════════════
if (!CONFIG.TOKEN) {
  console.error('❌ TOKEN missing in .env file!');
  process.exit(1);
}

client.login(CONFIG.TOKEN);
