import type {
  BodyPayload,
  BotEventPayloads,
  InlineQueryResultArticle,
  Message,
  SendMessageOptions,
  TelegramBot as TelegramBotInterface,
  TelegramUpdate,
  User,
} from "./types.ts";

export class TelegramBot extends EventTarget implements TelegramBotInterface {
  private token: string;
  private offset = 0;
  private running = true;

  constructor(token: string) {
    super();
    this.token = token;
  }

  private get apiUrl() {
    return `https://api.telegram.org/bot${this.token}`;
  }

  async getMe(): Promise<User> {
    const resp = await fetch(`${this.apiUrl}/getMe`);
    const { result } = await resp.json();
    return result;
  }

  async start() {
    console.log("Бот запущен...");

    while (this.running) {
      try {
        const response = await fetch(
          `${this.apiUrl}/getUpdates?offset=${this.offset}&timeout=120`,
        );

        if (!response.ok) {
          throw new Error(`Статус API: ${response.status}`);
        }

        const data: { ok: boolean; result: TelegramUpdate[] } = await response
          .json();

        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            this.handleUpdate(update);
            this.offset = update.update_id + 1;
          }
        }
      } catch (error) {
        if (
          error instanceof TypeError &&
          error.message.includes("peer closed connection")
        ) {
          console.warn(
            "Соединение было сброшено сервером (TLS EOF). Переподключение...",
          );
        } else {
          console.error("Критическая ошибка при getUpdates:", error);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }
  }

  private handleUpdate(
    update: TelegramUpdate,
  ) {
    const updateTypes: (keyof BotEventPayloads)[] = [
      "message",
      "inline_query",
    ];

    for (const type of updateTypes) {
      if (update[type]) {
        const event = new CustomEvent<BotEventPayloads[typeof type]>(type, {
          detail: update[type],
        });
        this.dispatchEvent(event);
        return;
      }
    }
  }

  private async api<T>(
    method: string,
    payload: BodyPayload,
  ): Promise<T | null> {
    try {
      // if (payload.results && typeof payload.results !== "string") {
      //   payload.results = JSON.stringify(payload.results);
      // }

      const response = await fetch(`${this.apiUrl}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.ok) {
        console.error(`Telegram API Error [${method}]:`, data.description);
        return null;
      }

      return data.result as T;
    } catch (error) {
      if (
        error instanceof TypeError &&
        error.message.includes("peer closed connection")
      ) {
        console.warn(
          `Отъеб лонг полинга при вызове ${method}. Соединение разорвано.`,
        );
      } else {
        console.error(`Ошибка при вызове ${method}:`, error);
      }
      return null;
    }
  }

  async sendMessage(
    chatId: number,
    text: string,
    options?: SendMessageOptions,
  ): Promise<Message | null> {
    return await this.api<Message>("sendMessage", {
      chat_id: chatId,
      text,
      ...options,
    });
  }

  async answerInlineQuery(
    inlineQueryId: string,
    results: InlineQueryResultArticle[],
  ) {
    return await this.api<boolean>("answerInlineQuery", {
      inline_query_id: inlineQueryId,
      results: results,
      cache_time: 0,
    });
  }

  on<K extends keyof BotEventPayloads>(
    event: K,
    callback: (
      event: BotEventPayloads[K],
      eventObj: CustomEvent<BotEventPayloads[K]>,
    ) => void,
  ) {
    this.addEventListener(event, (e: Event) => {
      const customEvent = e as CustomEvent<BotEventPayloads[K]>;
      callback(customEvent.detail, customEvent);
    });
  }
}
