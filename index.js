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

// Last transactions (30 days)
bot.onText(/\/transactions/, async (msg) => {
  const chatId = msg.chat.id;
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
  const sql = `SELECT * FROM budget WHERE date_of_transaction >= '${startDate.toISOString()}'`;

  try {
    const result = await client.query(
      `SELECT * FROM budget WHERE date_of_transaction >= now() - interval '30 days';`
    );
    const transactions = result.rows;

    if (transactions.length === 0) {
      bot.sendMessage(chatId, 'There are no transactions in the last 30 days.');
    } else {
      let message = 'Transactions in the last 30 days:\n\n';
      transactions.forEach((transaction) => {
        message += `Date: ${transaction.date_of_transaction}\n`;
        message += `Amount: ${transaction.amount}\n`;
        message += `Category: ${transaction.category}\n`;
        message += `Comment: ${transaction.comment}\n\n`;
      });
      bot.sendMessage(chatId, message);
    }
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, 'Error fetching transactions.');
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

// Show list of categories
bot.onText(/\/categories/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const result = await client.query(
      `SELECT DISTINCT category FROM budget;`
    );
    const categories = result.rows;
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
bot.onText(/\/add/, async (msg) => {
  const chatId        = msg.chat.id;
  const userId        = msg.from.id;
  const allowedUserId = '746413249';
  let state           = "type";

  // check if user is allowed to add transactions
  if (userId === allowedUserId) {
    bot.sendMessage(chatId, "You don't have enough permissions to add transactions.");
    console.log("Your ID:", userId);
    return;
  }

  const transaction = {
    type: "",
    category: "",
    amount: 0,
    comment: "",
    user_id: userId,
  };

  const categories = [];

  const options = {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [],
      one_time_keyboard: true,
    },
  };

  const sendMessage = (text, opts) => {
    bot.sendMessage(chatId, text, opts);
  };

  const clearOptions = () => {
    options.reply_markup.keyboard = [];
  };

  const setState = (newState) => {
    state = newState;
  };

  const setType = (newType) => {
    transaction.type = newType;
  };

  const setCategory = (newCategory) => {
    transaction.category = newCategory;
  };

  const setAmount = (newAmount) => {
    transaction.amount = parseFloat(newAmount);
  };

  const setComment = (newComment) => {
    transaction.comment = newComment;
  };

  bot.sendMessage(chatId, "Please select the transaction type:", options);
  options.reply_markup.keyboard = [["income"], ["spending"]];
  setState("type");

  try {
    const queryResult = await client.query(
      "SELECT DISTINCT category FROM budget"
    );
    queryResult.rows.forEach((row) => {
      categories.push(row.category);
    });
  } catch (error) {
    console.error(error);
    sendMessage("An error occurred while retrieving the categories.");
    return;
  }

  bot.on("message", (msg) => {
    const text          = msg.text;

    switch (state) {
      case "type":
        if (text === "income" || text === "spending") {
          setType(text);
          setState("category");
          clearOptions();
          try {
            categories = result.rows.map(row => row.category);
            options.reply_markup.keyboard = categories.map(category => [category]);
            sendMessage("Please select a category:", options);
          } catch (err) {
            console.error(err);
            sendMessage("An error occurred while fetching categories. Please try again later.");
            setState("done");
          }
        } else {
          sendMessage("Please select the transaction type:", options);
        }
        break;
      case "category":
        if (categories.includes(text)) {
          setCategory(text);
          setState("amount");
          sendMessage("Please enter the amount:", options);
        } else {
          sendMessage("Please select a category:", options);
        }
        break;
      case "amount":
        if (!isNaN(parseFloat(text))) {
          setAmount(text);
          setState("comment");
          sendMessage("Please enter a comment (optional):", options);
        } else {
          sendMessage("Please enter the amount:", options);
        }
        break;
      case "comment":
        setComment(text);
        setState("done");
        bot.off("message");
        const sqlQuery = `INSERT INTO budget (type, category, amount, comment, user_id, date_of_transaction) VALUES ($1, $2, $3, $4, $5, $6)`;
        const currentDate = new Date();
        const date = currentDate.getDate();
        // const date = `${currentDate.getFullYear()}-${
        //   currentDate.getMonth() + 1
        // }-${currentDate.getDate()}`;
        client.query(
          sqlQuery,
          [
            transaction.type,
            transaction.category,
            transaction.amount,
            transaction.comment,
            transaction.user_id,
            date,
          ],
          (err, res) => {
            if (err) {
              sendMessage(
                "An error occurred while adding the transaction to the database."
              );
              console.error(err);
            } else {
              sendMessage("Transaction added successfully!");
              console.log(res);
            }
          }
        );
        break;
      default:
        sendMessage("An error occurred.");
        break;
    }
  });
});


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
      bot.sendMessage(chatId, 'Select + for income and - for spending::');
      bot.once('message', async (msg) => {
        if (msg.text === '+' || msg.text === '-') {
          const type = msg.text === '+' ? 'income' : 'spending';
          bot.sendMessage(chatId, 'Choose a category:', options);
          bot.once('message', async (msg) => {
            const category = msg.text;
  
            bot.sendMessage(chatId, 'Enter the amount:');
            bot.once('message', async (msg) => {
              if (isNaN(msg.text) || msg.text <= 0) {
                bot.sendMessage(chatId, 'Please enter a valid amount.');
                return;
              }
              const amount = msg.text;
              bot.sendMessage(chatId, `Adding ${type} of ${currency}${amount} to "${category}" category\nPlease add the comment to this transaction:`);
              if (msg.text === '-' || msg.text === 'cancel' || msg.text === 'отмена') {
                bot.sendMessage(chatId, 'Cancelled | Отменено.');
                return;
              }
              const comment = msg.text;
              try {
                await client.query('INSERT INTO budget (type, category, amount, comment) VALUES ($1, $2, $3, $4)', [type, category, amount, comment]);
                bot.sendMessage(chatId, `The transaction of  ${currency}${amount} for "${category}" category has been added as ${type}.`);
              } catch (error) {
                console.error(error);
                bot.sendMessage(chatId, 'An error occurred while adding the transaction. Please try again later.');
              }
            });
          });
        } else {
          bot.sendMessage(chatId, 'Please try again from + command!\nChoose either "+" for income or "-" for spending.');
          return;
        }
      });
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, 'An error occurred while adding the transaction. Please try again later.');
    }
});

// Delete Category
bot.onText(/\/delete (.+)/, async (msg, match) => {
  const category = match[1];
  let allowedUserId = '746413249';

  // check if user is allowed to add transactions
  if (userId != allowedUserId) {
    bot.sendMessage(chatId, "You don't have enough permissions to delete categories.");
    console.log(`Your ID: ${userId}`);
    console.log(`Necessary ID: ${allowedUserId}`);
    return;
  }

  try {
    const res = await client.query('DELETE FROM budget WHERE category = $1', [category]);
    if (res.rowCount === 0) {
      bot.sendMessage(msg.chat.id, `Category "${category}" does not exist.`);
    } else {
      bot.sendMessage(msg.chat.id, `Category "${category}" deleted successfully.`);
    }
  } catch (err) {
    console.error(err);
    bot.sendMessage(msg.chat.id, 'Error deleting category.');
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
