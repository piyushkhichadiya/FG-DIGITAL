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
        return response(res, 400, 'required', 'ClientID is required', undefined, 'A-6.1.1')
    }
    if (!dbAdminSnapshot.clients) {
        return response(res, 404, 'notfound', 'Incorrect Client ID', undefined, 'A-6.1.2')
    }
    var dbClient = dbAdminSnapshot.clients,
        dbClientKey = Object.keys(dbClient),
        client_id = String(req.query.client_id).trim(),
        pushData = []
    for (var i = 0; i < dbClientKey.length; i++) {
        if (client_id == dbClientKey[i]) {
            var planDB = dbClient[dbClientKey[i]].plans,
                planKey = Object.keys(planDB)
            for (var j = 0; j < planKey.length; j++) {
                var tempPlan = planDB[planKey[j]]
                if (!tempPlan.deleted) {
                    if (tempPlan.team) {
                        delete tempPlan.team
                    }
                    pushData.push(tempPlan)
                }
            }
            if (pushData.length > 0) {
                return response(res, '200', 'success', undefined, pushData, 'A-6.1.5')
            } else {
                return response(res, '404', 'notFound', 'No Any Plan Purchased By Client', undefined, 'A-6.1.3')
            }
        } else if (i == dbClientKey.length - 1) {
            return response(res, 403, 'forbidden', 'Client Key Not Matched with any user', undefined, 'A-6.1.4')
        }
    }


})

// 6.2 GET PROJECT DETAILS BY ID
projectAPI.get('/project/:project_id', (req, res) => {
    if (!req.params.project_id) {
        return response(res, 400, 'required', 'ClientID is not found', undefined, 'A-6.2.1')
    }
    //REMAINING DUE TO INSUFFICIENT DATA
})

// 6.3 ASSIGN EMPLOYEE TO PROJECT
projectAPI.post('/team/add', async(req, res) => {
    if (!req.body.project_id || !req.body.employee_id) {
        return response(res, 400, 'required', 'Project Id and Employee ID both are required', undefined, 'A-6.3.1')
    }
    var pushData = { review: false, activity: false, active: true }
    if (req.body.review) {
        pushData.review = true
    }
    if (req.body.activity) {
        pushData.activity = true
    }
    var projectId = String(req.body.project_id).trim(),
        getKeyDB = getKeys(projectId),
        employeeID = String(req.body.employee_id.trim()),
        employeeDB = dbAdminSnapshot.employees,
        employeeKeys = Object.keys(employeeDB)
    if (getKeyDB) {
        for (var i = 0; i < employeeKeys.length; i++) {
            var tempEmployee = employeeDB[employeeKeys[i]]
            if (tempEmployee.employee_id == employeeID && !tempEmployee.deleted) {
                if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team) {
                    var teamDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team,
                        teamKeys = Object.keys(teamDB)
                    for (var j = 0; j < teamKeys.length; j++) {
                        var tempTeam = teamDB[teamKeys[j]]
                        if (tempTeam.employee_id == employeeID) {
                            return response(res, 403, 'forbidden', 'Employee already assigned to this project', undefined, 'A-6.3.2')
                        } else if (j == teamKeys.length - 1) {
                            pushData.employee_id = employeeID
                            pushData.createdOn = String(new Date())
                            pushData.createdBy = "ADMIN"
                            return firebase.database().ref(`admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/`).push(pushData).then(() => {
                                return response(res, 200, 'success', undefined, undefined, 'A-6.3.3')
                            })
                        }
                    }
                } else {
                    pushData.employee_id = employeeID
                    console.log(pushData);
                    return firebase.database().ref(`admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/`).push(pushData).then(() => {
                        return response(res, 200, 'success', undefined, undefined, 'A-6.3.4')
                    })
                }

            } else if (i == employeeKeys.length - 1) {
                return response(res, 403, 'Forbidden', 'Incorrect Employee ID', undefined, 'A-6.3.5')
            }
        }
    } else {
        return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.3.6')

    }
})

// 6.4 UPDATE PERMISSION OF EMPLOYEE ASSIGNED
projectAPI.post('/team/update', async(req, res) => {
    if (!req.body.project_id || !req.body.employee_id) {
        return response(res, 400, 'required', 'Project ID and Employee ID are required', undefined, 'A-6.4.1')
    }
    var projectID = String(req.body.project_id).trim(),
        getKeyDB = getKeys(projectID),
        employeeID = String(req.body.employee_id).trim(),
        employeeDB = dbAdminSnapshot.employees,
        employeeKeys = Object.keys(employeeDB)
    for (var i = 0; i < employeeKeys.length; i++) {
        var tempEmployee = employeeDB[employeeKeys[i]]
        if (tempEmployee.employee_id == employeeID && !tempEmployee.deleted && getKeyDB) {
            if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team) {
                var teamDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team,
                    teamKeys = Object.keys(teamDB)
                for (var j = 0; j < teamKeys.length; j++) {
                    var tempTeam = teamDB[teamKeys[j]]
                    if (tempTeam.employee_id == employeeID && !tempTeam.deleted) {
                        tempTeam.lastModifiedOn = String(new Date())
                        tempTeam.lastModifiedBy = "ADMIN"
                        if (req.body.review) {
                            tempTeam.review = true
                        } else if (req.body.review == false) {
                            tempTeam.review = false
                        }
                        if (req.body.activity) {
                            tempTeam.activity = true
                        } else if (req.body.activity == false) {
                            tempTeam.activity = false
                        }
                        if (req.body.active) {
                            tempTeam.active = true
                        } else if (req.body.active == false) {
                            tempTeam.active = false
                        }
                        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/${teamKeys[j]}/`).update(tempTeam).then(() => {
                            return response(res, 200, 'success', 'Permission Successfully Updated', undefined, 'A-6.4.2')
                        })
                    } else if (j == teamKeys.length - 1) {
                        return response(res, 403, 'forbidden', 'Employee is not active or removed from this project', undefined, 'A-6.4.3')
                    }
                }
            }
        } else if (i == employeeKeys.length - 1) {
            return response(res, 403, 'forbidden', 'Employee is not available or removed', undefined, 'A-6.4.4')
        }
    }
})

// 6.5 TEAM REMOVE
projectAPI.get('/team/remove', (req, res) => {
    if (!req.query.project_id || !req.query.employee_id) {
        return response(res, 400, 'required', 'Input is not proper', undefined, 'A-6.5.1')
    }
    var projectID = String(req.query.project_id),
        getKeyDB = getKeys(projectID),
        employeeID = String(req.query.employee_id).trim()
    if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team) {
        var teamDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team,
            teamDBKeys = Object.keys(teamDB)
        for (var i = 0; i < teamDBKeys.length; i++) {
            var tempTeam = teamDB[teamDBKeys[i]]
            if (tempTeam.employee_id == employeeID) {
                tempTeam.active = false
                tempTeam.deleted = true
                tempTeam.lastModifiedOn = String(new Date())
                tempTeam.lastModifiedBy = "ADMIN"
                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/${teamDBKeys[i]}/`).update(tempTeam).then(() => {
                    return response(res, 200, 'success', 'Deleted Successfully', undefined, 'A-6.5.2')
                })
            } else if (i == teamDBKeys.length - 1) {
                return response(res, 403, 'forbidden', 'Internal Error', undefined, 'A-6.5.3')
            }
        }
    }
})

// 6.6 TEAM DEACTIVATE
projectAPI.get('/team/deactivate', (req, res) => {
    if (!req.query.project_id || !req.query.employee_id) {
        return response(res, 400, 'required', 'Input is not proper', undefined, 'A-6.6.1')
    }
    var projectID = String(req.query.project_id).trim(),
        getKeyDB = getKeys(projectID),
        employeeID = String(req.query.employee_id).trim()
    if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team && getKeyDB) {
        var teamDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team,
            teamDBKeys = Object.keys(teamDB)
        for (var i = 0; i < teamDBKeys.length; i++) {
            var tempTeam = teamDB[teamDBKeys[i]]
            if (tempTeam.employee_id == employeeID && !tempTeam.deleted) {
                tempTeam.active = false
                tempTeam.lastModifiedOn = String(new Date())
                tempTeam.lastModifiedBy = "ADMIN"
                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/${teamDBKeys[i]}/`).update(tempTeam).then(() => {
                    return response(res, 200, 'success', 'Deleted Successfully', undefined, 'A-6.6.2')
                })
            } else if (i == teamDBKeys.length - 1) {
                return response(res, 403, 'forbidden', 'Employee is not assigned to this project', undefined, 'A-6.6.3')
            }
        }
    }
    return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6-6.4')


})

// 6.7 TEAM ACTIVATE
projectAPI.get('/team/activate', (req, res) => {
    if (!req.query.project_id || !req.query.employee_id) {
        return response(res, 400, 'required', 'Project Id and employee Id are required', undefined, 'A-6.7.1')
    }
    var projectID = String(req.query.project_id).trim(),
        getKeyDB = getKeys(projectID),
        employeeID = String(req.query.employee_id).trim()
    if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team && getKeyDB) {
        var teamDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team,
            teamDBKeys = Object.keys(teamDB)
        for (var i = 0; i < teamDBKeys.length; i++) {
            var tempTeam = teamDB[teamDBKeys[i]]
            if (tempTeam.employee_id == employeeID && !tempTeam.deleted) {
                tempTeam.active = true
                tempTeam.lastModifiedOn = String(new Date())
                tempTeam.lastModifiedBy = "ADMIN"
                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/${teamDBKeys[i]}/`).update(tempTeam).then(() => {
                    return response(res, 200, 'success', 'Deleted Successfully', undefined, 'A-6.7.2')
                })
            } else if (i == teamDBKeys.length - 1) {
                return response(res, 403, 'forbidden', 'Employee is not assigned to this project', undefined, 'A-6.7.3')
            }
        }
    }
    return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.7.4')

})

// 6.8 SOCIAL ACCOUNT ADD
projectAPI.post('/social-account/add', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project Id is required', undefined, 'A-6.8.1')
    }
    if (!req.body.account_name) {
        return response(res, 400, 'required', 'Account Name is required', undefined, 'A-6.8.2')
    }
    if (!req.body.reference) {
        return response(res, 400, 'required', 'Reference is required', undefined, 'A-6.8.3')

    }
    var projectID = String(req.body.project_id).trim(),
        accountName = String(req.body.account_name).trim(),
        reference = String(req.body.reference).trim(),
        getKeyDB = getKeys(projectID),
        pushData = {
            "account_name": accountName,
            "reference": reference,
            "createdOn": String(new Date()),
            "createdBy": "ADMIN"
        }
    if (getKeyDB) {
        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/social_account`).push(pushData).then(() => {
            return response(res, 200, 'success', 'Social Account Created', undefined, 'A-6.8.4')
        })
    } else {
        return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.8.5')
    }


})

// 6.9 SOCIAL ACCOUNT UPDATE
projectAPI.post('/social-account/update', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project Id is required', undefined, 'A-6.9.1')
    }
    if (!req.body.account_key) {
        return response(res, 400, 'required', 'Account Key is required', undefined, 'A-6.9.2')
    }
    if (!req.body.reference) {
        return response(res, 400, 'required', 'Reference is required', undefined, 'A-6.9.3')
    }
    var accountKey = String(req.body.account_key).trim(),
        projectID = String(req.body.project_id).trim(),
        getKeyDB = getKeys(projectID),
        reference = String(req.body.reference).trim()
    if (getKeyDB && dbAdminSnapshot.clients[getKeyDB.client_key].social_account) {
        var clientSocialDB = dbAdminSnapshot.clients[getKeyDB.client_key].social_account,
            clientSocialKey = Object.keys(clientSocialDB)
        for (var i = 0; i < clientSocialKey.length; i++) {
            if (clientSocialKey[i] == accountKey && !clientSocialKey[i].deleted) {
                var tempData = clientSocialDB[clientSocialKey[i]]
                tempData.reference = reference
                tempData.lastModifiedOn = String(new Date())
                tempData.lastModifiedBy = "ADMIN"
                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/social_account/${accountKey}`).update(tempData).then(() => {
                    return response(res, 200, 'success', 'Social Account Updated', undefined, 'A-6.9.4')

                })
            } else if (i == clientSocialKey.length - 1) {
                return response(res, 404, 'notfound', 'Incorrect Account ID', undefined, 'A-6.9.5')

            }
        }
    } else {
        return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.9.6')

    }
})

// 6.10 SOCIAL ACCOUNT REMOVE 

projectAPI.get('/social-account/remove', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project Id is required', undefined, 'A-6.10.1')
    }
    if (!req.query.account_key) {
        return response(res, 400, 'required', 'Account Key is required', undefined, 'A-6.10.2')
    }

    var accountKey = String(req.query.account_key).trim(),
        projectID = String(req.query.project_id).trim(),
        getKeyDB = getKeys(projectID)
    if (getKeyDB && dbAdminSnapshot.clients[getKeyDB.client_key].social_account) {
        var clientSocialDB = dbAdminSnapshot.clients[getKeyDB.client_key].social_account,
            clientSocialKey = Object.keys(clientSocialDB)
        for (var i = 0; i < clientSocialKey.length; i++) {
            if (clientSocialKey[i] == accountKey && !clientSocialKey[i].deleted) {
                var tempData = clientSocialDB[clientSocialKey[i]]
                tempData.deleted = true
                tempData.lastModifiedOn = String(new Date())
                tempData.lastModifiedBy = "ADMIN"
                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/social_account/${accountKey}`).update(tempData).then(() => {
                    return response(res, 200, 'success', 'Social Account Removed Successfully', undefined, 'A-6.10.3')
                })
            } else if (i == clientSocialKey.length - 1) {
                return response(res, 404, 'notfound', 'Incorrect Account ID', undefined, 'A-6.10.4')
            }
        }
    } else {
        return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.10.5')
    }

})

// 6.11 UPDATE PROJECT INFO
projectAPI.post('/update', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project Id is required', undefined, 'A-6.11.1')
    }
    var pushData = {}
    if (req.body.project_name) {
        pushData.project_name = String(req.body.project_name).trim()
    }
    if (req.body.project_description) {
        pushData.project_description = String(req.body.project_description).trim()
    }
    var projectID = String(req.query.project_id),
        getKeyDB = getKeys(projectID)
    if (getKeyDB) {
        if (Object.keys(pushData).length > 0) {
            pushData.lastModifiedOn = String(new Date()),
                pushData.lastModifiedBy = "ADMIN"
            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/`).update(pushData).then(() => {
                return response(res, 200, 'success', 'Account Updated Successfully', undefined, 'A-6.11.2')

            })

        } else {
            return response(res, 400, 'required', 'Enter Data To Update', undefined, 'A-6.11.3')

        }
    } else {
        return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.11.4')
    }
})

function getKeys(project_id) {
    if (!dbAdminSnapshot.clients) {
        return false
    }
    var clientDB = dbAdminSnapshot.clients,
        clientKey = Object.keys(clientDB)
    for (var i = 0; i < clientKey.length; i++) {
        if (clientDB[clientKey[i]].plans && !clientDB[clientKey[i]].deleted) {
            var planDB = clientDB[clientKey[i]].plans,
                planKey = Object.keys(planDB)
            for (var j = 0; j < planKey.length; j++) {
                var tempPlan = planDB[planKey[j]]
                if (tempPlan.project_id == project_id && !tempPlan.deleted) {
                    pushData = {
                        "client_key": clientKey[i],
                        "plan_key": planKey[j]
                    }
                    return pushData
                } else if (j == planKey.length - 1) {
                    return false
                }
            }
        } else if (i == clientKey.length - 1) {
            return false
        }
    }
    return false

}
module.exports = projectAPI