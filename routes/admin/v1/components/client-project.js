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

//------------------------------- 6. CLIENT-PROJECT -------------------------------

// 6.1 GET ALL PROJECT DETAIL

projectAPI.get(['/', '/get'], (req, res) => {
    if (!req.query.client_id) {
        return response(res, 400, 'required', 'ClientID is not found', undefined, 'A-6.1.1')
    }
    if (!dbAdminSnapshot.clients) {
        return response(res, 403, 'forbidden', 'Not matched any client', undefined, 'A-6.1.2')

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
                return response(res, '403', 'forbidden', 'No Any Plan Purchased By Client', undefined, 'A-6.1.2')
            }
        } else if (i == dbClientKey.length - 1) {
            return response(res, 403, 'forbidden', 'Client Key Not Matched with any user', undefined, 'A-6.1.3')
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
    if (!req.body.project_id || !req.body.employee_id) {
        return response(res, 400, 'required', 'Input is not properly', undefined, 'A-6.3.1')
    }
    var pushData = { review: false, activity: false, active: true }
    if (req.body.review) {
        pushData.review = true
    }
    if (req.body.activity) {
        pushData.activity = true
    }
    var projectId = String(req.body.project_id),
        getKeyDB = getKeys(projectId),
        employeeID = String(req.body.employee_id),
        employeeDB = dbAdminSnapshot.employees,
        employeeKeys = Object.keys(employeeDB)
    console.log(getKeyDB);
    for (var i = 0; i < employeeKeys.length; i++) {
        var tempEmployee = employeeDB[employeeKeys[i]]
        if (tempEmployee.employee_id == employeeID && !tempEmployee.deleted) {
            if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team) {
                var teamDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team,
                    teamKeys = Object.keys(teamDB)
                for (var j = 0; j < teamKeys.length; j++) {
                    var tempTeam = teamDB[teamKeys[j]]
                    if (tempTeam.employee_id == employeeID) {
                        return response(res, 403, 'forbidden', 'Emplyee already assigned to this project', undefined, '6.3.2')
                    } else if (j == teamKeys.length - 1) {
                        pushData.employee_id = employeeID
                        console.log(pushData);
                        return firebase.database().ref(`admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/`).push(pushData).then(() => {
                            return response(res, 200, 'success', undefined, undefined, 'A-6.3.2')
                        })
                    }
                }
            } else {
                pushData.employee_id = employeeID
                console.log(pushData);
                return firebase.database().ref(`admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/`).push(pushData).then(() => {
                    return response(res, 200, 'success', undefined, undefined, 'A-6.3.3')
                })
            }

        } else if (i == employeeKeys.length - 1) {
            return response(res, 403, 'Forbidden', 'Employee Not Found In List Or Removed', undefined, 'A-6.3.4')
        }
    }
})

// 6.4 UPDATE PERMISSION OF EMPLOYEE ASSIGNED

projectAPI.post('/team/update', async(req, res) => {
    if (!req.body.project_id || !req.body.employee_id) {
        return response(res, 400, 'required', 'Input is not properly', undefined, 'A-6.4.1')
    }
    var projectID = String(req.body.project_id),
        getKeyDB = getKeys(projectID),
        employeeID = String(req.body.employee_id),
        employeeDB = dbAdminSnapshot.employees,
        employeeKeys = Object.keys(employeeDB)
    for (var i = 0; i < employeeKeys.length; i++) {
        var tempEmployee = employeeDB[employeeKeys[i]]
        if (tempEmployee.employee_id == employeeID && !tempEmployee.deleted) {
            if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team) {
                var teamDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team,
                    teamKeys = Object.keys(teamDB)
                for (var j = 0; j < teamKeys.length; j++) {
                    var tempTeam = teamDB[teamKeys[j]]
                    if (tempTeam.employee_id == employeeID) {
                        tempTeam.review = false
                        tempTeam.activity = false
                        tempTeam.active = false
                        if (req.body.review) {
                            tempTeam.review = true
                        }
                        if (req.body.activity) {
                            tempTeam.activity = true
                        }
                        if (req.body.active) {
                            tempTeam.active = true
                        }
                        console.log(tempTeam);
                        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/${teamKeys[j]}/`).update(tempTeam).then(() => {
                            return response(res, 200, 'success', 'Permission Successfully Updated', undefined, 'A-6.4.2')
                        })
                    } else if (j == teamKeys.length - 1) {
                        return response(res, 403, 'forbidden', 'Employee is not active', undefined, 'A-6.4.3')
                    }
                }
            }
        } else if (i == employeeKeys.length - 1) {
            return response(res, 403, 'forbidden', 'Employee is not available or removed', undefined, 'A-6.4.4')
        }
    }
})

// 6.5 TEAM REMOVE


function getKeys(project_id) {
    var clientDB = dbAdminSnapshot.clients,
        clientKey = Object.keys(clientDB)
    for (var i = 0; i <= clientKey.length; i++) {
        var planDB = clientDB[clientKey[i]].plans,
            planKey = Object.keys(planDB)
        for (var j = 0; j <= planKey.length; j++) {
            var tempPlan = planDB[planKey[j]]
            if (tempPlan.project_id == project_id) {
                pushData = {
                    "client_key": clientKey[i],
                    "plan_key": planKey[j]
                }
                return pushData
            } else if (j == planKey.length - 1) {
                return response(res, 404, 'notfound', 'Not Found any project with this ID', undefined, 'F-6.1')
            }
        }
    }
    return response(res, 404, 'notfound', 'Not Found any project with this ID', undefined, 'F-6.2')

}
module.exports = projectAPI