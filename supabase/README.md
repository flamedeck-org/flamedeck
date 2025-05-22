# Deploying

```bash
yarn supabase functions deploy stripe-webhook-handler --no-verify-jwt
yarn supabase functions deploy create-stripe-checkout-session
# Should this verify JWT?
yarn supabase functions deploy trace-analysis-socket --no-verify-jwt
yarn supabase functions deploy api-upload-trace --no-verify-jwt
yarn supabase functions deploy delete-user
```