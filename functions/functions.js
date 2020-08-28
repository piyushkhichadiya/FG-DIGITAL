const secrets = require('../config/secrets'),
    jwt = require('jsonwebtoken'),
    fs = require('fs'),
    bcrypt = require('bcryptjs');

module.exports = {
    response: (res, status, response, message, data, code) => {
        if (!res || typeof res != 'object') {
            return console.log('\x1b[36m\x1b[31m Function Response Error: \x1b[0m', 'Response Object is required to send response');
        }

        if (!status || isNaN(status)) {
            return console.log('\x1b[36m\x1b[31m Function Response Error: \x1b[0m', 'Status Code is required to send response. Status must be integer number');
        }

        if (!response || typeof response == 'object') {
            return console.log('\x1b[36m\x1b[31m Function Response Error: \x1b[0m', 'Standard Response is required to send response. Response must be string');
        }

        if (!code || typeof code == 'object') {
            return console.log('\x1b[36m\x1b[31m Function Response Error: \x1b[0m', 'Custom Response Code is required to send response');
        }

        if (message && typeof message == 'object') {
            return console.log('\x1b[36m\x1b[31m Function Response Error: \x1b[0m', 'Response message must be string');
        }

        return res.status(status).json({
            status: parseInt(status),
            response: String(response),
            message: message,
            data: data,
            code: code
        })
    },
    jwtSign: (string) => {
        if (string) {
            return jwt.sign(string, secrets.jwt());
        } else {
            return;
        }
    },
    jwtDecode: (token) => {
        if (token) {
            var decodeValue;
            return jwt.verify(token, secrets.jwt(), (error, decode) => {
                if (error) {
                    return false;
                } else {
                    return decode;
                }
            })
        }
    },
    bcryptHash: (string) => {
        // Using bcryptjs
        if (string) {
            var salt = bcrypt.genSaltSync(8);
            return bcrypt.hashSync(String(string), salt);
        } else {
            return;
        }
    },
    bcryptHashCompare: (string, hash) => {
        // Using bcryptjs
        /*
         * Value : String - Non Hash Value
         * Hash : Hash Value
         */
        return bcrypt.compare(string, hash).then((result) => {
            return result;
        });
    },
    randomAlphabet: (length) => {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        // var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    },
    randomString: (length) => {

        // Generate random string contain CAPITAL + SMALL Letter + Digit

        if (!length) {
            return 'Length Invalid';
        }
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    },
    randomIntDigit: (min, max) => {

        // Generate random number for given length
        if (min && !max) {
            var length = min;
            return Math.floor(Math.random() * (9 * Math.pow(10, length - 1))) + Math.pow(10, length - 1);
        }


        // Generate random number between minimum and maximum value
        if (!min && !max) {
            return 'Invalid Minimum or Maximum Value';
        }
        return (Math.round((Math.random() * (max - min) + min)))
    },
    storageDirectory: () => {
        return process.cwd() + '/public/storage';
    },
    ConvertKeysToLowerCase(jsonObject) {
        // Convert All Key from JSON object to lower case
        var output = {};
        for (i in jsonObject) {

            // Check Empty String
            if (typeof(jsonObject[i]) == 'string' && String(jsonObject[i]).trim() == '') {
                continue
            }
            output[i.toLowerCase()] = jsonObject[i];
        }
        return output;
    },
    unlinkFile: (fileName) => {
        // Remove File from Storage Directory

        if (!filename) { return false }

        var path = module.exports.storageDirectory() + '/',
            filename = fileName
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path, { recursive: true })
        }
        try {
            var finder = finder = require('findit')(path)
            finder.on('directory', function(dir, stat, stop) {
                var newPath = dir + '/'
                if (fs.existsSync(newPath + filename)) {
                    try {
                        fs.unlinkSync(newPath + filename)
                    } catch {}
                    return true
                }
            });

            finder.on('end', function() {
                return false
            });
        } catch {}
    }
}