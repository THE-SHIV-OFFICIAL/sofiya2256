const queue = require('../../utils/queue');

async function processMedia(fileData) {
    console.log(`[MediaQueue] Processing:`, fileData);
    // OCR + NVIDIA Vision + NSFW scan will go here later
    return true;
}

module.exports = { processMedia };
