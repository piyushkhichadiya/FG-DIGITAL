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
                price: parseInt(tempPlan.price) || undefined,
                duration: parseInt(tempPlan.duration) || undefined,
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

    var projectID = parseInt(req.params.projectID),
        dbKeys = getProject(projectID)

    if (!dbKeys) { return response(res, 404, 'notFound', 'Incorrect Project ID', undefined, 'C-3.2.1') }

    if (req.query.scope) {
        var queryScope = String(req.query.scope).split(' ')
    } else {
        return response(res, 400, 'required', 'At least 1 scope is required', { valid_scopes: ['services', 'activity', 'reviews', 'accounts', 'team'] }, 'C-3.2.2')
    }

    const dbProject = dbClientAccount.plans[dbKeys.plan_key],
        serviceValidator = serviceChecker();
    var scope = [],
        postData = {}

    // Allocated Services
    if (queryScope.includes('services')) {
        scope.push('services')

        if (dbProject.service && dbAdminSnapshot.services) {
            var dbProjectService = dbProject.service,
                dbProjectServiceKey = Object.keys(dbProjectService)

            // Object for Service Scope
            postData.services = []

            for (var i = 0; i < dbProjectServiceKey.length; i++) {
                var tempProjectService = dbProjectService[dbProjectServiceKey[i]]

                if (tempProjectService.deleted || !serviceValidator[tempProjectService.service_id]) { continue }

                if (serviceValidator[tempProjectService.service_id].deleted) { continue }

                var tempService = serviceValidator[tempProjectService.service_id]

                var tempServiceObj = {
                    service_id: parseInt(tempProjectService.service_id),
                    service_name: tempService.service_name,
                    active: tempProjectService.active,
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
                            criteria_id: dbServiceCriteriaKey[k],
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

    // Activity in Project
    if (queryScope.includes('activity')) {
        scope.push('activity')

        if (dbProject.activity) {
            var dbProjectActivity = dbProject.activity,
                dbProjectActivityKeys = Object.keys(dbProjectActivity)

            // Object for Activity
            postData.activity = []

            for (var i = 0; i < dbProjectActivityKeys.length; i++) {
                var tempActivity = dbProjectActivity[dbProjectActivityKeys[i]]

                if (tempActivity.deleted) { continue }

                var tempActivityObj = {
                    activity_key: dbProjectActivityKeys[i],
                    createdOn: tempActivity.createdOn,
                    createdBy: tempActivity.createdBy,
                    createdById: tempActivity.createdById,
                    lastModifiedOn: tempActivity.lastModifiedOn,
                    lastModifiedBy: tempActivity.lastModifiedBy,
                    lastModifiedById: tempActivity.lastModifiedById,
                    date: tempActivity.date,
                    description: tempActivity.description,
                    service_id: parseInt(tempActivity.service_id) || undefined,
                    title: tempActivity.title,
                    type: tempActivity.type
                }

                // For Activity Type 'SERVICE'
                if (tempActivityObj.type == 'SERVICE') {
                    if (!serviceValidator[tempActivityObj.service_id]) {
                        continue;
                        // Will not push to data because original source of service has been remove from database
                    }

                    tempActivityObj.service_name = serviceValidator[tempActivityObj.service_id].service_name

                    var allCriteriaDeleted;
                    if (serviceValidator[tempActivityObj.service_id].deleted) {
                        tempActivityObj.service_deleted = allCriteriaDeleted = true
                    }

                    if (tempActivity.criteria) {
                        var dbActivityCriteria = tempActivity.criteria,
                            dbActivityCriteriaKey = Object.keys(dbActivityCriteria)

                        // Object to Temp Activity Object for Criteria
                        tempActivityObj.criteria = []

                        for (var j = 0; j < dbActivityCriteriaKey.length; j++) {
                            var tempCriteria = dbActivityCriteria[dbActivityCriteriaKey[j]]

                            if (tempCriteria.deleted) { continue }

                            if (serviceValidator[tempActivityObj.service_id].criteria && serviceValidator[tempActivityObj.service_id].criteria[tempCriteria.criteria_id]) {

                                var tempCriteriaObj = {
                                    criteria_id: parseInt(tempCriteria.criteria_id),
                                    criteria: serviceValidator[tempActivityObj.service_id].criteria[tempCriteria.criteria_id].criteria,
                                    value: tempCriteria.value,
                                    deleted: serviceValidator[tempActivityObj.service_id].criteria[tempCriteria.criteria_id].deleted || allCriteriaDeleted,
                                    createdOn: tempCriteria.createdOn || tempActivity.createdOn,
                                    createdBy: tempCriteria.createdBy || tempActivity.createdBy,
                                    createdById: tempCriteria.createdById || tempActivity.createdById,
                                    lastModifiedOn: tempCriteria.lastModifiedOn,
                                    lastModifiedBy: tempCriteria.lastModifiedBy,
                                    lastModifiedById: tempCriteria.lastModifiedById
                                }

                                tempActivityObj.criteria.push(tempCriteriaObj)
                            }
                        }

                        if (tempCriteriaObj.criteria.length == 0) {
                            delete tempCriteriaObj.criteria
                        }
                    }
                }

                // Documents
                if (tempActivity.documents) {
                    var dbActivityDocuments = tempActivity.documents,
                        dbActivityDocumentsKey = Object.keys(dbActivityDocuments)

                    tempActivityObj.documents = []

                    for (var j = 0; j < dbActivityDocumentsKey.length; j++) {
                        var tempDocument = dbActivityDocuments[dbActivityDocumentsKey[j]]

                        if (tempDocument.deleted) { continue }

                        var tempDocObj = {
                            document_key: dbActivityDocumentsKey[j],
                            filename: tempDocument.filename,
                            createdOn: tempDocument.createdOn || tempActivity.createdOn,
                            createdBy: tempDocument.createdBy || tempActivity.createdBy,
                            createdById: tempDocument.createdById || tempActivity.createdById,
                            lastModifiedOn: tempDocument.lastModifiedOn,
                            lastModifiedBy: tempDocument.lastModifiedBy,
                            lastModifiedById: tempDocument.lastModifiedById
                        }

                        tempActivityObj.documents.push(tempDocObj)
                    }

                    if (tempActivityObj.documents.length == 0) {
                        delete tempActivityObj.documents
                    }
                }

                // Push to Activity of Post Object
                postData.activity.push(tempActivityObj)
            }

            if (postData.activity.length == 0) {
                delete postData.activity
            }
        }


    }

    // Reviews
    if (queryScope.includes('reviews')) {
        scope.push('reviews')

        if (dbProject.review) {
            var dbProjectReview = dbProject.review,
                dbProjectReviewKey = Object.keys(dbProjectReview)

            // Object for Reviews
            postData.reviews = []

            for (var i = 0; i < dbProjectReviewKey.length; i++) {
                var tempReview = dbProjectReview[dbProjectReviewKey[i]]

                if (tempReview.deleted) { continue }

                var tempReviewObj = {
                    review_key: dbProjectReviewKey[i],
                    review_id: tempReview.review_id,
                    createdOn: tempReview.createdOn,
                    createdBy: tempReview.createdBy,
                    createdById: tempReview.createdById,
                    lastModifiedOn: tempReview.lastModifiedOn,
                    lastModifiedBy: tempReview.lastModifiedBy,
                    lastModifiedById: tempReview.lastModifiedById,
                    title: tempReview.title,
                    description: tempReview.description,
                    closed: tempReview.closed
                }

                if (tempReview.post) {
                    var dbReviewPost = tempReview.post,
                        dbReviewPostKey = Object.keys(dbReviewPost)

                    tempReviewObj.posts = []

                    for (var j = 0; j < dbReviewPostKey.length; j++) {
                        var tempPost = dbReviewPost[dbReviewPostKey[j]]

                        if (tempPost.deleted) { continue }

                        var tempPostObj = {
                            post_key: dbReviewPostKey[j],
                            createdOn: tempPost.createdOn,
                            createdBy: tempPost.createdBy,
                            createdById: tempPost.createdById,
                            lastModifiedOn: tempPost.lastModifiedOn,
                            lastModifiedBy: tempPost.lastModifiedBy,
                            lastModifiedById: tempPost.lastModifiedById,
                            description: tempPost.description
                        }

                        // Conversation
                        if (tempPost.conversations) {
                            var dbPostConversations = tempPost.conversations,
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

                        // Documents
                        if (tempPost.documents) {
                            var dbPostDocuments = tempPost.documents,
                                dbPostDocumentsKey = Object.keys(dbPostDocuments)

                            tempPostObj.documents = []

                            for (var k = 0; k < dbPostDocumentsKey.length; k++) {
                                var tempDocument = dbPostDocuments[dbPostDocumentsKey[k]]

                                if (tempDocument.deleted) { continue }

                                var tempDocObj = {
                                    document_key: dbPostDocumentsKey[k],
                                    filename: tempDocument.filename,
                                    createdOn: tempDocument.createdOn || tempPost.createdOn,
                                    createdBy: tempDocument.createdBy || tempPost.createdBy,
                                    createdById: tempDocument.createdById || tempPost.createdById,
                                    lastModifiedOn: tempDocument.lastModifiedOn,
                                    lastModifiedBy: tempDocument.lastModifiedBy,
                                    lastModifiedById: tempDocument.lastModifiedById
                                }

                                // Push to Post Object
                                tempPostObj.documents.push(tempDocObj)
                            }

                            if (tempPostObj.documents.length == 0) { delete tempPostObj.documents }
                        }

                        // Push to Temp. Review Obj
                        tempReviewObj.posts.push(tempPostObj)
                    }

                    if (tempReviewObj.posts.length == 0) { delete tempReviewObj.posts }
                }

                // Push to Review Object of Post Object
                postData.reviews.push(tempReviewObj)
            }

            if (postData.reviews.length == 0) { delete postData.reviews }
        }
    }

    return response(res, 200, 'success', undefined, { scopes: scope, data: postData, valid_scopes: ['services', 'activity', 'reviews', 'accounts', 'team'] }, 'C-3.2.3')
});

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

// Service Checker
function serviceChecker() {
    /**
     * This function will check that which service and criteria of same is deleted
     */

    if (dbAdminSnapshot.services) {
        var dbService = dbAdminSnapshot.services,
            dbServiceKey = Object.keys(dbService),
            tempServiceObj = {}

        for (var i = 0; i < dbServiceKey.length; i++) {
            var tempService = dbService[dbServiceKey[i]]

            tempServiceObj[tempService.service_id] = {
                service_name: tempService.title,
                deleted: tempService.deleted
            }

            if (tempService.criteria) {
                var dbServiceCriteria = tempService.criteria,
                    dbServiceCriteriaKey = Object.keys(dbServiceCriteria)

                tempServiceObj[tempService.service_id].criteria = {}

                for (var j = 0; j < dbServiceCriteriaKey.length; j++) {
                    var tempCriteria = dbServiceCriteria[dbServiceCriteriaKey[j]]

                    tempServiceObj[tempService.service_id].criteria[tempCriteria.criteria_id] = {
                        criteria: tempCriteria.criteria,
                        deleted: tempService.deleted || tempCriteria.deleted
                    }
                }
            }
        }

        return tempServiceObj;
    } else {
        return false;
    }
}