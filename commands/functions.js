const dotenv = require('dotenv');
dotenv.config();

// START
exports.start = (bot, msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `Добро пожаловать в мой бот!\n
    https://tg-expenses-bot-zvh6xv3kha-uc.a.run.app/ - запустить\n
    /categories - list of categories\n
    /delete + category\'s name - delete category\n
    /budget - view your current budget\n
    /transactions - view list of last transactions\n
    /add`
  );
}
