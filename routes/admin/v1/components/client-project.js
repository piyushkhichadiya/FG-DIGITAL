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

// 6.1 GET ALL PROJECT DETAIL

projectAPI.get(['/', '/get'], (req, res) => {
    if (!req.query.client_id) {
        return response(res, 400, 'required', 'ClientID is not found', undefined, '6.1.1')
    }
    if (!dbAdminSnapshot.clients) {
        return response(res, 403, 'forbidden', 'Not matched any client', undefined, '6.1.2')

    }
    var dbClient = dbAdminSnapshot.clients,
        dbClientKey = Object.keys(dbClient),
        client_id = String(req.query.client_id),
        pushData = []
    for (var i = 0; i < dbClientKey.length; i++) {
        if (client_id == dbClientKey[i]) {
            var planDB = dbClient[dbClientKey[i]].plans,
                planKey = Object.keys(planDB)
            for (var j = 0; j < planKey.length; j++) {
                var tempPlan = planDB[planKey[j]]
                console.log(tempPlan);
                if (!tempPlan.deleted) {
                    pushData.push(tempPlan)
                }
            }
            if (pushData.length > 0) {
                return response(res, '200', 'success', undefined, pushData)
            } else {
                return response(res, '403', 'forbidden', 'No Any Plan Purchased By Client', undefined, '6.1.2')
            }
        } else if (i == dbClientKey.length - 1) {
            return response(res, 403, 'forbidden', 'Client Key Not Matched with any user', undefined, '6.1.3')
        }
    }


})

// 6.2 GET PROJECT DETAILS BY ID

projectAPI.get('/project/:project_id', (req, res) => {
    if (!req.params.project_id) {
        return response(res, 400, 'required', 'ClientID is not found', undefined, '6.1.1')
    }
    //REMAINING DUE TO INSUFFICIENT DATA
})

// 6.3 ASSIGN EMPLOYEE TO PROJECT

projectAPI.post('/team/add', async(req, res) => {
    if (!req.query.project_id || !req.query.employee_id) {
        return response(res, 400, 'required', 'Input is not properly', undefined, '6.1.1')
    }
    var pushData = { review: false, activity: false, active: true }
    if (req.query.review) {
        pushData.review = true
    }
    if (req.query.activity) {
        pushData.activity = true
    }
    var projectId = String(req.query.project_id),
        getKeyDB = getKeys(projectId),
        employeeID = String(req.query.employee_id),
        employeeDB = dbAdminSnapshot.employees,
        employeeKeys = Object.keys(employeeDB)
    for (var i = 0; i < employeeKeys.length; i++) {
        var tempEmployee = employeeDB[employeeKeys[i]]
        if (tempEmployee.employee_id == employeeID) {
            pushData.employee_id = employeeID
            console.log(pushData);
            return firebase.database().ref(`admin/clients/${getKeyDB[0].client_key}/plans/${getKeyDB[0].plan_key}/team/`).push(pushData).then(() => {
                return response(res, 200, 'success')
            })
        } else if (i == employeeKeys.length - 1) {
            return response(res, 403, 'Forbidden', 'Employee Not Found In List', undefined, '6.3.1')
        }
    }
})

function getKeys(project_id) {
    var clientDB = dbAdminSnapshot.clients,
        clientKey = Object.keys(clientDB),
        pushData = []
    for (var i = 0; i <= clientKey.length; i++) {
        var planDB = clientDB[clientKey[i]].plans,
            planKey = Object.keys(planDB)
        for (var j = 0; j <= planKey.length; j++) {
            var tempPlan = planDB[planKey[j]]
            if (tempPlan.project_id == project_id) {
                pushData.push({
                    "client_key": clientKey[i],
                    "plan_key": planKey[j]
                })
                return pushData
            }
        }
    }
}
module.exports = projectAPI