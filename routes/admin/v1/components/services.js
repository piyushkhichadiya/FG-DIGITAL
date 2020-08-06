const servicesAPI = require('express').Router(),
    firebase = require('firebase-admin').database(),
    { response } = require('../functions/functions'),
    fs = require('fs'),
    regex = require('../functions/regex')


//----------------------------- CONFIGURATION ------------------------------

//---------------------------- GLOBAL VARIABLE -----------------------------
var dbAdminSnapshot, adminAuthToken;
servicesAPI.use((req, res, next) => {
    dbAdminSnapshot = req.session.dbAdminSnapshot
    adminAuthToken = req.session.decode_adminAuthToken
    next();
});

//--------------------------------- ROUTES ---------------------------------

//------------------------------- 7. SERVICES -------------------------------

// 7.1 ADD SERVICE
// 7.2 GET SERVICE
// 7.3 UPDATE SERVICE
// 7.4 REMOVE SERVICE
// 7.5 ADD SERVICE CRITERIA
// 7.6 UPDATE SERVICE CRITERIA
// 7.7 REMOVE SERVICE CRITERIA

module.exports = servicesAPI;