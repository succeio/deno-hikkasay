import type {
  InlineQuery,
  InlineQueryResultArticle,
  Message,
} from "./types.ts";
import { Openrouter } from "./openrouter.ts";
import { TelegramBot } from "./telegrambot.ts";

if (import.meta.main) {
  const bot_token = Deno.env.get("BOT_TOKEN");
  if (!bot_token) throw new Error(`BOT_TOKEN не обнаружен`);

  const chId = Deno.env.get("CHAT_ID");
  if (!chId) throw new Error(`CHAT_ID не обнаружен`);
  const chatId = +chId;

  const bot = new TelegramBot(bot_token);
  const { id } = await bot.getMe();
  const openrouter = await Openrouter.create();

  const md = (text: string) =>
    text.replace(/\*\*([^\s][\s\S]*?[^\s])\*\*/g, "*$1*");

  bot.start();
  const openHandler = async (msg: Message) => {
    if (msg.chat.id !== chatId) {
      return;
    }

    if (msg.text && msg.text.length > 0) {
      const messageText = msg.text.toString().toLowerCase();

      if (messageText.startsWith("open")) {
        const question = messageText.replace("open", "").trim();
        try {
          const modelResponse = await openrouter.chat(question);
          bot.sendMessage(chatId, md(modelResponse), {
            reply_to_message_id: msg.message_id,
            parse_mode: "Markdown",
          });
        } catch (error) {
          console.error(error);
          bot.sendMessage(chatId, `Ошибка вызова open: ${error}`);
        }
      }
    }
  };

  const switchApiHandler = (msg: Message) => {
    if (msg.chat.id !== chatId) {
      return;
    }

    if (msg.text && msg.text.length > 0) {
      const messageText = msg.text.toString().toLowerCase();

      if (messageText.startsWith("switch")) {
        try {
          const status = openrouter.switchApi();
          bot.sendMessage(chatId, status, {
            reply_to_message_id: msg.message_id,
            parse_mode: "Markdown",
          });
        } catch (error) {
          console.error(error);
          bot.sendMessage(chatId, `Ошибка вызова switch: ${error}`);
        }
      }
    }
  };

  const contextSimulationHandler = async (msg: Message) => {
    if (msg.chat.id !== chatId) {
      return;
    }
    if (
      msg.reply_to_message &&
      msg.reply_to_message.from &&
      msg.reply_to_message.from.id === id
    ) {
      // Проверяем, что сообщение не от бота и что оно не является командой
      if (msg.from?.is_bot || msg.text?.startsWith("/")) {
        return;
      }

      const originalText = msg.reply_to_message.text;
      if (originalText && msg.text) {
        const prewAI = originalText;
        const userText = msg.text;
        try {
          const response = await openrouter.chat(
            `Твой предыдущий ответ: ${prewAI}. Мой следующий вопрос: ${userText}`,
          );

          bot.sendMessage(+chatId, md(response)), {
            parse_mode: "Markdown",
            reply_to_message_id: msg.message_id,
          };
        } catch (error) {
          console.error(error);
          bot.sendMessage(chatId, `Ошибка вызова contextSimulation: ${error}`);
        }
      }
    }
  };

  const setModelHandler = (msg: Message) => {
    if (msg.chat.id !== chatId) {
      return;
    }

    if (msg.text && msg.text.length > 0) {
      const messageText = msg.text.toString().toLowerCase();

      if (messageText.startsWith("set")) {
        const model = messageText.replace("set", "").trim();
        try {
          if (model.length === 0) {
            throw new Error(`Укажите название модели`);
          }
          openrouter.setModel(model);

          bot.sendMessage(chatId, `Установлена модель ${model}`, {
            reply_to_message_id: msg.message_id,
            parse_mode: "Markdown",
          });
        } catch (error) {
          console.error(error);
          bot.sendMessage(chatId, `Ошибка вызова set: ${error}`);
        }
      }
    }
  };

  const inlineQueryHandler = (query: InlineQuery) => {
    try {
      const models = openrouter.models;
      const ids = models.map((m) => {
        return m.id;
      });

      const q = query.query.toLowerCase();

      const results: InlineQueryResultArticle[] = ids
        .filter((text) => text.includes(q))
        .map((text, index) => ({
          type: "article",
          id: String(index),
          title: text,
          input_message_content: {
            message_text: "set " + text,
          },
        }));

      bot.answerInlineQuery(query.id, results);
    } catch (error) {
      bot.sendMessage(chatId, `Ошибка вызова inline_query: ${error}`);
    }
  };

  bot.on("message", openHandler);
  bot.on("message", contextSimulationHandler);
  bot.on("message", setModelHandler);
  bot.on("message", switchApiHandler);
  bot.on("inline_query", inlineQueryHandler);
}
