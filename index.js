const functions = require("./commands/start");
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

const BOT_TOKEN = `${process.env.BOT_TOKEN}`;
const bot = new TelegramBot(BOT_TOKEN, {polling: true});

require('./commands/transactions')(bot);
const currency = "€";

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

// Start message
bot.onText(/\/start/, (msg) => {
  functions.start(bot, msg);
});

const allowedUserId = 746413249;
if (msg.from.id !== allowedUserId) {
  bot.sendMessage(chatId, "You don't have enough permissions to use this command.");
  return;
}

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
      HAVING SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - SUM(CASE WHEN type = 'spending' THEN amount ELSE 0 END) > 0;`
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
            await client.query(`
              UPDATE budget
              SET income = $1, spending = $2
              WHERE category = $3
            `, [income, spending, category]);
    
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

// Update an existing transaction
// bot.onText(/\/update (\d+) (income|spending) (\d+\.\d+) (\w+)/, async (msg, match) => {
//   const chatId = msg.chat.id;
//   const id = parseInt(match[1]);
//   const type = match[2];
//   const amount = parseFloat(match[3]);
//   const category = match[4];

//   try {
//     const result = await client.query(`
//       UPDATE budget
//       SET type = $2, amount = $3, category = $4
//       WHERE id = $1
//     `, [id, type, amount, category]);

//     if (result.rowCount === 0) {
//       bot.sendMessage(chatId, `Transaction with ID ${id} not found.`);
//       return;
//     }

//     bot.sendMessage(chatId, `Transaction with ID ${id} has been updated.`);
//   } catch (error) {
//       console.error(error);
//       bot.sendMessage(chatId, 'An error occurred while updating the transaction. Please try again later.');
//   }
// });
// bot.onText(/\/update/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(chatId, 'What is the category of the transaction you would like to update?');
//   bot.once('message', async (msg) => {
//     const category = msg.text;
//     try {
//       const result = await client.query(`SELECT id, category, type, amount FROM budget WHERE category = $1`, [category]);
//       if (result.rows.length === 0) {
//         bot.sendMessage(chatId, `No transactions found for category: ${category}. Please try again.`);
//       } else if (result.rows.length === 1) {
//         const transaction = result.rows[0];
//         bot.sendMessage(chatId, `What would you like to update for this transaction? (category, type, amount)`);
//         bot.once('message', async (msg) => {
//           const updateType = msg.text.toLowerCase();
//           if (updateType === 'category') {
//             bot.sendMessage(chatId, `What is the new category for this transaction?`);
//             bot.once('message', async (msg) => {
//               const newCategory = msg.text;
//               try {
//                 await client.query(`UPDATE budget SET category = $1 WHERE id = $2`, [newCategory, transaction.id]);
//                 bot.sendMessage(chatId, `Transaction updated successfully.`);
//               } catch (err) {
//                 console.error(err);
//                 bot.sendMessage(chatId, `Transaction failed to update. Please try again.`);
//               }
//             });
//           } else if (updateType === 'type') {
//               bot.sendMessage(chatId, `What is the new type for this transaction? (income or spending)`);
//               bot.once('message', async (msg) => {
//                 const newType = msg.text.toLowerCase();
//               //if (newType
//             });
//           }
//         });
//       }
//     } catch (err) {
//       console.error(err);
//       bot.sendMessage(chatId, `Transaction failed to update. Please try again.`);
//     }
//   });
// });
// Show the budget
// bot.onText(/\/budget/, async (msg) => {
//   const chatId = msg.chat.id;
//   try {
//     const result = await client.query(`
//       SELECT category, SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income, 
//       SUM(CASE WHEN type = 'spending' THEN amount ELSE 0 END) as total_spending, 
//       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - SUM(CASE WHEN type = 'spending' THEN amount ELSE 0 END) as balance 
//       FROM budget WHERE date_of_transaction >= DATE_TRUNC('month', CURRENT_DATE) 
//       GROUP BY category`);
//     const budget = result.rows;
//     let curr = '€';
//     let budgetMessage = `*Budget for the current month:*\n\n`;
//     budget.forEach((row) => {
//       budgetMessage += `${row.category}: ${curr}${row.total_income.toFixed(2)} income, ${curr}${row.total_spending.toFixed(2)} spending, balance: ${curr}${row.balance.toFixed(2)}\n`;
//     });
//     bot.sendMessage(chatId, budgetMessage, {parse_mode: 'Markdown'});
//   } catch (error) {
//       console.error(error);
//       bot.sendMessage(chatId, 'An error occurred while retrieving the budget. Please try again later.');
//   }
// });