var secrets = require('../../../../config/secrets'),
    jwt = require('jsonwebtoken'),
    bcrypt = require('bcryptjs');
const { callbackPromise } = require('nodemailer/lib/shared');
const { response } = require('express');

module.exports = {
    response: (res, status, response, message, data, customCode) => {
        return res.status(status).json({
            status: status,
            response: response,
            message: message,
            data: data,
            response_code: customCode
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
                    return '12';
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
    }
}