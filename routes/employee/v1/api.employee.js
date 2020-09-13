var express = require('express'),
    employeeAPI = express(),
    { response } = require('../../../functions/functions'),
    middleware = require('./middleware/employee.middleware');

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

//------------------------------ MIDDLEWARE ---------------------------------
employeeAPI.use(/^(?!\/user).*/, middleware.employeeAuthToken);

//------------------------------ ADMIN APIs ---------------------------------

// 1. USER ACCOUNT
employeeAPI.use('/user', require('./components/user'));

// 2. EMPLOYEE PROFILE
employeeAPI.use('/profile', require('./components/profile'));

// 3. CLIENT PROJECT
employeeAPI.use('/project', require('./components/client-project'));

// 400 UNKNOWN APIs
employeeAPI.use('*', (req, res) => {
    return response(res, 400, 'unknownApi', 'The API that the request is calling is not recognized.', undefined, 'A-API');
});

module.exports = employeeAPI;