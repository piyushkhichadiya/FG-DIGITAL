var express = require('express'),
    adminAPI = express(),
    { response } = require('../../../functions/functions'),
    middleware = require('./middleware/admin.middleware');

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

//------------------------------ MIDDLEWARE ---------------------------------
adminAPI.use(/^(?!\/user).*/, middleware.adminAuthToken);

//------------------------------ ADMIN APIs ---------------------------------

// 1. USER ACCOUNT
adminAPI.use('/user', require('./components/user'));

// 2.Admin Profile
adminAPI.use('/profile', require('./components/profile'));

// 3. PLAN
adminAPI.use('/plan', require('./components/plan'));

// 4. CLIENT
adminAPI.use('/client', require('./components/client'));

// 5. EMPLOYEE
adminAPI.use('/employee', require('./components/employee'));

// 6. CLIENT PROJECTS
adminAPI.use('/project', require('./components/client-project'));

// 7. SERVICES
adminAPI.use('/service', require('./components/services'));

// 400 UNKNOWN APIs
adminAPI.use('*', (req, res) => {
    return response(res, 400, 'unknownApi', 'The API that the request is calling is not recognized.', undefined, 'A-API');
});

module.exports = adminAPI;