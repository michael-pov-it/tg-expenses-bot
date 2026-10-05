# Family budget Telegram bot

A small project I built with help from ChatGPT to track expenses with my wife in
a shared Telegram group. The original bot code dates back to February 2023.

ChatGPT helped during development. The bot itself does not call an AI model.

## How it works

- A Node.js process receives Telegram messages by polling the Bot API.
- `/add` asks for income or spending, an amount, and a category.
- Transactions are stored in PostgreSQL.
- SQL queries calculate category balances and list transactions.
- Replies are sent back to the Telegram chat.

The original project ran in Docker and used GitHub Actions to deploy to Google
Cloud Run. The Dockerfile is included; the obsolete workflow tied to my personal
cloud setup was removed during cleanup. The database is separate from the bot
container.

## Commands

| Command | Purpose |
| --- | --- |
| `/add` | Record income or spending through a series of questions. |
| `/budget` | Show category balances that are zero or positive. |
| `/last` | List transactions from the current month. |
| `/transactions` | List stored transactions with their IDs. |
| `/list income` | Total income by category, for entries with an amount above 1. |
| `/list spending` | Total spending by category, for entries with an amount above 1. |
| `/delete category` | Delete transactions in the named category. |

## Local setup

You need Node.js, npm, a Telegram bot token from BotFather, and a PostgreSQL
database. This is a historical demo with the limitations listed below.

```sh
git clone https://github.com/michael-pov-it/tg-expenses-bot.git
cd tg-expenses-bot
npm ci
cp .env.example .env
```

Edit `.env` to set your own bot token and PostgreSQL connection values. The blank
`BOT_TOKEN` and `DB_PASSWORD` values must be filled in. Keep the file local.

| Variable | Purpose |
| --- | --- |
| `BOT_TOKEN` | Token issued by Telegram's BotFather. |
| `DB_HOST` | PostgreSQL hostname. |
| `DB_PORT` | PostgreSQL port, usually `5432`. |
| `DB_NAME` | Database name. |
| `DB_USERNAME` | Database user. |
| `DB_PASSWORD` | Database password. |
| `CURRENCY` | Original currency setting; see the limitations below. |

The original database schema is not included. The main commands expect a
`budget` table with `id`, `type`, `category`, `amount`, and
`date_of_transaction` columns. The database must generate the transaction ID and
timestamp when a row is inserted. After configuring a compatible database:

```sh
npm start
```

To try the original container:

```sh
docker build -t tg-expenses-bot .
docker run --rm --env-file .env tg-expenses-bot
```

Set `DB_HOST` to an address reachable from inside the container. Supply
credentials at runtime; do not put them in the Dockerfile or image.

## Project status

This is the original learning project, kept as a historical example. The 2026
repository cleanup removes unused files and personal deployment configuration,
corrects package metadata, keeps runtime dependencies in `dependencies`, and
documents the code. The dependency versions and bot behavior remain those of
the original project.

Known limitations in the original code:

- The runtime and dependencies are old; the Dockerfile still uses Node.js 16.
- Commands do not restrict access by user or isolate data by chat.
- Multi-step input uses global message listeners, so simultaneous conversations
  can interfere with each other.
- Amount validation and currency selection need fixes.
- `/update` expects columns from an older schema and needs rework.
- A webhook route is present, but the bot is configured to use polling.

Do not use this version for a public bot or sensitive financial data without
addressing those issues. Previously committed credentials must be revoked or
rotated; removing them from current files does not invalidate them or erase old
commits.

## Contributing

Issues and small fixes are welcome. Include reproduction steps for a bug and
explain how you checked a change. Never include bot tokens, database passwords,
database backups, or real transaction data in an issue or pull request.

## License

See [LICENSE](LICENSE) for the GNU GPL v3 terms.
