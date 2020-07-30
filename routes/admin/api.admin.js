var express = require('express'),
    adminAPI = express(),
    { response } = require('./v1/functions/functions'),
    middleware = require('./v1/middleware/admin.middleware');

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

//------------------------------ MIDDLEWARE ---------------------------------
adminAPI.use(/^(?!\/user).*/, async(req, res, next) => {
    var adminAuthToken = await middleware.adminAuthToken(req, res)
    if (adminAuthToken) {
        next();
    } else {
        return;
    }
});

//------------------------------ ADMIN APIs ---------------------------------

// 1. USER ACCOUNT
adminAPI.use('/user', require('./v1/components/user'));

// 2. ADMIN PROFILE
adminAPI.use('/profile', require('./v1/components/profile'));

// 3. PLAN
adminAPI.use('/plan', require('./v1/components/plan'));

// 4. CLIENT
adminAPI.use('/client', require('./v1/components/client'));

// 5. EMPLOYEE
adminAPI.use('/employee', require('./v1/components/employee'));

// 6. CLIENT PROJECTS
adminAPI.use('/project', require('./v1/components/client-project'));

// 7. SERVICES
// adminAPI.use('/service');

// 400 UNKNOWN APIs
adminAPI.use('*', (req, res) => {
    return response(res, 400, 'unknownApi', 'The API that the request is calling is not recognized.', undefined, 'A-API');
});

module.exports = adminAPI;