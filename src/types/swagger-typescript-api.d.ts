declare module 'swagger-typescript-api' {
  export interface GenerateApiParams {
    name?: string;
    output?: string;
    url?: string;
    input?: string;
    httpClientType?: 'fetch' | 'axios';
    generateClient?: boolean;
    generateRouteTypes?: boolean;
    generateResponses?: boolean;
    extractRequestParams?: boolean;
    extractRequestBody?: boolean;
    modular?: boolean;
  }

  export function generateApi(params: GenerateApiParams): Promise<void>;
} 