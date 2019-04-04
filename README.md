# Setup

1. Deploy to server with an exposed url
2. Manually add [Github repo webhooks] pointing to your exposed url for each repo you want enabled. (TODO: Automatically establish these using GH API)
3. Populate .env using the [.env.example](./.env.example) template.
   - You can generate `GITHUB_WEBHOOK_SECRET` using [this tutorial](https://developer.github.com/webhooks/securing/).



# Planning Poker Slackbot with Github Integration

## Dev
Start ngrok: `ngrok http 4390`
Start smee: `smee -u https://smee.io/XdRfWzBeTgL2E94`

### Project Column List

- Fetch issues for project column
- Return interactive col list that can click issues

### Interactive Issues

- Render issues from being clicked in col list or by pasting link
- On interactive rendered issue add following action options:
  - Vote
  - (maybe) Add label or manually apply swag in place
  - Open in GH
  - View comments

### Voting

- Similar to current planning-poker slack bot
- Use pie chart
- Show who has voted
- Give user-specific options to revoke
- Give vote-close permissions only to user who initiated vote
  - If not possible, require that every logged in user votes or opts not to vote
- After vote give option to apply all the selected swags (in order of votes) to issue
