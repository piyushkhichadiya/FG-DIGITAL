const projectAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    fs = require('fs'),
    directoryCreate = require('../../../../config/directory'),
    { response, storageDirectory, unlinkFile } = require('../../../../functions/functions')

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
projectAPI.get('/get', (req, res) => {
    if (!req.query.client_id) {
        return response(res, 400, 'required', 'ClientID is required', undefined, 'A-6.1.1')
    }
    var client_id = String(req.query.client_id).trim();

    if (!dbAdminSnapshot.clients || !dbAdminSnapshot.clients[client_id]) {
        return response(res, 404, 'notfound', 'Incorrect Client ID', undefined, 'A-6.1.2')
    }

    var dbClient = dbAdminSnapshot.clients[client_id],
        pushData = []
    if (dbClient.plans) {

        var planDB = dbClient.plans,
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
                    lastModifiedOn: tempPlan.lastModifiedOn
                }
                pushData.push(tempObj)
            }
        }
    }
    return response(res, 200, 'success', undefined, pushData, 'A-6.1.3')
})

// 6.2 GET PROJECT DETAILS BY ID
projectAPI.get('/fetch/:project_id', (req, res) => {

    var projectID = parseInt(req.params.project_id)
    if (!getKeys(projectID)) { return response(res, 404, 'notFound', 'Incorrect Project ID', undefined, 'A-6.2.1') }

    var dbProject = dbAdminSnapshot.clients[getKeys(projectID).client_key].plans[getKeys(projectID).plan_key],
        postObject = {
            project_id: projectID
        }

    if (req.query.scope) {
        var scope = String(req.query.scope).split(' ')
        postObject.scope = [];
    } else {
        return response(res, 200, 'success', 'No Scope Identified', { projectID: projectID }, 'A-6.2.2')
    }

    // Basic Information
    if (scope.includes('info')) {
        postObject.scope.push('info');

        var tempObj = {
            project_name: dbProject.project_name,
            description: dbProject.project_description,
            createdBy: dbProject.createdBy,
            createdOn: dbProject.createdOn,
            lastModifiedBy: dbProject.lastModifiedBy,
            lastModifiedOn: dbProject.lastModifiedOn
        }

        postObject.info = tempObj;
    }

    // Attached Service
    if (scope.includes('service')) {
        postObject.scope.push('service')

        if (dbProject.service) {
            var dbProjectService = dbProject.service,
                dbProjectServiceKey = Object.keys(dbProjectService)

            postObject.service = [];

            for (var i = 0; i < dbProjectServiceKey.length; i++) {
                var tempService = dbProjectService[dbProjectServiceKey[i]];

                if (tempService.deleted) { continue }

                if (dbAdminSnapshot.services) {
                    var dbService = dbAdminSnapshot.services,
                        dbServiceKey = Object.keys(dbService)

                    for (var j = 0; j < dbServiceKey.length; j++) {
                        if (!dbService[dbServiceKey[j]].deleted && dbService[dbServiceKey[j]].service_id == tempService.service_id) {
                            var tempJSONObject = {
                                service_id: tempService.service_id,
                                active: tempService.active,
                                createdBy: tempService.createdBy,
                                createdOn: tempService.createdOn,
                                lastModifiedBy: tempService.lastModifiedBy,
                                lastModifiedOn: tempService.lastModifiedOn
                            }

                            postObject.service.push(tempJSONObject);
                        }
                    }
                }
            }

            if (postObject.service.length == 0) {
                delete postObject.service
            }
        }
    }

    // Allocated Employee ID
    if (scope.includes('team')) {
        postObject.scope.push('team')

        if (dbProject.team) {
            var dbProjectTeam = dbProject.team,
                dbProjectTeamKey = Object.keys(dbProjectTeam)

            postObject.team = [];

            for (var i = 0; i < dbProjectTeamKey.length; i++) {
                var tempTeam = dbProjectTeam[dbProjectTeamKey[i]]
                if (tempTeam.deleted) { continue }

                // Check Employee is not deleted
                if (dbAdminSnapshot.employees) {
                    var dbEmployee = dbAdminSnapshot.employees,
                        dbEmployeeKey = Object.keys(dbEmployee)

                    for (var j = 0; j < dbEmployeeKey.length; j++) {
                        if (!dbEmployee[dbEmployeeKey[j]].deleted && dbEmployee[dbEmployeeKey[j]].employee_id == tempTeam.employee_id) {
                            var tempJSONObject = {
                                employee_id: tempTeam.employee_id,
                                active: tempTeam.active,
                                createdOn: tempTeam.createdOn,
                                createdBy: tempTeam.createdBy,
                                lastModifiedBy: tempTeam.lastModifiedBy,
                                lastModifiedOn: tempTeam.lastModifiedOn,
                                permission: {
                                    activity: tempTeam.activity,
                                    review: tempTeam.review
                                }
                            }
                            postObject.team.push(tempJSONObject)
                        }
                    }
                }
            }
            if (postObject.team.length == 0) {
                delete postObject.team
            }
        }
    }

    // Social Accounts
    if (scope.includes('accounts')) {
        postObject.scope.push('accounts')

        if (dbProject.social_account) {
            var dbSocialAccount = dbProject.social_account,
                dbSocialAccountKey = Object.keys(dbSocialAccount)

            postObject.accounts = [];

            for (var i = 0; i < dbSocialAccountKey.length; i++) {
                var tempSocialAccount = dbSocialAccount[dbSocialAccountKey[i]];

                if (tempSocialAccount.deleted) { continue }

                var tempJSONObject = {
                    account_id: dbSocialAccountKey[i],
                    account_name: tempSocialAccount.account_name,
                    reference: tempSocialAccount.reference,
                    createdBy: tempSocialAccount.createdBy,
                    createdOn: tempSocialAccount.createdOn,
                    lastModifiedOn: tempSocialAccount.lastModifiedOn,
                    lastModifiedBy: tempSocialAccount.lastModifiedBy,
                    lastModifiedById: tempSocialAccount.lastModifiedById,
                }

                postObject.accounts.push(tempJSONObject);
            }

            if (postObject.accounts.length == 0) {
                delete postObject.accounts
            }
        }
    }

    // Reviews
    if (scope.includes('review')) {
        postObject.scope.push('review');

        if (dbProject.review) {
            var dbReview = dbProject.review,
                dbReviewKey = Object.keys(dbReview)

            postObject.review = []

            for (var i = 0; i < dbReviewKey.length; i++) {
                var tempReview = dbReview[dbReviewKey[i]];

                if (tempReview.deleted) { continue }

                var tempJSONObject = {
                    review_id: tempReview.review_id,
                    title: tempReview.title,
                    description: tempReview.description,
                    createdOn: tempReview.createdOn,
                    createdBy: tempReview.createdBy,
                    createdById: tempReview.createdById,
                    lastModifiedOn: tempReview.lastModifiedOn,
                    lastModifiedBy: tempReview.lastModifiedBy,
                    lastModifiedById: tempReview.lastModifiedById,
                    closed: tempReview.closed
                }

                if (tempReview.post) {
                    var dbReviewPost = tempReview.post,
                        dbReviewPostKey = Object.keys(dbReviewPost)

                    tempJSONObject.posts = []

                    for (var j = 0; j < dbReviewPostKey.length; j++) {
                        var tempReviewPost = dbReviewPost[dbReviewPostKey[j]];

                        if (tempReviewPost.deleted) { continue }
                        var tempPostObj = {
                            post_key: dbReviewPostKey[j],
                            description: tempReviewPost.description,
                            createdOn: tempReviewPost.createdOn,
                            createdBy: tempReviewPost.createdBy,
                            createdById: tempReviewPost.createdById,
                            lastModifiedOn: tempReviewPost.lastModifiedOn,
                            lastModifiedBy: tempReviewPost.lastModifiedBy,
                            lastModifiedById: tempReviewPost.lastModifiedById,
                        }

                        // Documents
                        if (tempReviewPost.documents) {
                            var dbPostDocuments = tempReviewPost.documents,
                                dbPostDocumentsKey = Object.keys(dbPostDocuments)

                            tempPostObj.documents = []

                            for (var k = 0; k < dbPostDocumentsKey.length; k++) {
                                var tempDocument = dbPostDocuments[dbPostDocumentsKey[k]]

                                if (tempDocument.deleted) { continue }

                                var tempDocObj = {
                                    document_id: dbPostDocumentsKey[k],
                                    filename: tempDocument.filename,
                                    lastModifiedOn: tempDocument.lastModifiedOn,
                                    lastModifiedBy: tempDocument.lastModifiedBy,
                                    lastModifiedById: tempDocument.lastModifiedById,
                                    createdOn: tempDocument.createdOn,
                                    createdBy: tempDocument.createdBy,
                                    createdById: tempDocument.createdById
                                }

                                tempPostObj.documents.push(tempDocObj)
                            }

                            if (tempPostObj.documents.length == 0) {
                                delete tempPostObj.documents
                            }
                        }

                        // Conversation
                        if (tempReviewPost.conversations) {
                            var dbPostConversations = tempReviewPost.conversations,
                                dbPostConversationsKey = Object.keys(dbPostConversations)

                            tempPostObj.conversations = []

                            for (var k = 0; k < dbPostConversationsKey.length; k++) {
                                var tempConversation = dbPostConversations[dbPostConversationsKey[k]]

                                if (tempConversation.deleted) { continue }

                                var tempConversationObj = {
                                    conversation_key: dbPostConversationsKey[k],
                                    createdOn: tempConversation.createdOn,
                                    createdBy: tempConversation.createdBy,
                                    createdById: tempConversation.createdById,
                                    lastModifiedOn: tempConversation.lastModifiedOn,
                                    lastModifiedBy: tempConversation.lastModifiedBy,
                                    lastModifiedById: tempConversation.lastModifiedById,
                                    status: tempConversation.status,
                                    description: tempConversation.description
                                }

                                // Push to Post Object
                                tempPostObj.conversations.push(tempConversationObj)
                            }

                            if (tempPostObj.conversations.length == 0) { delete tempPostObj.conversations }
                        }

                        tempJSONObject.posts.push(tempPostObj)
                    }
                    if (tempJSONObject.posts.length == 0) {
                        delete tempJSONObject.posts
                    }
                }

                postObject.review.push(tempJSONObject)
            }

            if (postObject.review.length == 0) {
                delete postObject.review
            }
        }
    }

    // Activity
    if (scope.includes('activity')) {
        postObject.scope.push('activity');

        if (dbProject.activity) {
            var dbActivity = dbProject.activity,
                dbActivityKey = Object.keys(dbActivity)

            postObject.activity = []

            for (var i = 0; i < dbActivityKey.length; i++) {
                var tempActivity = dbActivity[dbActivityKey[i]];

                if (tempActivity.deleted) { continue }

                var tempObj = {
                    activity_key: dbActivityKey[i],
                    type: tempActivity.type,
                    createdOn: tempActivity.createdOn,
                    createdBy: tempActivity.createdBy,
                    createdById: tempActivity.createdById,
                    date: tempActivity.date,
                    title: tempActivity.title,
                    description: tempActivity.description,
                    service_id: tempActivity.service_id,
                    lastModifiedOn: tempActivity.lastModifiedOn,
                    lastModifiedBy: tempActivity.lastModifiedBy,
                    lastModifiedById: tempActivity.lastModifiedById,
                }


                // Append Service Criteria for Type Service
                if (tempActivity.type = 'SERVICE' && tempActivity.criteria) {
                    var dbActivityCriteria = tempActivity.criteria,
                        dbActivityCriteriaKey = Object.keys(dbActivityCriteria),
                        postCriteriaObj = []

                    for (var j = 0; j < dbActivityCriteriaKey.length; j++) {
                        var validate = validateCriteria(tempActivity.service_id, dbActivityCriteria[dbActivityCriteriaKey[j]].criteria_id)
                        if (validate) {

                            var tempCriteria = dbActivityCriteria[dbActivityCriteriaKey[j]];

                            var tempCriteriaObj = {
                                criteria_id: tempCriteria.criteria_id,
                                criteria: validate.criteria,
                                value: tempCriteria.value,
                                deleted: validate.deleted || validate.service_deleted,
                                createdOn: tempCriteria.createdOn || tempActivity.createdOn,
                                createdBy: tempCriteria.createdBy || tempActivity.createdBy,
                                createdById: tempCriteria.createdById || tempActivity.createdById,
                                lastModifiedOn: tempCriteria.lastModifiedOn,
                                lastModifiedBy: tempCriteria.lastModifiedBy,
                                lastModifiedById: tempCriteria.lastModifiedById,
                            }

                            if (!tempObj.service_name) {
                                tempObj.service_name = validate.service_name
                            }

                            postCriteriaObj.push(tempCriteriaObj);
                        }
                        if (!tempObj.service_deleted && validate.service_deleted) {
                            tempObj.service_deleted = true
                        }
                    }

                    if (postCriteriaObj.length != 0) {
                        tempObj.criteria = postCriteriaObj
                    }
                }

                // Append Documents
                if (tempActivity.documents) {
                    var dbActivityDocuments = tempActivity.documents,
                        dbActivityDocumentsKeys = Object.keys(dbActivityDocuments),
                        postDocuments = []

                    for (var j = 0; j < dbActivityDocumentsKeys.length; j++) {
                        var tempDocument = dbActivityDocuments[dbActivityDocumentsKeys[j]];

                        if (!tempDocument.deleted) {
                            postDocuments.push({
                                document_id: dbActivityDocumentsKeys[j],
                                filename: tempDocument.filename,
                                createdOn: tempDocument.createdOn || tempActivity.createdOn,
                                createdBy: tempDocument.createdBy || tempActivity.createdBy,
                                createdById: tempDocument.createdById || tempActivity.createdById,
                                lastModifiedOn: tempDocument.lastModifiedOn,
                                lastModifiedBy: tempDocument.lastModifiedBy,
                                lastModifiedById: tempDocument.lastModifiedById,
                            })
                        }
                    }

                    if (postDocuments.length != 0) {
                        tempObj.documents = postDocuments
                    }
                }

                postObject.activity.push(tempObj)
            }

            if (postObject.activity.length == 0) {
                delete postObject.activity;
            }
        }
    }

    return response(res, 200, 'success', undefined, postObject, 'A-6.2.3')


    // Function Check Criteria Exist
    function validateCriteria(service_id, criteria_id) {
        if (!service_id || !criteria_id) {
            return false;
        }

        if (dbAdminSnapshot.services) {
            var dbServices = dbAdminSnapshot.services,
                dbServicesKey = Object.keys(dbServices)

            for (var i = 0; i < dbServicesKey.length; i++) {

                if (dbServices[dbServicesKey[i]].service_id == service_id) {
                    if (dbServices[dbServicesKey[i]].criteria) {
                        var dbServiceCriteria = dbServices[dbServicesKey[i]].criteria,
                            dbServiceCriteriaKeys = Object.keys(dbServiceCriteria)

                        for (var j = 0; j < dbServiceCriteriaKeys.length; j++) {
                            if (dbServiceCriteria[dbServiceCriteriaKeys[j]].criteria_id == criteria_id) {
                                return {
                                    criteria_id: dbServiceCriteria[dbServiceCriteriaKeys[j]].criteria_id,
                                    criteria: dbServiceCriteria[dbServiceCriteriaKeys[j]].criteria,
                                    deleted: dbServiceCriteria[dbServiceCriteriaKeys[j]].deleted,
                                    service_deleted: dbServices[dbServicesKey[i]].deleted,
                                    service_name: dbServices[dbServicesKey[i]].title
                                }
                            }
                        }
                    } else {
                        return false;
                    }

                } else if (i == dbServicesKey.length - 1) {
                    return false;
                }
            }
        }
    }
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
                        return response(res, 409, 'duplicate', 'Employee already assigned to this project', undefined, 'A-6.3.7')
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

                        if (req.body.review == true || req.body.review == 'true') {
                            tempTeam.review = true
                        } else if (req.body.review == false || req.body.review == 'false') {
                            tempTeam.review = false
                        }
                        if (req.body.activity == true || req.body.activity == 'true') {
                            tempTeam.activity = true
                        } else if (req.body.activity == false || req.body.activity == 'false') {
                            tempTeam.activity = false
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
            return response(res, 403, 'forbidden', 'Employee ID is not associated with  the project', undefined, 'A-6.4.6')
        }
    }
})

// 6.5 TEAM > REMOVE
projectAPI.get('/team/remove', (req, res) => {
    if (!req.query.project_id || !req.query.employee_id) {
        return response(res, 400, 'required', 'Project ID and Employee ID is required', undefined, 'A-6.5.1')
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
                    return response(res, 200, 'success', 'Employee ID removed from project', undefined, 'A-6.5.3')
                })
            } else if (i == teamDBKeys.length - 1) {
                return response(res, 403, 'forbidden', 'Employee ID is not associated with the project', undefined, 'A-6.5.4')
            }
        }
    } else {
        return response(res, 403, 'forbidden', 'Employee is not assigned to this project', undefined, 'A-6.5.5')
    }
})

// 6.6 TEAM > DEACTIVATE
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
                    return response(res, 200, 'success', 'Employee deactivated successfully', undefined, 'A-6.6.4')
                })
            } else if (i == teamDBKeys.length - 1) {
                return response(res, 403, 'forbidden', 'Employee is not assigned to this project', undefined, 'A-6.6.5')
            }
        }
    } else {
        return response(res, 403, 'forbidden', 'Employee is not assigned to this project', undefined, 'A-6.6.6')
    }
})

// 6.7 TEAM > ACTIVATE
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
                    return response(res, 200, 'success', 'Employee ID activated successfully for the project', undefined, 'A-6.7.4')
                })
            } else if (i == teamDBKeys.length - 1) {
                return response(res, 403, 'forbidden', 'Employee is not assigned to this project', undefined, 'A-6.7.5')
            }
        }
    } else {
        return response(res, 403, 'forbidden', 'Employee is not assigned to this project', undefined, 'A-6.7.6')
    }

})

// 6.8 SOCIAL ACCOUNT > ADD
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

// 6.9 SOCIAL ACCOUNT > UPDATE
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
                    tempData.account_name = String(req.body.account_name).trim()
                }

                if (req.body.reference) {
                    tempData.reference = String(req.body.reference).trim()
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

// 6.10 SOCIAL ACCOUNT > REMOVE 
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
            return response(res, 200, 'success', 'Project Information Updated Successfully', undefined, 'A-6.11.3')

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
        review_id: Math.floor(new Date().valueOf() * Math.random()),
        title: title,
        createdOn: String(new Date()),
        createdBy: "ADMIN"
    }

    if (req.body.description) {
        pushData.description = String(req.body.description).trim()
    }

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.12.3') }

    return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review`).push(pushData).then(() => {
        return response(res, 200, 'success', 'Social Account Created', { review_id: pushData.review_id }, 'A-6.12.4')
    })

})

// 6.13 REVIEW > ADD POST
projectAPI.post('/review/add-post', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.13.1')
    }
    if (!req.body.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'A-6.13.2')
    }
    if (!req.body.description && !req.files.file) {
        return response(res, 400, 'required', 'Description or filename is required', undefined, 'A-6.13.12')
    }

    var projectID = String(req.body.project_id).trim(),
        getKeyDB = getKeys(projectID),
        reviewID = String(req.body.review_id).trim(),
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
        pushData.documents = []
        var file = req.files.file,
            fileNameData = [],
            directory = storageDirectory() + `/clients/${getKeyDB.client_key}/reviews/`

        if (!Array.isArray(file)) {
            var file = [req.files.file]
        }

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
            pushData.documents.push({ filename: tempName })
        }

    }

    if (dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
            reviewDBKey = Object.keys(reviewDB)

        for (var j = 0; j < reviewDBKey.length; j++) {
            var tempReview = reviewDB[reviewDBKey[j]]

            if (!tempReview.deleted && tempReview.review_id == reviewID) {

                if (tempReview.closed) {
                    return response(res, 403, 'forbidden', 'Addition or Modification on closed review is not allowed', undefined, 'A-6.13.6')
                }

                if (fileNameData && fileNameData.length == 1) {
                    var file = req.files.file,
                        tempName = String(fileNameData)
                    file.mv(directory + tempName, (error, abc) => {
                        if (error) {
                            return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'A-6.13.7')
                        }
                    })
                } else if (fileNameData && fileNameData.length > 1) {
                    var file = req.files.file
                    for (var i = 0; i < file.length; i++) {
                        var tempFile = file[i],
                            tempName = fileNameData[i]
                        tempFile.mv(directory + tempName, (error) => {
                            if (error) {
                                return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'A-6.13.8')
                            }
                        })
                    }
                }

                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKey[j]}/post`).push(pushData).then(() => {
                    return response(res, 200, 'success', 'Social Account Created', undefined, 'A-6.13.9')
                })
            } else if (j == reviewDBKey.length - 1) {
                return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'A-6.13.10')
            }
        }
    } else {
        return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'A-6.13.11')
    }

})

// 6.14 REVIEW > REMOVE POST
projectAPI.get('/review/remove-post', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.14.1')
    }
    if (!req.query.review_id || !req.query.post_key) {
        return response(res, 400, 'required', 'Review ID and Post Key both are required', undefined, 'A-6.14.2')
    }

    var projectID = String(req.query.project_id).trim(),
        reviewID = String(req.query.review_id).trim(),
        postKey = String(req.query.post_key).trim(),
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
        if (tempReview.review_id == reviewID && !tempReview.deleted) {
            if (tempReview.closed) {
                return response(res, 403, 'forbidden', 'Modifications on closed reviews are not allowed', undefined, 'A-6.14.4')
            }
            if (tempReview.post) {
                var postDB = tempReview.post,
                    postDBKey = Object.keys(postDB)
                for (var i = 0; i < postDBKey.length; i++) {
                    if (postDBKey[i] == postKey) {
                        //removing Images
                        var tempReviewPost = postDB[postDBKey[i]]
                        if (tempReviewPost.deleted) {
                            return response(res, 403, 'forbidden', 'Post is already removed', undefined, 'A-6.14.10')
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
                        delete tempReviewPost.lastModifiedById
                        tempReviewPost.lastModifiedOn = String(new Date())

                        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKey[j]}/post/${postKey}`).set(tempReviewPost).then(() => {
                            return response(res, 200, 'success', 'Post from Review has been deleted successfully', undefined, 'A-6.14.5')
                        })
                    } else if (i == postDBKey.length - 1) {
                        return response(res, 404, 'notfound', 'Incorrect Post Key', undefined, 'A-6.14.6')
                    }
                }
            } else {
                return response(res, 404, 'notfound', 'Incorrect Post Key', undefined, 'A-6.14.7')
            }
        } else if (j == reviewDBKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'A-6.14.8')
        }
    }
})

// 6.15 REVIEW > CLOSE
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
        return response(res, 404, 'notfound', 'Review ID Incorrect', undefined, 'A-6.15.4')
    }

    var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKey = Object.keys(reviewDB)

    for (var i = 0; i < reviewDBKey.length; i++) {

        if (reviewID == reviewDB[reviewDBKey[i]].review_id) {
            var tempReview = reviewDB[reviewDBKey[i]]

            if (tempReview.closed) {
                return response(res, 403, 'forbidden', 'Review is already closed', undefined, 'A-6.15.5')
            }

            tempReview.closed = true
            tempReview.lastModifiedBy = "ADMIN"
            delete tempReview.lastModifiedById
            tempReview.lastModifiedOn = String(new Date())

            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKey[i]}/`).set(tempReview).then(() => {
                return response(res, 200, 'success', 'Review has been closed successfully', undefined, 'A-6.15.6')

            })
        } else if (i == reviewDBKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'A-6.15.7')
        }
    }
})

// 6.16 REVIEW > REMOVE FILE
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

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect ', undefined, 'A-6.16.6')
    }

    var directory = storageDirectory() + `/clients/${getKeyDB.client_key}/reviews/`,
        reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKey = Object.keys(reviewDB)

    for (var j = 0; j < reviewDBKey.length; j++) {
        var tempReview = reviewDB[reviewDBKey[j]]

        if (tempReview.review_id == reviewID) {
            if (tempReview.closed) {
                return response(res, 403, 'forbidden', 'Modifications on closed reviews are not allowed', undefined, 'A-6.16.7')
            }

            if (tempReview.post) {
                var postDB = tempReview.post,
                    postDBKey = Object.keys(postDB)

                for (var i = 0; i < postDBKey.length; i++) {
                    var tempReviewPost = postDB[postDBKey[i]]

                    if (!tempReviewPost.deleted && tempReviewPost.documents) {
                        var documentsDB = tempReviewPost.documents,
                            documentsDBKeys = Object.keys(documentsDB)

                        for (var k = 0; k < documentsDBKeys.length; k++) {
                            var tempImage = documentsDB[documentsDBKeys[k]]

                            if (!tempImage.deleted && tempImage.filename == fileName) {

                                try { fs.unlinkSync(directory + tempImage.filename) } catch {}

                                tempImage.deleted = true
                                tempImage.lastModifiedBy = 'ADMIN'
                                tempImage.lastModifiedOn = String(new Date())
                                delete tempImage.lastModifiedById

                                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKey[j]}/post/${postDBKey[i]}/documents/${documentsDBKeys[k]}/`).set(tempImage).then(() => {
                                    return response(res, 200, 'success', 'File has been removed successfully', undefined, 'A-6.16.8')
                                })
                            }
                        }
                    } else if (i == postDBKey.length - 1) {
                        return response(res, 404, 'notfound', 'Incorrect File Name', undefined, 'A-6.16.9')
                    }
                }
            } else {
                return response(res, 404, 'notfound', 'Incorrect File Name', undefined, 'A-6.16.10')
            }
        } else if (j == reviewDBKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID or FileName', undefined, 'A-6.16.5')
        }
    }
})

// 6.17 SERVICE > ADD
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

                        if (tempServiceClient.service_id == serviceID && !tempServiceClient.deleted) {
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

// 6.18 SERVICE > DEACTIVATE
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

// 6.19 SERVICE > ACTIVATE
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
        return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'A-6.19.4')
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

// 6.20 SERVICE > REMOVE
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

        if (!tempService.deleted && tempService.service_id == serviceID) {

            tempService.active = false
            tempService.deleted = true
            tempService.lastModifiedBy = "ADMIN"
            tempService.lastModifiedOn = String(new Date())

            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/service/${serviceDBClientKey[i]}/`).update(tempService).then(() => {
                return response(res, 200, 'success', 'Service has been removed successfully', undefined, 'A-6.20.5')
            })


        } else if (i == serviceDBClientKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Service ID', undefined, 'A-6.20.6')
        }
    }
})

// 6.21 REVIEW > UPDATE
projectAPI.post('/review/update', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.21.1')
    }
    if (!req.body.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'A-6.21.2')
    }
    if (!req.body.title && !req.body.description) {
        return response(res, 400, 'required', 'Title or Description  is required', undefined, 'A-6.21.3')
    }
    var projectID = String(req.body.project_id).trim(),
        reviewID = String(req.body.review_id).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.21.4') }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect ', undefined, 'A-6.21.5')
    }
    var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKeys = Object.keys(dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review)
    for (var i = 0; i < reviewDBKeys.length; i++) {
        var tempReview = reviewDB[reviewDBKeys[i]]
        if (tempReview.review_id == reviewID && !tempReview.deleted) {

            if (tempReview.closed) {
                return response(res, 403, 'forbidden', 'Modification on Closed review are not allowed', undefined, 'A-6.21.10')
            }
            if (req.body.title) {
                var title = String(req.body.title).trim()
                if (title == "undefined" || title == null) {
                    return response(res, 400, 'required', 'Title is required ', undefined, 'A-6.21.6')
                }
                tempReview.title = title
            }
            if (req.body.description) {
                var description = String(req.body.description).trim()
                if (description == "undefined" || description == null) {
                    return response(res, 400, 'required', 'Description is required ', undefined, 'A-6.21.7')
                }
                tempReview.description = description
            }
            tempReview.lastModifiedBy = 'ADMIN'
            tempReview.lastModifiedOn = String(new Date())
            delete tempReview.lastModifiedById
            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKeys[i]}`).set(tempReview).then(() => {
                return response(res, 200, 'success', 'Review has been updated successfully', undefined, 'A-6.21.8')

            })
        } else if (i == reviewDBKeys.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'A-6.21.9')
        }
    }

})

// 6.22 REVIEW > UPDATE POST
projectAPI.post('/review/update-post', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.22.1')
    }
    if (!req.body.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'A-6.22.2')
    }
    if (!req.body.post_key) {
        return response(res, 400, 'required', 'Post key is required', undefined, 'A-6.22.3')
    }

    if (!req.files && !req.body.description) {
        return response(res, 400, 'required', 'Description or file is required', undefined, 'A-6.22.4')
    }
    var projectID = String(req.body.project_id).trim(),
        reviewID = String(req.body.review_id).trim(),
        postKey = String(req.body.post_key).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.22.5') }

    directoryCreate(`/clients/${getKeyDB.client_key}/reviews`)

    if (req.files && req.files.file) {

        var file = req.files.file,
            fileNameData = [],
            documents = [],
            directory = storageDirectory() + `/clients/${getKeyDB.client_key}/reviews/`

        if (!Array.isArray(file)) {
            var file = [req.files.file]
        }

        for (var i = 0; i < file.length; i++) {
            var tempFile = file[i]

            if ((tempFile.size / 1024 / 1024) > 10) {
                return response(res, 403, 'forbidden', 'File size limit exceed. 10 MB/per file is maximum', undefined, 'A-6.22.7');
            }

            switch (tempFile.mimetype) {
                case 'image/jpeg':
                case 'image/jpg':
                    var tempName = 'Post-' + Math.floor(new Date().valueOf() * Math.random()) + '.jpeg';
                    break;
                case 'image/png':
                    var tempName = 'Post-' + Math.floor(new Date().valueOf() * Math.random()) + '.png';
                    break;
                default:
                    return response(res, 403, 'forbidden', 'Invalid File Type. JPG/JPEG/PNG are only valid file types.', undefined, 'A-6.22.8')

            }

            fileNameData.push(tempName)
            documents.push({
                filename: tempName,
                createdOn: String(new Date()),
                createdBy: 'ADMIN'
            })
        }
    }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect ', undefined, 'A-6.22.6')
    }

    var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKeys = Object.keys(reviewDB)

    for (var i = 0; i < reviewDBKeys.length; i++) {
        var tempReview = reviewDB[reviewDBKeys[i]]

        if (tempReview.review_id == reviewID && !tempReview.deleted) {
            if (tempReview.closed) {
                return response(res, 403, 'forbidden', 'Modification on Closed review are not allowed', undefined, 'A-6.22.13')
            }
            if (tempReview.post && tempReview.post[postKey] && !tempReview.post[postKey].deleted) {

                var tempPost = tempReview.post[postKey]

                if (req.body.description) {
                    tempPost.description = String(req.body.description).trim()
                    tempPost.lastModifiedOn = String(new Date())
                    tempPost.lastModifiedBy = "ADMIN"
                    delete tempPost.lastModifiedById
                }

                // Append Documents
                if (tempPost.documents) {
                    tempPost.documents.push.apply(tempPost.documents, documents)

                } else {
                    tempPost.documents = documents
                }

                // Move files to directory 
                if (req.files && req.files.file) {
                    var file = req.files.file
                    if (!Array.isArray(file)) {
                        var file = [req.files.file]
                    }
                    for (var j = 0; j < file.length; j++) {
                        var tempFile = file[j],
                            tempName = fileNameData[j]
                        tempFile.mv(directory + tempName, (error) => {
                            if (error) {
                                return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'A-6.22.9')
                            }
                        })
                    }
                }


                return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKeys[i]}/post/${postKey}/`).set(tempPost).then(() => {
                    return response(res, 200, 'success', 'Post has been updated successfully', undefined, 'A-6.22.10')
                })
            } else {
                return response(res, 404, 'notfound', 'Incorrect Post Key', undefined, 'A-6.22.11')
            }
        } else if (i == reviewDBKeys.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'A-6.22.12')
        }
    }
})

// 6.23 REVIEW > CLOSE
projectAPI.get('/review/open', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.23.1')
    }
    if (!req.query.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'A-6.23.2')
    }

    var projectID = String(req.query.project_id).trim(),
        reviewID = String(req.query.review_id).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.23.3') }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect', undefined, 'A-6.23.4')
    }

    var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKeys = Object.keys(reviewDB)

    for (var i = 0; i < reviewDBKeys.length; i++) {
        var tempReview = reviewDB[reviewDBKeys[i]]

        if (tempReview.review_id == reviewID) {
            if (!tempReview.closed) {
                return response(res, 409, 'conflict', 'Review is already open', undefined, 'A-6.23.5')
            }

            delete tempReview.closed
            tempReview.lastModifiedOn = String(new Date())
            tempReview.lastModifiedBy = "ADMIN"
            delete tempReview.lastModifiedById
            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKeys[i]}/`).set(tempReview).then(() => {
                return response(res, 200, 'success', 'Review is opened successfully', undefined, 'A-6.23.6')
            })
        } else if (i == reviewDBKeys.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'A-6.23.7')
        }
    }

})

// 6.24 ACTIVITY > ADD
projectAPI.post('/activity/add', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.24.1')
    }
    if (!req.body.type) {
        return response(res, 400, 'required', 'Type is required', undefined, 'A-6.24.2')
    }

    var projectID = String(req.body.project_id).trim(),
        type = String(req.body.type).trim().toUpperCase(),
        getKeyDB = getKeys(projectID)

    if (type != "SERVICE" && type != "ACTIVITY") {
        return response(res, 400, 'invalid', 'Invalid Type. Valid Activity Type: [Service, Activity]', undefined, 'A-6.24.3')
    }
    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.24.4') }

    directoryCreate(`/clients/${getKeyDB.client_key}/activity`)

    if (req.files && req.files.file) {

        var file = req.files.file,
            documents = [],
            directory = storageDirectory() + `/clients/${getKeyDB.client_key}/activity/`,
            fileNameData = []

        if (!Array.isArray(file)) {
            var file = [req.files.file]
        }

        for (var i = 0; i < file.length; i++) {
            var tempFile = file[i]

            if ((tempFile.size / 1024 / 1024) > 15) {
                return response(res, 403, 'forbidden', 'File size limit exceed. 15 MB/per file is maximum', undefined, 'A-6.24.5');
            }

            switch (tempFile.mimetype) {
                case 'image/jpeg':
                case 'image/jpg':
                    var tempName = 'Post-' + Math.floor(new Date().valueOf() * Math.random()) + '.jpeg';
                    break;
                case 'image/png':
                    var tempName = 'Post-' + Math.floor(new Date().valueOf() * Math.random()) + '.png';
                    break;
                case 'application/pdf':
                    var tempName = 'Post-' + Math.floor(new Date().valueOf() * Math.random()) + '.pdf';
                    break;
                default:
                    return response(res, 403, 'forbidden', 'Invalid File Type. JPG/JPEG/PNG/PDF are only valid file types.', undefined, 'A-6.24.6')

            }

            fileNameData.push(tempName)
            documents.push({
                filename: tempName,
                createdOn: String(new Date()),
                createdBy: 'ADMIN'
            })
        }
    }

    // Activity Type: Service
    if (type == "SERVICE") {
        if (!req.body.service_id) {
            return response(res, 400, 'required', 'Service ID is required', undefined, 'A-6.24.7')
        }
        if (!req.body.criteria) {
            return response(res, 400, 'required', 'Criteria is required', undefined, 'A-6.24.8')
        }

        if (!dbAdminSnapshot.services) {
            return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'A-6.24.9')
        }
        if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service) {
            return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'A-6.24.10')
        }

        var dbAdminService = dbAdminSnapshot.services,
            dbAdminServiceKeys = Object.keys(dbAdminService),
            serviceID = String(req.body.service_id)

        try {
            criteria = JSON.parse(req.body.criteria)
        } catch {
            return response(res, 404, 'notfound', 'Criteria must be in JSON Object. Hint: Stringify JSON object', {
                json_object_sample: {
                    "0": { "criteria_id": 13245689, "value": 50 },
                    "1": { "criteria_id": 13245689, "value": 55 },
                    "2": { "criteria_id": 32186547, "value": 55 }
                }
            }, 'A-6.24.11')
        }


        // DB Service - Criteria Validation
        for (var i = 0; i < dbAdminServiceKeys.length; i++) {
            var tempService = dbAdminService[dbAdminServiceKeys[i]]

            // Check service in admin
            if (tempService.service_id == serviceID && !tempService.deleted) {

                // Project Service in client
                var dbClientService = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service,
                    dbClientServiceKey = Object.keys(dbClientService)
                for (var k = 0; k < dbClientServiceKey.length; k++) {
                    var tempClientService = dbClientService[dbClientServiceKey[k]]
                    if (tempClientService.active && tempClientService.service_id == serviceID && !tempClientService.deleted) {

                        // DB Criteria
                        if (tempService.criteria) {
                            var dbServiceCriteria = tempService.criteria,
                                dbServiceCriteriaKeys = Object.keys(dbServiceCriteria),
                                activeCriteria = []

                            for (var l = 0; l < dbServiceCriteriaKeys.length; l++) {
                                if (!dbServiceCriteria[dbServiceCriteriaKeys[l]].deleted) {
                                    activeCriteria.push(dbServiceCriteria[dbServiceCriteriaKeys[l]].criteria_id)
                                }
                            }
                        }

                        // Body Criteria Validation
                        var pushCriteria = [],
                            tempPushCriteria = [],
                            bodyCriteriaKey = Object.keys(criteria)

                        for (var l = 0; l < bodyCriteriaKey.length; l++) {
                            var tempCriteria = criteria[bodyCriteriaKey[l]];
                            if (tempCriteria.criteria_id && tempCriteria.value) {

                                if (isNaN(parseInt(tempCriteria.value)) || parseInt(tempCriteria.value) < 0) {
                                    return response(res, 400, 'invalid', 'Criteria Value must be integer and greater than 0', undefined, 'A-6.24.23');
                                }

                                if (!activeCriteria.includes(tempCriteria.criteria_id)) {
                                    return response(res, 403, 'forbidden', 'Invalid Criteria ID. Criteria ID does not exist in Service.', { invalid_criteria_id: tempCriteria.criteria_id }, 'A-6.24.12')
                                }

                                if (tempPushCriteria.includes(tempCriteria.criteria_id)) {
                                    return response(res, 400, 'invalid', 'Criteria ID must be unique', undefined, 'A-6.24.22')
                                }

                                pushCriteria.push({
                                    criteria_id: tempCriteria.criteria_id,
                                    value: parseInt(tempCriteria.value)
                                })
                                tempPushCriteria.push(tempCriteria.criteria_id)
                            } else {
                                return response(res, 403, 'forbidden', 'Criteria ID and Value both are required', undefined, 'A-6.24.13')
                            }
                        }

                        if (pushCriteria.length == 0) {
                            return response(res, 400, 'required', 'At least one criteria is required', undefined, 'A-6.25.21')
                        }
                        i = dbAdminServiceKeys.length;
                        break;
                    } else if (k == dbClientServiceKey.length - 1) {
                        return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'A-6.24.14')
                    }
                }
            } else if (i == dbAdminServiceKeys.length - 1) {
                return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'A-6.24.15')
            }
        }

        var pushData = {
            createdOn: String(new Date()),
            createdBy: "ADMIN",
            service_id: serviceID,
            criteria: pushCriteria,
            type: type
        }

        if (req.body.title) {
            var title = String(req.body.title).trim()
            pushData.title = title
        }

        if (req.body.description) {
            var description = String(req.body.description).trim()
            pushData.description = description
        }

        if (req.body.date) {
            var date = new Date(req.body.date)
            if (date == "Invalid Date" || date > new Date()) {
                return response(res, 400, 'invalid', 'Date Time must not be greater than current time. Format: YYYY/MM/DD HH:MM:SS AM/PM. AM/PM is required for 12-Hour Timestamp', undefined, 'A-6.24.16')
            }
            pushData.date = String(date)
        }



        if (fileNameData && fileNameData.length != 0) {
            pushData.documents = documents
                // Move files  
            var file = req.files.file
            if (!Array.isArray(file)) {
                var file = [req.files.file]
            }
            for (var j = 0; j < file.length; j++) {
                var tempFile = file[j],
                    tempName = fileNameData[j]
                tempFile.mv(directory + tempName, (error) => {
                    if (error) {
                        return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'A-6.24.17')
                    }
                })
            }
        }


    }

    // Activity Type: Activity
    if (type == "ACTIVITY") {

        if (!req.body.title) {
            return response(res, 400, 'required', 'Title is required', undefined, 'A-6.24.19')
        }
        var title = String(req.body.title).trim()

        var pushData = {
            title: title,
            createdOn: String(new Date()),
            createdBy: "ADMIN",
            type: type
        }

        if (req.body.date) {
            if (new Date(req.body.date) == "Invalid Date" || new Date(req.body.date) > new Date()) {
                return response(res, 400, 'invalid', 'Date Time must not be greater than current time. Format: YYYY/MM/DD HH:MM:SS AM/PM. AM/PM is required for 12-Hour Timestamp', undefined, 'A-6.24.20')
            }
            pushData.date = String(new Date(req.body.date))
        }

        if (req.body.description) {
            pushData.description = String(req.body.description).trim()
        }


        if (fileNameData && fileNameData.length != 0) {
            pushData.documents = documents
                // Move files  
            var file = req.files.file
            if (!Array.isArray(file)) {
                var file = [req.files.file]
            }
            for (var j = 0; j < file.length; j++) {
                var tempFile = file[j],
                    tempName = fileNameData[j]
                tempFile.mv(directory + tempName, (error) => {
                    if (error) {
                        return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'A-6.24.21')
                    }
                })
            }
        }
    }

    return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/`).push(pushData).then(() => {
        return response(res, 200, 'success', 'Activity has been added successfully', undefined, 'A-6.24.18')
    })
})

// 6.25 ACTIVITY > UPDATE
projectAPI.post('/activity/update', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.25.1')
    }
    if (!req.body.activity_key) {
        return response(res, 400, 'required', 'Activity Key is required', undefined, 'A-6.25.2')
    }

    var projectID = String(req.body.project_id).trim(),
        getKeyDB = getKeys(projectID),
        activityKey = String(req.body.activity_key).trim()


    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.25.3') }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'A-6.25.4')
    }

    var dbClientActivity = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity
    if (!dbClientActivity[activityKey] || dbClientActivity[activityKey].deleted) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'A-6.25.5')
    }

    var tempActivity = dbClientActivity[activityKey],
        type = tempActivity.type

    directoryCreate(`/clients/${getKeyDB.client_key}/activity`)

    if (req.files && req.files.file) {

        var file = req.files.file,
            directory = storageDirectory() + `/clients/${getKeyDB.client_key}/activity/`,
            fileNameData = [],
            documents = []

        if (!Array.isArray(file)) {
            var file = [req.files.file]
        }

        for (var i = 0; i < file.length; i++) {
            var tempFile = file[i]

            if ((tempFile.size / 1024 / 1024) > 15) {
                return response(res, 403, 'forbidden', 'File size limit exceed. 15 MB/per file is maximum', undefined, 'A-6.25.6');
            }

            switch (tempFile.mimetype) {
                case 'image/jpeg':
                case 'image/jpg':
                    var tempName = 'Post-' + Math.floor(new Date().valueOf() * Math.random()) + '.jpeg';
                    break;
                case 'image/png':
                    var tempName = 'Post-' + Math.floor(new Date().valueOf() * Math.random()) + '.png';
                    break;
                case 'application/pdf':
                    var tempName = 'Post-' + Math.floor(new Date().valueOf() * Math.random()) + '.pdf';
                    break;
                default:
                    return response(res, 403, 'forbidden', 'Invalid File Type. JPG/JPEG/PNG/PDF are only valid file types.', undefined, 'A-6.25.7')

            }

            fileNameData.push(tempName)
            documents.push({
                filename: tempName,
                createdOn: String(new Date()),
                createdBy: 'ADMIN'
            })
        }

    }

    // Update for type : ACTIVITY
    if (type == "ACTIVITY") {

        if (req.body.title) {
            var title = String(req.body.title).trim()
            tempActivity.title = title
        }

        if (req.body.date) {
            if (new Date(req.body.date) == "Invalid Date" || new Date(req.body.date) > new Date(tempActivity.createdOn)) {
                return response(res, 400, 'invalid', 'Date Time must not be greater than creation time. Format: YYYY/MM/DD HH:MM:SS AM/PM. AM/PM is required for 12-Hour Timestamp', undefined, 'A-6.25.8')
            }
            tempActivity.date = String(new Date(req.body.date))
        }

        if (req.body.description) {
            tempActivity.description = String(req.body.description).trim()
        }

        if (fileNameData && fileNameData.length != 0) {
            if (tempActivity.documents) {
                tempActivity.documents.push.apply(tempActivity.documents, documents)
            } else {
                tempActivity.documents = documents
            }

            // Move files  
            var file = req.files.file
            if (!Array.isArray(file)) {
                var file = [req.files.file]
            }
            for (var j = 0; j < file.length; j++) {
                var tempFile = file[j],
                    tempName = fileNameData[j]
                tempFile.mv(directory + tempName, (error) => {
                    if (error) {
                        return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'A-6.25.9')
                    }
                })
            }
        }

        tempActivity.lastModifiedBy = "ADMIN"
        tempActivity.lastModifiedOn = String(new Date())
        delete tempActivity.lastModifiedById

        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/${activityKey}`).set(tempActivity).then(() => {
            return response(res, 200, 'success', 'Activity has been updated successfully', undefined, 'A-6.25.10')
        })
    }

    // Update for type : SERVICE
    if (type == "SERVICE") {

        var serviceID = tempActivity.service_id

        if (!dbAdminSnapshot.services) {
            return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'A-6.25.11')
        }
        if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service) {
            return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'A-6.25.12')
        }

        if (req.body.criteria) {
            try {
                JSON.parse(req.body.criteria)
            } catch {
                return response(res, 404, 'notfound', 'Criteria must be in JSON Object. Hint: Stringify JSON object', {
                    json_object_sample: {
                        "0": { "criteria_id": 13245689, "value": 50 },
                        "1": { "criteria_id": 98765412, "value": 55 },
                        "2": { "criteria_id": 32186547, "value": 55 }
                    }
                }, 'A-6.25.13')
            }

            var dbAdminService = dbAdminSnapshot.services,
                dbAdminServiceKeys = Object.keys(dbAdminService)

            // DB Service - Criteria Validation
            for (var i = 0; i < dbAdminServiceKeys.length; i++) {
                var tempService = dbAdminService[dbAdminServiceKeys[i]]

                // Check service in admin
                if (tempService.service_id == serviceID && !tempService.deleted) {

                    i = dbAdminServiceKeys.length; // Break DB Service Loop, Because Service ID matched

                    // Project Service in client
                    var dbClientService = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service,
                        dbClientServiceKey = Object.keys(dbClientService)

                    for (var k = 0; k < dbClientServiceKey.length; k++) {
                        var tempClientService = dbClientService[dbClientServiceKey[k]]

                        if (tempClientService.active && tempClientService.service_id == serviceID && !tempClientService.deleted) {

                            // DB Criteria
                            if (tempService.criteria) {
                                var dbServiceCriteria = tempService.criteria,
                                    dbServiceCriteriaKeys = Object.keys(dbServiceCriteria),
                                    activeCriteria = [],
                                    inActiveCriteria = []

                                for (var l = 0; l < dbServiceCriteriaKeys.length; l++) {
                                    if (!dbServiceCriteria[dbServiceCriteriaKeys[l]].deleted) {
                                        activeCriteria.push(dbServiceCriteria[dbServiceCriteriaKeys[l]].criteria_id)
                                    } else {
                                        inActiveCriteria.push(dbServiceCriteria[dbServiceCriteriaKeys[l]].criteria_id)
                                    }
                                }
                            }

                            // Body Criteria Validation
                            var bodyCriteria = JSON.parse(req.body.criteria),
                                bodyCriteriaKey = Object.keys(bodyCriteria),
                                newPushCriteria = [],
                                newCriteria = []
                            for (var l = 0; l < bodyCriteriaKey.length; l++) {

                                var tempCriteria = bodyCriteria[bodyCriteriaKey[l]];

                                if (tempCriteria.criteria_id && tempCriteria.value) {

                                    if (isNaN(parseInt(tempCriteria.value)) || parseInt(tempCriteria.value) < 0) {
                                        return response(res, 400, 'invalid', 'Criteria Value must be integer and greater than 0', undefined, 'A-6.25.14');
                                    }

                                    // Check That criteria is active
                                    if (activeCriteria.includes(tempCriteria.criteria_id)) {

                                        if (tempActivity.criteria) {

                                            // Check DB that Criteria is already exit or not
                                            var tempActivityCriteria = tempActivity.criteria,
                                                tempActivityCriteriaKey = Object.keys(tempActivityCriteria)

                                            for (var c = 0; c < tempActivityCriteriaKey.length; c++) {
                                                var tempClientCriteria = tempActivityCriteria[tempActivityCriteriaKey[c]]

                                                // If exist
                                                if (tempClientCriteria.criteria_id == tempCriteria.criteria_id) {

                                                    if (tempClientCriteria.value != tempCriteria.value) {
                                                        tempClientCriteria.value = parseInt(tempCriteria.value)
                                                        tempClientCriteria.lastModifiedOn = String(new Date())
                                                        tempClientCriteria.lastModifiedBy = 'ADMIN'
                                                        delete tempClientCriteria.lastModifiedById

                                                    }
                                                    break;
                                                } else if (c == tempActivityCriteriaKey.length - 1 && !newPushCriteria.includes(tempCriteria.criteria_id)) {
                                                    // If already not exist
                                                    newCriteria.push({
                                                        criteria_id: tempCriteria.criteria_id,
                                                        value: parseInt(tempCriteria.value),
                                                        createdOn: String(new Date()),
                                                        createdBy: 'ADMIN'
                                                    });

                                                    // For Checking, New Criteria Repeat or not
                                                    newPushCriteria.push(tempCriteria.criteria_id)
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    return response(res, 403, 'forbidden', 'Criteria ID and Value both are required', undefined, 'A-6.25.15')
                                }

                                if (l == bodyCriteriaKey.length - 1 && newCriteria.length != 0) {
                                    tempActivityCriteria.push.apply(tempActivityCriteria, newCriteria)
                                }
                            }
                            break;
                        } else if (k == dbClientServiceKey.length - 1) {
                            return response(res, 404, 'notfound', 'Service ID Incorrect. Service ID is not associated with the project', undefined, 'A-6.25.16')
                        }
                    }
                } else if (i == dbAdminServiceKeys.length - 1) {
                    return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'A-6.25.17')
                }
            }
        }

        if (req.body.title) {
            var title = String(req.body.title).trim()
            tempActivity.title = title
        }

        if (req.body.description) {
            var description = String(req.body.description).trim()
            tempActivity.description = description
        }

        if (req.body.date) {
            var date = new Date(req.body.date)
            if (date == "Invalid Date" || date > new Date(tempActivity.createdOn)) {
                return response(res, 400, 'invalid', 'Date Time must not be greater than creation time. Format: YYYY/MM/DD HH:MM:SS AM/PM. AM/PM is required for 12-Hour Timestamp', undefined, 'A-6.25.18')
            }
            tempActivity.date = String(date)
        }

        if (fileNameData && fileNameData.length != 0) {
            if (tempActivity.documents) {
                tempActivity.documents.push.apply(tempActivity.documents, documents)
            } else {
                tempActivity.documents = documents
            }

            // Move files  
            var file = req.files.file
            if (!Array.isArray(file)) {
                var file = [req.files.file]
            }
            for (var j = 0; j < file.length; j++) {
                var tempFile = file[j],
                    tempName = fileNameData[j]
                tempFile.mv(directory + tempName, (error) => {
                    if (error) {
                        return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'A-6.25.19')
                    }
                })
            }
        }

        tempActivity.lastModifiedOn = String(new Date())
        tempActivity.lastModifiedBy = "ADMIN"
        delete tempActivity.lastModifiedById

        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/${activityKey}/`).set(tempActivity).then(() => {
            return response(res, 200, 'success', 'Activity has been updated successfully', undefined, 'A-6.25.20')
        })
    }
})

// 6.26 ACTIVITY > REMOVE FILE
projectAPI.post('/activity/remove-file', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.26.1')
    }

    if (!req.body.activity_key) {
        return response(res, 400, 'required', 'Activity key is required', undefined, 'A-6.26.2')
    }

    if (!req.body.filename) {
        return response(res, 400, 'required', 'Filename is required', undefined, 'A-6.26.3')
    }

    var projectID = String(req.body.project_id).trim(),
        activityKey = String(req.body.activity_key).trim(),
        filename = String(req.body.filename).trim(),
        getKeyDB = getKeys(projectID)


    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.26.4') }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'A-6.26.5')
    }

    var dbClientActivity = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity
    if (!dbClientActivity[activityKey] || dbClientActivity[activityKey].deleted) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'A-6.26.6')
    }

    if (!dbClientActivity[activityKey].documents) {
        return response(res, 404, 'notfound', 'Incorrect Filename', undefined, 'A-6.26.9')
    }

    var activityDocuments = dbClientActivity[activityKey].documents,
        activityDocumentsKeys = Object.keys(activityDocuments)

    for (var i = 0; i < activityDocumentsKeys.length; i++) {

        var tempDocument = activityDocuments[activityDocumentsKeys[i]]

        if (!tempDocument.deleted && tempDocument.filename == filename) {

            tempDocument.deleted = true
            tempDocument.lastModifiedBy = "ADMIN"
            tempDocument.lastModifiedOn = String(new Date())
            delete tempDocument.lastModifiedById
            unlinkFile(tempDocument.filename);
            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/${activityKey}/documents/${activityDocumentsKeys[i]}/`).set(tempDocument).then(() => {
                return response(res, 200, 'success', 'File has been removed successfully', undefined, 'A-6.26.7')
            })

        } else if (i == activityDocumentsKeys.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect filename', undefined, 'A-6.26.8')
        }
    }

})

// 6.27 ACTIVITY > REMOVE
projectAPI.post('/activity/remove', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.27.1')
    }

    if (!req.body.activity_key) {
        return response(res, 400, 'required', 'Activity key is required', undefined, 'A-6.27.2')
    }
    var projectID = String(req.body.project_id).trim(),
        activityKey = String(req.body.activity_key).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.27.3') }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'A-6.27.4')
    }

    var dbClientActivity = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity
    if (!dbClientActivity[activityKey] || dbClientActivity[activityKey].deleted) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'A-6.27.5')
    }
    var tempActivity = dbClientActivity[activityKey]
    if (tempActivity.documents) {
        var activityDocuments = tempActivity.documents,
            activityDocumentsKeys = Object.keys(activityDocuments)
        for (var i = 0; i < activityDocumentsKeys.length; i++) {

            var tempDocument = activityDocuments[activityDocumentsKeys[i]]

            if (!tempDocument.deleted) {

                tempDocument.deleted = true
                tempDocument.lastModifiedBy = "ADMIN"
                tempDocument.lastModifiedOn = String(new Date())
                delete tempDocument.lastModifiedId
                unlinkFile(tempDocument.filename);

            }
        }
    }
    tempActivity.deleted = true
    delete tempActivity.lastModifiedById
    return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/${activityKey}/`).set(tempActivity).then(() => {
        return response(res, 200, 'success', 'Activity has been removed successfully', undefined, 'A-6.27.6')
    })


})

// 6.28 REVIEW > REVIEW
projectAPI.get('/review/remove', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-6.28.1')
    }

    if (!req.query.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'A-6.28.2')
    }

    var projectID = String(req.query.project_id).trim(),
        reviewID = parseInt(String(req.query.review_id).trim()),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-6.28.3') }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'A-6.28.4')
    }

    var dbClientReview = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        dbClientReviewKey = Object.keys(dbClientReview)

    for (var i = 0; i < dbClientReviewKey.length; i++) {
        var tempClientReview = dbClientReview[dbClientReviewKey[i]]

        if (!tempClientReview.deleted && tempClientReview.review_id == reviewID) {

            if (tempClientReview.post) {
                var dbReviewPost = tempClientReview.post,
                    dbReviewPostKey = Object.keys(dbReviewPost)

                for (var j = 0; j < dbReviewPostKey.length; j++) {
                    if (dbReviewPost[dbReviewPostKey[j]].documents) {
                        var dbPostDocuments = dbReviewPost[dbReviewPostKey[j]].documents,
                            dbPostDocumentsKey = Object.keys(dbPostDocuments)

                        for (var k = 0; k < dbPostDocumentsKey.length; k++) {
                            if (dbPostDocuments[dbPostDocumentsKey[k]].deleted) { continue }

                            var tempPostDocument = dbPostDocuments[dbPostDocumentsKey[k]]

                            tempPostDocument.deleted = true
                            tempPostDocument.lastModifiedOn = String(new Date())
                            tempPostDocument.lastModifiedBy = 'ADMIN'
                            delete tempPostDocument.lastModifiedById
                            unlinkFile(tempPostDocument.filename);
                        }
                    }
                }
            }

            tempClientReview.deleted = true
            tempClientReview.lastModifiedOn = String(new Date())
            tempClientReview.lastModifiedBy = 'ADMIN'
            delete tempClientReview.lastModifiedById

            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${dbClientReviewKey[i]}/`).set(tempClientReview).then(() => {
                return response(res, 200, 'success', 'Review has been removed successfully', undefined, 'A-6.28.5')
            })
        } else if (i == dbClientReviewKey.length - 1) {
            return response(res, 404, 'notFound', 'Incorrect Review ID', undefined, 'A-6.28.6')
        }
    }
})

module.exports = projectAPI;


// Function: To Get Client and Project Key using Project ID
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
                    return {
                        client_key: clientKey[i],
                        plan_key: planKey[j]
                    }
                }
            }
        } else if (i == clientKey.length - 1) {
            return false
        }
    }

}