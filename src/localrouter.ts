import type { FetchBody, ModelMessage } from "./types.ts";

export class Localrouter {
  private url?: string;
  private token?: string;
  private model?: string;
  private prompt?: string;
  private reasoning?: string;

  static create(): Localrouter {
    const instance = new Localrouter();
    return instance;
  }

  private constructor() {
    this.url = Deno.env.get("LOCALAPI_URL");
    this.token = Deno.env.get("LOCAL_TOKEN");
    this.model = Deno.env.get("LOCAL_MODEL");
    this.prompt = Deno.env.get("LOCAL_SYSTEM_PROMPT");
    this.reasoning = Deno.env.get("LOCAL_REASONING");

    if (!this.url || !this.token || !this.model) {
      throw new Error(
        "Отсутствуют необходимые переменные окружения",
      );
    }
  }

  async chat(prompt: string): Promise<string> {
    if (!this.url || !this.token || !this.model) {
      throw new Error(`Не установлены параметры окружения`);
    }

    const messages: (ModelMessage & { reasoning?: string })[] = [];

    const systemMessage: ModelMessage = {
      role: "system",
      content: this.prompt ?? "",
    };

    const promptMessage: ModelMessage = {
      role: "user",
      content: prompt,
    };

    messages.push(systemMessage, promptMessage);

    const body: FetchBody = {
      "model": this.model,
      "messages": messages,
    };

    if (this.reasoning === "true") {
      body.reasoning = { enabled: true };
    }

    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    const res = result.choices?.[0]?.message?.content;

    return res;
  }
}
