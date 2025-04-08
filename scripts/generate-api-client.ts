import { generateApi } from 'swagger-typescript-api';
import path from 'path';

const generate = async () => {
  try {
    await generateApi({
      name: 'ApiClient.ts',
      output: path.resolve(process.cwd(), './src/apiClient'),
      url: 'http://localhost:5238/swagger/v1/swagger.json',
      httpClientType: 'axios',
      generateClient: true,
      generateRouteTypes: true,
      generateResponses: true,
      extractRequestParams: true,
      extractRequestBody: true,
      modular: true,
    });
    console.log('✅ API client generated successfully!');
  } catch (error) {
    console.error('❌ Error generating API client:', error);
    process.exit(1);
  }
};

generate(); 