import * as path from "@std/path";
import type { FetchBody, Model, ModelMessage, ModelResponse } from "./types.ts";

export class Openrouter {
  private openrouter_api_key: string;
  private openrouter_token: string;
  private data_dir: string;
  private model_path: string;
  private free_models?: Model[];
  private model?: string;
  private url: string;

  static async create(): Promise<Openrouter> {
    const instance = new Openrouter();

    // 1. Загружаем модель из файла
    const savedModel = await instance.loadModelFromFile();
    if (savedModel) {
      instance.model = savedModel;
    }

    // 2. Запускаем сетевые дела БЕЗ await, чтобы не блокировать бота
    instance.initNetworkData().catch((err) => {
      console.error(
        "Фоновая инициализация OpenRouter не удалась:",
        err.message,
      );
    });

    return instance;
  }

  private constructor() {
    this.data_dir = Deno.env.get("DATA_DIR")!;
    this.openrouter_api_key = Deno.env.get("OPENROUTERAPI_KEY")!;
    this.openrouter_token = Deno.env.get("OPENROUTER_TOKEN")!;

    if (!this.data_dir || !this.openrouter_api_key || !this.openrouter_token) {
      throw new Error(
        "Отсутствуют необходимые переменные окружения (DATA_DIR, API_KEY или TOKEN)",
      );
    }

    this.url = "https://openrouter.ai/api/v1/chat/completions";

    Deno.mkdirSync(this.data_dir, { recursive: true });
    this.model_path = path.join(this.data_dir, "model.json");
  }

  private async initNetworkData() {
    await this.refreshFreeModels(); // Обновит список моделей
    if (!this.model) {
      await this.initializeBestModel(); // Найдет модель, если файл был пустой
    }
  }

  private async loadModelFromFile(): Promise<string | null> {
    try {
      const content = await Deno.readTextFile(this.model_path);
      const parsed = JSON.parse(content);
      return parsed.model || null;
    } catch {
      await this.saveModelToFile("");
      return null;
    }
  }

  private async refreshFreeModels(retries = 3) {
    for (let i = 0; i < retries; i++) {
      const models = await this.listFreeModels();
      if (models.length > 0) {
        this.free_models = models;
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(
      "Не удалось получить список бесплатных моделей после нескольких попыток",
    );
  }

  private async initializeBestModel() {
    try {
      const result = await this.firstRespondingModel("Привет, ты тут?");
      this.model = result.model;
      await this.saveModelToFile(result.model);
    } catch (error) {
      throw new Error(`Не удалось инициализировать базовую модель: ${error}`);
    }
  }

  private async listFreeModels(): Promise<Model[]> {
    const url = "https://openrouter.ai/api/v1/models";
    try {
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${this.openrouter_api_key}` },
      });
      if (!response.ok) return [];

      const { data } = await response.json();
      return data.filter((m: Model) => parseFloat(m.pricing.prompt) === 0);
    } catch (error) {
      console.error("Ошибка при получении списка моделей:", error);
      return [];
    }
  }

  private async firstRespondingModel(prompt: string) {
    const controller = new AbortController();
    const { signal } = controller;

    try {
      const models = this.free_models ?? await this.listFreeModels();

      const requests = models.map(async (model) => {
        const { url, options } = this.fetchSettings(prompt, model.id);

        const response = await fetch(url, {
          ...options,
          signal,
        });

        if (!response.ok) {
          throw new Error(
            `Model ${model.id} responded with ${response.status}`,
          );
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: ModelResponse }>;
        };

        if (!data?.choices?.[0]?.message?.content) {
          throw new Error(`Invalid response structure from ${model.id}`);
        }

        controller.abort();

        return {
          model: model.id,
          message: data.choices[0].message.content,
          supported_parameters: model.supported_parameters,
        };
      });

      return await Promise.any(requests);
    } catch (error) {
      throw new Error(`Ошибка поиска модели с минимальной задержкой: ${error}`);
    }
  }

  fetchSettings(prompt: string, model: string) {
    const url = this.url;
    const messages: ModelMessage[] = [];

    const systemMessage: ModelMessage = {
      role: "system",
      content:
        "Важно: Отвечай на русском языке. Не выдумывай факты. Если не знаешь ответа, то попроси уточнения.",
    };

    const promptMessage: ModelMessage = {
      role: "user",
      content: prompt,
    };

    const bodySafeStringify = (fetchBody: FetchBody): string => {
      return JSON.stringify(fetchBody);
    };

    if (prompt.length > 0) {
      messages.push(systemMessage, promptMessage);
    }

    const options = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.openrouter_token}`,
        "Content-Type": "application/json",
      },
      body: bodySafeStringify({
        model: model,
        messages: messages,
      }),
    };
    return { url, options };
  }

  private async saveModelToFile(model: string) {
    await Deno.writeTextFile(
      this.model_path,
      JSON.stringify({ model }, null, 2),
    );
  }

  async chat(prompt: string): Promise<string> {
    if (!this.model) throw new Error("Модель не инициализирована");

    const sendRequest = async (modelId: string) => {
      const { url, options } = this.fetchSettings(prompt, modelId);
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      return data.choices?.[0]?.message?.content;
    };

    try {
      return await sendRequest(this.model);
    } catch {
      // Резервный вариант: если текущая модель упала, ищем новую "на лету"
      const fallback = await this.firstRespondingModel(prompt);
      this.model = fallback.model;
      await this.saveModelToFile(this.model);
      return fallback.message;
    }
  }

  async setModel(model: string) {
    try {
      await Deno.writeTextFile(
        this.model_path,
        JSON.stringify({ model: model }, null, 2),
      );
      this.model = model;
    } catch (error) {
      console.error(error);
    }
  }

  get models() {
    return this.free_models ?? [];
  }
}
