# **N-01** — Launch Instructions

A desktop-style, web-based puzzle game.

## Play in Browser

Double-click the `index.html` file in the project's root directory to play offline using Microsoft Edge or Google Chrome. All game assets are embedded in this file, allowing it to be copied and shared independently.

If the browser blocks the opening video from autoplaying, click **"Start Game"** to continue.

After updating the game, run the following commands in the project directory to rebuild the web version:

```bash
npm install
npm run build:web
```

## Development Setup

To launch the game in development mode, run the following command in the VS Code terminal:

```bash
npm start
```

The project is developed using **HTML, CSS, JavaScript, and Electron**.

`src/index.html` serves as the interface entry point loaded internally by Electron. It is not intended to be opened directly by players or developers.