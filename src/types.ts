import type { Context } from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    responseData: any;
    responseMessage: string;
  }
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message: string;
}

export interface ErrorResponse {
  success: false;
  data: null;
  message: string;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;
