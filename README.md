# Dev Setup

1. Start the backend services (Postgres and Redis) with `npm run dev.up`
2. Start server `npm run dev`
3. Start ngrok: `ngrok http 4390`
4. Add ngrok urls to Github Planning Poker App
5. (TODO:) Populate .env using the [.env.example](./.env.example) template.
   - You can generate `GITHUB_WEBHOOK_SECRET` using [this tutorial](https://developer.github.com/webhooks/securing/).
