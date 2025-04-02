const packageJson = `{
  "name": "wiz-coin-bot",
  "version": "1.0.0",
  "description": "A Telegram bot with Wiz Coin economy system",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "telegraf": "^4.7.0",
    "dotenv": "^16.0.3",
    "express": "^4.18.2"
  }
}`;

require('fs').writeFileSync('package.json', packageJson);
