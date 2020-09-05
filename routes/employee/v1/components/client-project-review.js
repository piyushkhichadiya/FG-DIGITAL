const { query } = require('express');

const clientProjectAPI = require('express').Router(),
    firebase = require('firebase-admin').database(),
    fs = require('fs'),
    { response, storageDirectory } = require('../../../../functions/functions')

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

var dbAdminSnapshot, employeeAuthToken, dbEmployeeAccount;
clientProjectAPI.use((req, res, next) => {
    dbAdminSnapshot = req.session.dbAdminSnapshot
    employeeAuthToken = req.session.decode_employeeAuthToken
    dbEmployeeAccount = dbAdminSnapshot.employees[employeeAuthToken.employee_key];
    next();
});

//--------------------------------- ROUTES ----------------------------------

//----------------------------- 3. CLIENT PROJECT ---------------------------

// 3.1 Fetch Project
clientProjectAPI.get('/fetch', (req, res) => {

    /**
     * If not Project ID and Scope then Only Project List
     * If Project ID then project id + scope
     */

    // Query Filter
    /**
     * 1. project_id
     * 2. scope
     */

    if (req.query.project_id) {
        var query_ProjectID = req.query.project_id
    }

    var query_scope = []
    if (req.query.scope) {
        query_scope = String(req.query.scope).split(' ')
    }

    // Client
    if (dbAdminSnapshot.clients) {
        var dbClients = dbAdminSnapshot.clients,
            dbClientsKey = Object.keys(dbClients),
            projectObject = []

        for (var i = 0; i < dbClientsKey.length; i++) {
            var tempClient = dbClients[dbClientsKey[i]]
            if (tempClient.deleted) { continue }

            // Client Info
            var tempClientObject = {
                client_key: dbClientsKey[i],
                name: tempClient.name
            }

            // Projects
            if (tempClient.plans) {
                var dbClientProjects = tempClient.plans,
                    dbClientProjectsKey = Object.keys(dbClientProjects)

                for (var j = 0; j < dbClientProjectsKey.length; j++) {
                    var tempProject = dbClientProjects[dbClientProjectsKey[j]]

                    if (tempProject.deleted) { continue }

                    var tempProjectObj = {
                        project_id: tempProject.project_id,
                        project_name: tempProject.project_name,
                        project_description: tempProject.project_description
                    }


                    // Team
                    var tempEmployeePermission = {},
                        authorized = false // To Check Employee is associated with project

                    if (tempProject.team) {
                        var dbProjectTeam = tempProject.team,
                            dbProjectTeamKeys = Object.keys(dbProjectTeam)

                        tempProjectObj.team = []

                        for (var k = 0; k < dbProjectTeamKeys.length; k++) {
                            var tempTeam = dbProjectTeam[dbProjectTeamKeys[k]]

                            if (tempTeam.deleted || !tempTeam.active) { continue }

                            // Check Employee Status
                            if (dbAdminSnapshot.employees) {
                                var dbEmployee = dbAdminSnapshot.employees,
                                    dbEmployeeKey = Object.keys(dbEmployee)

                                for (var e = 0; e < dbEmployeeKey.length; e++) {

                                    if (!dbEmployee[dbEmployeeKey[e]].deleted && dbEmployee[dbEmployeeKey[e]].employee_id == tempTeam.employee_id) {

                                        var tempEmployee = dbEmployee[dbEmployeeKey[e]],
                                            tempEmployeeObj = {
                                                employee_id: tempEmployee.employee_id,
                                                email: tempEmployee.email,
                                                mobile: tempEmployee.mobile,
                                                name: tempEmployee.name,
                                                position: tempEmployee.position,
                                                profile_image: tempEmployee.profile_image,
                                                skills: tempEmployee.skills
                                            }

                                        if (tempTeam.employee_id == dbEmployeeAccount.employee_id) {
                                            authorized = true;
                                            tempEmployeePermission = tempEmployeeObj.permission = {
                                                activity: tempTeam.activity,
                                                review: tempTeam.review
                                            }

                                            // All Projects
                                            projectObject.push({
                                                project_id: tempProject.project_id,
                                                project_name: tempProject.project_name,
                                                project_description: tempProject.project_description
                                            })
                                        }

                                        tempProjectObj.team.push(tempEmployeeObj)
                                    }
                                }
                            }
                        }

                        if (tempProjectObj.team.length == 0) {
                            delete tempProjectObj.team
                        }
                    }

                    // If Employee ID is not associated with project
                    if (!authorized || !query_ProjectID) { continue }

                    // Social Accounts
                    if (tempProject.social_account && query_scope.includes('account')) {
                        var dbProjectAccount = tempProject.social_account,
                            dbProjectAccountKey = Object.keys(dbProjectAccount)

                        tempProjectObj.accounts = []

                        for (k = 0; k < dbProjectAccountKey.length; k++) {
                            var tempAccount = dbProjectAccount[dbProjectAccountKey[k]]

                            if (tempAccount.deleted) { continue }

                            var tempObj = {
                                account_key: dbProjectAccountKey[k],
                                account_name: tempAccount.account_name,
                                reference: tempAccount.reference
                            }

                            tempProjectObj.accounts.push(tempObj)
                        }

                        if (tempProjectObj.accounts.length == 0) {
                            delete tempProjectObj.accounts
                        }
                    }

                    // Service
                    var activeCriteria = [] // To validate in Activity Data

                    if (tempProject.service && query_scope.includes('service')) {
                        var dbProjectService = tempProject.service,
                            dbProjectServiceKey = Object.keys(dbProjectService)

                        tempProjectObj.services = []

                        for (var k = 0; k < dbProjectServiceKey.length; k++) {
                            var tempProjectService = dbProjectService[dbProjectServiceKey[k]]

                            if (tempProjectService.deleted || !tempProjectService.active) { continue }

                            // Check Service Status
                            if (dbAdminSnapshot.services) {
                                var dbServices = dbAdminSnapshot.services,
                                    dbServicesKey = Object.keys(dbServices)

                                for (var l = 0; l < dbServicesKey.length; l++) {
                                    var tempService = dbServices[dbServicesKey[l]]

                                    if (tempService.deleted || tempService.service_id != tempProjectService.service_id) { continue }

                                    var tempServiceObj = {
                                        service_id: tempProjectService.service_id
                                    }

                                    if (tempService.criteria) {
                                        var dbServiceCriteria = tempService.criteria,
                                            dbServiceCriteriaKey = Object.keys(dbServiceCriteria)

                                        tempServiceObj.criteria = []

                                        for (var k = 0; k < dbServiceCriteriaKey.length; k++) {
                                            var tempCriteria = dbServiceCriteria[dbServiceCriteriaKey[k]]

                                            if (tempCriteria.deleted) { continue }

                                            tempServiceObj.criteria.push({
                                                criteria_id: tempCriteria.criteria_id,
                                                criteria: tempCriteria.criteria
                                            })

                                            activeCriteria.push(tempCriteria.criteria_id)
                                        }
                                    }

                                    tempProjectObj.services.push(tempServiceObj)
                                }
                            }
                        }
                    }

                    // Review
                    if (tempEmployeePermission.review && query_scope.includes('review') && tempProject.review) {
                        var dbProjectReview = tempProject.review,
                            dbProjectReviewKey = Object.keys(dbProjectReview)

                        tempProjectObj.review = []

                        for (var k = 0; k < dbProjectReviewKey.length; k++) {
                            var tempReview = dbProjectReview[dbProjectReviewKey[k]];

                            if (tempReview.deleted) { continue }

                            var tempReviewObj = {
                                review_id: tempReview.review_id,
                                title: tempReview.title,
                                description: tempReview.description,
                                closed: tempReview.closed,
                                createdOn: tempReview.createdOn,
                                createdBy: tempReview.createdBy
                            }

                            if (tempReview.post) {
                                var dbReviewPost = tempReview.post,
                                    dbReviewPostKey = Object.keys(dbReviewPost)

                                tempReviewObj.post = []

                                for (var m = 0; m < dbReviewPostKey.length; m++) {
                                    var tempReviewPost = dbReviewPost[dbReviewPostKey[m]]

                                    if (tempReviewPost.deleted) { continue }

                                    var tempPostObj = {
                                        description: tempReviewPost.description,
                                        createdOn: tempReviewPost.createdOn,
                                        createdBy: tempReviewPost.createdBy
                                    }

                                    if (tempReviewPost.documents) {
                                        var dbReviewDocument = tempReviewPost.documents,
                                            dbReviewDocumentKey = Object.keys(dbReviewDocument)

                                        tempPostObj.documents = []

                                        for (var l = 0; l < dbReviewDocumentKey.length; l++) {
                                            var tempDocument = dbReviewDocument[dbReviewDocumentKey[l]]

                                            if (tempDocument.deleted) { continue }

                                            var tempReviewPostDocObj = {
                                                filename: tempDocument.filename,
                                                createdOn: tempDocument.createdOn || tempReview.createdOn,
                                                createdBy: tempDocument.createdBy || tempReview.createdBy
                                            }

                                            tempPostObj.documents.push(tempReviewPostDocObj)
                                        }

                                        if (tempPostObj.documents.length == 0) {
                                            delete tempPostObj.documents
                                        }
                                    }

                                    tempReviewObj.post.push(tempPostObj)
                                }

                                if (tempReviewObj.post.length == 0) {
                                    delete tempReviewObj.post
                                }
                            }

                            tempProjectObj.review.push(tempReviewObj)
                        }

                        if (tempProjectObj.review.length == 0) {
                            delete tempProjectObj.review
                        }
                    }

                    // Activity
                    if (tempEmployeePermission.activity && query_scope.includes('activity')) {
                        // Pending
                    }

                    // Filter for Scope Team
                    if (!query_scope.includes('team')) {
                        delete tempProjectObj.team
                    }

                    if (query_ProjectID == tempProjectObj.project_id) {
                        tempClientObject.project = tempProjectObj
                        return response(res, 200, 'success', undefined, tempClientObject, 'E-3.1-1')
                    }
                }
            }
        }

        if (query_ProjectID) {
            return response(res, 404, 'notFound', 'Incorrect Project ID', undefined, 'E-3.1-2')
        }
        return response(res, 200, 'success', undefined, { projects: projectObject }, 'E-3.1-3')
    }

    return response(res, 200, 'success', '0 Projects Found', undefined, 'E-3.1-4')
})

module.exports = clientProjectAPI;
// Function
function getKeys(project_id) {
    if (!dbAdminSnapshot.clients) {
        return false
    }

    var employeeID = dbEmployeeAccount.employee_id,
        clientDB = dbAdminSnapshot.clients,
        clientKey = Object.keys(clientDB)

    for (var i = 0; i < clientKey.length; i++) {
        if (clientDB[clientKey[i]].plans && !clientDB[clientKey[i]].deleted) {

            var planDB = clientDB[clientKey[i]].plans,
                planKey = Object.keys(planDB)
            for (var j = 0; j < planKey.length; j++) {
                var tempPlan = planDB[planKey[j]]
                if (tempPlan.project_id == project_id && !tempPlan.deleted) {

                    if (tempPlan.team) {
                        var dbTeam = tempPlan.team,
                            dbTeamKey = Object.keys(dbTeam)

                        for (var t = 0; t < dbTeamKey.length; t++) {
                            var tempTeam = dbTeam[dbTeamKey[t]];
                            if (!tempTeam.deleted && tempTeam.employee_id == employeeID && tempTeam.active) {
                                return {
                                    client_key: clientKey[i],
                                    plan_key: planKey[j],
                                    permission: {
                                        activity: tempTeam.activity,
                                        review: tempTeam.review
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        if (i == clientKey.length - 1) {
            return false
        }
    }
}

// APIs
/**
 * 3.1 Fetch Project
 * 3.6 Create Review
 * 3.7 Update Review
 * 3.8 Add Post to Review
 * 3.9 Update Post
 * 3.10 Remove Post
 * 3.11 Close Review
 * 3.12 Open Review
 * 3.13 Remove File from Review
 */