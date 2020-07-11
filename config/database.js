const firebase = require('firebase-admin'),
    secrets = require('./secrets')

var status, message;
class Database {
    constructor() {}

    initialization() {
        switch (String(process.env.NODE_ENV).trim().toLowerCase()) {
            case 'dev':
            case 'development':
                try {
                    firebase.initializeApp({
                        credential: firebase.credential.cert(secrets.firebase_admin_sdk().development.sdk),
                        databaseURL: secrets.firebase_admin_sdk().development.databaseURL
                    });
                } catch {
                    return console.log('DEVELOPMENT DATABASE CREDENTIALS MISSING:\nCheck: /config/database.js & /config/secret.js')
                }

                status = 'SUCCESS'
                message = 'DB INITIALIZATION SUCCESS FOR DEVELOPMENT'
                break;
            case 'prod':
            case 'production':
                try {
                    firebase.initializeApp({
                        credential: firebase.credential.cert(secrets.firebase_admin_sdk().production.sdk),
                        databaseURL: secrets.firebase_admin_sdk().production.databaseURL
                    });
                } catch {
                    return console.log('PRODUCTION DATABASE CREDENTIALS MISSING:\nCheck: /config/database.js & /config/secret.js')
                }

                status = 'SUCCESS'
                message = 'DB INITIALIZATION SUCCESS FOR PRODUCTION'
                break;
            default:

                status = 'FAILED'
                message = 'NO ENVIRONMENT FOUND FOR DATABASE INITIALIZATION'
        }
    }

    status() {
        return {
            status: status,
            message: message
        }
    }
}

module.exports = Database;