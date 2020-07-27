const projectAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    { response, bcryptHash, bcryptHashCompare, randomIntDigit } = require('../functions/functions'),
    regex = require('../functions/regex')

//----------------------------- CONFIGURATION ------------------------------

//---------------------------- GLOBAL VARIABLE -----------------------------
var dbAdminSnapshot, adminAuthToken;
projectAPI.use((req, res, next) => {
    dbAdminSnapshot = req.session.dbAdminSnapshot
    adminAuthToken = req.session.decode_adminAuthToken
    next();
});
//--------------------------------- ROUTES ---------------------------------

//------------------------------- 6. CLIENT -------------------------------

// 6.1

projectAPI.get(['/', '/get'], (req, res) => {
    if (!req.query.client_id) {
        return response(res, 400, 'required', 'ClientID is not found', undefined, '6.1.1')
    }
    var dbKey = Object.keys(dbAdminSnapshot)


})
module.exports = projectAPI