const TelegramBot = require('node-telegram-bot-api');
const BOT_TOKEN = '5477850762:AAHFh8b7sZv_cFlWOyrf_D_AsKco8FPS5pE';
const bot = new TelegramBot(BOT_TOKEN, {polling: true});

let budget = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      keyboard: commands.map(c => [c.text]),
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
  bot.sendMessage(chatId, 'Welcome to the Gordievsky Expenses Bot!\n' +
    'You can add income by using the /add_income command.\n' +
    'You can add spending by using the /add_spending command.\n' +
    'To see your current budget, use the /budget command.', options);
});

bot.onText(/\/add_income/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'What is the category for the income?');
  
  bot.once('message', (incomeMsg) => {
    const category = incomeMsg.text;
    if (!budget[category]) {
      budget[category] = {
        income: 0,
        spending: 0
      };
    }
  
    bot.sendMessage(chatId, 'What is the amount for the income?');

    bot.once('message', (amountMsg) => {
      const amount = parseFloat(amountMsg.text);
      if (isNaN(amount)) {
        bot.sendMessage(chatId, 'Invalid amount. Please enter a number.');
        return;
      }
      budget[category].income += amount;
      bot.sendMessage(chatId, `${amount} has been added to your ${category} income.`);
    });
  });
});

bot.onText(/\/add_spending/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'What is the category for the spending?');

  bot.once('message', (spendingMsg) => {
    const category = spendingMsg.text;
    if (!budget[category]) {
      budget[category] = {
        income: 0,
        spending: 0
      };
    }
    bot.sendMessage(chatId, 'What is the amount for the spending?');

    bot.once('message', (amountMsg) => {
      const amount = parseFloat(amountMsg.text);
      budget[category].spending += amount;
      bot.sendMessage(chatId, `${amount} has been added to your ${category} spending.`);
    });
  });
});

bot.onText(/\/budget/, (msg) => {
  const chatId = msg.chat.id;
  let budgetReport = 'Budget Report\n\n';
  for (const category in budget) {
    budgetReport += `${category}: \n` +
    `Plánované: ${budget[category].income}\n` +
    `Skutočné: ${budget[category].spending}\n` +
    `Rozdiel: ${budget[category].income - budget[category].spending}\n\n`;
  }
  bot.sendMessage(chatId, budgetReport);
});
