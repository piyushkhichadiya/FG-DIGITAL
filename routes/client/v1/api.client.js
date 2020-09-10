var express = require('express'),
    clientAPI = express(),
    { response } = require('../../../functions/functions'),
    middleware = require('./middleware/client.middleware');

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

//------------------------------ MIDDLEWARE ---------------------------------
clientAPI.use(/^(?!\/user).*/, middleware.clientAuthToken);

//------------------------------ ADMIN APIs ---------------------------------

// 1. USER ACCOUNT
clientAPI.use('/user', require('./components/user'));

// 2. EMPLOYEE PROFILE
clientAPI.use('/profile', require('./components/profile'));

// 3. CLIENT PROJECT
// clientAPI.use('/project', require('./components/client-project'));

// 400 UNKNOWN APIs
clientAPI.use('*', (req, res) => {
    return response(res, 400, 'unknownApi', 'The API that the request is calling is not recognized.', undefined, 'A-API');
});

module.exports = clientAPI;