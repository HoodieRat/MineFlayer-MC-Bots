const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Correct path to botsConfig.json located in the shared folder
const botsConfigPath = path.join(__dirname, 'shared', 'botsConfig.json');  // This points to the shared folder

// Function to start bots using spawn
function startBot(botName, role) {
    const botScript = path.join(__dirname, 'bots', 'genericBot.js'); // Ensure this is the correct path to genericBot.js

    const botProcess = spawn('node', [botScript], {
        env: {
            BOT_NAME: botName,
            BOT_ROLE: role
        }
    });

    botProcess.stdout.on('data', (data) => {
        console.log(`[${botName}] ${data}`);
    });

    botProcess.stderr.on('data', (data) => {
        console.error(`[${botName} ERROR] ${data}`);
    });

    botProcess.on('close', (code) => {
        console.log(`[${botName}] process exited with code ${code}`);
    });
}

// Read bot configuration from the botsConfig.json file
if (fs.existsSync(botsConfigPath)) {
    const botsConfig = JSON.parse(fs.readFileSync(botsConfigPath, 'utf8'));

    // Start each bot defined in the configuration
    botsConfig.forEach(({ name, role }) => {
        startBot(name, role);
    });
} else {
    console.error('botsConfig.json not found at', botsConfigPath);
}