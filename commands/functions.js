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
    `Welcome in Gordievsky Family Bot!\n
    https://expenses-dev-cqetgkfjsa-uc.a.run.app/ - restart\n`
    , options
  );
}
