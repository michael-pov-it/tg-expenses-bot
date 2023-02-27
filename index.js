const functions = require("./commands/functions");
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { Client } = require('pg');
const dotenv = require('dotenv');
const e = require("express");

dotenv.config();
const app = express();

const BOT_TOKEN = `${process.env.BOT_TOKEN}`;
const bot = new TelegramBot(BOT_TOKEN, {polling: true});

// let currency = "${process.env.CURRENCY}" == "EUR" ? "€" : "$";
let currency = "€";

const databaseUrl = `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = new Client({
  connectionString: databaseUrl,
});

client.connect((err) => {
  if (err) {
    console.error('Error connecting to Postgres:', err);
  } else {
    console.log('PG connection established successfully!');
  }
});

bot.onText(/\/start/, (msg) => {
  functions.start(bot, msg);
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

// Show list of categories
bot.onText(/\/categories/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const result = await client.query(
      `SELECT DISTINCT category FROM budget;`
    );
    const categories = result.rows;
    let curr = currency;
    let categoriesList = 'Categories List:\n\n';
    categories.forEach((row) => {
      categoriesList += `${row.category}\n`;
    });
    bot.sendMessage(chatId, categoriesList);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, 'An error occurred while retrieving the list of categories. Please try again.');
  }
});

async function getCategories() {
  try {
    const result = await client.query('SELECT DISTINCT category FROM budget');
    const categories = result.rows.map((row) => row.category);
    return categories;
  } catch (error) {
    console.error(error);
    throw new Error('An error occurred while retrieving the list of categories');
  }
}

// Add transaction
bot.onText(/^\+$/, async (msg) => {
  const chatId        = msg.chat.id;
  const userId        = msg.from.id;
  const allowedUserId = '746413249';

  // check if user is allowed to add transactions
  if (userId === allowedUserId) {
    bot.sendMessage(chatId, "You don't have enough permissions to add transactions.");
    console.log(userId);
    return;
  }

  try {
      const categories = await getCategories();
      const options = {
        reply_markup: JSON.stringify({
          keyboard: [categories],
          one_time_keyboard: true,
        }),
      };
      bot.sendMessage(chatId, 'To add a new transaction, select the type of transaction:', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Income',
                callback_data: 'income'
              },
              {
                text: 'Spending',
                callback_data: 'spending'
              }
            ]
          ]
        }
      });
      bot.once('message', async (msg) => {
        const { text } = msg;
        if (text === 'Income' || text === 'Spending') {
          text === 'Spending' ? console.log('spending!') : console.log('income!');
        } else {
          bot.sendMessage(chatId, 'Please choose either "+" for income or "-" for spending.');
          return;
        }
        const type = text === 'Spending' ? 'income' : 'spending';
        bot.sendMessage(chatId, 'Choose a category:', options);
        bot.once('message', async (msg) => {
          const { text } = msg;
          // if (!categories.includes(text)) {
          //   bot.sendMessage(chatId, `The category "${text}" doesn't exist. Please try again.`);
          //   return;
          // }
          const category = text;
  
          bot.sendMessage(chatId, 'Enter the amount:');
          bot.once('message', async (msg) => {
            const { text } = msg;
            if (isNaN(text) || text <= 0) {
              bot.sendMessage(chatId, 'Please enter a valid amount.');
              return;
            }
            const amount = text;
            console.log(`
              Category: ${category}\n
              Amount: ${amount}
            `);
  
            try {
              await client.query('INSERT INTO budget (type, category, amount) VALUES ($1, $2, $3)', [type, category, amount]);
              bot.sendMessage(chatId, `The transaction of ${amount} ${currency} for "${category}" category has been added as ${type}.`);
            } catch (error) {
              console.error(error);
              bot.sendMessage(chatId, 'An error occurred while adding the transaction. Please try again later.');
            }
          });
        });
      });
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, 'An error occurred while adding the transaction. Please try again later.');
    }
});

// Listen for messages
// bot.on('message', async (msg) => {
//   const chatId = msg.chat.id;

//   // Check command
//   switch (msg.text) {
//     case '/start':
//       bot.sendMessage(chatId, 'Hello! Welcome to the budget bot. Type /help to see the list of available commands.');
//       break;
//     case '/help':
//       bot.sendMessage(chatId, 'List of available commands:\n/add - add a new transaction\n/budget - show budget summary\n/transactions - show list of transactions');
//       break;
//     case '/add':
//       addTransaction(msg);
//       break;
//     case '/budget':
//       getBudgetSummary(msg);
//       break;
//     case '/transactions':
//       getTransactionsList(msg);
//       break;
//     default:
//       bot.sendMessage(chatId, 'Invalid command. Type /help to see the list of available commands.');
//       break;
//   }
// });


// bot.onText(/^\+$/, async (msg) => {
//   const chatId        = msg.chat.id;
//   const userId        = msg.from.id;
//   const allowedUserId = '746413249';
  
//   // check if user is allowed to add transactions
//   if (userId === allowedUserId) {
//     bot.sendMessage(chatId, "You don't have enough permissions to add transactions.");
//     console.log(userId);
//     return;
//   }
  
//   // create message options for asking the transaction details
//   const messageOptions = {
//     reply_markup: {
//       force_reply: true
//     }
//   };

//   let messageText = 'Enter transaction amount:';
//   let currentStep = 'amount';
//   let transactionType;

//   const handleMessage = async (message) => {
//     const { text } = message;
//     const chatId = message.chat.id;
    
//     switch (currentStep) {
//       case 'amount': {
//         if (!isValidNumber(text)) {
//           bot.sendMessage(chatId, 'Please enter a valid amount.');
//           return;
//         }
//         transactionAmount = Number(text);
//         messageText = 'Choose the transaction type:';
//         currentStep = 'type';
//         bot.sendMessage(chatId, messageText, { reply_markup: { 
//           inline_keyboard: [
//             [
//               { text: 'Income', callback_data: 'income' },
//               { text: 'Spending', callback_data: 'spending' },
//             ]
//           ]
//         }});
//         break;
//       }
//       case 'type': {
//         if (text === '+' || text === 'income') {
//           transactionType = 'income';
//         } else if (text === '-' || text === 'spending') {
//           transactionType = 'spending';
//         } else {
//           bot.sendMessage(chatId, 'Please choose a valid transaction type.');
//           return;
//         }

//         messageText = 'Enter transaction category:';
//         currentStep = 'category';
//         bot.sendMessage(chatId, messageText, messageOptions);
//         break;
//       }
//       case 'category': {
//         transactionCategory = text;
//         messageText = 'Enter transaction description:';
//         currentStep = 'description';
//         bot.sendMessage(chatId, messageText, messageOptions);
//         break;
//       }
//       case 'description': {
//         transactionDescription = text;
//         transactionDate = new Date().toISOString();
//         try {
//           const result = await client.query(`
//             INSERT INTO budget (type, category, description, amount, date_of_transaction)
//             VALUES ($1, $2, $3, $4, $5)
//             RETURNING id`,
//             [transactionType, transactionCategory, transactionDescription, transactionAmount, transactionDate]);
//           const newTransactionId = result.rows[0].id;
//           bot.sendMessage(chatId, `Transaction ${newTransactionId} added.`);
//         } catch (error) {
//           console.error(error);
//           bot.sendMessage(chatId, 'An error occurred while adding the transaction. Please try again later.');
//         }
//         break;
//       }
//       default:
//         break;
//     }
//   }

//   bot.sendMessage(chatId, messageText, messageOptions);
//   bot.onReplyToMessage(chatId, handleMessage);
// });


// bot.onText(/\/start/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(chatId, 'Hello! Welcome to your budget tracker. Type /add to add a new transaction, or /budget to see your spending by category.');
// });

// bot.onText(/\/add/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(chatId, 'To add a new transaction, select the type of transaction:', {
//     reply_markup: {
//       inline_keyboard: [
//         [
//           {
//             text: 'Income',
//             callback_data: 'income'
//           },
//           {
//             text: 'Spending',
//             callback_data: 'spending'
//           }
//         ]
//       ]
//     }
//   });
// });

// bot.on('callback_query', (callbackQuery) => {
//   const message = callbackQuery.message;
//   const chatId = message.chat.id;
//   const data = callbackQuery.data;

//   bot.answerCallbackQuery(callbackQuery.id);

//   if (data === 'income') {
//     bot.sendMessage(chatId, 'Please select a category for income:', {});
//   } else if (data === 'spending') {
//     bot.sendMessage(chatId, 'Please select a category for spending:', {});
//   } else {
//     bot.sendMessage(chatId, 'Invalid option selected');
//   }
// });

// bot.on('callback_query', (callbackQuery) => {
//   const message = callbackQuery.message;
//   const chatId = message.chat.id;
//   const data = callbackQuery.data;

//   bot.answerCallbackQuery(callbackQuery.id);

//   if (data === 'food' || data === 'transportation' || data === 'housing' || data === 'rent' || data === 'utilities' || data === 'groceries' || data === 'other') {
//     bot.sendMessage(chatId, `Please enter the amount for the ${data} category:`);

//     bot.onReplyToMessage(chatId, message.message_id, (replyMsg) => {
//       const amount = replyMsg.text;

//       if (!Number(amount)) {
//         bot.sendMessage(chatId, 'Invalid amount entered');
//         return;
//       }

//       const type = data.startsWith('i') ? 'income' : 'spending';
//       const category = data;
//       const date = new Date();

//       const query = `INSERT INTO budget (type, category, amount, date_of_transaction) VALUES ('${type}', '${category}', ${amount}, '${date.toISOString()}')`;

//       // Run the SQL query to add the transaction to the database

//       bot.sendMessage(chatId, 'Transaction added successfully!');
//     });
//   }
// });
