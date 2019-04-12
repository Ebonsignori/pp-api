# Dev Setup

1. Start the backend services (Postgres and Redis) with `npm run dev.up`
2. Start server `npm run dev`
3. Start ngrok: `ngrok http 4390`
4. Create a development Github App and populate it, replacing `<ngrok-url>` in the image below with your url
   ![github app example](./docs/imgs/gh-dev-app.png)
      - You can generate `GITHUB_WEBHOOK_SECRET` using [this tutorial](https://developer.github.com/webhooks/securing/).
5. Populate .env with the Github apps information in [.env](./.env), using the current .env as a template.
