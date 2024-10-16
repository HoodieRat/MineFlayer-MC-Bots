const fs = require('fs');
const path = require('path');

// Paths
const botsConfigPath = path.join(__dirname, 'shared', 'botsConfig.json');
const individualDir = path.join(__dirname, 'individual');
const botsDir = path.join(__dirname, 'bots');
const sharedDir = path.join(__dirname, 'shared');

// Ensure necessary directories exist
const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
};
ensureDirExists(individualDir);
ensureDirExists(botsDir);
ensureDirExists(sharedDir);

// Load and parse botsConfig.json
let botsConfig = null;
try {
  if (fs.existsSync(botsConfigPath)) {
    const fileContents = fs.readFileSync(botsConfigPath, 'utf8');
    botsConfig = JSON.parse(fileContents);
  } else {
    throw new Error(`botsConfig.json not found at ${botsConfigPath}`);
  }
} catch (error) {
  console.error(`Error reading botsConfig.json: ${error.message}`);
  process.exit(1); // Exit the script if botsConfig.json cannot be loaded
}

// Since botsConfig is an array, iterate directly over it
if (!Array.isArray(botsConfig)) {
  console.error('Invalid botsConfig.json format: Expected an array.');
  process.exit(1);
}

// Template for generating Q-table for individual bots
const qTableTemplate = (role) => {
  return {}; // Start with an empty Q-table for individual bots
};

// Template for generating role-specific Q-tables
const roleQTableTemplate = (role) => {
  switch (role.toLowerCase()) {
    case 'miner':
      return {
        state_idle: { explore: 0.3, gather: 0.5, craft: 0.2 },
        state_mining: { dig: 0.7, explore: 0.2, gather: 0.1 }
      };
    case 'builder':
      return {
        state_idle: { explore: 0.4, gather: 0.4, craft: 0.2 },
        state_building: { placeBlock: 0.6, explore: 0.3, gather: 0.1 }
      };
    case 'explorer':
      return {
        state_idle: { explore: 0.7, gather: 0.2, craft: 0.1 },
        state_exploring: { discover: 0.6, gather: 0.3, avoid: 0.1 }
      };
    default:
      return { state_idle: { explore: 0.5, gather: 0.3, craft: 0.2 } };
  }
};

// Template for generating bot script
const botScriptTemplate = (botName, role) => `
const { createBot } = require('../scripts/genericBot');

// Create bot with specific configuration
createBot({
  botName: '${botName}',
  role: '${role}',
  version: '1.20.6',
  host: '127.0.0.1', // Use your server IP
  port: 25565
});
`;

// Proceed with bot generation
botsConfig.forEach(bot => {
  const botName = bot.name;
  const botRole = bot.role || 'default'; // Default to 'default' role if missing

  console.log(`Generating files for bot: ${botName}, role: ${botRole}`);
  
  // Generate individual Q-table if it doesn't exist
  const qTablePath = path.join(individualDir, `${botName}_qtable.json`);
  if (!fs.existsSync(qTablePath)) {
    try {
      const qTableContent = JSON.stringify(qTableTemplate(botRole), null, 2);
      fs.writeFileSync(qTablePath, qTableContent, 'utf8');
      console.log(`Created individual Q-table for ${botName} at ${qTablePath}`);
    } catch (err) {
      console.error(`Error creating individual Q-table for ${botName}: ${err.message}`);
    }
  } else {
    console.log(`Individual Q-table for ${botName} already exists. Skipping creation.`);
  }

  // Generate bot script if it doesn't exist
  const botScriptPath = path.join(botsDir, `${botName}.js`);
  if (!fs.existsSync(botScriptPath)) {
    try {
      const botScriptContent = botScriptTemplate(botName, botRole);
      fs.writeFileSync(botScriptPath, botScriptContent, 'utf8');
      console.log(`Created bot script for ${botName} at ${botScriptPath}`);
    } catch (err) {
      console.error(`Error creating bot script for ${botName}: ${err.message}`);
    }
  } else {
    console.log(`Bot script for ${botName} already exists. Skipping creation.`);
  }

  // Generate role-specific Q-table if it doesn't exist
  const roleQTablePath = path.join(sharedDir, `${botRole.toLowerCase()}_qtable.json`);
  if (!fs.existsSync(roleQTablePath)) {
    try {
      const roleQTableContent = JSON.stringify(roleQTableTemplate(botRole), null, 2);
      fs.writeFileSync(roleQTablePath, roleQTableContent, 'utf8');
      console.log(`Created role-specific Q-table for role '${botRole}' at ${roleQTablePath}`);
    } catch (err) {
      console.error(`Error creating role-specific Q-table for role '${botRole}': ${err.message}`);
    }
  } else {
    console.log(`Role-specific Q-table for role '${botRole}' already exists. Skipping creation.`);
  }
});

// Create main Q-table if it doesn't exist
const mainQTablePath = path.join(sharedDir, 'mainQTable.json');
if (!fs.existsSync(mainQTablePath)) {
  try {
    const mainQTableContent = JSON.stringify({
      state_idle: { explore: 0.4, gather: 0.3, craft: 0.3 },
      state_working: { gather: 0.5, explore: 0.2, craft: 0.3 }
    }, null, 2);
    fs.writeFileSync(mainQTablePath, mainQTableContent, 'utf8');
    console.log(`Created main Q-table at ${mainQTablePath}`);
  } catch (err) {
    console.error(`Error creating main Q-table: ${err.message}`);
  }
} else {
  console.log(`Main Q-table already exists. Skipping creation.`);
}
