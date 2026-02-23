import type {
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
          `${this.apiUrl}/getUpdates?offset=${this.offset}&timeout=300`,
        );
        const data = await response.json();

        if (data.ok && data.result) {
          for (const update of data.result) {
            this.offset = update.update_id + 1;
            this.handleUpdate(update);
          }
        }
      } catch (err) {
        console.error("Ошибка:", err);
        await new Promise((r) => setTimeout(r, 5000));
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

  async sendMessage(
    chatId: number,
    text: string,
    options?: SendMessageOptions,
  ): Promise<Message> {
    const response = await fetch(`${this.apiUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, ...options }),
    });
    const msg = await response.json();
    return msg;
  }

  async answerInlineQuery(
    inlineQueryId: string,
    results: InlineQueryResultArticle[],
  ) {
    return await fetch(`${this.apiUrl}/answerInlineQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inline_query_id: inlineQueryId,
        results: JSON.stringify(results),
        cache_time: 0,
      }),
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
