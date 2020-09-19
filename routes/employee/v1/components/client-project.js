const clientProjectAPI = require('express').Router(),
    firebase = require('firebase-admin').database(),
    fs = require('fs'),
    directoryCreate = require('../../../../config/directory'),
    { response, storageDirectory, unlinkFile } = require('../../../../functions/functions')

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
            projectObject = [],
            scope = [],
            permissionDeny = []

        for (var i = 0; i < dbClientsKey.length; i++) {
            var tempClient = dbClients[dbClientsKey[i]]
            if (tempClient.deleted) { continue }

            // Projects
            if (tempClient.plans) {
                var dbClientProjects = tempClient.plans,
                    dbClientProjectsKey = Object.keys(dbClientProjects)

                for (var j = 0; j < dbClientProjectsKey.length; j++) {
                    var tempProject = dbClientProjects[dbClientProjectsKey[j]]

                    if (tempProject.deleted) { continue }

                    var tempProjectObj = {
                        project_id: tempProject.project_id
                    }

                    // Project Information
                    if (query_scope.includes('info')) {

                        scope.push('info')

                        tempProjectObj.name = tempProject.project_name
                        tempProjectObj.description = tempProject.project_description
                    }

                    // Client Information
                    if (query_scope.includes('client')) {

                        scope.push('client')

                        var tempClientObject = {
                            client_key: dbClientsKey[i],
                            client_id: tempClient.client_id,
                            name: tempClient.name
                        }
                        tempProjectObj.client = tempClientObject
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

                        // Filter for Scope Team
                        if (!query_scope.includes('team')) {
                            delete tempProjectObj.team
                        } else {
                            scope.push('team')
                        }
                    }

                    // If Employee ID is not associated with project
                    if (!authorized || !query_ProjectID) { continue }

                    // Social Accounts
                    if (query_scope.includes('account')) {
                        scope.push('account')

                        if (tempProject.social_account) {
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
                    }

                    // Service
                    var activeCriteria = {}, // To validate in Activity Data
                        allServices = {}

                    if (tempProject.service) {

                        var dbProjectService = tempProject.service,
                            dbProjectServiceKey = Object.keys(dbProjectService)

                        tempProjectObj.services = []

                        for (var k = 0; k < dbProjectServiceKey.length; k++) {
                            var tempProjectService = dbProjectService[dbProjectServiceKey[k]]

                            // Check Service Status
                            if (dbAdminSnapshot.services) {
                                var dbServices = dbAdminSnapshot.services,
                                    dbServicesKey = Object.keys(dbServices)

                                for (var l = 0; l < dbServicesKey.length; l++) {
                                    var tempService = dbServices[dbServicesKey[l]]

                                    allServices[tempService.service_id] = {
                                        deleted: tempService.deleted,
                                        service_name: tempService.title
                                    }

                                    if (tempService.service_id != tempProjectService.service_id) { continue }

                                    var tempServiceObj = {
                                        service_id: tempProjectService.service_id,
                                        service_name: tempService.title
                                    }

                                    if (tempService.criteria) {
                                        var dbServiceCriteria = tempService.criteria,
                                            dbServiceCriteriaKey = Object.keys(dbServiceCriteria)

                                        tempServiceObj.criteria = []

                                        for (var m = 0; m < dbServiceCriteriaKey.length; m++) {
                                            var tempCriteria = dbServiceCriteria[dbServiceCriteriaKey[m]]

                                            activeCriteria[parseInt(tempCriteria.criteria_id)] = {
                                                criteria: tempCriteria.criteria,
                                                deleted: tempCriteria.deleted
                                            }

                                            if (tempCriteria.deleted) { continue }

                                            tempServiceObj.criteria.push({
                                                criteria_id: tempCriteria.criteria_id,
                                                criteria: tempCriteria.criteria
                                            })


                                        }
                                    }

                                    // Check Original Service is deleted or not, Check Service active and not deleted in project
                                    if (!tempService.deleted && !tempProjectService.deleted && tempProjectService.active) {
                                        tempProjectObj.services.push(tempServiceObj)
                                    }
                                }
                            }
                        }

                        if (!query_scope.includes('service')) {
                            delete tempProjectObj.services
                        } else {
                            scope.push('service')
                        }

                    }

                    // Review
                    if (tempEmployeePermission.review && query_scope.includes('review')) {

                        scope.push('review')

                        if (tempProject.review) {
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
                                    createdBy: tempReview.createdBy,
                                    createdById: tempReview.createdById,
                                    lastModifiedOn: tempReview.lastModifiedOn,
                                    lastModifiedBy: tempReview.lastModifiedBy,
                                    lastModifiedById: tempReview.lastModifiedById,
                                }

                                if (tempReview.post) {
                                    var dbReviewPost = tempReview.post,
                                        dbReviewPostKey = Object.keys(dbReviewPost)

                                    tempReviewObj.post = []

                                    for (var m = 0; m < dbReviewPostKey.length; m++) {
                                        var tempReviewPost = dbReviewPost[dbReviewPostKey[m]]

                                        if (tempReviewPost.deleted) { continue }

                                        var tempPostObj = {
                                            post_key: dbReviewPostKey[m],
                                            description: tempReviewPost.description,
                                            createdOn: tempReviewPost.createdOn,
                                            createdBy: tempReviewPost.createdBy,
                                            createdById: tempReviewPost.createdById,
                                            lastModifiedOn: tempReviewPost.lastModifiedOn,
                                            lastModifiedBy: tempReviewPost.lastModifiedBy,
                                            lastModifiedById: tempReviewPost.lastModifiedById,
                                        }

                                        if (tempReviewPost.documents) {
                                            var dbReviewDocument = tempReviewPost.documents,
                                                dbReviewDocumentKey = Object.keys(dbReviewDocument)

                                            tempPostObj.documents = []

                                            for (var l = 0; l < dbReviewDocumentKey.length; l++) {
                                                var tempDocument = dbReviewDocument[dbReviewDocumentKey[l]]

                                                if (tempDocument.deleted) { continue }

                                                var tempReviewPostDocObj = {
                                                    document_id: dbReviewDocumentKey[l],
                                                    filename: tempDocument.filename,
                                                    createdOn: tempDocument.createdOn || tempReview.createdOn,
                                                    createdBy: tempDocument.createdBy || tempReview.createdBy,
                                                    createdById: tempDocument.createdById || tempReview.createdById,
                                                    lastModifiedOn: tempDocument.lastModifiedOn,
                                                    lastModifiedBy: tempDocument.lastModifiedBy,
                                                    lastModifiedById: tempDocument.lastModifiedById
                                                }

                                                tempPostObj.documents.push(tempReviewPostDocObj)
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
                    } else if (!tempEmployeePermission.review && query_scope.includes('review')) {
                        permissionDeny.push('review')
                    }

                    // Activity
                    if (tempEmployeePermission.activity && query_scope.includes('activity')) {

                        scope.push('activity')

                        if (tempProject.activity) {
                            var dbProjectActivity = tempProject.activity,
                                dbProjectActivityKey = Object.keys(dbProjectActivity)

                            tempProjectObj.activity = []

                            for (var k = 0; k < dbProjectActivityKey.length; k++) {
                                var tempProjectActivity = dbProjectActivity[dbProjectActivityKey[k]]

                                if (tempProjectActivity.deleted) { continue }

                                var tempObj = {
                                    activity_key: dbProjectActivityKey[k],
                                    createdOn: tempProjectActivity.createdOn,
                                    createdBy: tempProjectActivity.createdBy,
                                    createdById: tempProjectActivity.createdById,
                                    lastModifiedOn: tempProjectActivity.lastModifiedOn,
                                    lastModifiedBy: tempProjectActivity.lastModifiedBy,
                                    lastModifiedById: tempProjectActivity.lastModifiedById,
                                    description: tempProjectActivity.description,
                                    date: tempProjectActivity.date,
                                    service_id: tempProjectActivity.service_id,
                                    title: tempProjectActivity.title,
                                    type: tempProjectActivity.type
                                }



                                if (tempObj.type == 'SERVICE' && allServices[tempObj.service_id]) {

                                    tempObj.service_deleted = allServices[tempObj.service_id].deleted
                                    tempObj.service_name = allServices[tempObj.service_id].service_name

                                    if (tempProjectActivity.criteria) {
                                        var dbActivityCriteria = tempProjectActivity.criteria,
                                            dbActivityCriteriaKey = Object.keys(dbActivityCriteria)

                                        tempObj.criteria = []

                                        for (var l = 0; l < dbActivityCriteriaKey.length; l++) {
                                            var tempActivityCriteria = dbActivityCriteria[dbActivityCriteriaKey[l]];

                                            if (tempActivityCriteria.deleted || !activeCriteria[tempActivityCriteria.criteria_id]) { continue }

                                            var tempCriteriaObj = {
                                                criteria_id: tempActivityCriteria.criteria_id,
                                                criteria: activeCriteria[tempActivityCriteria.criteria_id].criteria,
                                                value: tempActivityCriteria.value,
                                                createdOn: tempActivityCriteria.createdOn,
                                                createdBy: tempActivityCriteria.createdBy,
                                                createdById: tempActivityCriteria.createdById,
                                                lastModifiedOn: tempActivityCriteria.lastModifiedOn,
                                                lastModifiedBy: tempActivityCriteria.lastModifiedBy,
                                                lastModifiedById: tempActivityCriteria.lastModifiedById,
                                                deleted: activeCriteria[tempActivityCriteria.criteria_id].deleted,
                                            }

                                            // Push Criteria to Temp. Object
                                            tempObj.criteria.push(tempCriteriaObj);
                                        }

                                        if (tempObj.criteria.length == 0) {
                                            delete tempObj.criteria
                                        }
                                    }
                                }

                                if (tempProjectActivity.documents) {
                                    var dbActivityDocuments = tempProjectActivity.documents,
                                        dbActivityDocumentsKey = Object.keys(dbActivityDocuments)

                                    tempObj.documents = []

                                    for (var l = 0; l < dbActivityDocumentsKey.length; l++) {
                                        var tempActivityDoc = dbActivityDocuments[dbActivityDocumentsKey[l]];

                                        if (tempActivityDoc.deleted) { continue }

                                        var tempDocObj = {
                                            document_id: dbActivityDocumentsKey[l],
                                            filename: tempActivityDoc.filename,
                                            createdOn: tempActivityDoc.createdOn,
                                            createdBy: tempActivityDoc.createdBy,
                                            createdById: tempActivityDoc.createdById,
                                            lastModifiedOn: tempActivityDoc.lastModifiedOn,
                                            lastModifiedBy: tempActivityDoc.lastModifiedBy,
                                            lastModifiedById: tempActivityDoc.lastModifiedById,
                                        }

                                        // Push to Temp Doc array
                                        tempObj.documents.push(tempDocObj)
                                    }

                                    if (tempObj.documents.length == 0) {
                                        delete tempObj.documents
                                    }
                                }

                                // Push to Object
                                tempProjectObj.activity.push(tempObj)
                            }

                            if (tempProjectObj.activity.length == 0) {
                                delete tempProjectObj.activity
                            }
                        }
                    } else if (!tempEmployeePermission.activity && query_scope.includes('activity')) {
                        permissionDeny.push('activity')
                    }

                    if (query_ProjectID == tempProjectObj.project_id) {
                        return response(res, 200, 'success', undefined, { scope: scope, project: tempProjectObj, permission_denied: permissionDeny, permissionAllowed: tempEmployeePermission }, 'E-3.1.1')
                    }
                }
            }
        }

        if (query_ProjectID) {
            return response(res, 404, 'notFound', 'Incorrect Project ID', undefined, 'E-3.1.2')
        }
        return response(res, 200, 'success', undefined, { projects: projectObject }, 'E-3.1.3')
    }

    return response(res, 200, 'success', '0 Projects Found', undefined, 'E-3.1.4')
})

// 3.2 Add Activity
clientProjectAPI.post('/activity/add', (req, res) => {

    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.2.1')
    }
    if (!req.body.type) {
        return response(res, 400, 'required', 'Type is required', undefined, 'E-3.2.2')
    }

    var projectID = String(req.body.project_id).trim(),
        type = String(req.body.type).trim().toUpperCase(),
        getKeyDB = getKeys(projectID)

    if (type != "SERVICE" && type != "ACTIVITY") {
        return response(res, 400, 'invalid', 'Invalid Type. Valid Activity Type: [Service, Activity]', undefined, 'E-3.2.3')
    }

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.2.4') }
    if (!getKeyDB.permission.activity) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.2.26')
    }

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
                return response(res, 403, 'forbidden', 'File size limit exceed. 15 MB/per file is maximum', undefined, 'E-3.2.5');
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
                    return response(res, 403, 'forbidden', 'Invalid File Type. JPG/JPEG/PNG/PDF are only valid file types.', undefined, 'E-3.2.6')

            }

            fileNameData.push(tempName)
            documents.push({
                filename: tempName,
                createdOn: String(new Date()),
                createdBy: 'EMPLOYEE',
                createdById: dbEmployeeAccount.employee_id
            })
        }
    }

    // Activity Type: Activity
    if (type == "ACTIVITY") {

        if (!req.body.title) {
            return response(res, 400, 'required', 'Title is required', undefined, 'E-3.2.7')
        }
        var title = String(req.body.title).trim(),
            pushData = {
                title: title,
                createdOn: String(new Date()),
                createdBy: 'EMPLOYEE',
                createdById: dbEmployeeAccount.employee_id,
                type: type
            }

        if (req.body.date) {
            if (new Date(req.body.date) == "Invalid Date" || new Date(req.body.date) > new Date()) {
                return response(res, 400, 'invalid', 'Date Time must not be greater than current time. Format: YYYY/MM/DD HH:MM:SS AM/PM. AM/PM is required for 12-Hour Timestamp', undefined, 'E-3.2.8')
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
                        return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'E-3.2.9')
                    }
                })
            }
        }
        return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/`).push(pushData).then(() => {
            return response(res, 200, 'success', 'Activity has been added successfully', undefined, 'E-3.2.10')
        })
    }

    // Activity Type: Service
    if (type == "SERVICE") {
        if (!req.body.service_id) {
            return response(res, 400, 'required', 'Service ID is required', undefined, 'E-3.2.11')
        }
        if (!req.body.criteria) {
            return response(res, 400, 'required', 'Criteria is required', undefined, 'E-3.2.12')
        }

        if (!dbAdminSnapshot.services) {
            return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'E-3.2.13')
        }
        if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service) {
            return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'E-3.2.14')
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
            }, 'E-3.2.15')
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
                                    return response(res, 400, 'invalid', 'Criteria Value must be integer and greater than 0', undefined, 'E-3.2.16');
                                }

                                if (!activeCriteria.includes(tempCriteria.criteria_id)) {
                                    return response(res, 403, 'forbidden', 'Invalid Criteria ID. Criteria ID does not exist in Service.', { invalid_criteria_id: tempCriteria.criteria_id }, 'E-3.2.17')
                                }

                                if (tempPushCriteria.includes(tempCriteria.criteria_id)) {
                                    return response(res, 400, 'invalid', 'Criteria ID must be unique', undefined, 'E-3.2.18')
                                }

                                pushCriteria.push({
                                    criteria_id: tempCriteria.criteria_id,
                                    value: parseInt(tempCriteria.value)
                                })
                                tempPushCriteria.push(tempCriteria.criteria_id)
                            } else {
                                return response(res, 403, 'forbidden', 'Criteria ID and Value both are required', undefined, 'E-3.2.19')
                            }
                        }

                        if (pushCriteria.length == 0) {
                            return response(res, 400, 'required', 'At least one criteria is required', undefined, 'E-3.2.20')
                        }
                        i = dbAdminServiceKeys.length;
                        break;
                    } else if (k == dbClientServiceKey.length - 1) {
                        return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'E-3.2.21')
                    }
                }
            } else if (i == dbAdminServiceKeys.length - 1) {
                return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'E-3.2.22')
            }
        }

        var pushData = {
            createdOn: String(new Date()),
            createdBy: 'EMPLOYEE',
            createdById: dbEmployeeAccount.employee_id,
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
                return response(res, 400, 'invalid', 'Date Time must not be greater than current time. Format: YYYY/MM/DD HH:MM:SS AM/PM. AM/PM is required for 12-Hour Timestamp', undefined, 'E-3.2.23')
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
                        return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'E-3.2.24')
                    }
                })
            }
        }

        return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/`).push(pushData).then(() => {
            return response(res, 200, 'success', 'Activity has been added successfully', undefined, 'E-3.2.25')
        })
    }

})

// 3.3 Update Activity
clientProjectAPI.post('/activity/update', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.3.1')
    }
    if (!req.body.activity_key) {
        return response(res, 400, 'required', 'Activity Key is required', undefined, 'E-3.3.2')
    }

    var projectID = String(req.body.project_id).trim(),
        getKeyDB = getKeys(projectID),
        activityKey = String(req.body.activity_key).trim()


    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.3.3') }
    if (!getKeyDB.permission.activity) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.3.4')
    }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'E-3.3.5')
    }

    var dbClientActivity = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity
    if (!dbClientActivity[activityKey] || dbClientActivity[activityKey].deleted) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'E-3.3.6')
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
                return response(res, 403, 'forbidden', 'File size limit exceed. 15 MB/per file is maximum', undefined, 'E-3.3.7');
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
                    return response(res, 403, 'forbidden', 'Invalid File Type. JPG/JPEG/PNG/PDF are only valid file types.', undefined, 'E-3.3.8')

            }

            fileNameData.push(tempName)
            documents.push({
                filename: tempName,
                createdOn: String(new Date()),
                createdBy: 'EMPLOYEE',
                createdById: dbEmployeeAccount.employee_id
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
                return response(res, 400, 'invalid', 'Date Time must not be greater than creation time. Format: YYYY/MM/DD HH:MM:SS AM/PM. AM/PM is required for 12-Hour Timestamp', undefined, 'E-3.3.9')
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
                        return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'E-3.3.10')
                    }
                })
            }
        }

        tempActivity.lastModifiedBy = 'EMPLOYEE'
        tempActivity.lastModifiedById = dbEmployeeAccount.employee_id
        tempActivity.lastModifiedOn = String(new Date())

        return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/${activityKey}`).update(tempActivity).then(() => {
            return response(res, 200, 'success', 'Activity has been updated successfully', undefined, 'E-3.3.11')
        })
    }

    // Update for type : SERVICE
    if (type == "SERVICE") {

        var serviceID = tempActivity.service_id

        if (!dbAdminSnapshot.services) {
            return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'E-3.3.12')
        }
        if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].service) {
            return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'E-3.3.13')
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
                }, 'E-3.3.14')
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
                                        return response(res, 400, 'invalid', 'Criteria Value must be integer and greater than 0', undefined, 'E-3.3.15');
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
                                                        tempClientCriteria.lastModifiedBy = 'EMPLOYEE'
                                                        tempClientCriteria.lastModifiedById = dbEmployeeAccount.employee_id
                                                    }
                                                    break;
                                                } else if (c == tempActivityCriteriaKey.length - 1 && !newPushCriteria.includes(tempCriteria.criteria_id)) {
                                                    // If already not exist
                                                    newCriteria.push({
                                                        criteria_id: tempCriteria.criteria_id,
                                                        value: parseInt(tempCriteria.value),
                                                        createdOn: String(new Date()),
                                                        createdBy: 'EMPLOYEE',
                                                        createdById: dbEmployeeAccount.employee_id
                                                    });

                                                    // For Checking, New Criteria Repeat or not
                                                    newPushCriteria.push(tempCriteria.criteria_id)
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    return response(res, 403, 'forbidden', 'Criteria ID and Value both are required', undefined, 'E-3.3.16')
                                }

                                if (l == bodyCriteriaKey.length - 1 && newCriteria.length != 0) {
                                    tempActivityCriteria.push.apply(tempActivityCriteria, newCriteria)
                                }
                            }
                            break;
                        } else if (k == dbClientServiceKey.length - 1) {
                            return response(res, 404, 'notfound', 'Service ID Incorrect. Service ID is not associated with the project', undefined, 'E-3.3.17')
                        }
                    }
                } else if (i == dbAdminServiceKeys.length - 1) {
                    return response(res, 404, 'notfound', 'Service ID Incorrect', undefined, 'E-3.3.18')
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
                return response(res, 400, 'invalid', 'Date Time must not be greater than creation time. Format: YYYY/MM/DD HH:MM:SS AM/PM. AM/PM is required for 12-Hour Timestamp', undefined, 'E-3.3.19')
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
                        return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'E-3.3.20')
                    }
                })
            }
        }

        tempActivity.lastModifiedOn = String(new Date())
        tempActivity.lastModifiedBy = 'EMPLOYEE'
        tempActivity.lastModifiedById = dbEmployeeAccount.employee_id

        return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/${activityKey}/`).update(tempActivity).then(() => {
            return response(res, 200, 'success', 'Activity has been updated successfully', undefined, 'E-3.3.21')
        })
    }
})

// 3.4 Remove File
clientProjectAPI.post('/activity/remove-file', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.4.1')
    }

    if (!req.body.activity_key) {
        return response(res, 400, 'required', 'Activity key is required', undefined, 'E-3.4.2')
    }

    if (!req.body.filename) {
        return response(res, 400, 'required', 'Filename is required', undefined, 'E-3.4.3')
    }

    var projectID = String(req.body.project_id).trim(),
        activityKey = String(req.body.activity_key).trim(),
        filename = String(req.body.filename).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.4.4') }
    if (!getKeyDB.permission.activity) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.4.5')
    }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'E-3.4.6')
    }

    var dbClientActivity = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity
    if (!dbClientActivity[activityKey] || dbClientActivity[activityKey].deleted) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'E-3.4.7')
    }

    if (!dbClientActivity[activityKey].documents) {
        return response(res, 404, 'notfound', 'Incorrect Filename', undefined, 'E-3.4.8')
    }

    var activityDocuments = dbClientActivity[activityKey].documents,
        activityDocumentsKeys = Object.keys(activityDocuments)

    for (var i = 0; i < activityDocumentsKeys.length; i++) {

        var tempDocument = activityDocuments[activityDocumentsKeys[i]]

        if (!tempDocument.deleted && tempDocument.filename == filename) {

            tempDocument.deleted = true
            tempDocument.lastModifiedBy = 'EMPLOYEE'
            tempDocument.lastModifiedById = dbEmployeeAccount.employee_id
            tempDocument.lastModifiedOn = String(new Date())
            unlinkFile(tempDocument.filename)
            return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/${activityKey}/documents/${activityDocumentsKeys[i]}/`).update(tempDocument).then(() => {
                return response(res, 200, 'success', 'File has been removed successfully', undefined, 'E-3.4.9')
            })

        } else if (i == activityDocumentsKeys.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect filename', undefined, 'E-3.4.10')
        }
    }

})

// 3.5 Remove Activity
clientProjectAPI.post('/activity/remove', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.5.1')
    }

    if (!req.body.activity_key) {
        return response(res, 400, 'required', 'Activity key is required', undefined, 'E-3.5.2')
    }
    var projectID = String(req.body.project_id).trim(),
        activityKey = String(req.body.activity_key).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.5.3') }
    if (!getKeyDB.permission.activity) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.5.4')
    }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'E-3.5.5')
    }

    var dbClientActivity = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity
    if (!dbClientActivity[activityKey] || dbClientActivity[activityKey].deleted) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'E-3.5.6')
    }

    var tempActivity = dbClientActivity[activityKey]

    if (tempActivity.documents) {
        var activityDocuments = tempActivity.documents,
            activityDocumentsKeys = Object.keys(activityDocuments)
        for (var i = 0; i < activityDocumentsKeys.length; i++) {

            var tempDocument = activityDocuments[activityDocumentsKeys[i]]

            if (!tempDocument.deleted) {

                tempDocument.deleted = true
                tempDocument.lastModifiedBy = 'EMPLOYEE'
                tempDocument.lastModifiedById = dbEmployeeAccount.employee_id
                tempDocument.lastModifiedOn = String(new Date())
                unlinkFile(tempDocument.filename);

            }
        }
    }

    tempDocument.lastModifiedBy = 'EMPLOYEE'
    tempDocument.lastModifiedById = dbEmployeeAccount.employee_id
    tempDocument.lastModifiedOn = String(new Date())
    tempActivity.deleted = true
    return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/${activityKey}/`).update(tempActivity).then(() => {
        return response(res, 200, 'success', 'Activity has been removed successfully', undefined, 'E-3.5.7')
    })

})

// 3.6 Create Review
clientProjectAPI.post('/review/create', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.6.1')
    }

    var projectID = req.body.project_id,
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.6.2') }
    if (!getKeyDB.permission.review) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.6.3')
    }

    if (!req.body.title) {
        return response(res, 400, 'required', 'Title is required', undefined, 'E-3.6.4')
    }

    var title = String(req.body.title).trim()

    pushData = {
        review_id: Math.floor(new Date().valueOf() * Math.random()),
        title: title,
        createdOn: String(new Date()),
        createdBy: 'EMPLOYEE',
        createdById: dbEmployeeAccount.employee_id
    }

    if (req.body.description) {
        pushData.description = String(req.body.description).trim()
    }

    return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review`).push(pushData).then(() => {
        return response(res, 200, 'success', 'Social Account Created', { review_id: pushData.review_id }, 'E-3.6.5')
    })
});

// 3.7 Review Update Post
clientProjectAPI.post('/review/update', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.7.1')
    }
    if (!req.body.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'E-3.7.2')
    }
    if (!req.body.title && !req.body.description) {
        return response(res, 400, 'required', 'Title or Description  is required', undefined, 'E-3.7.3')
    }
    var projectID = String(req.body.project_id).trim(),
        reviewID = String(req.body.review_id).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.7.4') }

    if (!getKeyDB.permission.review) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.7.5')
    }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect ', undefined, 'E-3.7.6')
    }
    var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKeys = Object.keys(dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review)
    for (var i = 0; i < reviewDBKeys.length; i++) {
        var tempReview = reviewDB[reviewDBKeys[i]]
        if (tempReview.review_id == reviewID && !tempReview.deleted) {

            if (tempReview.closed) {
                return response(res, 403, 'forbidden', 'Modification on Closed review are not allowed', undefined, 'E-3.7.7')
            }
            if (req.body.title) {
                var title = String(req.body.title).trim()
                if (title == "undefined" || title == null) {
                    return response(res, 400, 'required', 'Title is required ', undefined, 'E-3.7.8')
                }
                tempReview.title = title
            }
            if (req.body.description) {
                var description = String(req.body.description).trim()
                if (description == "undefined" || description == null) {
                    return response(res, 400, 'required', 'Description is required ', undefined, 'E-3.7.9')
                }
                tempReview.description = description
            }
            tempReview.lastModifiedBy = 'EMPLOYEE'
            tempReview.lastModifiedOn = String(new Date())
            tempReview.lastModifiedById = dbEmployeeAccount.employee_id
            return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKeys[i]}`).update(tempReview).then(() => {
                return response(res, 200, 'success', 'Review has been updated successfully', undefined, 'E-3.7.10')

            })
        } else if (i == reviewDBKeys.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'E-3.7.11')
        }
    }

})

// 3.8 Add Review Post
clientProjectAPI.post('/review/add-post', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.8.1')
    }
    if (!req.body.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'E-3.8.2')
    }
    if (!req.body.description && !req.files.file) {
        return response(res, 400, 'required', 'Description or filename is required', undefined, 'E-3.8.13')
    }
    var projectID = String(req.body.project_id).trim(),
        getKeyDB = getKeys(projectID),
        reviewID = String(req.body.review_id).trim(),
        pushData = {
            createdOn: String(new Date()),
            createdBy: 'EMPLOYEE',
            createdById: dbEmployeeAccount.employee_id
        }

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.8.3') }
    if (!getKeyDB.permission.review) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.8.4')
    }

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
                return response(res, 403, 'forbidden', 'File size limit exceed. 10 MB/per file is maximum', undefined, 'E-3.8.5');
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
                    return response(res, 403, 'forbidden', 'Invalid File Type. JPEG/PNG are only valid file types.', undefined, 'E-3.8.6')

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
                    return response(res, 403, 'forbidden', 'Addition or Modification on closed review is not allowed', undefined, 'E-3.8.7')
                }

                if (fileNameData && fileNameData.length == 1) {
                    var file = req.files.file,
                        tempName = String(fileNameData)
                    file.mv(directory + tempName, (error, abc) => {
                        if (error) {
                            return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'E-3.8.8')
                        }
                    })
                } else if (fileNameData && fileNameData.length > 1) {
                    var file = req.files.file
                    for (var i = 0; i < file.length; i++) {
                        var tempFile = file[i],
                            tempName = fileNameData[i]
                        tempFile.mv(directory + tempName, (error) => {
                            if (error) {
                                return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'E-3.8.9')
                            }
                        })
                    }
                }

                return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKey[j]}/post`).push(pushData).then(() => {
                    return response(res, 200, 'success', 'Social Account Created', undefined, 'E-3.8.10')
                })
            } else if (j == reviewDBKey.length - 1) {
                return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'E-3.8.11')
            }
        }
    } else {
        return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'E-3.8.12')
    }

})

// 3.9 Update Review Post
clientProjectAPI.post('/review/update-post', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.9.1')
    }
    if (!req.body.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'E-3.9.2')
    }
    if (!req.body.post_key) {
        return response(res, 400, 'required', 'Post key is required', undefined, 'E-3.9.3')
    }

    if (!req.files && !req.body.description) {
        return response(res, 400, 'required', 'Description or file is required', undefined, 'E-3.9.4')
    }
    var projectID = String(req.body.project_id).trim(),
        reviewID = String(req.body.review_id).trim(),
        postKey = String(req.body.post_key).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.9.5') }
    if (!getKeyDB.permission.review) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.9.6')
    }

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
                return response(res, 403, 'forbidden', 'File size limit exceed. 10 MB/per file is maximum', undefined, 'E-3.9.7');
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
                    return response(res, 403, 'forbidden', 'Invalid File Type. JPG/JPEG/PNG are only valid file types.', undefined, 'E-3.9.8')

            }

            fileNameData.push(tempName)
            documents.push({
                filename: tempName,
                createdOn: String(new Date()),
                createdBy: 'EMPLOYEE',
                createdById: dbEmployeeAccount.employee_id
            })
        }
    }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect ', undefined, 'E-3.9.9')
    }

    var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKeys = Object.keys(reviewDB)

    for (var i = 0; i < reviewDBKeys.length; i++) {
        var tempReview = reviewDB[reviewDBKeys[i]]

        if (tempReview.review_id == reviewID && !tempReview.deleted) {
            if (tempReview.closed) {
                return response(res, 403, 'forbidden', 'Modification on Closed review are not allowed', undefined, 'E-3.9.10')
            }
            if (tempReview.post && tempReview.post[postKey] && !tempReview.post[postKey].deleted) {

                var tempPost = tempReview.post[postKey]

                if (req.body.description) {
                    tempPost.description = String(req.body.description).trim()
                    tempPost.lastModifiedOn = String(new Date())
                    tempPost.lastModifiedBy = 'EMPLOYEE'
                    tempPost.lastModifiedById = dbEmployeeAccount.employee_id
                }

                // Append Documents
                if (tempPost.documents && documents && documents.length > 0) {
                    tempPost.documents.push.apply(tempPost.documents, documents)
                } else if (documents && documents.length > 0) {
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
                                return response(res, 500, 'internalError', 'The request failed due to an internal error. File Upload Error', undefined, 'E-3.9.11')
                            }
                        })
                    }
                }


                return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKeys[i]}/post/${postKey}/`).update(tempPost).then(() => {
                    return response(res, 200, 'success', 'Post has been updated successfully', undefined, 'E-3.9.12')
                })
            } else {
                return response(res, 404, 'notfound', 'Incorrect Post Key', undefined, 'E-3.9.13')
            }
        } else if (i == reviewDBKeys.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'E-3.9.14')
        }
    }
})

// 3.10 Remove Review Post
clientProjectAPI.get('/review/remove-post', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.10.1')
    }
    if (!req.query.review_id || !req.query.post_key) {
        return response(res, 400, 'required', 'Review ID and Post Key both are required', undefined, 'E-3.10.2')
    }

    var projectID = String(req.query.project_id).trim(),
        reviewID = String(req.query.review_id).trim(),
        postKey = String(req.query.post_key).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.10.3') }
    if (!getKeyDB.permission.review) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.10.4')
    }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect ', undefined, 'E-3.10.5')
    }
    var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKey = Object.keys(reviewDB),
        directory = storageDirectory() + `/clients/${getKeyDB.client_key}/reviews/`

    for (var j = 0; j < reviewDBKey.length; j++) {
        var tempReview = reviewDB[reviewDBKey[j]]
        if (tempReview.review_id == reviewID && !tempReview.deleted) {
            if (tempReview.closed) {
                return response(res, 403, 'forbidden', 'Modifications on closed reviews are not allowed', undefined, 'E-3.10.6')
            }
            if (tempReview.post) {
                var postDB = tempReview.post,
                    postDBKey = Object.keys(postDB)
                for (var i = 0; i < postDBKey.length; i++) {
                    if (postDBKey[i] == postKey) {
                        //removing Images
                        var tempReviewPost = postDB[postDBKey[i]]
                        if (tempReviewPost.deleted) {
                            return response(res, 403, 'forbidden', 'Post is already removed', undefined, 'E-3.10.7')
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
                        tempReviewPost.lastModifiedBy = 'EMPLOYEE'
                        tempReviewPost.lastModifiedOn = String(new Date())
                        tempReviewPost.lastModifiedById = dbEmployeeAccount.employee_id

                        return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKey[j]}/post/${postKey}`).update(tempReviewPost).then(() => {
                            return response(res, 200, 'success', 'Post from Review has been deleted successfully', undefined, 'E-3.10.8')
                        })
                    } else if (i == postDBKey.length - 1) {
                        return response(res, 404, 'notfound', 'Incorrect Post Key', undefined, 'E-3.10.9')
                    }
                }
            } else {
                return response(res, 404, 'notfound', 'Incorrect Post Key', undefined, 'E-3.10.10')
            }
        } else if (j == reviewDBKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'E-3.10.11')
        }
    }
})

// 3.11 Review Close
clientProjectAPI.get('/review/close', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.11.1')
    }
    if (!req.query.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'E-3.11.2')
    }
    var projectID = String(req.query.project_id).trim(),
        reviewID = String(req.query.review_id).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.11.3') }
    if (!getKeyDB.permission.review) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.11.4')
    }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect', undefined, 'E-3.11.5')
    }

    var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKey = Object.keys(reviewDB)

    for (var i = 0; i < reviewDBKey.length; i++) {

        if (reviewID == reviewDB[reviewDBKey[i]].review_id) {
            var tempReview = reviewDB[reviewDBKey[i]]

            if (tempReview.closed) {
                return response(res, 403, 'forbidden', 'Review is already closed', undefined, 'E-3.11.6')
            }

            tempReview.closed = true
            tempReview.lastModifiedBy = 'EMPLOYEE'
            tempReview.lastModifiedOn = String(new Date())
            tempReview.lastModifiedById = dbEmployeeAccount.employee_id

            return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKey[i]}/`).update(tempReview).then(() => {
                return response(res, 200, 'success', 'Review has been closed successfully', undefined, 'E-3.11.7')

            })
        } else if (i == reviewDBKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'E-3.11.8')
        }
    }
})

// 3.12 Review Reopen
clientProjectAPI.get('/review/open', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.12.1')
    }
    if (!req.query.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'E-3.12.2')
    }

    var projectID = String(req.query.project_id).trim(),
        reviewID = String(req.query.review_id).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.12.3') }
    if (!getKeyDB.permission.review) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.12.4')
    }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect', undefined, 'E-3.12.5')
    }

    var reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKeys = Object.keys(reviewDB)

    for (var i = 0; i < reviewDBKeys.length; i++) {
        var tempReview = reviewDB[reviewDBKeys[i]]

        if (tempReview.review_id == reviewID) {
            if (!tempReview.closed) {
                return response(res, 409, 'conflict', 'Review is already open', undefined, 'E-3.12.6')
            }

            delete tempReview.closed
            tempReview.lastModifiedOn = String(new Date())
            tempReview.lastModifiedBy = 'EMPLOYEE'
            tempReview.lastModifiedById = dbEmployeeAccount.employee_id

            return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKeys[i]}/`).set(tempReview).then(() => {
                return response(res, 200, 'success', 'Review is opened successfully', undefined, 'E-3.12.7')
            })
        } else if (i == reviewDBKeys.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'E-3.12.8')
        }
    }

})

// 3.13 Remove Review File
clientProjectAPI.get('/review/remove-file', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.13.1')
    }
    if (!req.query.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'E-3.13.2')
    }
    if (!req.query.filename) {
        return response(res, 400, 'required', 'File Name is required', undefined, 'E-3.13.3')
    }

    var projectID = String(req.query.project_id).trim(),
        reviewID = String(req.query.review_id).trim(),
        fileName = String(req.query.filename).trim(),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.13.4') }
    if (!getKeyDB.permission.review) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.13.5')
    }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Review ID Incorrect ', undefined, 'E-3.13.6')
    }

    var directory = storageDirectory() + `/clients/${getKeyDB.client_key}/reviews/`,
        reviewDB = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review,
        reviewDBKey = Object.keys(reviewDB)

    for (var j = 0; j < reviewDBKey.length; j++) {
        var tempReview = reviewDB[reviewDBKey[j]]

        if (tempReview.review_id == reviewID) {
            if (tempReview.closed) {
                return response(res, 403, 'forbidden', 'Modifications on closed reviews are not allowed', undefined, 'E-3.13.7')
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
                                tempImage.lastModifiedBy = 'EMPLOYEE'
                                tempImage.lastModifiedOn = String(new Date())
                                tempImage.lastModifiedById = dbEmployeeAccount.employee_id

                                return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${reviewDBKey[j]}/post/${postDBKey[i]}/documents/${documentsDBKeys[k]}/`).update(tempImage).then(() => {
                                    return response(res, 200, 'success', 'File has been deleted successfully', undefined, 'E-3.13.8')
                                })
                            }
                        }
                    } else if (i == postDBKey.length - 1) {
                        return response(res, 404, 'notfound', 'Incorrect File Name', undefined, 'E-3.13.9')
                    }
                }
            } else {
                return response(res, 404, 'notfound', 'Incorrect File Name', undefined, 'E-3.13.10')
            }
        } else if (j == reviewDBKey.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect Review ID or FileName', undefined, 'E-3.13.11')
        }
    }
})

// 3.14 Remove Review
clientProjectAPI.get('/review/remove', (req, res) => {
    if (!req.query.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'E-3.14.1')
    }

    if (!req.query.review_id) {
        return response(res, 400, 'required', 'Review ID is required', undefined, 'E-3.14.2')
    }

    var projectID = String(req.query.project_id).trim(),
        reviewID = parseInt(String(req.query.review_id).trim()),
        getKeyDB = getKeys(projectID)

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'E-3.14.3') }
    if (!getKeyDB.permission.review) {
        return response(res, 403, 'insufficientPermissions', 'Employee ID is restricted perform this action', undefined, 'E-3.14.7')
    }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].review) {
        return response(res, 404, 'notfound', 'Incorrect Review ID', undefined, 'E-3.14.4')
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
                            tempPostDocument.lastModifiedBy = 'EMPLOYEE'
                            tempPostDocument.lastModifiedById = dbEmployeeAccount.employee_id
                            unlinkFile(tempPostDocument.filename);
                        }
                    }
                }
            }

            tempClientReview.deleted = true
            tempClientReview.lastModifiedOn = String(new Date())
            tempClientReview.lastModifiedBy = 'EMPLOYEE'
            tempClientReview.lastModifiedById = dbEmployeeAccount.employee_id

            return firebase.ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/review/${dbClientReviewKey[i]}/`).set(tempClientReview).then(() => {
                return response(res, 200, 'success', 'Review has been removed successfully', undefined, 'E-3.14.5')
            })
        } else if (i == dbClientReviewKey.length - 1) {
            return response(res, 404, 'notFound', 'Incorrect Review ID', undefined, 'E-3.14.6')
        }
    }
})

module.exports = clientProjectAPI;

// Function
function getKeys(project_id) {
    if (!dbAdminSnapshot.clients) {
        return false
    }

    if (!project_id) {
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

                    if (tempPlan.team) {
                        var dbTeam = tempPlan.team,
                            dbTeamKey = Object.keys(dbTeam)

                        for (var t = 0; t < dbTeamKey.length; t++) {
                            var tempTeam = dbTeam[dbTeamKey[t]];
                            if (!tempTeam.deleted && tempTeam.employee_id == dbEmployeeAccount.employee_id && tempTeam.active) {
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