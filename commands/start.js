// START
const commands = [
  { command: 'Show Budget', text: '/budget' },
  { command: 'Add transaction', text: '/add' },
];

const dotenv = require('dotenv');
dotenv.config();
const { Client } = require('pg');
const databaseUrl = `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = new Client({
  connectionString: databaseUrl,
});


/// *********
/// FUNCTIONS
/// *********

// START
exports.start = (bot, msg) => {
  const options = {
    reply_markup: {
      keyboard: commands.map(c => [c.text]),
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
  bot.sendMessage(
    msg.chat.id,
    `Welcome to the Expenses Bot!\n/budget\n/add`,
    options);
}

// TRANSACTIONS
const showTransactions = async (bot, msg) => {
  const chatId = msg.chat.id;
  try {
    const result = await client.query(`SELECT id, type, category, amount FROM budget GROUP BY id, type, category, amount`);
    const budget = result.rows;
    let transactionsList = 'The list of transactions:\n\n';
    budget.forEach((row) => {
      transactionsList += `${row.id} | ${row.type} | ${row.category} | ${row.amount}\n`;
    });
    bot.sendMessage(chatId, transactionsList);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, 'An error occurred while retrieving the list of transactions. Please try again later.');
  }
};
  
exports.transactions = showTransactions;



// exports.transactions = async (bot, msg) => {
//   const chatId = msg.chat.id;
//   try {
//     const result = await client.query(`
//       SELECT id, type, category, amount 
//       FROM budget
//       GROUP BY id, type, category, amount`);
//     const transactions = result.rows;
//     let transactionsList = 'The list of transactions:\n\n';
//     transactions.forEach((row) => {
//       transactionsList += `${row.id} | ${row.type} | ${row.category} | ${row.amount}\n`;
//     });
//     bot.sendMessage(chatId, transactionsList);
//   } catch (error) {
//     console.error(error);
//     bot.sendMessage(chatId, 'An error occurred while retrieving the list of transactions. Please try again later.');
//   }
// }









//       'You can add, view, update, and delete transactions by using the following commands:\n' +
//       '/budget - view your current budget\n' +
//       '/transactions - show the list of transactions\n' +
//       '/add - add a new transaction\n' +
//       '/list incomes - show the list of incomes\n' +
//       '/list spendings - show the list of spendings\n' +
//       '/update - update an existing category\n' +
//       '/delete - delete a category');