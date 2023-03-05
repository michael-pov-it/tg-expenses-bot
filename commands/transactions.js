const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const databaseUrl = `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`; // 'postgresql://postgres:123654789w@localhost/expenses-dev';
const client = new Client({
  connectionString: databaseUrl,
});
client.connect();

let currency = "${process.env.CURRENCY}" == "EUR" ? "€" : "$";

// Show list of transactions
// module.exports = (bot) => {
//   bot.onText(/\/transactions/, async (msg) => {
//     const chatId = msg.chat.id;
//     try {
//       const result = await client.query(`
//         SELECT id, type, category, amount 
//         FROM budget
//         GROUP BY id, type, category, amount`);
//       const budget = result.rows;
//       let curr = currency;
//       let transactionsList = 'The list of transactions:\n\n';
//       budget.forEach((row) => {
//         transactionsList += `${row.id} | ${row.type} | ${row.category} | ${row.amount}\n`;
//       });
//       bot.sendMessage(chatId, transactionsList);
//     } catch (error) {
//         console.error(error);
//         bot.sendMessage(chatId, 'An error occurred while retrieving the list of transactions. Please try again later.');
//     }
//   });
// };
