export type AlexaCard = { title?: string; content?: string; imageUrl?: string };
export type ApiResponse<T = unknown> = {
  ok: boolean;
  speech?: string;
  card?: AlexaCard;
  data?: T;
  error?: { code: string; message: string; correlationId?: string };
};

export const ok = <T>(speech: string, data?: T, card?: AlexaCard): ApiResponse<T> => ({
  ok: true,
  speech,
  card,
  data
});

export const fail = (code: string, message: string, correlationId?: string): ApiResponse => ({
  ok: false,
  speech: message,
  error: { code, message, correlationId }
});
