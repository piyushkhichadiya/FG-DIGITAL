const fs = require('fs'),
    { storageDirectory } = require('../functions/functions');
module.exports = (directory) => {
    try {
        if (!fs.exists(storageDirectory() + directory)) {
            fs.mkdirSync(storageDirectory() + directory, { recursive: true });
        }
    } catch {
        fs.mkdirSync(storageDirectory() + directory, { recursive: true });
    }
}