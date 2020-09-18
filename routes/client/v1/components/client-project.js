const clientProjectAPI = require('express').Router(),
    firebase = require('firebase-admin').database(),
    fs = require('fs'),
    { response } = require('../../../../functions/functions')

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

var dbAdminSnapshot, clientAuthToken, dbClientAccount;
clientProjectAPI.use((req, res, next) => {
    dbAdminSnapshot = req.session.dbAdminSnapshot
    clientAuthToken = req.session.decode_clientAuthToken
    dbClientAccount = dbAdminSnapshot.clients[clientAuthToken.client_key];
    next();
});

//--------------------------------- ROUTES ----------------------------------

//----------------------------- 3. CLIENT PROJECT ---------------------------

// 3.1 Get All Project 
clientProjectAPI.get(['/', '/get'], (req, res) => {
    if (dbClientAccount.plans) {
        var dbClientPlan = dbClientAccount.plans,
            dbClientPlanKey = Object.keys(dbClientPlan),
            postProject = []

        for (var i = 0; i < dbClientPlanKey.length; i++) {
            var tempPlan = dbClientPlan[dbClientPlanKey[i]];

            if (tempPlan.deleted) { continue }

            var tempObj = {
                project_id: tempPlan.project_id,
                createdOn: tempPlan.createdOn,
                createdBy: tempPlan.createdBy,
                plan_name: tempPlan.plan,
                price: parseInt(tempPlan.price),
                duration: parseInt(tempPlan.duration),
                project_name: tempPlan.project_name,
                project_description: tempPlan.project_description,
                start_date: tempPlan.start_date,
                end_date: String(new Date(new Date(tempPlan.start_date).setDate(new Date(tempPlan.start_date).getDate() + parseInt(tempPlan.duration))))
            }

            if (new Date(tempPlan.start_date) > new Date()) {
                tempObj.status = 'scheduled'
            } else if (new Date() >= new Date(tempPlan.start_date) && new Date() <= new Date(tempPlan.start_date).setDate(new Date(tempPlan.start_date).getDate() + parseInt(tempPlan.duration))) {
                tempObj.status = 'running'
            } else {
                tempObj.status = 'expired'
            }

            postProject.push(tempObj)
            if (parseInt(req.query.project_id) == parseInt(tempObj.project_id)) {
                return response(res, 200, 'success', undefined, tempObj, 'C-3.1.1')
            }
        }

        if (req.query.project_id) {
            return response(res, 404, 'notFound', 'Incorrect Project ID', undefined, 'C-3.1.2')
        }
        return response(res, 200, 'success', undefined, postProject, 'C-3.1.3')
    } else {
        return response(res, 200, 'success', 'No Projects found', undefined, 'C-3.1.4')
    }

});

// 3.2 Fetch Project
clientProjectAPI.get('/:projectID', (req, res) => {
    if (isNaN(parseInt(req.params.projectID))) {
        return response(res, 400, 'invalid', 'Incorrect Project ID', undefined, 'P')
    }

    var projectID = parseInt(req.params.projectID),
        dbKeys = getProject(projectID)

    if (!dbKeys) { return response(res, 404, 'notFound', 'Incorrect Project ID', undefined, 'P') }

    if (req.query.scope) {
        var queryScope = String(req.query.scope).split(' ')
    } else {
        return response(res, 400, 'required', 'At least 1 scope is required', { valid_scopes: ['services', 'activity', 'reviews', 'accounts', 'team'] })
    }

    var dbProject = dbClientAccount.plans[dbKeys.plan_key],
        scope = [],
        postData = {}

    // Allocated Services
    if (queryScope.includes('services')) {
        scope.push('services')

        if (dbProject.service && dbAdminSnapshot.services) {
            var dbProjectService = dbProject.service,
                dbProjectServiceKey = Object.keys(dbProjectService),
                dbService = dbAdminSnapshot.services,
                dbServiceKey = Object.keys(dbService)

            // Object for Service Scope
            postData.services = []

            for (var i = 0; i < dbProjectServiceKey.length; i++) {
                var tempProjectService = dbProjectService[dbProjectServiceKey[i]]

                if (tempProjectService.deleted) { continue }

                for (var j = 0; j < dbServiceKey.length; j++) {
                    var tempService = dbService[dbServiceKey[j]]

                    if (tempService.deleted) { continue }

                    if (tempService.service_id == tempProjectService.service_id) {
                        var tempServiceObj = {
                            service_id: parseInt(tempService.service_id),
                            service_name: tempService.title,
                            active: tempService.active,
                            createdOn: tempProjectService.createdOn,
                            createdBy: tempProjectService.createdBy,
                            lastModifiedOn: tempProjectService.lastModifiedOn,
                            lastModifiedBy: tempProjectService.lastModifiedBy,
                        }

                        if (tempService.criteria) {
                            var dbServiceCriteria = tempService.criteria,
                                dbServiceCriteriaKey = Object.keys(tempService.criteria)

                            tempServiceObj.criteria = []

                            for (var k = 0; k < dbServiceCriteriaKey.length; k++) {
                                var tempCriteria = dbServiceCriteria[dbServiceCriteriaKey[k]]

                                if (tempCriteria.deleted) { continue }

                                tempServiceObj.criteria.push({
                                    criteria_id: tempCriteria.criteria_id,
                                    criteria: tempCriteria.criteria
                                })
                            }

                            if (tempServiceObj.criteria.length == 0) {
                                delete tempServiceObj.criteria
                            }
                        }

                        // Push to Main Object
                        postData.services.push(tempServiceObj)
                    }
                }
            }

            if (postData.services.length == 0) {
                delete postData.services
            }
        }
    }

    // Associated Team Member
    if (queryScope.includes('team')) {
        scope.push('team')

        if (dbProject.team && dbAdminSnapshot.employees) {
            var dbProjectTeam = dbProject.team,
                dbProjectTeamKey = Object.keys(dbProjectTeam),
                dbEmployees = dbAdminSnapshot.employees,
                dbEmployeesKey = Object.keys(dbEmployees)

            // Object for Team
            postData.team = []

            for (var i = 0; i < dbProjectTeamKey.length; i++) {
                var tempTeamMember = dbProjectTeam[dbProjectTeamKey[i]]

                if (tempTeamMember.deleted || !tempTeamMember.active) { continue }

                for (var j = 0; j < dbEmployeesKey.length; j++) {

                    if (dbEmployees[dbEmployeesKey[j]].deleted) { continue }

                    var tempEmployee = dbEmployees[dbEmployeesKey[j]]
                    if (tempEmployee.employee_id == tempTeamMember.employee_id) {

                        postData.team.push({
                            employee_id: parseInt(tempEmployee.employee_id),
                            name: tempEmployee.name,
                            position: tempEmployee.position,
                            profile_image: tempEmployee.profile_image,
                            createdOn: tempTeamMember.createdOn,
                            createdBy: tempTeamMember.createdBy,
                            lastModifiedOn: tempTeamMember.lastModifiedOn,
                            lastModifiedBy: tempTeamMember.lastModifiedBy,
                        })
                    }

                }
            }

            if (postData.team.length == 0) {
                delete postData.team
            }
        }
    }

    // Accounts of Project
    if (queryScope.includes('accounts')) {
        scope.push('accounts')

        if (dbProject.social_account) {
            var dbProjectAccount = dbProject.social_account,
                dbProjectAccountKey = Object.keys(dbProjectAccount)

            // Object for Account
            postData.accounts = []

            for (var i = 0; i < dbProjectAccountKey.length; i++) {
                var tempAccount = dbProjectAccount[dbProjectAccountKey[i]]

                if (tempAccount.deleted) { continue }

                postData.accounts.push({
                    account_key: dbProjectAccountKey[i],
                    account_name: tempAccount.account_name,
                    reference: tempAccount.reference,
                    createdOn: tempAccount.createdOn,
                    createdBy: tempAccount.createdBy,
                    lastModifiedOn: tempAccount.lastModifiedOn,
                    lastModifiedBy: tempAccount.lastModifiedBy
                })
            }

            if (postData.accounts.length == 0) {
                delete postData.accounts
            }
        }
    }

    return response(res, 200, 'success', undefined, { scopes: scope, data: postData }, 'P')
});

// 3.3 Review Action
clientProjectAPI.post('/review/action', (req, res) => {
    if (!req.body.review_id || isNaN(parseInt(req.body.review_id))) {
        return response(res, 400, 'required', 'Review Id is required', undefined, 'C-3.3.1')
    }
    if (!req.body.post_key) {
        return response(res, 400, 'required', 'Post Key is required', undefined, 'C-3.3.2')
    }
    if (!req.body.status) {
        return response(res, 400, 'required', 'Status is required it should be "APPROVED or REJECTED or CHANGES"', undefined, 'C-3.3.3')
    }
    if (isNaN(parseInt(req.body.project_id)) || !req.body.project_id) {
        return response(res, 400, 'required', 'Project Id is required', undefined, 'C-3.3.4')
    }
    var status = String(req.body.status).trim(),
        projectID = String(req.body.project_id),
        reviewID = String(req.body.review_id),
        postKey = String(req.body.post_key).trim(),
        getKeys = getProject(projectID)
    if (!getKeys) {
        return response(res, 404, 'notFound', 'Incorrect Project ID', undefined, 'c-3.3.5')
    }

    if (status != "APPROVED" && status != "REJECTED" && status != "CHANGES") {
        return response(res, 400, 'invalid', 'Status value is not proper', undefined, 'C-3.3.6')

    }
    if (!dbAdminSnapshot.clients[getKeys.client_key].plans[getKeys.plan_key].review) {
        return response(res, 404, 'notFound', 'Incorrect Review ID', undefined, 'c-3.3.7')

    }
    var dbReview = dbAdminSnapshot.clients[getKeys.client_key].plans[getKeys.plan_key].review,
        dbReviewKeys = Object.keys(dbReview)
    for (var i = 0; i < dbReviewKeys.length; i++) {
        var tempReview = dbReview[dbReviewKeys[i]]

        if (tempReview.review_id == reviewID && !tempReview.deleted && !tempReview.closed) {
            var tempPost = tempReview.post
            if (tempPost[postKey]) {
                var pushData = {
                    createdBy: 'CLIENT',
                    createdOn: String(new Date()),
                    createdById: dbClientAccount.client_id || 0,
                    status: status
                }
                if (req.body.description) {
                    var description = String(req.body.description)
                    pushData.description = description
                }
                return firebase.ref(`/admin/clients/${getKeys.client_key}/plans/${getKeys.plan_key}/review/${dbReviewKeys[i]}/post/${postKey}/conversations/`).push(pushData).then(() => {
                    return response(res, 200, 'success', 'Your action recorded successfully', undefined, 'C-3.3.8')
                })
            } else {
                return response(res, 404, 'notfound', 'Incorrect Post Key', undefined, 'C-3.3.9')

            }


        } else if (i == dbReviewKeys.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'C-3.3.10')

        }
    }


});

// 3.4 Review Action Edit
clientProjectAPI.post('/review/action/edit', (req, res) => {
    if (!req.body.review_id || isNaN(parseInt(req.body.review_id))) {
        return response(res, 400, 'required', 'Review Id is required', undefined, 'C-3.4.1')
    }

    if (!req.body.post_key) {
        return response(res, 400, 'required', 'Post Key is required', undefined, 'C-3.4.2')
    }

    if (!req.body.conversation_key) {
        return response(res, 400, 'required', 'Conversation Key is required', undefined, 'C-3.4.3')
    }

    if (!req.body.status) {
        return response(res, 400, 'required', 'Status is required', undefined, 'C-3.4.4')
    }

    if (isNaN(parseInt(req.body.project_id)) || !req.body.project_id) {
        return response(res, 400, 'required', 'Project Id is required', undefined, 'C-3.4.5')
    }

    var status = String(req.body.status).trim(),
        projectID = String(req.body.project_id),
        reviewID = String(req.body.review_id),
        postKey = String(req.body.post_key).trim(),
        conversationKey = String(req.body.conversation_key).trim(),
        getKeys = getProject(projectID)

    if (!getKeys) {
        return response(res, 404, 'notFound', 'Incorrect Project ID', undefined, 'c-3.4.6')
    }

    if (status != "APPROVED" && status != "REJECTED" && status != "CHANGES") {
        return response(res, 400, 'invalid', 'Status value is not proper / it should be "APPROVED or REJECTED or CHANGES"', undefined, 'C-3.4.7')
    }

    if (!dbAdminSnapshot.clients[getKeys.client_key].plans[getKeys.plan_key].review) {
        return response(res, 404, 'notFound', 'Incorrect Review ID', undefined, 'c-3.4.8')
    }

    var dbReview = dbAdminSnapshot.clients[getKeys.client_key].plans[getKeys.plan_key].review,
        dbReviewKeys = Object.keys(dbReview)
    for (var i = 0; i < dbReviewKeys.length; i++) {
        var tempReview = dbReview[dbReviewKeys[i]]

        if (tempReview.review_id == reviewID && !tempReview.deleted && !tempReview.closed) {
            var tempPost = tempReview.post
            if (tempPost[postKey]) {
                var conversation = tempPost[postKey].conversations
                if (conversation[conversationKey]) {
                    var tempConversation = conversation[conversationKey]

                    tempConversation.lastModifiedBy = 'CLIENT'
                    tempConversation.lastModifiedOn = String(new Date())
                    tempConversation.lastModifiedById = dbClientAccount.client_id || 0
                    tempConversation.status = status

                    if (req.body.description) {
                        var description = String(req.body.description)
                        tempConversation.description = description
                    }
                    return firebase.ref(`/admin/clients/${getKeys.client_key}/plans/${getKeys.plan_key}/review/${dbReviewKeys[i]}/post/${postKey}/conversations/${conversationKey}`).update(tempConversation).then(() => {
                        return response(res, 200, 'success', 'Your action recorded successfully', undefined, 'C-3.4.9')
                    })
                } else {
                    return response(res, 404, 'notfound', 'Incorrect Conversation Key', undefined, 'C-3.4.10')

                }

            } else {
                return response(res, 404, 'notfound', 'Incorrect Post Key', undefined, 'C-3.4.11')
            }


        } else if (i == dbReviewKeys.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'C-3.4.12')
        }
    }


})

module.exports = clientProjectAPI;

// Project Validator
function getProject(project_id) {
    if (!project_id) { return false; }

    if (dbClientAccount.plans) {
        var dbClientPlans = dbClientAccount.plans,
            dbClientPlansKey = Object.keys(dbClientPlans)

        for (var i = 0; i < dbClientPlansKey.length; i++) {
            var tempProject = dbClientPlans[dbClientPlansKey[i]]

            if (tempProject.deleted) { continue } else if (tempProject.project_id == project_id) {
                return {
                    client_key: clientAuthToken.client_key,
                    plan_key: dbClientPlansKey[i]
                }
            }
        }
    }

    return false;
}