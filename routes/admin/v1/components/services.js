const servicesAPI = require('express').Router(),
    firebase = require('firebase-admin').database(),
    { response } = require('../../../../functions/functions')


//----------------------------- CONFIGURATION ------------------------------

//---------------------------- GLOBAL VARIABLE -----------------------------
var dbAdminSnapshot, adminAuthToken;
servicesAPI.use((req, res, next) => {
    dbAdminSnapshot = req.session.dbAdminSnapshot
    adminAuthToken = req.session.decode_adminAuthToken
    next();
});

//--------------------------------- ROUTES ---------------------------------

//------------------------------- 7. SERVICES -------------------------------

// 7.1 ADD SERVICE
servicesAPI.post('/create', (req, res) => {
    if (req.body.title) {
        var title = String(req.body.title).trim()
    } else {
        return response(res, 400, 'required', 'Title is required', undefined, 'A-7.1.1')
    }

    var pushObject = {
        service_id: Math.floor(new Date().valueOf() * Math.random()),
        title: title,
        createdOn: String(new Date()),
        createdBy: 'ADMIN'
    }

    return firebase.ref('/admin/services').push(pushObject).then(() => {
        return response(res, 200, 'success', 'Service created successfully', { service_id: pushObject.service_id }, 'A-7.1.2')
    })
})

// 7.2 GET SERVICE
servicesAPI.get(['/', '/get'], (req, res) => {
    if (!dbAdminSnapshot.services) {
        if (req.query.service_id) {
            return response(res, 404, 'notFound', 'Incorrect Service ID', undefined, 'A-7.2.1')
        }
        return response(res, 200, 'success', undefined, undefined, 'A-7.2.2');
    }

    var dbServices = dbAdminSnapshot.services,
        dbServicesKey = Object.keys(dbServices),
        postServices = []

    for (var i = 0; i < dbServicesKey.length; i++) {
        var tempService = dbServices[dbServicesKey[i]],
            tempObj = {}

        if (tempService.deleted) {
            continue;
        }

        // Data
        tempObj = {
            service_id: tempService.service_id,
            title: tempService.title,
            createdOn: tempService.createdOn,
            createdBy: tempService.createdBy,
            lastModifiedOn: tempService.lastModifiedOn,
            lastModifiedBy: tempService.lastModifiedBy
        }

        if (tempService.criteria) {
            var dbCriteria = tempService.criteria,
                dbCriteriaKey = Object.keys(dbCriteria),
                postCriteria = []

            for (var j = 0; j < dbCriteriaKey.length; j++) {
                var tempCriteria = dbCriteria[dbCriteriaKey[j]]

                if (tempCriteria.deleted) {
                    continue;
                }

                var tempCriteriaObj = {
                    criteria_id: tempCriteria.criteria_id,
                    criteria: tempCriteria.criteria,
                    createdOn: tempCriteria.createdOn,
                    createdBy: tempCriteria.createdBy,
                    lastModifiedOn: tempCriteria.lastModifiedOn,
                    lastModifiedBy: tempCriteria.lastModifiedBy
                }

                postCriteria.push(tempCriteriaObj)
            }
            if (postCriteria.length > 0) {
                tempObj.criteria = postCriteria
            }
        }

        // Filter & Push to Object
        if (req.query.service_id) {
            if (req.query.service_id == tempObj.service_id) {
                return response(res, 200, 'success', undefined, tempObj, 'A-7.2.3')
            }
        } else {
            postServices.push(tempObj)
        }
    }
    if (req.query.service_id) {
        return response(res, 404, 'notFound', 'Incorrect Service ID', undefined, 'A-7.2.4')
    } else {
        return response(res, 200, 'success', undefined, postServices, 'A-7.2.5');
    }
})

// 7.3 UPDATE SERVICE
servicesAPI.post('/update', (req, res) => {
    if (req.body.service_id) {
        var service_id = String(req.body.service_id)
    } else {
        return response(res, 400, 'required', 'Service ID is required', undefined, 'A-7.3.1')
    }

    if (req.body.title) {
        var title = String(req.body.title).trim()
    } else {
        return response(res, 400, 'required', 'Title is required', undefined, 'A-7.3.2')
    }

    if (!dbAdminSnapshot.services) {
        return response(res, 404, 'notFound', 'Incorrect Service ID', undefined, 'A-7.3.3');
    }

    var dbServices = dbAdminSnapshot.services,
        dbServicesKey = Object.keys(dbServices)

    for (var i = 0; i < dbServicesKey.length; i++) {
        var tempService = dbServices[dbServicesKey[i]]

        if (tempService.deleted || tempService.service_id != service_id) {
            continue;
        }

        if (tempService.title == title) {
            return response(res, 403, 'forbidden', 'Nothing to be modify', undefined, 'A-7.3.4')
        }

        tempService.title = title
        tempService.lastModifiedOn = String(new Date())
        tempService.lastModifiedBy = 'ADMIN'

        return firebase.ref(`/admin/services/${dbServicesKey[i]}`).update(tempService).then(() => {
            return response(res, 200, 'success', 'Service updated successfully', undefined, 'A-7.3.5')
        })
    }
    return response(res, 400, 'notFound', 'Incorrect Service ID', undefined, 'A-7.3.6')
})

// 7.4 REMOVE SERVICE
servicesAPI.get('/remove', (req, res) => {
    if (req.query.service_id) {
        var service_id = String(req.query.service_id)
    } else {
        return response(res, 400, 'required', 'Service ID is required', undefined, 'A-7.4.1')
    }

    if (!dbAdminSnapshot.services) {
        return response(res, 404, 'notFound', 'Incorrect Service ID', undefined, 'A-7.4.2');
    }

    var dbServices = dbAdminSnapshot.services,
        dbServicesKey = Object.keys(dbServices)

    for (var i = 0; i < dbServicesKey.length; i++) {
        var tempService = dbServices[dbServicesKey[i]]

        if (tempService.deleted || tempService.service_id != service_id) {
            continue;
        }

        tempService.deleted = true
        tempService.lastModifiedOn = String(new Date())
        tempService.lastModifiedBy = 'ADMIN'

        return firebase.ref(`/admin/services/${dbServicesKey[i]}`).update(tempService).then(() => {
            return response(res, 200, 'success', 'Service removed successfully', undefined, 'A-7.4.3')
        })
    }
    return response(res, 400, 'notFound', 'Incorrect Service ID', undefined, 'A-7.4.4')
})

// 7.5 ADD SERVICE CRITERIA
servicesAPI.post('/criteria/add', (req, res) => {
    if (req.body.service_id) {
        var service_id = String(req.body.service_id)
    } else {
        return response(res, 400, 'required', 'Service ID is required', undefined, 'A-7.5.1')
    }

    if (req.body.criteria) {
        var criteria = String(req.body.criteria).trim()
    } else {
        return response(res, 400, 'required', 'Criteria is required', undefined, 'A-7.5.2')
    }

    if (!dbAdminSnapshot.services) {
        return response(res, 404, 'notFound', 'Incorrect Service ID', undefined, 'A-7.5.3');
    }

    var dbServices = dbAdminSnapshot.services,
        dbServicesKey = Object.keys(dbServices)

    for (var i = 0; i < dbServicesKey.length; i++) {
        var tempService = dbServices[dbServicesKey[i]]

        if (tempService.deleted || tempService.service_id != service_id) {
            continue;
        }

        var pushObject = {
            criteria_id: Math.floor(new Date().valueOf() * Math.random()),
            criteria: criteria,
            createdOn: String(new Date()),
            createdBy: 'ADMIN'
        }

        return firebase.ref(`/admin/services/${dbServicesKey[i]}/criteria`).push(pushObject).then(() => {
            return response(res, 200, 'success', 'Criteria added successfully to service', { criteria_id: pushObject.criteria_id }, 'A-7.5.4')
        })
    }
    return response(res, 400, 'notFound', 'Incorrect Service ID', undefined, 'A-7.5.5')

})

// 7.6 UPDATE SERVICE CRITERIA
servicesAPI.post('/criteria/update', (req, res) => {
    if (req.body.service_id) {
        var service_id = String(req.body.service_id)
    } else {
        return response(res, 400, 'required', 'Service ID is required', undefined, 'A-7.6.1')
    }

    if (req.body.criteria_id) {
        var criteria_id = String(req.body.criteria_id)
    } else {
        return response(res, 400, 'required', 'Criteria ID is required', undefined, 'A-7.6.2')
    }

    if (req.body.criteria) {
        var criteria = String(req.body.criteria).trim()
    } else {
        return response(res, 400, 'required', 'Criteria is required', undefined, 'A-7.6.3')
    }

    if (!dbAdminSnapshot.services) {
        return response(res, 404, 'notFound', 'Incorrect Service ID', undefined, 'A-7.6.4');
    }

    var dbServices = dbAdminSnapshot.services,
        dbServicesKey = Object.keys(dbServices)

    for (var i = 0; i < dbServicesKey.length; i++) {
        var tempService = dbServices[dbServicesKey[i]]

        if (tempService.deleted || tempService.service_id != service_id) {
            continue;
        }

        if (!tempService.criteria) {
            return response(res, 400, 'notFound', 'Incorrect Criteria ID', undefined, 'A-7.6.5')
        }

        var dbCriteria = tempService.criteria,
            dbCriteriaKey = Object.keys(dbCriteria)

        for (var j = 0; j < dbCriteriaKey.length; j++) {
            var tempCriteria = dbCriteria[dbCriteriaKey[j]]

            if (tempCriteria.deleted || tempCriteria.criteria_id != criteria_id) {
                continue;
            }

            tempCriteria.criteria = criteria
            tempCriteria.lastModifiedOn = String(new Date())
            tempCriteria.lastModifiedBy = 'ADMIN'

            return firebase.ref(`/admin/services/${dbServicesKey[i]}/criteria/${dbCriteriaKey[j]}`).update(tempCriteria).then(() => {
                return response(res, 200, 'success', 'Service criteria updated successfully', undefined, 'A-7.6.6')
            })
        }
        return response(res, 400, 'notFound', 'Incorrect Criteria ID', undefined, 'A-7.6.7')
    }
    return response(res, 400, 'notFound', 'Incorrect Service ID', undefined, 'A-7.6.8')

})

// 7.7 REMOVE SERVICE CRITERIA
servicesAPI.get('/criteria/remove', (req, res) => {
    if (req.query.service_id) {
        var service_id = String(req.query.service_id)
    } else {
        return response(res, 400, 'required', 'Service ID is required', undefined, 'A-7.7.1')
    }

    if (req.query.criteria_id) {
        var criteria_id = String(req.query.criteria_id)
    } else {
        return response(res, 400, 'required', 'Criteria ID is required', undefined, 'A-7.7.2')
    }

    if (!dbAdminSnapshot.services) {
        return response(res, 404, 'notFound', 'Incorrect Service ID', undefined, 'A-7.7.3');
    }

    var dbServices = dbAdminSnapshot.services,
        dbServicesKey = Object.keys(dbServices)

    for (var i = 0; i < dbServicesKey.length; i++) {
        var tempService = dbServices[dbServicesKey[i]]

        if (tempService.deleted || tempService.service_id != service_id) {
            continue;
        }

        if (!tempService.criteria) {
            return response(res, 400, 'notFound', 'Incorrect Criteria ID', undefined, 'A-7.7.4')
        }

        var dbCriteria = tempService.criteria,
            dbCriteriaKey = Object.keys(dbCriteria)

        for (var j = 0; j < dbCriteriaKey.length; j++) {
            var tempCriteria = dbCriteria[dbCriteriaKey[j]]

            if (tempCriteria.deleted || tempCriteria.criteria_id != criteria_id) {
                continue;
            }

            tempCriteria.deleted = true
            tempCriteria.lastModifiedOn = String(new Date())
            tempCriteria.lastModifiedBy = 'ADMIN'

            return firebase.ref(`/admin/services/${dbServicesKey[i]}/criteria/${dbCriteriaKey[j]}`).update(tempCriteria).then(() => {
                return response(res, 200, 'success', 'Service criteria removed successfully', undefined, 'A-7.7.5')
            })
        }
        return response(res, 400, 'notFound', 'Incorrect Criteria ID', undefined, 'A-7.7.6')
    }
    return response(res, 400, 'notFound', 'Incorrect Service ID', undefined, 'A-7.7.7')
})

module.exports = servicesAPI;
/**
 * error code
 */