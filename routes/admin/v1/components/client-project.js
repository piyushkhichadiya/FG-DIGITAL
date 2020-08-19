const projectAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    fs = require('fs'),
    directoryCreate = require('../../../../config/directory'),
    { response, storageDirectory } = require('../../../../functions/functions')

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
            if (dbClient[dbClientKey[i]].plans) {
                var planDB = dbClient[dbClientKey[i]].plans,
                    planKey = Object.keys(planDB)
                for (var j = 0; j < planKey.length; j++) {
                    var tempPlan = planDB[planKey[j]]
                    if (!tempPlan.deleted) {
                        var tempObj = {
                            project_id: tempPlan.project_id,
                            project_name: tempPlan.project_name,
                            project_description: tempPlan.project_description,
                            createdOn: tempPlan.createdOn,
                            createdBy: tempPlan.createdBy,
                            lastModifiedBy: tempPlan.lastModifiedBy,
                            lastModifiedOn: tempPlan.lastModifiedOn,
                            plan_name: tempPlan.plan_name,
                            duration: tempPlan.duration,
                            start_date: tempPlan.startDate
                        }
                        pushData.push(tempObj)
                    }
                }
            }
            return response(res, 200, 'success', undefined, pushData, 'A-6.1.3')

        } else if (i == dbClientKey.length - 1) {
            return response(res, 404, 'notFound', 'Incorrect Client ID', undefined, 'A-6.1.4')
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

    var pushData = { active: true }
    if (req.body.review == true) {
        pushData.review = true
    }
    if (req.body.activity == true) {
        pushData.activity = true
    }

    if (!dbAdminSnapshot.employees) {
        return response(res, 404, 'notFound', 'Incorrect Employee ID', undefined, 'A-6.3.2')
    }

    var projectId = String(req.body.project_id).trim(),
        getKeyDB = getKeys(projectId),
        employeeID = String(req.body.employee_id).trim(),
        employeeDB = dbAdminSnapshot.employees,
        employeeDBKeys = Object.keys(employeeDB)


    if (!getKeyDB) {
        return response(res, 404, 'notFound', 'Incorrect Project ID', undefined, 'A-6.3.3')
    }

    for (var i = 0; i < employeeDBKeys.length; i++) {
        var tempEmployee = employeeDB[employeeDBKeys[i]]
        if (tempEmployee.employee_id == employeeID && !tempEmployee.deleted) {
            if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team) {
                var teamDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team,
                    teamKeys = Object.keys(teamDB)
                for (var j = 0; j < teamKeys.length; j++) {
                    var tempTeam = teamDB[teamKeys[j]]
                    if (tempTeam.employee_id == employeeID) {
                        return response(res, 409, 'duplicate', 'Employee already assigned to this project', undefined, 'A-6.3.2')
                    } else if (j == teamKeys.length - 1) {
                        pushData.employee_id = employeeID
                        pushData.createdOn = String(new Date())
                        pushData.createdBy = "ADMIN"
                        return firebase.database().ref(`admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/`).push(pushData).then(() => {
                            return response(res, 200, 'success', undefined, undefined, 'A-6.3.4')
                        })
                    }
                }
            } else {
                pushData.employee_id = employeeID
                pushData.createdOn = String(new Date())
                pushData.createdBy = "ADMIN"
                return firebase.database().ref(`admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/`).push(pushData).then(() => {
                    return response(res, 200, 'success', undefined, undefined, 'A-6.3.5')
                })
            }

        } else if (i == employeeDBKeys.length - 1) {
            return response(res, 404, 'notFound', 'Incorrect Employee ID', undefined, 'A-6.3.6')
        }
    }
})

// 6.4 UPDATE PERMISSION OF EMPLOYEE ASSIGNED
projectAPI.post('/team/update', async(req, res) => {
    if (!req.body.project_id || !req.body.employee_id) {
        return response(res, 400, 'required', 'Project ID and Employee ID are required', undefined, 'A-6.4.1')
    }

    if (!dbAdminSnapshot.employees) {
        return response(res, 404, 'notFound', 'Incorrect Employee ID', undefined, 'A-6.4.2')
    }

    var projectID = String(req.body.project_id).trim(),
        getKeyDB = getKeys(projectID),
        employeeID = String(req.body.employee_id).trim(),
        employeeDB = dbAdminSnapshot.employees,
        employeeDBKeys = Object.keys(employeeDB)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.4.3') }

    for (var i = 0; i < employeeDBKeys.length; i++) {
        var tempEmployee = employeeDB[employeeDBKeys[i]]
        if (tempEmployee.employee_id == employeeID && !tempEmployee.deleted) {
            if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team) {
                var teamDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team,
                    teamKeys = Object.keys(teamDB)
                for (var j = 0; j < teamKeys.length; j++) {
                    var tempTeam = teamDB[teamKeys[j]]
                    if (tempTeam.employee_id == employeeID && !tempTeam.deleted) {

                        if (req.body.review == true) {
                            tempTeam.review = true
                        } else if (req.body.review == false) {
                            tempTeam.review = false
                        }
                        if (req.body.activity == true) {
                            tempTeam.activity = true
                        } else if (req.body.activity == false) {
                            tempTeam.activity = false
                        }
                        if (req.body.active == true) {
                            tempTeam.active = true
                        } else if (req.body.active == false) {
                            tempTeam.active = false
                        }

                        tempTeam.lastModifiedOn = String(new Date())
                        tempTeam.lastModifiedBy = "ADMIN"

                        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/${teamKeys[j]}/`).update(tempTeam).then(() => {
                            return response(res, 200, 'success', 'Permission Successfully Updated', undefined, 'A-6.4.4')
                        })
                    } else if (j == teamKeys.length - 1) {
                        return response(res, 403, 'forbidden', 'Employee is not active or removed from this project', undefined, 'A-6.4.5')
                    }
                }
            }
        } else if (i == employeeDBKeys.length - 1) {
            return response(res, 403, 'forbidden', 'Employee ID is not team member', undefined, 'A-6.4.6')
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

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.5.2') }

    if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team) {
        var teamDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team,
            teamDBKeys = Object.keys(teamDB)
        for (var i = 0; i < teamDBKeys.length; i++) {
            var tempTeam = teamDB[teamDBKeys[i]]
            if (tempTeam.employee_id == employeeID && !tempTeam.deleted) {
                tempTeam.active = false
                tempTeam.deleted = true
                tempTeam.lastModifiedOn = String(new Date())
                tempTeam.lastModifiedBy = "ADMIN"
                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/${teamDBKeys[i]}/`).update(tempTeam).then(() => {
                    return response(res, 200, 'success', 'Deleted Successfully', undefined, 'A-6.5.3')
                })
            } else if (i == teamDBKeys.length - 1) {
                return response(res, 403, 'forbidden', 'Employee ID is not part of project team', undefined, 'A-6.5.4')
            }
        }
    } else {
        return response(res, 403, 'forbidden', 'Employee is not assigned to this project', undefined, 'A-6.5.5')
    }
})

// 6.6 TEAM DEACTIVATE
projectAPI.get('/team/deactivate', (req, res) => {
    if (!req.query.project_id || !req.query.employee_id) {
        return response(res, 400, 'required', 'Project ID and Employee ID are required', undefined, 'A-6.6.1')
    }
    var projectID = String(req.query.project_id).trim(),
        getKeyDB = getKeys(projectID),
        employeeID = String(req.query.employee_id).trim()

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.6.2') }

    if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team) {
        var teamDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team,
            teamDBKeys = Object.keys(teamDB)
        for (var i = 0; i < teamDBKeys.length; i++) {
            var tempTeam = teamDB[teamDBKeys[i]]
            if (tempTeam.employee_id == employeeID && !tempTeam.deleted) {
                if (!tempTeam.active) {
                    return response(res, 403, 'forbidden', 'Employee is already deactivated from this project', undefined, 'A-6.6.3')
                }
                tempTeam.active = false
                tempTeam.lastModifiedOn = String(new Date())
                tempTeam.lastModifiedBy = "ADMIN"
                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/${teamDBKeys[i]}/`).update(tempTeam).then(() => {
                    return response(res, 200, 'success', 'Deleted Successfully', undefined, 'A-6.6.4')
                })
            } else if (i == teamDBKeys.length - 1) {
                return response(res, 403, 'forbidden', 'Employee is not assigned to this project', undefined, 'A-6.6.5')
            }
        }
    } else {
        return response(res, 403, 'forbidden', 'Employee is not assigned to this project', undefined, 'A-6.6.6')
    }
})

// 6.7 TEAM ACTIVATE
projectAPI.get('/team/activate', (req, res) => {
    if (!req.query.project_id || !req.query.employee_id) {
        return response(res, 400, 'required', 'Project ID and employee ID are required', undefined, 'A-6.7.1')
    }
    var projectID = String(req.query.project_id).trim(),
        getKeyDB = getKeys(projectID),
        employeeID = String(req.query.employee_id).trim()

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.7.2') }

    if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team) {
        var teamDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].team,
            teamDBKeys = Object.keys(teamDB)
        for (var i = 0; i < teamDBKeys.length; i++) {
            var tempTeam = teamDB[teamDBKeys[i]]
            if (tempTeam.employee_id == employeeID && !tempTeam.deleted) {
                if (tempTeam.active) {
                    return response(res, 403, 'forbidden', 'Employee is already activated for this project', undefined, 'A-6.7.3')
                }
                tempTeam.active = true
                tempTeam.lastModifiedOn = String(new Date())
                tempTeam.lastModifiedBy = "ADMIN"
                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/team/${teamDBKeys[i]}/`).update(tempTeam).then(() => {
                    return response(res, 200, 'success', 'Deleted Successfully', undefined, 'A-6.7.4')
                })
            } else if (i == teamDBKeys.length - 1) {
                return response(res, 403, 'forbidden', 'Employee is not assigned to this project', undefined, 'A-6.7.5')
            }
        }
    } else {
        return response(res, 403, 'forbidden', 'Employee is not assigned to this project', undefined, 'A-6.7.6')
    }

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
        return response(res, 400, 'required', 'Reference (URL/Username) is required', undefined, 'A-6.8.3')

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

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.8.4') }

    return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/social_account`).push(pushData).then(() => {
        return response(res, 200, 'success', 'Social Account Created', undefined, 'A-6.8.5')
    })


})

// 6.9 SOCIAL ACCOUNT UPDATE
projectAPI.post('/social-account/update', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project Id is required', undefined, 'A-6.9.1')
    }
    if (!req.body.account_key) {
        return response(res, 400, 'required', 'Account Key is required', undefined, 'A-6.9.2')
    }

    var accountKey = String(req.body.account_key).trim(),
        projectID = String(req.body.project_id).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.9.3') }

    if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].social_account) {
        var clientSocialDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].social_account,
            clientSocialKey = Object.keys(clientSocialDB)
        for (var i = 0; i < clientSocialKey.length; i++) {
            if (clientSocialKey[i] == accountKey && !clientSocialDB[clientSocialKey[i]].deleted) {
                var tempData = clientSocialDB[clientSocialKey[i]]

                if (req.body.account_name) {
                    var accountName = String(req.body.account_name).trim()
                    if (accountName == "") {
                        return response(res, 400, 'required', 'Account Name value cannot be empty', undefined, 'A-6.9.4')
                    }
                    tempData.account_name = accountName
                }

                if (req.body.reference) {
                    var reference = String(req.body.reference).trim()
                    tempData.reference = reference
                }

                tempData.lastModifiedOn = String(new Date())
                tempData.lastModifiedBy = "ADMIN"
                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/social_account/${accountKey}`).update(tempData).then(() => {
                    return response(res, 200, 'success', 'Social Account Updated', undefined, 'A-6.9.5')

                })
            } else if (i == clientSocialKey.length - 1) {
                return response(res, 404, 'notfound', 'Incorrect Account ID', undefined, 'A-6.9.6')
            }
        }
    } else {
        return response(res, 404, 'notfound', 'Incorrect Account ID', undefined, 'A-6.9.7')
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

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.10.3') }

    if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].social_account) {
        var clientSocialDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].social_account,
            clientSocialKey = Object.keys(clientSocialDB)
        for (var i = 0; i < clientSocialKey.length; i++) {
            if (clientSocialKey[i] == accountKey && !clientSocialDB[clientSocialKey[i]].deleted) {
                var tempData = clientSocialDB[clientSocialKey[i]]
                tempData.deleted = true
                tempData.lastModifiedOn = String(new Date())
                tempData.lastModifiedBy = "ADMIN"
                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/social_account/${accountKey}`).update(tempData).then(() => {
                    return response(res, 200, 'success', 'Social Account Removed Successfully', undefined, 'A-6.10.4')
                })
            } else if (i == clientSocialKey.length - 1) {
                return response(res, 404, 'notfound', 'Incorrect Account ID', undefined, 'A-6.10.5')
            }
        }
    } else {
        return response(res, 404, 'notfound', 'Incorrect Account ID', undefined, 'A-6.10.6')
    }

})

// 6.11 UPDATE PROJECT INFO
projectAPI.post('/update', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project Id is required', undefined, 'A-6.11.1')
    }
    var pushData = {}
    if (req.body.project_name) {
        pushData.project_name = String(req.body.project_name).trim()
    }
    if (req.body.project_description) {
        pushData.project_description = String(req.body.project_description).trim()
    }
    var projectID = String(req.body.project_id),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.11.2') }
    if (Object.keys(pushData).length > 0) {
        pushData.lastModifiedOn = String(new Date())
        pushData.lastModifiedBy = "ADMIN"
        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/`).update(pushData).then(() => {
            return response(res, 200, 'success', 'Account Updated Successfully', undefined, 'A-6.11.3')

        })
    } else {
        return response(res, 400, 'required', 'Project Name or Description is required', undefined, 'A-6.11.4')
    }
})

// 6.12 REVIEW CREATE
projectAPI.post('/review/create', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.12.1')
    }
    if (!req.body.title) {
        return response(res, 400, 'required', 'Title is required', undefined, 'A-6.12.2')
    }
    var projectID = String(req.body.project_id).trim(),
        title = String(req.body.title).trim(),
        getKeyDB = getKeys(projectID)

    pushData = {
        "review_id": Math.floor(new Date().valueOf() * Math.random()),
        "title": title,
        "createdOn": String(new Date()),
        "createdBy": "ADMIN"
    }

    if (req.body.description) {
        pushData.description = String(req.body.description).trim()
    }
    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.12.3') }

    return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review`).push(pushData).then(() => {
        return response(res, 200, 'success', 'Social Account Created', { review_id: pushData.review_id }, 'A-6.12.4')
    })

})

// 6.13 REVIEW ADD POST
projectAPI.post('/review/add-post', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.13.1')
    }
    if (!req.body.review_key) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'A-6.13.2')
    }
    var projectID = String(req.body.project_id).trim(),
        getKeyDB = getKeys(projectID),
        reviewID = String(req.body.review_key).trim(),
        pushData = {
            createdOn: String(new Date()),
            createdBy: "ADMIN"
        }

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.13.3') }

    // Create Directory if does not exist
    directoryCreate(`/clients/${getKeyDB.client_key}/reviews`)

    if (req.body.description) {
        var description = String(req.body.description).trim()
        pushData.description = description
    }
    if (req.files && req.files.file) {
        pushData.images = []
        var file = req.files.file,
            fileNameData = [],
            directory = storageDirectory() + `/clients/${getKeyDB.client_key}/reviews/`

        if (Array.isArray(file)) {
            //FOR MULTIPLE FILE

            for (var i = 0; i < file.length; i++) {
                var tempFile = file[i]
                if ((tempFile.size / 1024 / 1024) > 10) {
                    return response(res, 403, 'forbidden', 'File size limit exceed. 10 MB/per file is maximum', undefined, 'A-6.13.4');
                }
                var tempName;
                switch (tempFile.mimetype) {
                    case 'image/jpeg':
                    case 'image/jpg':
                        tempName = 'Post-' + Math.floor(new Date().valueOf() * Math.random()) + '.jpeg';
                        break;
                    case 'image/png':
                        tempName = 'Post-' + Math.floor(new Date().valueOf() * Math.random()) + '.png';
                        break;
                    default:
                        return response(res, 403, 'forbidden', 'Invalid File Type. JPEG/PNG are only valid file types.', undefined, 'A-6.13.5')

                }
                fileNameData.push(tempName)
                pushData.images.push({ filename: tempName })
            }
        } else {
            // FOR SINGLE FILE
            var tempFile = file
            if ((tempFile.size / 1024 / 1024) > 10) {
                return response(res, 403, 'forbidden', 'File size limit exceed. 10 MB/per file is maximum', undefined, 'A-6.13.6');
            }
            var tempName = ''
            switch (tempFile.mimetype) {
                case 'image/jpeg':
                case 'image/jpg':
                    tempName = 'Post-' + Math.floor(new Date().valueOf() * Math.random()) + '.jpeg';
                    break;
                case 'image/png':
                    tempName = 'Post-' + Math.floor(new Date().valueOf() * Math.random()) + '.png';;
                    break;
                default:
                    return response(res, 403, 'forbidden', 'Invalid File Type. JPEG/PNG are only valid file types.', undefined, 'A-6.13.7')

            }
            fileNameData.push(tempName)
            pushData.images.push({ filename: tempName })
        }

    }

    if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
            reviewDBKey = Object.keys(reviewDB)
        for (var j = 0; j < reviewDBKey.length; j++) {
            var tempReview = reviewDB[reviewDBKey[j]]
            if (reviewDBKey[j] == reviewID && !tempReview.deleted && !tempReview.closed) {
                if (fileNameData && fileNameData.length == 1) {
                    var file = req.files.file,
                        tempName = String(fileNameData)
                    file.mv(directory + tempName, (error, abc) => {
                        if (error) {
                            return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'A-6.13.8')
                        }
                    })
                } else if (fileNameData && fileNameData.length > 1) {
                    var file = req.files.file
                    for (var i = 0; i < file.length; i++) {
                        var tempFile = file[i],
                            tempName = fileNameData[i]
                        tempFile.mv(directory + tempName, (error) => {
                            if (error) {
                                return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'A-6.13.9')
                            }
                        })
                    }
                }
                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewID}/post`).push(pushData).then(() => {
                    return response(res, 200, 'success', 'Social Account Created', undefined, 'A-6.13.10')
                })
            } else if (j == reviewDBKey.length - 1) {
                return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'A-6.13.1z')
            }
        }
    } else {
        return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'A-6.13.13')
    }

})

// 6.14 REMOVE POST
projectAPI.get('/review/remove-post', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.14.1')
    }
    if (!req.query.review_id || !req.query.post_id) {
        return response(res, 400, 'required', 'Review ID and Post ID both are required', undefined, 'A-6.14.2')
    }

    var projectID = String(req.query.project_id).trim(),
        reviewID = String(req.query.review_id).trim(),
        postID = String(req.query.post_id).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.14.3') }
    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect ', undefined, 'A-6.14.9')
    }
    var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKey = Object.keys(reviewDB),
        directory = storageDirectory() + `/clients/${getKeyDB.client_key}/reviews/`

    for (var j = 0; j < reviewDBKey.length; j++) {
        var tempReview = reviewDB[reviewDBKey[j]]
        if (reviewDBKey[j] == reviewID && !tempReview.deleted) {
            if (tempReview.closed) {
                return response(res, 403, 'forbidden', 'Modifications on closed reviews are not allowed', undefined, 'A-6.14.4')
            }
            if (tempReview.post) {
                var postDB = tempReview.post,
                    postDBKey = Object.keys(postDB)
                for (var i = 0; i < postDBKey.length; i++) {
                    if (postDBKey[i] == postID) {
                        //removing Images
                        var tempReviewPost = postDB[postDBKey[i]]
                        if (tempReviewPost.deleted) {
                            return response(res, 403, 'Forbidden', 'Post is already removed', undefined, 'A-6.14.10')
                        }
                        if (tempReviewPost.images) {
                            var tempPostImages = tempReviewPost.images,
                                tempPostImagesKey = Object.keys(tempPostImages)
                            for (var k = 0; k < tempPostImagesKey.length; k++) {
                                var tempImage = tempPostImages[tempPostImagesKey[k]].filename
                                try { fs.unlinkSync(directory + tempImage) } catch {}
                            }
                        }


                        tempReviewPost.deleted = true
                        tempReviewPost.lastModifiedBy = 'ADMIN'
                        tempReviewPost.lastModifiedOn = String(new Date())

                        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewID}/post/${postID}`).update(tempReviewPost).then(() => {
                            return response(res, 200, 'success', 'Review has been deleted successfully', undefined, 'A-6.14.5')
                        })
                    } else if (i == postDBKey.length - 1) {
                        return response(res, 404, 'notfound', 'Incorrect Post ID', undefined, 'A-6.14.6')
                    }
                }
            } else {
                return response(res, 404, 'notfound', 'Incorrect Post ID', undefined, 'A-6.14.7')
            }
        } else if (j == reviewDBKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'A-6.14.8')
        }
    }
})

// 6.15 REVIEW CLOSE
projectAPI.get('/review/close', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.15.1')
    }
    if (!req.query.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'A-6.15.2')
    }
    var projectID = String(req.query.project_id).trim(),
        reviewID = String(req.query.review_id).trim(),
        getKeyDB = getKeys(projectID)
    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.15.3') }
    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect ', undefined, 'A-6.15.4')
    }
    var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKey = Object.keys(reviewDB)
    for (var i = 0; i < reviewDBKey.length; i++) {
        if (reviewID == reviewDBKey[i]) {
            var tempReview = reviewDB[reviewDBKey[i]]
            if (tempReview.closed) {
                return response(res, 403, 'Forbidden', 'Review is already closed', undefined, 'A-6.15.5')

            }
            tempReview.closed = true,
                tempReview.lastModifiedBy = "ADMIN",
                tempReview.lastModifiedOn = String(new Date())
            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewID}/`).update(tempReview).then(() => {
                return response(res, 200, 'success', 'Review has been closed successfully', undefined, 'A-6.15.6')

            })

        } else if (i == reviewDBKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'A-6.15.7')

        }
    }
})

// 6.16 REMOVE FILE
projectAPI.get('/review/remove-file', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.16.1')
    }
    if (!req.query.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'A-6.16.2')
    }
    if (!req.query.filename) {
        return response(res, 400, 'required', 'File Name is required', undefined, 'A-6.16.3')
    }
    var projectID = String(req.query.project_id).trim(),
        reviewID = String(req.query.review_id).trim(),
        fileName = String(req.query.filename).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.16.4') }
    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans) {
        return response(res, 404, 'notfound', 'Plan ID Incorrect ', undefined, 'A-6.16.5')
    }
    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect ', undefined, 'A-6.16.6')
    }
    var directory = storageDirectory() + `/clients/${getKeyDB.client_key}/reviews/`,
        reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKey = Object.keys(reviewDB)
    for (var j = 0; j < reviewDBKey.length; j++) {
        var tempReview = reviewDB[reviewDBKey[j]]
        if (reviewDBKey[j] == reviewID) {
            if (tempReview.closed) {
                return response(res, 403, 'forbidden', 'Modifications on closed reviews are not allowed', undefined, 'A-6.16.7')
            }
            if (tempReview.post) {
                var postDB = tempReview.post,
                    postDBKey = Object.keys(postDB)
                for (var i = 0; i < postDBKey.length; i++) {
                    // removing Images
                    var tempReviewPost = postDB[postDBKey[i]]
                    if (tempReviewPost.deleted) {
                        return response(res, 403, 'Forbidden', 'Post is already removed', undefined, 'A-6.16.8')
                    }
                    if (tempReviewPost.images) {
                        var imagesDB = tempReviewPost.images,
                            imagesDBKeys = Object.keys(imagesDB)
                        for (var k = 0; k < imagesDBKeys.length; k++) {
                            var tempImage = imagesDB[imagesDBKeys[k]]
                            if (tempImage.filename == fileName) {
                                if (tempImage.deleted) {
                                    return response(res, 403, 'Forbidden', 'Image is already removed', undefined, 'A-6.16.9')
                                }
                                try { fs.unlinkSync(directory + tempImage.filename) } catch {}
                                tempImage.deleted = true
                                tempImage.lastModifiedBy = 'ADMIN'
                                tempImage.lastModifiedOn = String(new Date())
                                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewID}/post/${postDBKey[i]}/images/${imagesDBKeys[k]}/`).update(tempImage).then(() => {
                                    return response(res, 200, 'success', 'Review has been deleted successfully', undefined, 'A-6.16.10')
                                })
                            }
                        }
                    }
                }
            } else {
                return response(res, 404, 'notfound', 'Incorrect File Name', undefined, 'A-6.16.11')
            }
        } else if (j == reviewDBKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID or FileName', undefined, 'A-6.16.12')
        }
    }
})

// 6.17 Add Service
projectAPI.get('/service/add', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.17.1')
    }
    if (!req.query.service_id) {
        return response(res, 400, 'required', 'Service ID is required', undefined, 'A-6.17.2')
    }
    var projectID = String(req.query.project_id).trim(),
        serviceID = String(req.query.service_id).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.17.3') }

    if (dbAdminSnapshot && dbAdminSnapshot.services) {
        var serviceDB = dbAdminSnapshot.services,
            serviceDBKeys = Object.keys(serviceDB)

        for (var i = 0; i < serviceDBKeys.length; i++) {
            var tempService = serviceDB[serviceDBKeys[i]]

            if (tempService.service_id == serviceID) {

                if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service) {

                    var serviceDBClient = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service,
                        serviceDBClientKey = Object.keys(serviceDBClient)

                    for (var j = 0; j < serviceDBClientKey.length; j++) {
                        var tempServiceClient = serviceDBClient[serviceDBClientKey[j]]

                        if (tempServiceClient.service_id == serviceID) {
                            return response(res, 409, 'duplicate', 'Service already added', undefined, 'A-6.17.4')
                        } else if (j == serviceDBClientKey.length - 1) {
                            var pushData = {
                                service_id: serviceID,
                                active: true,
                                createdOn: String(new Date()),
                                createdBy: "ADMIN"
                            }
                            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/service/`).push(pushData).then(() => {
                                return response(res, 200, 'success', 'Service has been added successfully', undefined, 'A-6.17.5')
                            })
                        }
                    }
                } else {
                    var pushData = {
                        service_id: serviceID,
                        active: true,
                        createdOn: String(new Date()),
                        createdBy: "ADMIN"
                    }
                    return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/service/`).push(pushData).then(() => {
                        return response(res, 200, 'success', 'Service has been added successfully', undefined, 'A-6.17.6')
                    })
                }

            } else if (i == serviceDBKeys.length - 1) {
                return response(res, 404, 'notfound', 'Incorrect Service ID', undefined, 'A-6.17.7')
            }
        }
    } else {
        return response(res, 404, 'notfound', 'Incorrect Service ID', undefined, 'A-6.17.8')
    }
})

// 6.18 Deactivate Service
projectAPI.get('/service/deactivate', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.18.1')
    }
    if (!req.query.service_id) {
        return response(res, 400, 'required', 'Service ID is required', undefined, 'A-6.18.2')
    }
    var projectID = String(req.query.project_id).trim(),
        serviceID = String(req.query.service_id).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.18.3') }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service) {
        return response(res, 404, 'notfound', 'Service ID Incorrect ', undefined, 'A-6.18.4')
    }

    var serviceDBClient = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service,
        serviceDBClientKey = Object.keys(serviceDBClient)

    for (var i = 0; i < serviceDBClientKey.length; i++) {
        var tempService = serviceDBClient[serviceDBClientKey[i]]

        if (tempService.active && tempService.service_id == serviceID && !tempService.deleted) {
            tempService.active = false
            tempService.lastModifiedBy = "ADMIN"
            tempService.lastModifiedOn = String(new Date())
            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/service/${serviceDBClientKey[i]}/`).update(tempService).then(() => {
                return response(res, 200, 'success', 'Service has been deactivated successfully', undefined, 'A-6.18.5')
            })
        } else if (i == serviceDBClientKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Service ID', undefined, 'A-6.18.6')
        }
    }

})

// 6.19 Activate Service
projectAPI.get('/service/activate', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.19.1')
    }
    if (!req.query.service_id) {
        return response(res, 400, 'required', 'Service ID is required', undefined, 'A-6.19.2')
    }
    var projectID = String(req.query.project_id).trim(),
        serviceID = String(req.query.service_id).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.19.3') }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service) {
        return response(res, 404, 'notfound', 'Service ID Incorrect ', undefined, 'A-6.19.4')
    }

    var serviceDBClient = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service,
        serviceDBClientKey = Object.keys(serviceDBClient)

    for (var i = 0; i < serviceDBClientKey.length; i++) {
        var tempService = serviceDBClient[serviceDBClientKey[i]]
        if (tempService.service_id == serviceID && !tempService.deleted) {

            if (tempService.active) {
                return response(res, 403, 'forbidden', 'This service is already active', undefined, 'A-6.19.5')
            }

            tempService.active = true
            tempService.lastModifiedBy = "ADMIN"
            tempService.lastModifiedOn = String(new Date())

            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/service/${serviceDBClientKey[i]}/`).update(tempService).then(() => {
                return response(res, 200, 'success', 'Service has been deactivated successfully', undefined, 'A-6.19.6')
            })
        } else if (i == serviceDBClientKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Service ID', undefined, 'A-6.19.7')
        }
    }
})

// 6.20 Remove Service
projectAPI.get('/service/remove', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.20.1')
    }
    if (!req.query.service_id) {
        return response(res, 400, 'required', 'Service ID is required', undefined, 'A-6.20.2')
    }
    var projectID = String(req.query.project_id).trim(),
        serviceID = String(req.query.service_id).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.20.3') }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service) {
        return response(res, 404, 'notfound', 'Service ID Incorrect ', undefined, 'A-6.20.4')
    }

    var serviceDBClient = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service,
        serviceDBClientKey = Object.keys(serviceDBClient)

    for (var i = 0; i < serviceDBClientKey.length; i++) {
        var tempService = serviceDBClient[serviceDBClientKey[i]]

        if (tempService.service_id == serviceID) {

            if (tempService.deleted) {
                return response(res, 403, 'forbidden', 'This service is already deleted', undefined, 'A-6.20.5')
            }

            tempService.active = false
            tempService.deleted = true
            tempService.lastModifiedBy = "ADMIN"
            tempService.lastModifiedOn = String(new Date())

            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/service/${serviceDBClientKey[i]}/`).update(tempService).then(() => {
                return response(res, 200, 'success', 'Service has been updated successfully', undefined, 'A-6.20.6')
            })
        } else if (i == serviceDBClientKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Service ID', undefined, 'A-6.20.7')
        }
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