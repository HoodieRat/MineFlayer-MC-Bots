// scripts/mainController.js

// -----------------------------
// 1. Importing Required Modules
// -----------------------------
// Importing Required Modules
const { spawn } = require('child_process'); // Using spawn instead of fork
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalNear, GoalBlock } } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const minecraftData = require('minecraft-data'); // Ensure correct version of Minecraft data is loaded

// -----------------------------
// 2. Initializing Configurations
// -----------------------------

// Define directories
const BOTS_DIR = path.join(__dirname, '../bots');
const INDIVIDUAL_QTABLES_DIR = path.join(__dirname, '../individual');
const SHARED_QTABLES_DIR = path.join(__dirname, '../shared');
const LOGS_DIR = path.join(__dirname, '../logs');

// Ensure directories exist
[INDIVIDUAL_QTABLES_DIR, SHARED_QTABLES_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(info => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`)
  ),
  transports: [
    new winston.transports.File({ filename: path.join(LOGS_DIR, 'mainController.log') }),
    new winston.transports.Console()
  ]
});

// -----------------------------
// 3. Bot Management Setup
// -----------------------------

// Bot Management Setup
const activeBots = {};

function reconnectBot(botName) {
    logger.info(`Reconnecting bot: ${botName}`);
    createBot(botName);  // Use createBot instead of loadBot
}

// Keep-alive checks
setInterval(() => {
    Object.keys(activeBots).forEach(botName => {
        activeBots[botName].send({ type: 'keepAlive' });
    });
}, 5000);
// -----------------------------
// 4. Handling Bot Messages
// -----------------------------
// Function to create a new bot using spawn
function createBot(botName, role) {
  const botScript = path.join(__dirname, '../bots', `${botName}.js`);

  // Initialize Q-tables for the bot
  const botQTablePath = path.join(__dirname, '../individual', `${botName}_qtable.json`);
  const sharedQTablePath = path.join(__dirname, '../shared', 'mainQTable.json');
  const knowledgeBasePath = path.join(__dirname, '../shared', 'knowledgeBase.json');

  const botProcess = spawn('node', [
    botScript,
    '--log', path.join(__dirname, 'logs', `${botName}.log`),
    '--error-log', path.join(__dirname, 'error_logs', `${botName}_error.log`),
    '--crafter-pos', path.join(__dirname, 'crafter_positions', `${botName}_bot.json`)
  ], {
    env: {
      BOT_NAME: botName,
      BOT_ROLE: role,
      QTABLE_PATH: botQTablePath,
      SHARED_QTABLE_PATH: sharedQTablePath,
      KNOWLEDGE_BASE_PATH: knowledgeBasePath
    },
    stdio: 'inherit'
  });

  botProcess.on('close', (code) => {
    console.log(`${botName} bot exited with code ${code}, restarting...`);
    setTimeout(() => createBot(botName, role), 10000); // Retry after 10 seconds
  });

  activeBots[botName] = botProcess;
  console.log(`Bot ${botName} with role ${role} started.`);
}

// Monitoring Bot Joins
function monitorBotJoins() {
  const botsConfigPath = path.join(__dirname, '../shared/botsConfig.json');
  if (fs.existsSync(botsConfigPath)) {
    const botsConfig = JSON.parse(fs.readFileSync(botsConfigPath, 'utf8'));
    botsConfig.forEach(({ name, role }) => {
      if (!activeBots[name]) {
        createBot(name, role);  // Use createBot here
      }
    });
  } else {
    console.warn('botsConfig.json not found.');
  }
}

// Call monitorBotJoins to start bots
monitorBotJoins();



// Function to update shared knowledge base
function updateSharedKnowledge(newData) {
  const sharedKnowledgePath = path.join(SHARED_QTABLES_DIR, 'knowledgeBase.json');

  let sharedKnowledge = {};
  if (fs.existsSync(sharedKnowledgePath)) {
    sharedKnowledge = JSON.parse(fs.readFileSync(sharedKnowledgePath, 'utf8'));
  }

  // Merge newData into sharedKnowledge
  sharedKnowledge = { ...sharedKnowledge, ...newData };

  // Write back to the file
  fs.writeFileSync(sharedKnowledgePath, JSON.stringify(sharedKnowledge, null, 2), 'utf8');

  logger.info('Shared knowledge base has been updated.');
}

// Function to handle help requests from bots
function handleHelpRequest(requestingBot, helpData) {
  const { helpType, details } = helpData;

  logger.info(`Bot ${requestingBot} is requesting help: ${helpType}`);

  // Implement logic based on helpType
  // For example, delegate tasks to other bots
  // This can be expanded based on specific requirements

  // Example: If helpType is 'resource_gather', find an available bot to assist
  if (helpType === 'resource_gather') {
    const assistingBots = Object.keys(activeBots).filter(bot => bot !== requestingBot && !isBotBusy(bot));

    if (assistingBots.length > 0) {
      const helperBot = assistingBots[0];
      const helperProcess = activeBots[helperBot];

      // Send assistance message to the helper bot
      helperProcess.send({ type: 'assist', data: details });

      logger.info(`Delegated ${helpType} to ${helperBot} for bot ${requestingBot}.`);
    } else {
      logger.warn(`No available bots to assist ${requestingBot} with ${helpType}.`);
    }
  }

  // Implement other helpTypes as needed
}

// Function to check if a bot is busy (can be expanded based on bot status)
function isBotBusy(botName) {
  // Placeholder: Implement logic to determine if a bot is busy
  // For example, check if the bot has an ongoing task
  return false;
}
// scripts/mainController.js (Continuing from Part 1)

// -----------------------------
// 5. Dynamic Q-Table Management
// -----------------------------

// Helper function to load a Q-table or create a new one if it doesn't exist
function loadQTable(qTablePath, defaultData = {}) {
  if (fs.existsSync(qTablePath)) {
    try {
      return JSON.parse(fs.readFileSync(qTablePath, 'utf8'));
    } catch (err) {
      logger.error(`Failed to parse Q-table at ${qTablePath}: ${err.message}`);
    }
  }
  logger.warn(`Q-table not found at ${qTablePath}, creating a new one.`);
  return defaultData;
}

// Refactored initializeQTable using the loadQTable helper function
function initializeQTable(botName, role) {
  const botQTablePath = path.join(INDIVIDUAL_QTABLES_DIR, `${botName}_qtable.json`);
  const roleQTablePath = path.join(SHARED_QTABLES_DIR, `${role}_qtable.json`);
  const mainQTablePath = path.join(SHARED_QTABLES_DIR, 'mainQTable.json');

  // Log the Q-table paths being loaded
  logger.info(`Loading Q-tables for bot: ${botName}, role: ${role}`);
  
  // Load main, role-specific, and bot-specific Q-tables
  let mainQTable = loadQTable(mainQTablePath);
  let roleQTable = loadQTable(roleQTablePath);
  let botQTable = loadQTable(botQTablePath, { ...mainQTable, ...roleQTable });

  // If the bot-specific Q-table doesn't exist, create and save a new one
  if (!fs.existsSync(botQTablePath)) {
    try {
      fs.writeFileSync(botQTablePath, JSON.stringify(botQTable, null, 2), 'utf8');
      logger.info(`Created new Q-table for ${botName} at ${botQTablePath}`);
    } catch (err) {
      logger.error(`Failed to create Q-table for ${botName}: ${err.message}`);
    }
  }

  return botQTablePath;
}


// -----------------------------
// 6. Loading Bots with Dynamic Q-Tables
// -----------------------------





// -----------------------------
// 7. Monitoring Bot Join Events
// -----------------------------


// -----------------------------
// 3. Bot Management Setup
// -----------------------------

// Object to keep track of active bots
const activeBots = {};

// Function to create a new bot using spawn
function createBot(botName, role) {
  const botScript = path.join(__dirname, '../bots', `${botName}.js`);

  // Initialize Q-tables for the bot
  const botQTablePath = path.join(__dirname, '../individual', `${botName}_qtable.json`);
  const sharedQTablePath = path.join(__dirname, '../shared', 'mainQTable.json');
  const knowledgeBasePath = path.join(__dirname, '../shared', 'knowledgeBase.json');

  const botProcess = spawn('node', [
    botScript,
    '--log', path.join(__dirname, 'logs', `${botName}.log`),
    '--error-log', path.join(__dirname, 'error_logs', `${botName}_error.log`),
    '--crafter-pos', path.join(__dirname, 'crafter_positions', `${botName}_bot.json`)
  ], {
    env: {
      BOT_NAME: botName,
      BOT_ROLE: role,
      QTABLE_PATH: botQTablePath,
      SHARED_QTABLE_PATH: sharedQTablePath,
      KNOWLEDGE_BASE_PATH: knowledgeBasePath
    },
    stdio: 'inherit'
  });

  botProcess.on('close', (code) => {
    console.log(`${botName} bot exited with code ${code}, restarting...`);
    setTimeout(() => createBot(botName, role), 10000); // Retry after 10 seconds
  });

  activeBots[botName] = botProcess;
  console.log(`Bot ${botName} with role ${role} started.`);
}

// Function to monitor bots and add new ones
function monitorBotJoins() {
  const botsConfigPath = path.join(__dirname, '../shared/botsConfig.json');
  if (fs.existsSync(botsConfigPath)) {
    const botsConfig = JSON.parse(fs.readFileSync(botsConfigPath, 'utf8'));
    botsConfig.forEach(({ name, role }) => {
      if (!activeBots[name]) {
        createBot(name, role);  // Use createBot here
      }
    });
  } else {
    console.warn('botsConfig.json not found.');
  }
}

// Call monitorBotJoins to start bots
monitorBotJoins();

// scripts/mainController.js (Continuing from Part 2)

// -----------------------------
// 8. Graceful Shutdown Handling
// -----------------------------

// Function to gracefully shut down all bots
function shutdownAllBots() {
  logger.info('Shutting down all active bots...');
  Object.keys(activeBots).forEach(botName => {
    const botProcess = activeBots[botName];
    botProcess.kill();
    logger.info(`Bot ${botName} has been terminated.`);
  });
}

// Handle process termination signals
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Initiating shutdown...');
  shutdownAllBots();
  process.exit();
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Initiating shutdown...');
  shutdownAllBots();
  process.exit();
});

// -----------------------------
// 9. Initializing Shared Knowledge and Q-Tables
// -----------------------------

// Function to initialize shared knowledge base if not present
function initializeSharedKnowledge() {
  const knowledgeBasePath = path.join(SHARED_QTABLES_DIR, 'knowledgeBase.json');
  if (!fs.existsSync(knowledgeBasePath)) {
    const initialKnowledge = {
      recipes: {},
      structures: [],
      sharedResources: {}
    };
    fs.writeFileSync(knowledgeBasePath, JSON.stringify(initialKnowledge, null, 2), 'utf8');
    logger.info('Initialized shared knowledge base.');
  }
}

// Function to initialize main Q-table if not present
function initializeMainQTable() {
  const mainQTablePath = path.join(SHARED_QTABLES_DIR, 'mainQTable.json');
  if (!fs.existsSync(mainQTablePath)) {
    const initialMainQTable = {};
    fs.writeFileSync(mainQTablePath, JSON.stringify(initialMainQTable, null, 2), 'utf8');
    logger.info('Initialized main Q-table.');
  }
}

// Call initialization functions
initializeSharedKnowledge();
initializeMainQTable();
// scripts/mainController.js (Continuing from Part 3)

// -----------------------------
// 10. Linking Q-Tables with Weighting
// -----------------------------

// Function to link a bot's Q-table with role and main Q-table
// -----------------------------
// 10. Linking Q-Tables with Weighting
// -----------------------------

// Function to link a bot's Q-table with role and main Q-table
function linkQTables(botQTablePath, roleQTablePath, mainQTablePath) {
  let botQTable = {};
  let roleQTable = {};
  let mainQTable = {};

  // Load main Q-table
  if (fs.existsSync(mainQTablePath)) {
    try {
      mainQTable = JSON.parse(fs.readFileSync(mainQTablePath, 'utf8'));
    } catch (error) {
      logger.error(`Error parsing main Q-table at ${mainQTablePath}: ${error.message}`);
      mainQTable = {}; // Initialize an empty Q-table if parsing fails
    }
  } else {
    logger.warn(`Main Q-table not found at ${mainQTablePath}. Initializing a new empty Q-table.`);
    mainQTable = {};
  }

  // Load role-specific Q-table
  if (fs.existsSync(roleQTablePath)) {
    try {
      roleQTable = JSON.parse(fs.readFileSync(roleQTablePath, 'utf8'));
    } catch (error) {
      logger.error(`Error parsing role Q-table at ${roleQTablePath}: ${error.message}`);
      roleQTable = {}; // Initialize an empty Q-table if parsing fails
    }
  } else {
    logger.warn(`Role-specific Q-table not found at ${roleQTablePath}. Initializing a new empty Q-table.`);
    roleQTable = {};
  }

  // Load bot-specific Q-table
  if (fs.existsSync(botQTablePath)) {
    try {
      const qTableData = fs.readFileSync(botQTablePath, 'utf8');
      botQTable = JSON.parse(qTableData);
      ensureDefaultStates(botQTable); // Ensure all default states are defined
    } catch (error) {
      logger.error(`Error parsing bot-specific Q-table at ${botQTablePath}: ${error.message}`);
      botQTable = {}; // Initialize an empty Q-table if parsing fails
    }
  } else {
    logger.warn(`Bot-specific Q-table not found at ${botQTablePath}. Initializing a new empty Q-table.`);
    botQTable = {};
  }

  // Merge Q-tables with weighting
  const weightedQTable = {};

  // Iterate over states in main Q-table
  Object.keys(mainQTable).forEach(state => {
    weightedQTable[state] = { ...mainQTable[state] };
  });

  // Merge role Q-table with weight
  Object.keys(roleQTable).forEach(state => {
    if (!weightedQTable[state]) {
      weightedQTable[state] = {};
    }
    Object.keys(roleQTable[state]).forEach(action => {
      if (!weightedQTable[state][action]) {
        weightedQTable[state][action] = 0;
      }
      weightedQTable[state][action] += roleQTable[state][action] * 0.3;
    });
  });

  // Merge bot Q-table with weight
  Object.keys(botQTable).forEach(state => {
    if (!weightedQTable[state]) {
      weightedQTable[state] = {};
    }
    Object.keys(botQTable[state]).forEach(action => {
      if (!weightedQTable[state][action]) {
        weightedQTable[state][action] = 0;
      }
      weightedQTable[state][action] += botQTable[state][action] * 0.2;
    });
  });

  // Save the merged Q-table back to bot's Q-table
  fs.writeFileSync(botQTablePath, JSON.stringify(weightedQTable, null, 2), 'utf8');

  logger.info(`Linked and weighted Q-tables for bot Q-table at ${botQTablePath}`);
}

// scripts/mainController.js (Continuing from Part 4)

// -----------------------------
// 11. Finalizing Main Controller Logic
// -----------------------------

// Function to ensure default states and actions in a Q-table
function ensureDefaultStates(qTable) {
  const defaultStates = {
    state_idle: { explore: 0.5, gather: 0.5, craft: 0.0 },
    state_mining: { dig: 0.7, explore: 0.2, gather: 0.1 },
    state_building: { placeBlock: 0.6, explore: 0.3, gather: 0.1 },
  };

  Object.keys(defaultStates).forEach(state => {
    if (!qTable[state]) {
      qTable[state] = defaultStates[state];
    }
  });
}

// Function to dynamically link Q-tables upon bot initialization
function finalizeBotInitialization(botName, role) {
  const botQTablePath = path.join(INDIVIDUAL_QTABLES_DIR, `${botName}_qtable.json`);
  const roleQTablePath = path.join(SHARED_QTABLES_DIR, `${role}_qtable.json`);
  const mainQTablePath = path.join(SHARED_QTABLES_DIR, 'mainQTable.json');

  // Link Q-tables with weighting
  linkQTables(botQTablePath, roleQTablePath, mainQTablePath);

  // Load the bot-specific Q-table to ensure defaults are set
  let botQTable = {};
  try {
    botQTable = JSON.parse(fs.readFileSync(botQTablePath, 'utf8'));
    ensureDefaultStates(botQTable);  // Ensure default states after loading
    fs.writeFileSync(botQTablePath, JSON.stringify(botQTable, null, 2), 'utf8');  // Save the updated Q-table
    logger.info(`Updated Q-table for ${botName} with default states.`);
  } catch (err) {
    logger.error(`Error loading or saving the bot Q-table for ${botName}: ${err.message}`);
  }
}

botConfigs.forEach(config => {
    createBot(config.name, config.role); // Use createBot instead of addNewBot
});

// -----------------------------
// 12. Starting the Main Controller
// -----------------------------

// Initialize shared knowledge and Q-tables
initializeSharedKnowledge();
initializeMainQTable();

// Start monitoring bot joins
monitorBotJoins();

// Log that the main controller is running
logger.info('Main Controller is up and running, managing all bots.');