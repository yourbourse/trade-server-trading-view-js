import { createClient } from '@hey-api/openapi-ts';

createClient({
    input: 'src/schema/openapi.json',
    output: 'src/schema/public-api',
    plugins: ['@hey-api/client-axios'],
});
