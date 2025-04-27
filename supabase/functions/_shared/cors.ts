export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // TODO: Restrict this in production!
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST for upload and OPTIONS for preflight
} 