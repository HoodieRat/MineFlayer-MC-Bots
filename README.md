# Minecraft Bot Program - README

## Overview

This program sets up a Minecraft bot using **Mineflayer** to perform specific roles such as **mining**, **building**, **exploring**, and **resource gathering**. The bot is capable of learning through a **Q-learning mechanism** to dynamically update its behaviors based on previous actions and outcomes. It interacts with the game world through the **Mineflayer Pathfinder** plugin, making decisions based on its role and the current environment.

## Features
- **Bot Roles**: Choose from predefined roles (miner, builder, explorer, etc.), with each role performing specific tasks.
- **Q-learning**: The bot uses a Q-table to learn from its actions, dynamically adjusting its behaviors.
- **Pathfinding**: The bot uses Mineflayer's pathfinder plugin to navigate the Minecraft world and complete tasks.
- **Resource Gathering**: The bot can gather resources, mine ores, and craft tools when necessary.
- **Crafting and Building**: The bot can craft items, build structures, and place blocks based on predefined or dynamically generated instructions.
- **Logging**: All major bot activities are logged for debugging and tracking purposes.
- **Inter-Bot Communication**: The bot can request help from other bots or assist other bots in resource gathering and building.

## Prerequisites

Ensure you have the following installed before running the program:

1. **Node.js** (v14 or later)
2. **Minecraft Java Edition** (version 1.20.6 or compatible)
3. **Mineflayer** and its plugins (pathfinder)

## Installation

### 1. Clone the Repository

First, clone the repository where the bot program is located:

    git clone <your-repo-url>
    cd <your-repo-folder>

### 2. Install Dependencies

Run the following command to install the required dependencies listed in `package.json`:

    npm install

Dependencies include:
- `mineflayer` - the main bot library
- `mineflayer-pathfinder` - for pathfinding and navigation
- `vec3` - for 3D vector calculations
- `winston` - for logging
- `fs` - for file system operations
- `path` - for handling file paths
- `minecraft-data` - for accessing Minecraft's block and item data

### 3. Configure Environment Variables

The bot can be configured using environment variables. Here are the key ones to set in your environment:

- `BOT_NAME` - it pulls the names from the botsConfig.json file
- `BOT_ROLE` - The role of your bot (default: 'miner')
- `QTABLE_PATH` - The path to the individual bot’s Q-table
- `SHARED_QTABLE_PATH` - The path to the shared Q-table used by multiple bots
- `KNOWLEDGE_BASE_PATH` - The path to the knowledge base JSON file

Example `.env` file:

    BOT_NAME=GenericBot
    BOT_ROLE=miner
    QTABLE_PATH=./individual/default_qtable.json
    SHARED_QTABLE_PATH=./shared/mainQTable.json
    KNOWLEDGE_BASE_PATH=./shared/knowledgeBase.json

### 4. Run the Bot

To start the bot, simply run:

    node bot.js

The bot will attempt to connect to your local Minecraft server and start performing tasks based on its role.

### 5. Logs

The bot will generate log files in the `logs` directory, tracking its actions, decisions, and errors. This is useful for debugging and understanding the bot's behavior.

## Additional Configuration

- The bot's knowledge base, Q-table, and other data can be manually edited in the `shared` and `individual` directories. 
- The bot will dynamically update these files during gameplay based on its learning and task completion.

## Troubleshooting

- **Bot Disconnects**: If the bot disconnects, it will attempt to reconnect after 10 seconds.
- **No Resources Found**: If the bot cannot find resources for its role, it will switch to exploration mode or request assistance from other bots.
- **Pathfinding Issues**: If the bot encounters pathfinding issues, it will log the error and attempt to re-path or switch tasks.

## License

This project is licensed under the MIT License.
