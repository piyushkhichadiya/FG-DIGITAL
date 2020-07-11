const fs = require('fs');
module.exports = (directory) => {
    try {
        if (!fs.exists(process.cwd() + '/public/storage/' + directory)) {
            fs.mkdirSync(process.cwd() + '/public/storage/' + directory, { recursive: true });
        }
    } catch {
        fs.mkdirSync(process.cwd() + '/public/storage/' + directory, { recursive: true });
    }

}