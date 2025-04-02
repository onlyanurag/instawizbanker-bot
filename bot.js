require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { Low, JSONFile } = require("lowdb");
const adapter = new JSONFile("db.json");
const db = new Low(adapter);


const bot = new TelegramBot('7551117225:AAG3hPbbu0nP7lgVx0wMkqM34A77bh1xeGc', { polling: true });

// Your other bot code goes here

async function initDB() {
  await db.read();
  db.data ||= { users: {}, guilds: {}, stocks: 100, jackpot: 0, shopItems: [{ name: 'Magic Wand', price: 100, id: 1 }] };
  await db.write();
}
initDB();

function getUser(userId) {
  return db.data.users[userId] || { coins: 0, bank: 0, stocks: 0, items: [], streak: 0 };
}

async function updateUser(userId, data) {
  db.data.users[userId] = { ...getUser(userId), ...data };
  await db.write();
}

bot.on("message", async (msg) => {
  const user = getUser(msg.from.id);
  user.coins += 1;
  await updateUser(msg.from.id, user);
});

bot.onText(/\/balance/, async (msg) => {
  const user = getUser(msg.from.id);
  bot.sendMessage(msg.chat.id, `💰 Balance: ${user.coins} Wiz Coins | 🏦 Bank: ${user.bank} Wiz Coins`);
});

bot.onText(/\/daily/, async (msg) => {
  const user = getUser(msg.from.id);
  const now = Date.now();
  
  if (user.lastDaily && now - user.lastDaily < 24 * 60 * 60 * 1000) {
    const remainingTime = Math.ceil((24 * 60 * 60 * 1000 - (now - user.lastDaily)) / (60 * 60 * 1000));
    bot.sendMessage(msg.chat.id, `❌ You've already claimed your daily reward! Try again in ${remainingTime} hours.`);
  } else {
    user.coins += 10;
    user.streak += 1;
    user.lastDaily = now; // Store the claim time
    await updateUser(msg.from.id, user);
    bot.sendMessage(msg.chat.id, `🎁 You claimed your daily 10 Wiz Coins! Streak: ${user.streak} days.`);
  }
});

bot.onText(/\/bank deposit (\d+)/, async (msg, match) => {
  const amount = parseInt(match[1]);
  const user = getUser(msg.from.id);
  if (user.coins >= amount) {
    user.coins -= amount;
    user.bank += amount;
    await updateUser(msg.from.id, user);
    bot.sendMessage(msg.chat.id, `🏦 Deposited ${amount} Wiz Coins to the bank.`);
  } else {
    bot.sendMessage(msg.chat.id, `❌ Not enough Wiz Coins.`);
  }
});

bot.onText(/\/bank withdraw (\d+)/, async (msg, match) => {
  const amount = parseInt(match[1]);
  const user = getUser(msg.from.id);
  if (user.bank >= amount) {
    user.bank -= amount;
    user.coins += amount;
    await updateUser(msg.from.id, user);
    bot.sendMessage(msg.chat.id, `🏦 Withdrawn ${amount} Wiz Coins from the bank.`);
  } else {
    bot.sendMessage(msg.chat.id, `❌ Not enough balance in bank.`);
  }
});

// Function to calculate stock price based on group members
async function updateStockPrice(chatId) {
  try {
    const chatMembers = await bot.getChatMembersCount(chatId); // Get total members
    db.data.stocks = Math.max(1, Math.floor(chatMembers * 1.5)); // Set stock price (1.5 coins per member)
    await db.write();
  } catch (err) {
    console.error("Error fetching member count:", err);
  }
}

// 📈 Check Stock Price
bot.onText(/\/stock price/, async (msg) => {
  await updateStockPrice(msg.chat.id);
  bot.sendMessage(msg.chat.id, `📊 Current Stock Price: ${db.data.stocks} Wiz Coins per share.`);
});

// 🛒 Buy Stocks
bot.onText(/\/stock buy (\d+)/, async (msg, match) => {
  const user = getUser(msg.from.id);
  const amount = parseInt(match[1]);

  if (user.coins >= db.data.stocks * amount) {
    user.coins -= db.data.stocks * amount;
    user.stocks += amount;
    await updateUser(msg.from.id, user);
    bot.sendMessage(msg.chat.id, `✅ You bought ${amount} stocks for ${db.data.stocks * amount} Wiz Coins.`);
  } else {
    bot.sendMessage(msg.chat.id, `❌ You don't have enough Wiz Coins to buy ${amount} stocks.`);
  }
});

// 💰 Sell Stocks
bot.onText(/\/stock sell (\d+)/, async (msg, match) => {
  const user = getUser(msg.from.id);
  const amount = parseInt(match[1]);

  if (user.stocks >= amount) {
    user.stocks -= amount;
    user.coins += db.data.stocks * amount;
    await updateUser(msg.from.id, user);
    bot.sendMessage(msg.chat.id, `💵 You sold ${amount} stocks for ${db.data.stocks * amount} Wiz Coins.`);
  } else {
    bot.sendMessage(msg.chat.id, `❌ You don't have enough stocks to sell.`);
  }
});

// 🔧 Admin Command: Set Stock Price Manually
bot.onText(/\/admin setstock (\d+)/, async (msg, match) => {
  if (msg.from.id === 5320958997) { // Only the admin can use this
    const newPrice = parseInt(match[1]);
    db.data.stocks = newPrice;
    await db.write();
    bot.sendMessage(msg.chat.id, `🔧 Admin set the stock price to ${newPrice} Wiz Coins.`);
  } else {
    bot.sendMessage(msg.chat.id, `❌ You are not authorized to use this command.`);
  }
});

// 🏢 Auto-Update Stock Price When Members Join or Leave
bot.on("new_chat_members", async (msg) => {
  await updateStockPrice(msg.chat.id);
  bot.sendMessage(msg.chat.id, `📈 New member joined! Stock price updated: ${db.data.stocks} Wiz Coins.`);
});

bot.on("left_chat_member", async (msg) => {
  await updateStockPrice(msg.chat.id);
  bot.sendMessage(msg.chat.id, `📉 A member left! Stock price updated: ${db.data.stocks} Wiz Coins.`);
});

bot.onText(/\/lottery buy/, async (msg) => {
  const user = getUser(msg.from.id);
  if (user.coins >= 50) {
    user.coins -= 50;
    db.data.jackpot += 50;
    await updateUser(msg.from.id, user);
    await db.write();
    bot.sendMessage(msg.chat.id, `🎟 Bought a lottery ticket! Jackpot: ${db.data.jackpot} Wiz Coins.`);
  } else {
    bot.sendMessage(msg.chat.id, `❌ Not enough Wiz Coins.`);
  }
});

const adminId = 5320958997; // Replace with actual admin ID

bot.onText(/\/workwithadmin/, async (msg) => {
  const userId = msg.from.id;
  
  // Check if the user is the admin
  if (userId === adminId) {
    bot.sendMessage(msg.chat.id, `⚠️ You cannot use this command yourself!`);
    return;
  }

  // Check if the user has already worked with the admin
  const user = getUser(userId);
  if (user.hasWorkedWithAdmin) {
    bot.sendMessage(msg.chat.id, `❌ You have already worked with the admin and received your 1000 Wiz Coins!`);
    return;
  }

  // Ask the admin for confirmation
  bot.sendMessage(adminId, `🧑‍💼 User ${msg.from.first_name} is requesting to work with you and receive 1000 Wiz Coins. Reply with "Yes" to approve or "No" to decline.`);

  // Set a listener for the admin's response
  bot.once('message', async (adminMsg) => {
    // Only process the response if the admin is replying
    if (adminMsg.from.id === adminId) {
      const adminResponse = adminMsg.text.trim().toLowerCase();
      
      if (adminResponse === 'yes') {
        // Admin approves
        user.coins += 1000;
        user.hasWorkedWithAdmin = true;
        await updateUser(userId, user);

        bot.sendMessage(userId, `✅ Congratulations! You have been approved by the admin and received 1000 Wiz Coins.`);
        bot.sendMessage(adminId, `✅ You approved ${msg.from.first_name} to work with you.`);
      } else if (adminResponse === 'no') {
        // Admin declines
        bot.sendMessage(userId, `❌ The admin has declined your request.`);
        bot.sendMessage(adminId, `❌ You declined ${msg.from.first_name}'s request to work with you.`);
      } else {
        bot.sendMessage(adminId, `❌ Invalid response. Please reply with "Yes" or "No".`);
      }
    }
  });
});

bot.onText(/\/gamble (\d+)/, async (msg, match) => {
  const amount = parseInt(match[1]);
  const user = getUser(msg.from.id);
  if (user.coins >= amount) {
    const win = Math.random() < 0.5;
    user.coins += win ? amount : -amount;
    await updateUser(msg.from.id, user);
    bot.sendMessage(msg.chat.id, win ? `🎉 You won ${amount} Wiz Coins!` : `😢 You lost ${amount} Wiz Coins.`);
  } else {
    bot.sendMessage(msg.chat.id, `❌ Not enough Wiz Coins.`);
  }
});

// 📌 Guild System
bot.onText(/\/guild create (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  const guildName = match[1];

  // Check if the user already belongs to a guild
  const user = getUser(userId);
  if (user.guild) {
    bot.sendMessage(msg.chat.id, `❌ You are already a member of the guild "${user.guild}".`);
    return;
  }

  // Check if a guild with this name already exists
  if (db.data.guilds[guildName]) {
    bot.sendMessage(msg.chat.id, `❌ A guild with the name "${guildName}" already exists.`);
    return;
  }

  // Create a new guild and add the user as the first member
  db.data.guilds[guildName] = { name: guildName, members: [userId] };
  user.guild = guildName;
  await updateUser(userId, user);

  bot.sendMessage(msg.chat.id, `✅ You have created a new guild called "${guildName}" and are the first member.`);
  bot.sendMessage(userId, `✅ You are now the leader of the guild "${guildName}".`);
  await db.write();
});

bot.onText(/\/guild join (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  const guildName = match[1];

  // Check if the user is already in a guild
  const user = getUser(userId);
  if (user.guild) {
    bot.sendMessage(msg.chat.id, `❌ You are already a member of the guild "${user.guild}".`);
    return;
  }

  // Check if the guild exists
  const guild = db.data.guilds[guildName];
  if (!guild) {
    bot.sendMessage(msg.chat.id, `❌ The guild "${guildName}" does not exist.`);
    return;
  }

  // Add the user to the guild
  guild.members.push(userId);
  user.guild = guildName;
  await updateUser(userId, user);

  bot.sendMessage(msg.chat.id, `✅ You have successfully joined the guild "${guildName}".`);
  bot.sendMessage(guild.members[0], `📢 New member "${msg.from.first_name}" has joined your guild "${guildName}".`);
  await db.write();
});

bot.onText(/\/guild info/, async (msg) => {
  const userId = msg.from.id;
  const user = getUser(userId);

  if (!user.guild) {
    bot.sendMessage(msg.chat.id, `❌ You are not a member of any guild.`);
    return;
  }

  const guild = db.data.guilds[user.guild];
  bot.sendMessage(msg.chat.id, `📜 Guild Info:\nName: ${guild.name}\nMembers: ${guild.members.length}`);
});

bot.onText(/\/guild battle (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  const user = getUser(userId);
  const guildName = match[1];

  // Check if the user is in a guild
  if (!user.guild) {
    bot.sendMessage(msg.chat.id, `❌ You must be in a guild to initiate a battle.`);
    return;
  }

  // Check if the user is in the specified guild
  if (user.guild !== guildName) {
    bot.sendMessage(msg.chat.id, `❌ You are not a member of the guild "${guildName}".`);
    return;
  }

  // Check if the guild exists
  const guild = db.data.guilds[guildName];
  if (!guild) {
    bot.sendMessage(msg.chat.id, `❌ The guild "${guildName}" does not exist.`);
    return;
  }

  // Initiate guild battle (this is a placeholder for actual battle logic)
  bot.sendMessage(msg.chat.id, `⚔️ The guild "${guildName}" has initiated a battle! Awaiting opponents...`);

  // For now, we'll notify the guild members
  guild.members.forEach(memberId => {
    bot.sendMessage(memberId, `⚔️ The guild "${guildName}" is ready for battle!`);
  });
});

// 📌 Help Command - Display All Available Commands
bot.onText(/\/help/, (msg) => {
  const helpMessage = `
  📝 Here are all the available commands:

  General Commands:
  - /balance: Check your Wiz Coin balance.
  - /rank: Check your rank based on Wiz Coins.
  - /top: See the global leaderboard.
  - /daily: Claim your daily 10 Wiz Coins (24-hour cooldown).
  - /shop: View all items available for purchase in the shop.
  - /buy <item_id>: Buy an item from the shop.
  - /items: View the items you have purchased.

  Admin Commands:
  - /admin reset coins: Reset all users' coins.
  - /admin reset jackpot: Reset the jackpot.
  - /admin give <user_id> <amount>: Give unlimited coins to a user.
  - /admin set stock price <amount>: Set the stock price manually.

  Work With Admin:
  - /workwithadmin: Work with the admin and receive 1000 Wiz Coins upon confirmation from the admin.
  
  Stock Market:
  - /stock price: See the current stock price.
  - /stock buy <amount>: Buy stocks at the current price.
  - /stock sell <amount>: Sell your stocks at the current price.

  Guilds:
  - /guild create <guild_name>: Create a guild.
  - /guild join <guild_name>: Join a guild.
  - /guild battle <guild_name>: Initiate a guild battle.

  Betting System:
  - /bet <amount>: Place a bet with the admin or other users.
  - /coinflip <heads/tails> <amount>: Play a coinflip game.

  Jackpot:
  - /jackpot enter: Enter the jackpot and try to win coins.

  Note:
  - Admins have special commands to manage users' coins and other settings. 
  - All actions involving coins or items are logged and can be monitored by the admin.

  Use any of the above commands to interact with the bot! 🎮
  `;
  
  bot.sendMessage(msg.chat.id, helpMessage);
});

bot.onText(/\/admin reset/, async (msg) => {
  if (msg.from.id === 5320958997) {
    db.data.users = {};
    db.data.jackpot = 0;
    await db.write();
    bot.sendMessage(msg.chat.id, `✅ Economy reset successfully.`);
  } else {
    bot.sendMessage(msg.chat.id, `❌ You are not authorized.`);
  }
});
const botToken = process.env.BOT_TOKEN;
const port = process.env.PORT;
