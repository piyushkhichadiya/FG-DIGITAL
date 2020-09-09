const clientProjectAPI = require('express').Router(),
    firebase = require('firebase-admin'),
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

//------------------------------- 3. Employee Profile ---------------------------

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
                createdBy: 'ADMIN'
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
                createdBy: "Employee",
                createdById: dbEmployeeAccount.employee_id,
                type: type
            }

        if (req.body.date) {
            if (new Date(req.body.date) == "Invalid Date" || new Date(req.body.date) < new Date()) {
                return response(res, 400, 'invalid', 'Invalid Date.Date Time must be greater than current time. Format: YYYY/MM/DD HH:MM:SS AM/PM. AM/PM is optional for 12-Hour', undefined, 'E-3.2.8')
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
        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/`).push(pushData).then(() => {
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
            createdBy: "Employee",
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
            if (date == "Invalid Date" || date < new Date()) {
                return response(res, 400, 'invalid', 'Invalid Date. Date Time must be greater than current time. Format: YYYY/MM/DD HH:MM:SS AM/PM. AM/PM is optional for 12-Hour', undefined, 'E-3.2.23')
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

        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/`).push(pushData).then(() => {
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

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'E-3.3.4')
    }

    var dbClientActivity = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity
    if (!dbClientActivity[activityKey] || dbClientActivity[activityKey].deleted) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'E-3.3.5')
    }

    var tempActivity = dbClientActivity[activityKey],
        type = tempActivity.type,
        employeeID = dbEmployeeAccount.employee_id

    if (tempActivity.createdById != employeeID) {
        return response(res, 403, 'Forbidden', 'Employee cannot modify this activity', undefined, 'E-3.3.6')
    }
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
            if (new Date(req.body.date) == "Invalid Date" || new Date(req.body.date) < new Date()) {
                return response(res, 400, 'invalid', 'Invalid Date.Date Time must be greater than current time. Format: YYYY/MM/DD HH:MM:SS AM/PM. AM/PM is optional for 12-Hour', undefined, 'E-3.3.9')
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

        tempActivity.lastModifiedBy = "Employee"
        tempActivity.lastModifiedById = employeeID
        tempActivity.lastModifiedOn = String(new Date())

        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/${activityKey}`).update(tempActivity).then(() => {
            return response(res, 200, 'success', 'Activity has been added successfully', undefined, 'E-3.3.11')
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
                                                        tempClientCriteria.lastModifiedBy = 'Employee'
                                                        tempClientCriteria.lastModifiedById = employeeID
                                                    }
                                                    break;
                                                } else if (c == tempActivityCriteriaKey.length - 1 && !newPushCriteria.includes(tempCriteria.criteria_id)) {
                                                    // If already not exist
                                                    newCriteria.push({
                                                        criteria_id: tempCriteria.criteria_id,
                                                        value: parseInt(tempCriteria.value),
                                                        createdOn: String(new Date()),
                                                        createdBy: 'Employee',
                                                        createdById: employeeID
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
            if (date == "Invalid Date" || date < new Date()) {
                return response(res, 400, 'invalid', 'Invalid Date. Date Time must be greater than current time. Format: YYYY/MM/DD HH:MM:SS AM/PM. AM/PM is optional for 12-Hour', undefined, 'E-3.3.19')
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
        tempActivity.lastModifiedBy = "Employee"
        tempActivity.lastModifiedById = employeeID

        return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/${activityKey}/`).update(tempActivity).then(() => {
            return response(res, 200, 'success', 'Activity has been updated successfully', undefined, 'E-3.3.21')
        })
    }
})

// 3.4 Remove File
clientProjectAPI.post('/activity/remove-file', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-3.4.1')
    }

    if (!req.body.activity_key) {
        return response(res, 400, 'required', 'Activity key is required', undefined, 'A-3.4.2')
    }

    if (!req.body.filename) {
        return response(res, 400, 'required', 'Filename is required', undefined, 'A-3.4.3')
    }

    var projectID = String(req.body.project_id).trim(),
        activityKey = String(req.body.activity_key).trim(),
        filename = String(req.body.filename).trim(),
        getKeyDB = getKeys(projectID),
        employeeID = dbEmployeeAccount.employee_id

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-3.4.4') }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'A-3.4.5')
    }

    var dbClientActivity = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity
    if (!dbClientActivity[activityKey] || dbClientActivity[activityKey].deleted) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'A-3.4.6')
    }

    if (!dbClientActivity[activityKey].documents) {
        return response(res, 404, 'notfound', 'Incorrect Filename', undefined, 'A-3.4.7')
    }
    if (dbClientActivity[activityKey].createdById != employeeID) {
        return response(res, 403, 'Forbidden', 'Employee cannot remove this file', undefined, 'E-3.4.8')
    }

    var activityDocuments = dbClientActivity[activityKey].documents,
        activityDocumentsKeys = Object.keys(activityDocuments)

    for (var i = 0; i < activityDocumentsKeys.length; i++) {

        var tempDocument = activityDocuments[activityDocumentsKeys[i]]

        if (!tempDocument.deleted && tempDocument.filename == filename) {

            tempDocument.deleted = true
            tempDocument.lastModifiedBy = "Employee"
            tempDocument.lastModifiedById = employeeID
            tempDocument.lastModifiedOn = String(new Date())
            unlinkFile(tempDocument.filename)
            return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/${activityKey}/documents/${activityDocumentsKeys[i]}/`).update(tempDocument).then(() => {
                return response(res, 200, 'success', 'File has been removed successfully', undefined, 'A-3.4.9')
            })

        } else if (i == activityDocumentsKeys.length - 1) {
            return response(res, 404, 'notfound', 'Incorrect filename', undefined, 'A-3.4.10')
        }
    }

})

// 3.5 Remove Activity
clientProjectAPI.post('/activity/remove', (req, res) => {
    if (!req.body.project_id) {
        return response(res, 400, 'required', 'Project ID is required', undefined, 'A-3.5.1')
    }

    if (!req.body.activity_key) {
        return response(res, 400, 'required', 'Activity key is required', undefined, 'A-3.5.2')
    }
    var projectID = String(req.body.project_id).trim(),
        activityKey = String(req.body.activity_key).trim(),
        getKeyDB = getKeys(projectID),
        employeeID = dbEmployeeAccount.employee_id

    if (!getKeyDB) { return response(res, 404, 'notfound', 'Incorrect Project ID', undefined, 'A-3.5.4') }

    if (!dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'A-3.5.5')
    }

    var dbClientActivity = dbAdminSnapshot.clients[getKeyDB.client_key].plans[getKeyDB.plan_key].activity
    if (!dbClientActivity[activityKey] || dbClientActivity[activityKey].deleted) {
        return response(res, 404, 'notfound', 'Incorrect Activity Key', undefined, 'A-3.5.6')
    }

    var tempActivity = dbClientActivity[activityKey]
    if (tempActivity.createdById != employeeID) {
        return response(res, 403, 'Forbidden', 'Employee cannot remove this file', undefined, 'E-3.5.7')
    }

    if (tempActivity.documents) {
        var activityDocuments = tempActivity.documents,
            activityDocumentsKeys = Object.keys(activityDocuments)
        for (var i = 0; i < activityDocumentsKeys.length; i++) {

            var tempDocument = activityDocuments[activityDocumentsKeys[i]]

            if (!tempDocument.deleted) {

                tempDocument.deleted = true
                tempDocument.lastModifiedBy = "Employee"
                tempDocument.lastModifiedById = employeeID
                tempDocument.lastModifiedOn = String(new Date())
                unlinkFile(tempDocument.filename);

            } else if (i == activityDocumentsKeys.length - 1) {
                break;
            }
        }
    }

    tempDocument.lastModifiedBy = "Employee"
    tempDocument.lastModifiedById = employeeID
    tempDocument.lastModifiedOn = String(new Date())
    tempActivity.deleted = true
    return firebase.database().ref(`/admin/clients/${getKeyDB.client_key}/plans/${getKeyDB.plan_key}/activity/${activityKey}/`).update(tempActivity).then(() => {
        return response(res, 200, 'success', 'File has been removed successfully', undefined, 'A-3.5.8')
    })

})

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
                    //Check Employee
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
module.exports = clientProjectAPI;
// APIs
/**
 * 3.2 Add Activity
 * 3.3 Update Activity
 * 3.4 Remove File
 * 3.5 Remove Activity
 */