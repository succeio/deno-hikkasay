export interface TelegramBot {
  on<K extends keyof BotEventPayloads>(
    event: K,
    callback: (event: BotEventPayloads[K]) => void,
  ): void;

  sendMessage(
    chatId: number,
    text: string,
    options?: SendMessageOptions,
  ): Promise<Message>;
}

interface SendBasicOptions {
  message_thread_id?: number | undefined;
  disable_notification?: boolean | undefined;
  reply_to_message_id?: number | undefined;
  protect_content?: boolean | undefined;
  allow_sending_without_reply?: boolean | undefined;
}

type ParseMode = "Markdown" | "MarkdownV2" | "HTML";

export interface SendMessageOptions extends SendBasicOptions {
  parse_mode?: ParseMode | undefined;
  disable_web_page_preview?: boolean | undefined;
}

export interface TelegramUpdate {
  update_id: number;
  message?: Message;
  inline_query?: InlineQuery;
}

export interface BotEventPayloads {
  message: Message;
  inline_query: InlineQuery;
}

export interface Message {
  message_id: number;
  chat: Chat;
  text: string;
  from?: User | undefined;
  reply_to_message?: Message | undefined;
}

export interface User {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string | undefined;
  username?: string | undefined;
  language_code?: string | undefined;
}

export interface Chat {
  id: number;
}

export interface InlineQuery {
  id: string;
  query: string;
  offset: string;
}

export interface InlineQueryResultBase {
  id: string;
}

export type InputMessageContent = object;

export interface InlineQueryResultArticle extends InlineQueryResultBase {
  type: "article";
  title: string;
  input_message_content: InputMessageContent;
  url?: string | undefined;
  hide_url?: boolean | undefined;
  description?: string | undefined;
  thumb_url?: string | undefined;
  thumb_width?: number | undefined;
  thumb_height?: number | undefined;
}

export interface Model {
  id: string;
  pricing: { prompt: string };
  supported_parameters: Array<string>;
  architecture: {
    input_modalities: string;
  };
}

export interface ModelResponse {
  role: string;
  content: string;
  refusal: null | string;
  reasoning: null | string;
}

export interface FetchBody {
  model: string;
  messages: ModelMessage | Array<ModelMessage>;
  tools?: Array<() => string>;
  stream?: boolean;
  think?: boolean;
  reasoning?: { "enabled": boolean };
}

export interface ModelMessage {
  role: "system" | "assistant" | "user";
  content:
    | string
    | Array<{ type: string; text?: string; image_base64?: string }>;
}
