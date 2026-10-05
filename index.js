const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

const BOT_TOKEN = `${process.env.BOT_TOKEN}`;
const bot = new TelegramBot(BOT_TOKEN, {polling: true});

require('./commands/transactions')(bot);
let currency = "${process.env.CURRENCY}" == "EUR" ? "€" : "$";

const databaseUrl = `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = new Client({
  connectionString: databaseUrl,
});

client.connect((err) => {
  if (err) {
    console.error('Error connecting to Postgres:', err);
  } else {
    console.log('PG connection established');
  }
});

app.listen(3000, () => {
  console.log(`Webhook server is listening on port 3000`);
});

// Handle POST requests to the /webhook route
app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Create a button to run the /start command
const startButton = {
  text: 'START BOT',
  callback_data: '/start',
};

// Create a keyboard with the start button
const keyboard = {
  inline_keyboard: [
    [startButton],
  ],
};

// Handle the button click event
bot.on('callback_query', (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const command = callbackQuery.data;

  if (command === '/start') {
    bot.sendMessage(chatId, 'Starting bot...');
    bot.sendChatAction(chatId, 'typing');
    bot.emit('text', message);
  }
});

// Send the keyboard with the start button to the user
bot.onText(/\/keyboard/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Here is your keyboard!', {
    reply_markup: keyboard,
  });
});

// Get list of transactions by express
bot.onText(/\/last/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const result = await client.query(
      `SELECT type, category, amount, TO_CHAR(date_of_transaction, 'YY/MM/DD HH24:MI:SS') as formatted_date 
      FROM budget
      WHERE date_of_transaction >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY formatted_date, category, type, amount`
    );
    const budget = result.rows;
    let transactionsList = 'The list of transactions:\n\n';
    budget.forEach((row) => {
      transactionsList += `${row.formatted_date} | ${row.type} | ${row.category} | ${row.amount}\n`;
    });
    bot.sendMessage(chatId, transactionsList);
    console.log(`User ID: ${userId}`);
  } catch (error) {
      console.error(error);
  }
});

// Show current budget
bot.onText(/\/budget/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const result = await client.query(
      `SELECT category, SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as Planned,
      SUM(CASE WHEN type = 'spending' THEN amount ELSE 0 END) as spent,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - SUM(CASE WHEN type = 'spending' THEN amount ELSE 0 END) as balance
      FROM budget
      GROUP BY category
      HAVING SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - SUM(CASE WHEN type = 'spending' THEN amount ELSE 0 END) >= 0;`
    );
    const budget = result.rows;
    let curr = currency;
    let budgetReport = 'Текущий бюджет:\n\n';
    budget.forEach((row) => {
      budgetReport += `${row.category}: ${curr}${row.balance} \n`;
    });
    bot.sendMessage(chatId, budgetReport);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, 'An error occurred while retrieving the budget. Please try again later.');
  }
});

// Add a new transaction
bot.onText(/\/add/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Что бы Вы хотели добавить? (income || spending)');
  bot.once('message', (msg) => {
    const transactionType = msg.text.toLowerCase();
    if (transactionType !== 'income' && transactionType !== 'spending') {
      bot.sendMessage(chatId, 'Invalid transaction type. Please try again.');
    } else {
      bot.sendMessage(chatId, 'What is the amount of the transaction?');
      bot.once('message', (msg) => {
        const amount = parseFloat(msg.text);
        if (isNaN(amount) && amount<=0) {
          bot.sendMessage(chatId, 'Invalid amount. Please try again.');
        } else {
          bot.sendMessage(chatId, `What category does this ${transactionType} belong to?`);
          bot.once('message', async (msg) => {
            const category = msg.text;
            try {
              const result = await client.query(`
                INSERT INTO budget (category, type, amount)
                VALUES ($1, $2, $3)`,
                [category, transactionType, amount]);
                bot.sendMessage(chatId, `${transactionType} added successfully.`);
                console.log(result);
            } catch (err) {
                console.error(err);
                bot.sendMessage(chatId, `Transaction failed to add. Please try again.`);
            }
          });
        }
      });
    }
  });
});

// List of incomes and spendings
bot.onText(/\/list (income|spending)/, (msg, match) => {
  const chatId = msg.chat.id;
  const type = match[1];
  const query = `SELECT category, SUM(amount) as amount FROM budget WHERE type = $1 AND amount > 1 GROUP BY category`;
  client.query(query, [type])
    .then((result) => {
      const rows = result.rows;
      let response = `${type} categories and amounts:\n\n`;
      for (const row of rows) {
        response += `${row.category}: ${currency}${row.amount}\n`;
      }
      bot.sendMessage(chatId, response);
      console.log(msg.from.id);
    })
    .catch((error) => {
      console.error(error);
      bot.sendMessage(chatId, 'An error occured while listing the transactions.');
  });
});

// Update category ?
bot.onText(/\/update/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'What is the category of the transaction you would like to update?');
  bot.once('message', async (msg) => {
    const category = msg.text;
    try {
      const result = await client.query('SELECT * FROM budget WHERE category = $1', [category]);
    
      if (!result.rows.length) {
        bot.sendMessage(chatId, 'This category does not exist.');
        return;
      }
    
      const budget = result.rows[0];
      bot.sendMessage(chatId,
        `${category} income: ${budget.income}\n` +
        `${category} spending: ${budget.spending}\n` +
        `Enter the new income for ${category}:`);
    
      bot.once('message', async (msg) => {
        const income = parseFloat(msg.text);
    
        bot.sendMessage(chatId, `Enter the new spending for ${category}:`);
    
        bot.once('message', async (msg) => {
          const spending = parseFloat(msg.text);
    
          try {
            await client.query(
              `UPDATE budget
              SET income = $1, spending = $2
              WHERE category = $3`
            , [income, spending, category]);
    
            bot.sendMessage(chatId, `${category} has been updated.\n` +
              `New income: ${income}\n` +
              `New spending: ${spending}`);
          } catch (error) {
            console.error(error);
            bot.sendMessage(chatId, 'An error occurred while updating the budget. Please try again later.');
          }
        });
      });
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, 'An error occurred while updating the budget. Please try again later.');
    }
  });
});

// Delete
bot.onText(/\/delete (\w+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const category = match[1];
  try {
    const result = await client.query(`DELETE FROM budget WHERE category = $1`, [category]);
    if (result.rowCount === 0) {
      bot.sendMessage(chatId, `The category "${category}" does not exist in the system.`);
    } else {
      bot.sendMessage(chatId, `The category "${category}" has been deleted from the system.`);
    }
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, 'An error occurred while deleting the category. Please try again later.');
  }
});
