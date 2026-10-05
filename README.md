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

The repository also contains a Dockerfile and the original GitHub Actions
workflow for building a container and deploying it to Google Cloud Run. The
database is separate from the bot container.

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

## Configuration

Copy `.env.example` to `.env` and set your own bot token and PostgreSQL connection
values. Keep the file local. When running a container, supply those values at
runtime; do not put them in the Dockerfile or image.

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
`date_of_transaction` columns. A compatible database is needed before starting
the app with `npm ci` and `npm start`.

## Project status

This is the original learning project, kept as a historical example. The 2026
repository cleanup removes credential examples and unused files, adds ignore
rules, and documents the code. It does not modernize the application.

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

## License

See [LICENSE](LICENSE) for the GNU GPL v3 terms.
