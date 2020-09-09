var express = require('express'),
    employeeAPI = express(),
    { response } = require('../../functions/functions'),
    middleware = require('./v1/middleware/employee.middleware');

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

//------------------------------ MIDDLEWARE ---------------------------------
employeeAPI.use(/^(?!\/user).*/, (req, res, next) => {
    middleware.employeeAuthToken(req, res, next)
});

//------------------------------ ADMIN APIs ---------------------------------

// 1. USER ACCOUNT
employeeAPI.use('/user', require('./v1/components/user'));

// 2. EMPLOYEE PROFILE
employeeAPI.use('/profile', require('./v1/components/profile'));

// 3. CLIENT PROJECT
employeeAPI.use('/client-project', require('./v1/components/client-project-activity')); // Author: Jenil Narola
employeeAPI.use('/client-project', require('./v1/components/client-project-review')); // Author: Smit Luvani

// 400 UNKNOWN APIs
employeeAPI.use('*', (req, res) => {
    return response(res, 400, 'unknownApi', 'The API that the request is calling is not recognized.', undefined, 'A-API');
});

module.exports = employeeAPI;