const dotenv = require('dotenv');
dotenv.config();

// START
exports.start = (bot, msg) => {
  const chatId = msg.chat.id;

  let categories = [
    "/start",
    "/add",
    "/budget",
  ];

  const options = {
    reply_markup: {
      resize_keyboard: true,
      one_time_keyboard: true,
      keyboard: [categories],
    },
  };

  bot.sendMessage(
    chatId,
    `Добро пожаловать в мой бот!\n
    http://surl.li/fioht - запустить\n
    /budget - view your current budget\n
    /transactions - view list of last transactions\n
    /add - Add transaction`, options
  );
}
