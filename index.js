const functions = require("./commands/functions");
const TelegramBot = require('node-telegram-bot-api');
// const express = require('express');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

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

// Async functions
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

// Start bot
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

// Add transaction
bot.onText(/\/add/, (msg) => {
  const chatId = msg.chat.id;
  let state = "category";

  const transaction = {
    type: "",
    category: "",
    amount: 0,
    comment: "",
  };

  const options = {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [],
      one_time_keyboard: true,
    },
  };

  const categories = [
    "Обеды",
    "Еда",
    "Рестораны",
    "Бытовая Химия",
    "Развлечения",
    "Незапланированное",
    "Алкоголь и доставка"
  ];

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

  const addTransaction = () => {
    const sqlQuery = `
    INSERT INTO budget (type, category, amount, comment, date_of_transaction, user_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    `;
    const currentDate = new Date();
    const date = `${currentDate.getFullYear()}-${
      currentDate.getMonth() + 1
    }-${currentDate.getDate()}`;
    client.query(
      sqlQuery,
      [
        transaction.type,
        transaction.category,
        transaction.amount,
        transaction.comment,
        date,
        msg.from.id
      ],
      (err, res) => {
        if (err) {
          sendMessage(
            "An error occurred while adding the transaction to the database."
          );
          console.error(err);
        } else {
          sendMessage("Transaction added successfully!");
        }
      }
    );
  };

  const handleTransaction = (type) => {
    setType(type);
    setState("category");
    clearOptions();
    options.reply_markup.keyboard = categories.map((category) => [
      category,
    ]);
    sendMessage("Please select a category:", options);

    bot.on("message", (msg) => {
      const text = msg.text;
      switch (state) {
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
          addTransaction();
          break;
        default:
          sendMessage("An error occurred.");
          break;
      }
    });
  };

  options.reply_markup.keyboard = [["income"], ["spending"]];
  sendMessage("Please select the transaction type:", options);
  clearOptions();

  bot.once("message", (msg) => {
    const text = msg.text.toLowerCase();
    if (text === "income") {
      handleTransaction("income");
    } else if (text === "spending") {
      handleTransaction("spending");
    } else {
      options.reply_markup.keyboard = [["income"], ["spending"]];
      sendMessage("Please select the transaction type:", options);
      clearOptions();
    }
  });
});

/// *** ADMIN *** \\\

// Last transactions (30 days)
bot.onText(/\/transactions/, async (msg) => {
  const chatId = msg.chat.id;
  const userId        = msg.from.id;
  const allowedUserId = '746413249';

  // check if user is allowed to add transactions
  if (userId != allowedUserId) {
    bot.sendMessage(chatId, "You don't have enough permissions to get the list of transactions.");
    console.log(userId);
    return;
  }

  try {
    // const today = new Date();
    // const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    // const sql = `SELECT * FROM budget WHERE date_of_transaction >= '${startDate.toISOString()}'`;
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

// Show list of categories
bot.onText(/\/categories/, async (msg) => {
  const chatId = msg.chat.id;
  const userId        = msg.from.id;
  const allowedUserId = '746413249';

  // check if user is allowed to add transactions
  if (userId != allowedUserId) {
    bot.sendMessage(chatId, "You don't have enough permissions to get the list of transactions.");
    console.log(userId);
    return;
  }

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

// Delete Category
bot.onText(/\/delete (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const category = match[1];
  const userId        = msg.from.id;
  const allowedUserId = '746413249';

  // check if user is allowed to add transactions
  if (userId != allowedUserId) {
    bot.sendMessage(chatId, "You don't have enough permissions to get the list of transactions.");
    console.log(userId);
    return;
  }

  try {
    const res = await client.query('DELETE FROM budget WHERE category = $1', [category]);
    if (res.rowCount === 0) {
      bot.sendMessage(chatId, `Category "${category}" does not exist.`);
    } else {
      bot.sendMessage(chatId, `Category "${category}" deleted successfully.`);
    }
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, 'Error deleting category.');
  }
});
