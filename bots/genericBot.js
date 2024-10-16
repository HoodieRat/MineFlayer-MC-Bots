// -----------------------------
// 1. Importing Required Modules
// -----------------------------

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

const BOT_NAME = process.env.BOT_NAME || 'GenericBot';
const BOT_ROLE = process.env.BOT_ROLE || 'miner';
const QTABLE_PATH = process.env.QTABLE_PATH || path.join(__dirname, '../individual/default_qtable.json');
const SHARED_QTABLE_PATH = process.env.SHARED_QTABLE_PATH || path.join(__dirname, '../shared/mainQTable.json');
const KNOWLEDGE_BASE_PATH = process.env.KNOWLEDGE_BASE_PATH || path.join(__dirname, '../shared/knowledgeBase.json');

// Ensure necessary directories exist
const INDIVIDUAL_QTABLES_DIR = path.dirname(QTABLE_PATH);
const SHARED_DIR = path.dirname(SHARED_QTABLE_PATH);
const LOGS_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

[INDIVIDUAL_QTABLES_DIR, SHARED_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
// -----------------------------
// 3. Configuring Advanced Logging
// -----------------------------

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(info => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`)
  ),
  transports: [
    new winston.transports.File({ filename: path.join(LOGS_DIR, `${BOT_NAME}.log`) }),
    new winston.transports.Console()
  ]
});

function logInfo(message) {
  logger.info(message);
}

function logError(message) {
  logger.error(message);
}

function logWarn(message) {
  logger.warn(message);
}
// -----------------------------
// 4. Loading Shared Knowledge Base
// -----------------------------

let knowledgeBase = {};
if (fs.existsSync(KNOWLEDGE_BASE_PATH)) {
  try {
    knowledgeBase = JSON.parse(fs.readFileSync(KNOWLEDGE_BASE_PATH, 'utf8'));
    logInfo('Shared knowledge base loaded successfully.');
  } catch (err) {
    logError(`Failed to parse knowledge base: ${err.message}`);
  }
} else {
  logWarn('Shared knowledge base not found. Initializing empty knowledge base.');
  knowledgeBase = {
    recipes: {},
    structures: [],
    sharedResources: {}
  };
}
// -----------------------------
// 5. Loading and Initializing Q-Tables
// -----------------------------

let mainQTable = {};
if (fs.existsSync(SHARED_QTABLE_PATH)) {
  try {
    mainQTable = JSON.parse(fs.readFileSync(SHARED_QTABLE_PATH, 'utf8'));
    logInfo('Main Q-table loaded successfully.');
  } catch (err) {
    logError(`Failed to parse main Q-table: ${err.message}`);
  }
} else {
  logWarn('Main Q-table not found. Initializing empty main Q-table.');
  mainQTable = {};
}

let individualQTable = {};
if (fs.existsSync(QTABLE_PATH)) {
  try {
    individualQTable = JSON.parse(fs.readFileSync(QTABLE_PATH, 'utf8'));
    logInfo('Individual Q-table loaded successfully.');
  } catch (err) {
    logError(`Failed to parse individual Q-table: ${err.message}`);
  }
} else {
  logWarn('Individual Q-table not found. Creating a new Q-table.');
  individualQTable = { ...mainQTable };
  fs.writeFileSync(QTABLE_PATH, JSON.stringify(individualQTable, null, 2), 'utf8');
  logInfo(`New Q-table created at ${QTABLE_PATH}`);
}
// -----------------------------
// 6. Initializing the Mineflayer Bot
// -----------------------------

// Path for logs
const logDir = path.join(__dirname, 'logs');
const logFile = path.join(logDir, 'pathlog.txt');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Logging function to write to file
const logToFile = (message) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
};


// Initialize the Bot
let botInstance = createBot();
// Global variable for tracking last activity
let lastActiveTime = Date.now(); // Initialize when the bot starts

function createBot() {
    logToFile(`${BOT_NAME} is attempting to connect to the server...`);
    const newBot = mineflayer.createBot({
        host: '127.0.0.1', // Replace with your actual server host
        port: 25565,       // Replace with your server port
        username: BOT_NAME,
        version: '1.20.6'
    });

    // Load the pathfinder plugin
    newBot.loadPlugin(pathfinder);
    logToFile('Attempting to load pathfinder plugin.');

    // Initialize bot state flags
    newBot.isDigging = false;
    newBot.isMoving = false;
    newBot.isBuilding = false;
    newBot.isCrafting = false;
    newBot.isRetreating = false;
    newBot.isDefending = false;
    newBot.isJumping = false;
    newBot.isBusy = false; // Added to track overall busy state

    // Handle the bot's spawn event
newBot.once('spawn', async () => {
    logToFile(`${BOT_NAME} has spawned.`);

    const mcData = minecraftData(newBot.version);

    // Create a new Movements instance and set parameters
    const movements = new Movements(newBot, mcData);
    movements.allowSprinting = false; // Disable sprinting to reduce fast movements
    movements.maxStepHeight = 1;      // Prevent high jumps that might trigger warnings
    movements.canDig = true;          // Ensure digging if it's being obstructed
    
    // Apply the movements to the bot's pathfinder
    newBot.pathfinder.setMovements(movements);

    logToFile('Movements configured for the bot.');

    // Start gathering resources or perform specific tasks
    gatherResources(newBot); // This function should be defined to handle gathering

    // Reset lastActiveTime after spawning
    lastActiveTime = Date.now();

    // Keep the connection alive
    setInterval(() => {
        if (newBot) {
            newBot.chat('I am still alive!');
            lastActiveTime = Date.now(); // Reset active time on keep-alive
        }
    }, 60000); // Send a message every 60 seconds

    // Start the activity checker
    setInterval(() => checkActivity(newBot), 1000); // Check every 1 second
});

    // Handle errors to prevent the bot from crashing
    newBot.on('error', (err) => {
        logError(`Error for ${BOT_NAME}: ${err.message}`);
    });

    // Handle bot disconnection and attempt to reconnect
    newBot.on('end', () => {
        logWarn(`${BOT_NAME} disconnected. Attempting to reconnect in 10 seconds...`);
        setTimeout(() => {
            logToFile(`Reconnecting ${BOT_NAME}...`);
            createBot(); // Recursively recreate the bot after disconnect
        }, 10000); // Reconnect after 10 seconds
    });

    // Update last active time on various events
    newBot.on('chat', () => { lastActiveTime = Date.now(); });
    newBot.on('move', () => { lastActiveTime = Date.now(); });
    newBot.on('digging', () => { lastActiveTime = Date.now(); });
    newBot.on('building', () => { lastActiveTime = Date.now(); });
    newBot.on('crafting', () => { lastActiveTime = Date.now(); });

    // Prevent idleness by gathering resources if inactive
    setInterval(() => {
        const now = Date.now();
        const idleThreshold = 10000; // 10 seconds idle threshold
        if (now - lastActiveTime > idleThreshold && !newBot.isBusy) {
            logInfo('Bot has been idle for more than 10 seconds. Initiating activity.');
            gatherResources(newBot); // Call resource gathering or exploration if idle for too long
        }
    }, 1000); // Check every second

    return newBot;
}
// Function to set up movements based on the bot's role
function setupMovements(movements) {
    switch (BOT_ROLE.toLowerCase()) {
        case 'miner':
            movements.canDig = true;
            movements.canPlace = false;
            movements.allowJump = false;
            break;
        case 'builder':
            movements.canDig = true;
            movements.canPlace = true;
            movements.allowJump = false;
            break;
        case 'explorer':
            movements.canDig = false;
            movements.canPlace = false;
            movements.allowJump = true;
            break;
        default:
            movements.canDig = true;
            movements.canPlace = true;
            movements.allowJump = false;
    }
}


module.exports = { createBot };  // <-- This ensures that createBot is exported correctly

// Utility for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Function to stop the bot from jumping
function preventJumping(bot) {
  botInstance.controlState.jump = false; // Ensure that the jump state is disabled
}

// Log the pathfinder loading (ensure this is not redundant)
logToFile('Attempting to load pathfinder plugin.');
botInstance.loadPlugin(pathfinder);
logToFile('Pathfinder plugin loaded.');
// -----------------------------
// 7. Implementing Q-Learning Mechanism
// -----------------------------

const learningRate = 0.1;    // How much newly acquired information overrides old information
const discountFactor = 0.9;  // The importance of future rewards
const explorationRate = 0.3; // Probability to explore random actions

// Function to choose the next action based on the current state
function chooseAction(state) {
  if (!individualQTable[state]) {
    logWarn(`No actions defined for state: ${state}. Initializing default actions.`);
    individualQTable[state] = { explore: 0, gather: 0, idle: 0 }; // Example default actions
  }
  
  if (Math.random() < explorationRate) {
    // Explore: choose a random action
    const actions = Object.keys(individualQTable[state] || {});
    if (actions.length === 0) return null;
    return actions[Math.floor(Math.random() * actions.length)];
  } else {
    // Exploit: choose the best known action
    const actions = individualQTable[state] || {};
    let bestAction = null;
    let maxQ = -Infinity;
    for (const action in actions) {
      if (actions[action] > maxQ) {
        maxQ = actions[action];
        bestAction = action;
      }
    }
    return bestAction;
  }
}
// Function to update the Q-table based on the action taken and the received reward
function updateQTable(state, action, reward, nextState) {
  const currentQ = individualQTable[state] ? individualQTable[state][action] || 0 : 0;
  const maxNextQ = individualQTable[nextState] ? Math.max(...Object.values(individualQTable[nextState])) : 0;
  const newQ = currentQ + learningRate * (reward + discountFactor * maxNextQ - currentQ);
  
  if (!individualQTable[state]) {
    individualQTable[state] = {};
  }
  individualQTable[state][action] = newQ;
  
  // Save the updated Q-table
  fs.writeFileSync(QTABLE_PATH, JSON.stringify(individualQTable, null, 2), 'utf8');
  
  logInfo(`Q-table updated: [${state}] ${action} => ${newQ.toFixed(2)}`);
}
// -----------------------------
// 8. Defining Bot Roles and Behaviors
// -----------------------------

// Event listener for when the bot spawns in the world
botInstance.once('spawn', () => {
  logInfo(`${BOT_NAME} has spawned as a ${BOT_ROLE}. Initiating role-specific behaviors.`);
  performRoleTasks();
});


function getCurrentState() {
  const inventory = botInstance.inventory.items();
  const resourcesLow = inventory.filter(item => item.name.includes('log')).length < 10;

  if (botInstance.isBusy) return 'busy';
  if (resourcesLow) return 'lowResources';
  if (needsBuilding()) return 'constructionNeeded';
  return 'idle';
}

function performRoleTasks() {
  const currentState = getCurrentState();
  const chosenAction = chooseAction(currentState);

  switch (chosenAction) {
    case 'gatherResources':
      gatherResources(botInstance);
      break;
    case 'buildStructure':
      buildStructure(chooseStructure());
      break;
    case 'craftItem':
      craftPickaxe(botInstance); // Or dynamically craft another tool
      break;
    default:
      logWarn(`No specific action for ${chosenAction}. Defaulting to idle.`);
      defaultBehavior();
  }
}

setInterval(() => {
  const now = Date.now();
  const idleThreshold = 10000;

  if (!botInstance.isBusy && (now - lastActiveTime > idleThreshold)) {
    logInfo('Bot is idle, initiating task.');
    performRoleTasks();
  }
}, 1000); // Check every second
// Function to check the bot's activity and prevent it from getting stuck
function checkActivity(bot) {
  const now = Date.now();
  const idleThreshold = 10000; // 10 seconds idle threshold

  if (now - lastActiveTime > idleThreshold && !bot.isBusy) {
    logInfo('Bot has been idle for more than 10 seconds. Initiating gathering tasks.');
    gatherResources(bot); // Re-initiate gathering if the bot has been idle for too long
  }
}
function updateAfterAction(state, action, success) {
  const reward = success ? 10 : -10; // Example reward values
  const nextState = getCurrentState(); // Determine the new state after the action
  
  updateQTable(state, action, reward, nextState); // Update Q-table based on the outcome
}


//---------------------------------
// 9. Miner Behavior Implementation
// -----------------------------

// Function to equip the best tool for the job
async function equipBestTool(targetBlock) {
  const toolMappings = {
    'stone': 'pickaxe',
    'iron_ore': 'pickaxe',
    'coal_ore': 'pickaxe',
    'gold_ore': 'pickaxe',
    'diamond_ore': 'pickaxe',
    'redstone_ore': 'pickaxe',
    'dirt': 'shovel',
    'grass': 'shovel',
    'sand': 'shovel',
    'oak_log': 'axe',
    'birch_log': 'axe',
    'spruce_log': 'axe',
    'jungle_log': 'axe',
    'acacia_log': 'axe',
    'dark_oak_log': 'axe'
  };

  const requiredToolType = toolMappings[targetBlock.name];

  if (!requiredToolType) {
    logWarn(`No tool required for block: ${targetBlock.name}`);
    return;
  }

  const bestTool = botInstance.inventory.findInventoryItem(requiredToolType, null);

  if (!bestTool) {
    // Request help for the missing tool
    logWarn(`No suitable tool found for ${targetBlock.name}. Initiating crafting sequence...`);
    await craftPickaxe(botInstance); // Craft a pickaxe if none found
    return;
  }

  try {
    await botInstance.equip(bestTool, 'hand');
    logInfo(`Equipped ${bestTool.name} for mining ${targetBlock.name}`);
  } catch (error) {
    logError(`Failed to equip tool: ${error.message}`);
  }
}

async function mineBlock(bot, block) {
    if (!block) {
        logError('No block specified to mine.');
        return;
    }

    logInfo(`Attempting to mine block: ${block.name} at ${block.position}`);

    try {
        bot.isDigging = true; // Set digging state
        bot.isBusy = true; // Set busy state before starting the dig
        
        // Digging loop
        while (block) {
            // Attempt to dig the block
            await bot.dig(block);

            // Check if the block still exists after trying to dig
            const targetBlock = bot.blockAt(block.position);
            if (targetBlock && targetBlock.name === block.name) {
                // If the block is still there, wait briefly before trying to dig again
                await delay(100); // Adjust the delay as needed
            } else {
                // The block was successfully mined or has changed
                logInfo(`Successfully mined block: ${block.name}`);
                await learnRecipe(bot, block.name); // Learn the recipe for the mined block
                break; // Exit the loop if the block is gone
            }
        }
    } catch (error) {
        logError(`Error mining block: ${error.message}`);
    } finally {
        bot.isDigging = false; // Reset digging state
        bot.isBusy = false; // Reset busy state
        logInfo('Mining action completed.');
    }
}

// Utility for delay

// Miner behavior with dynamic resource gathering and crafting
function minerBehavior(bot) {
  const miningTargets = ['stone', 'iron_ore', 'coal_ore', 'gold_ore', 'diamond_ore', 'redstone_ore'];

  setInterval(async () => {
    if (bot.isBusy) return; // Prevent overlapping tasks

    const targetBlock = bot.findBlock({
      matching: block => miningTargets.includes(block.name),
      maxDistance: 64,
      count: 1
    });

   if (targetBlock) {
    bot.isBusy = true;
    try {
        await bot.pathfinder.goto(new GoalBlock(targetBlock.position.x, targetBlock.position.y, targetBlock.position.z), { timeout: 10000 });
    } catch (err) {
        if (err.name === 'TimeoutError') {
            logWarn('Mining pathfinding timed out.');
        } else {
            logError(`Error during mining: ${err.message}`);
        }
    }
    await equipBestTool(targetBlock); // Equip the correct tool
    await mineBlock(bot, targetBlock); // Mine the block
    bot.isBusy = false;
} else {
    logInfo('No mining targets found. Exploring...');
    performRoleTasks(); // Switch to explorer or another behavior
}

  }, 5000); // Execute every 5 seconds
}

// Function to gather resources, including trees, and crafting tools when necessary
async function gatherResources(bot, targetItem = null) {
    const miningTargets = ['stone', 'iron_ore', 'coal_ore', 'gold_ore', 'diamond_ore', 'redstone_ore'];
    const treeTargets = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];

    const targets = targetItem ? [targetItem] : [...miningTargets, ...treeTargets];

    setInterval(async () => {
        if (bot.isBusy) return; // Prevent overlapping tasks

        const targetBlock = bot.findBlock({
            matching: block => targets.includes(block.name),
            maxDistance: 64,
            count: 1
        });

        if (targetBlock) {
            bot.isBusy = true;
            try {
                await bot.pathfinder.goto(new GoalBlock(targetBlock.position.x, targetBlock.position.y, targetBlock.position.z), { timeout: 10000 });
                await equipBestTool(targetBlock); // Equip the correct tool
                await mineBlock(bot, targetBlock); // Mine the block
                await learnRecipe(bot, targetBlock.name); // Learn the recipe for the gathered block
            } catch (err) {
                if (err.name === 'TimeoutError') {
                    logWarn(`Pathfinding to target block timed out.`);
                } else {
                    logError(`Error during pathfinding to block: ${err.message}`);
                }
            } finally {
                bot.isBusy = false; // Reset busy state
            }
        } else {
            logInfo(`No targets found for ${targetItem || 'resource gathering'}. Exploring nearby areas...`);
            await exploreAndGatherFallback(bot, targetItem);
        }
    }, 5000); // Execute every 5 seconds
}

// Fallback function to explore further, request help, or switch tasks when no resources are found
async function exploreAndGatherFallback(bot, targetItem) {
  logInfo('Exploring further for resources...');

  // Try to move to a random nearby location to explore more resources
  const randomX = bot.entity.position.x + (Math.random() * 100 - 50);
  const randomZ = bot.entity.position.z + (Math.random() * 100 - 50);
  const explorationPos = new Vec3(randomX, bot.entity.position.y, randomZ);

  try {
    await bot.pathfinder.goto(new GoalNear(explorationPos.x, explorationPos.y, explorationPos.z, 1), { timeout: 10000 });
    logInfo(`Moved to new exploration point at ${explorationPos}. Rechecking for resources.`);
    // Continue with resource gathering after moving
    const newTargetBlock = bot.findBlock({
        matching: block => [...miningTargets, ...treeTargets].includes(block.name),
        maxDistance: 64,
        count: 1
    });

    if (newTargetBlock) {
        logInfo(`Found new target: ${newTargetBlock.name}. Gathering...`);
        await equipBestTool(newTargetBlock);
        await mineBlock(bot, newTargetBlock);
    } else {
        logWarn('No targets found after exploring. Switching tasks.');
        await performRoleTasks(); // Switch to another task
    }
} catch (err) {
    if (err.name === 'TimeoutError') {
        logWarn(`Exploration pathfinding timed out.`);
    } else {
        logError(`Error while exploring: ${err.message}`);
    }
    bot.isBusy = false;
}

}

// Function to craft a pickaxe dynamically if the miner doesn't have one
async function craftPickaxe(bot) {
  // Step 1: Gather wood if necessary
  const logs = bot.inventory.items().filter(item => item.name.includes('log'));
  if (logs.length === 0) {
    logInfo('No wood found. Gathering wood...');
    await gatherWood(bot);
  }

  // Step 2: Check for crafting table or craft one
  const craftingTable = bot.inventory.items().find(item => item.name === 'crafting_table');
  if (!craftingTable) {
    logInfo('No crafting table found. Crafting one...');
    await craftCraftingTable(bot);
  }

  // Step 3: Craft a pickaxe using the crafting table
  logInfo('Crafting a wooden pickaxe...');
  await craftItem(bot, 'wooden_pickaxe');
}

// Function to gather wood if none is available
async function gatherWood(bot) {
  const treeTargets = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];

  const tree = bot.findBlock({
    matching: block => treeTargets.includes(block.name),
    maxDistance: 64,
    count: 1
  });

  if (tree) {
    bot.isBusy = true;
    await bot.pathfinder.goto(new GoalBlock(tree.position.x, tree.position.y, tree.position.z));
    await equipBestTool(tree); // Equip an axe if available
    await mineBlock(bot, tree); // Chop the tree
    bot.isBusy = false;
  } else {
    logWarn('No trees found for gathering wood.');
  }
}

// Function to craft a crafting table
async function craftCraftingTable(bot) {
  const planks = bot.inventory.items().filter(item => item.name.includes('planks'));

  // If no planks, craft planks from logs
  if (planks.length === 0) {
    logInfo('No planks available. Crafting planks...');
    await craftItem(bot, 'planks'); // Craft planks from logs
  }

  // Craft crafting table from planks
  logInfo('Crafting a crafting table...');
  await craftItem(bot, 'crafting_table');
}

// Function to craft any item using the crafting table
// -----------------------------
// 10. Builder Behavior Implementation
// -----------------------------



async function gatherMissingIngredient(bot, ingredient) {
  if (ingredient.includes('log')) {
    logInfo('Gathering wood...');
    await gatherWood(bot); // Gather wood if the missing ingredient is a log
    return true;
  } else if (ingredient.includes('stone') || ingredient.includes('ore')) {
    logInfo('Gathering stone or ores...');
    await gatherResources(bot, ingredient); // Dynamically gather stone or ores
    return true;
  } else {
    logWarn(`No automatic gathering logic defined for ingredient: ${ingredient}.`);
    return false;
  }
}


async function placeCraftingTable(bot) {
  const craftingTableItem = bot.inventory.items().find(item => item.name === 'crafting_table');
  if (!craftingTableItem) {
    logError('No crafting table in inventory.');
    return null;
  }
  
  const placePosition = bot.entity.position.offset(0, -1, 0);
  await bot.placeBlock(bot.blockAt(placePosition), new Vec3(0, 1, 0));
  logInfo('Crafting table placed.');
  return placePosition;
}

async function findOrPlaceCraftingTable(bot) {
  let craftingTable = bot.findBlock({
    matching: block => block.name === 'crafting_table',
    maxDistance: 64,
    count: 1
  });

  if (!craftingTable) {
    logInfo('No crafting table found nearby, placing one...');
    await placeCraftingTable(bot);
    craftingTable = bot.findBlock({
      matching: block => block.name === 'crafting_table',
      maxDistance: 64,
      count: 1
    });
  }

  return craftingTable;
}

async function craftItem(bot, itemName) {
  const recipe = knowledgeBase.recipes[itemName];
  if (!recipe) {
    logError(`Recipe for ${itemName} not found.`);
    return;
  }

  // Check if the bot has all the necessary ingredients
  const ingredients = recipe.ingredients;
  for (const [ingredient, quantity] of Object.entries(ingredients)) {
    const item = bot.inventory.items().find(i => i.name === ingredient);
    if (!item || item.count < quantity) {
      logWarn(`Missing ingredient: ${ingredient}, gathering now...`);
      const success = await gatherMissingIngredient(bot, ingredient); // Gather missing ingredient
      if (!success) {
        logError(`Failed to gather ingredient: ${ingredient}.`);
        return;
      }
    }
  }

  // Check if the item can be crafted without a crafting table (2x2 grid)
  const recipeWithoutTable = bot.recipesAll(itemName, null, true)[0]; // Check for 2x2 crafting
  const recipeWithTable = bot.recipesAll(itemName, null, false)[0];   // Check for crafting table
  
  // Craft without a crafting table (using 2x2 grid)
  if (recipeWithoutTable) {
    try {
      bot.isBusy = true;
      logInfo(`Crafting ${itemName} without a crafting table.`);
      await bot.craft(recipeWithoutTable, 1, null); // Use null for the crafting table
      logInfo(`${itemName} crafted successfully.`);
    } catch (err) {
      logError(`Failed to craft ${itemName} without crafting table: ${err.message}`);
    } finally {
      bot.isBusy = false;
    }
    return;
  }

  // Craft with a crafting table (if the recipe requires it)
  if (recipeWithTable) {
    const craftingTable = bot.findBlock({
      matching: block => block.name === 'crafting_table',
      maxDistance: 64,
      count: 1
    });

    // If no crafting table is placed, place one
    if (!craftingTable) {
      const craftingTableInInventory = bot.inventory.items().find(item => item.name === 'crafting_table');
      if (craftingTableInInventory) {
        logInfo('Placing crafting table...');
        await placeCraftingTable(bot); // Function to place crafting table
      } else {
        logError('No crafting table found in inventory.');
        return;
      }
    }

    // Craft with the crafting table
    try {
      bot.isBusy = true;
      logInfo(`Crafting ${itemName} using a crafting table.`);
      await bot.craft(recipeWithTable, 1, craftingTable); // Craft using the crafting table
      logInfo(`${itemName} crafted successfully using the crafting table.`);
    } catch (err) {
      logError(`Failed to craft ${itemName} using crafting table: ${err.message}`);
    } finally {
      bot.isBusy = false;
    }
    return;
  }

  // If no valid recipe was found
  logError(`No valid recipe found for ${itemName}.`);
}


function builderBehavior(bot) {
  // Example logic for builder behavior
  const structures = []; // Load or define your structures here

  if (structures.length === 0) {
    console.warn('No structures defined in the knowledge base. Awaiting new structures.');
    return; // Exit if no structures are available
  }

  setInterval(async () => {
    if (bot.isBusy) return; // Prevent overlapping tasks

    const structure = structures.shift(); // Get the next structure to build

    if (structure) {
      bot.isBusy = true;
      await buildStructure(bot, structure); // Build the structure
      bot.isBusy = false;
    } else {
      console.log('No structures to build. Gathering resources.');
      performRoleTasks(bot, 'miner'); // Switch to miner behavior
    }
  }, 10000); // Execute every 10 seconds
}
// -----------------------------
// 11. Explorer Behavior Implementation
// -----------------------------

function explorerBehavior() {
  // Example: Exploration loop
  setInterval(async () => {
    if (botInstance.isBusy) return; // Prevent overlapping tasks

    const currentState = 'exploring';
    const randomX = botInstance.entity.position.x + (Math.random() * 100 - 50);
    const randomZ = botInstance.entity.position.z + (Math.random() * 100 - 50);
    const explorationPos = new Vec3(randomX, botInstance.entity.position.y, randomZ);

    try {
      await botInstance.pathfinder.goto(new GoalNear(explorationPos.x, explorationPos.y, explorationPos.z, 1));
      logInfo(`Moved to exploration point at ${explorationPos}`);

      // Survey the area for resources
      await surveyArea();

      const action = 'explore';
      const reward = 2; // Reward for successful exploration
      updateQTable(currentState, action, reward, 'idle');

    } catch (err) {
      logError(`Error during exploration: ${err.message}`);
    }
  }, 15000); // Execute every 15 seconds

  // Function to survey the current area for resources
  async function surveyArea() {
    const discoveredResources = [];
    const resourceTypes = ['diamond_ore', 'emerald_ore', 'gold_ore'];

    resourceTypes.forEach(resource => {
      const blocks = botInstance.findBlocks({
        matching: block => block.name === resource,
        maxDistance: 32,
        count: 5
      });

      blocks.forEach(blockPos => {
        if (blockPos) {
          discoveredResources.push({ resource, position: blockPos });
          logInfo(`Discovered ${resource} at ${blockPos}`);
        }
      });
    });

    if (discoveredResources.length === 0) {
      // **Request help for finding resources**
      logWarn('No valuable resources found. Requesting assistance for resource gathering.');
      await requestHelp('resource_gather', { resource: 'any valuable ore' });
    }
  }
}


// Default Behavior
// Function to perform default tasks if no specific role is assigned
function defaultBehavior() {
  logWarn('Executing default behavior...');

  setInterval(async () => {
    if (botInstance.isBusy) return; // Prevent overlapping tasks

    const randomX = botInstance.entity.position.x + (Math.random() * 100 - 50);
    const randomZ = botInstance.entity.position.z + (Math.random() * 100 - 50);
    const explorationPos = new Vec3(randomX, botInstance.entity.position.y, randomZ);

    try {
      await botInstance.pathfinder.goto(new GoalNear(explorationPos.x, explorationPos.y, explorationPos.z, 1), { timeout: 10000 });
      logInfo(`Moved to exploration point at ${explorationPos}`);
      await surveyArea(); // Continue exploration
    } catch (err) {
      if (err.name === 'TimeoutError') {
        logWarn(`Exploration pathfinding timed out.`);
      } else {
        logError(`Error during exploration: ${err.message}`);
      }
    }
    
  }, 10000); // Execute every 10 seconds
}
async function learnRecipe(bot, itemName) {
    const recipes = knowledgeBase.recipes;

    // Define the new recipes based on discovered items
    const newRecipes = {
        "cobblestone": "furnace",
        "oak_planks": "crafting_table",
        "iron_ingot": "iron_pickaxe",
        "diamond": "diamond_pickaxe",
        "stick": "wooden_pickaxe"
        // Add more mappings as needed
    };

    if (newRecipes[itemName]) {
        const recipeToLearn = recipes[newRecipes[itemName]];
        if (recipeToLearn) {
            logInfo(`Learning new recipe: ${newRecipes[itemName]}`);
            recipes[newRecipes[itemName]] = recipeToLearn; // Add the recipe to the knowledge base
            fs.writeFileSync(KNOWLEDGE_BASE_PATH, JSON.stringify(knowledgeBase, null, 2), 'utf8');
        }
    }
}
async function buildStructure(structure) {
  try {
    botInstance.isBusy = true;
    const origin = new Vec3(structure.origin.x, structure.origin.y, structure.origin.z);

    for (const block of structure.blocks) {
      const blockPos = origin.offset(block.x, block.y, block.z);

      // Check if the block space is empty
      const targetBlock = botInstance.blockAt(blockPos);
      if (targetBlock && targetBlock.name !== 'air') {
        logInfo(`Block already present at ${blockPos}. Skipping.`);
        continue;
      }

      // Navigate to the block position
      await botInstance.pathfinder.goto(new GoalNear(blockPos.x, blockPos.y, blockPos.z, 1));

      // Equip the required block/item
      const requiredItem = block.block;
      const item = botInstance.inventory.findInventoryItem(requiredItem, null);

      if (item) {
        await botInstance.equip(item, 'hand');

        // Place the block
        await botInstance.placeBlock(botInstance.blockAt(blockPos.offset(0, -1, 0)), new Vec3(0, 1, 0));
        logInfo(`Placed block: ${requiredItem} at ${blockPos}`);
      } else {
        // **Request help for the missing resource**
        logWarn(`Required block ${requiredItem} not found in inventory. Requesting resources.`);
        await requestHelp('resource_gather', { resource: requiredItem });
        return; // Exit and retry later after help is received
      }
    }

    logInfo(`Construction of ${structure.name} completed.`);
  } catch (err) {
    logError(`Error while building: ${err.message}`);
  } finally {
    botInstance.isBusy = false;
  }
}
// -----------------------------
// 13. Handling Inter-Bot Communication and Assistance
// -----------------------------

// Function to request assistance from other bots (with timeout and fallback)
async function requestHelp(helpType, details) {
  process.send({ type: 'requestHelp', data: { helpType, details } });
  logInfo(`Requested help: ${helpType} with details: ${JSON.stringify(details)}`);

  await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds for help
  if (!botInstance.isBusy) {
    logWarn(`No help received for ${helpType}. Proceeding with fallback behavior.`);
    if (helpType === 'resource_gather') {
	
      await gatherResources(botInstance); // Fallback to gathering resources
    }
  }
}

process.on('message', async (msg) => {
  if (msg.type === 'assist') {
    const { helpType, details } = msg.data;
    if (helpType === 'resource_gather') {
      await assistResourceGather(details.resource);
    }
  }
});


// Function to assist in gathering specific resources
async function assistResourceGather(resource) {
  try {
    const targetBlock = botInstance.findBlock({
      matching: block => block.name === resource,
      maxDistance: 64,
      count: 1
    });

    if (targetBlock && targetBlock.position) {
      botInstance.isBusy = true;
      await botInstance.pathfinder.goto(new GoalNear(targetBlock.position.x, targetBlock.position.y, targetBlock.position.z, 1));
      await equipBestTool(targetBlock);
      await botInstance.dig(targetBlock);
      logInfo(`Assisted in gathering resource: ${resource} at ${targetBlock.position}`);
    } else {
      logWarn(`Requested resource ${resource} not found or position is undefined.`);
    }
  } catch (err) {
    logError(`Error while assisting resource gathering: ${err.message}`);
  } finally {
    botInstance.isBusy = false;
  }
}

// Function to assist in building structures
async function assistBuild(structure) {
  try {
    botInstance.isBusy = true;

    for (const block of structure.blocks) {
      const blockPos = new Vec3(block.x, block.y, block.z).add(new Vec3(structure.origin.x, structure.origin.y, structure.origin.z));

      // Ensure blockPos exists before using it
      if (blockPos) {
        const targetBlock = botInstance.blockAt(blockPos);
        if (targetBlock && targetBlock.name !== 'air') {
          logInfo(`Block already present at ${blockPos}. Skipping.`);
          continue;
        }

        await botInstance.pathfinder.goto(new GoalNear(blockPos.x, blockPos.y, blockPos.z, 1));

        const requiredItem = block.block;
        const item = botInstance.inventory.findInventoryItem(requiredItem, null);

        if (item) {
          await botInstance.equip(item, 'hand');
          await botInstance.placeBlock(botInstance.blockAt(blockPos.offset(0, -1, 0)), new Vec3(0, 1, 0));
          logInfo(`Placed block: ${requiredItem} at ${blockPos}`);
        } else {
          logWarn(`Required block ${requiredItem} not found in inventory. Cannot assist in building.`);
          requestHelp('resource_gather', { resource: requiredItem });
          return;
        }
      } else {
        logError('Block position is undefined. Cannot place block.');
      }
    }

    logInfo(`Assisted in building structure: ${structure.name}`);
  } catch (err) {
    logError(`Error while assisting in building: ${err.message}`);
  } finally {
    botInstance.isBusy = false;
  }
}
// -----------------------------
// 14. Graceful Shutdown and Saving Q-Tables
// -----------------------------

// Function to save the current Q-table before exiting
function saveQTableOnExit() {
  try {
    fs.writeFileSync(QTABLE_PATH, JSON.stringify(individualQTable, null, 2), 'utf8');
    logInfo('Individual Q-table saved successfully.');
  } catch (err) {
    logError(`Failed to save Q-table on exit: ${err.message}`);
  }
}

// Handle process termination signals
process.on('SIGINT', () => {
  logInfo('Received SIGINT. Initiating shutdown...');
  saveQTableOnExit();
  botInstance.end();
  process.exit();
});

process.on('SIGTERM', () => {
  logInfo('Received SIGTERM. Initiating shutdown...');
  saveQTableOnExit();
  botInstance.end();
  process.exit();
});

// Handle unexpected errors
process.on('uncaughtException', (err) => {
  logError(`Uncaught Exception: ${err.message}`);
  saveQTableOnExit();
  botInstance.end();
  process.exit(1);
});
