const clientAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    { response, bcryptHash } = require('../../../../functions/functions'),
    regex = require('../../../../functions/regex')


//----------------------------- CONFIGURATION ------------------------------

//---------------------------- GLOBAL VARIABLE -----------------------------
var dbAdminSnapshot, adminAuthToken;
clientAPI.use((req, res, next) => {
    dbAdminSnapshot = req.session.dbAdminSnapshot
    adminAuthToken = req.session.decode_adminAuthToken
    next();
});
//--------------------------------- ROUTES ---------------------------------

//------------------------------- 4. CLIENT -------------------------------

// 4.1 CREATE CLIENT ID
clientAPI.post('/create', async(req, res) => {
    if (!req.body.name || !req.body.email || !req.body.password) {
        return response(res, 400, 'required', 'Name, Email and Password are required', undefined, 'A-4.1.1')
    }
    var name = String(req.body.name).trim(),
        email = String(req.body.email).trim().toLowerCase(),
        password = String(req.body.password),
        authToken = (Math.floor(Math.random() * (99999 - 11111) + 11111))


    password = await bcryptHash(password)
    if (!regex.email(email)) {
        return response(res, 400, 'invalid', 'Invalid Email', undefined, 'A-4.1.2')
    }

    var pushData = {
        name: name,
        email: email,
        password: bcryptHash(password),
        createdOn: String(new Date()),
        createdBy: "ADMIN",
        authToken: authToken
    }
    if (dbAdminSnapshot.clients) {
        var clientDB = dbAdminSnapshot.clients,
            clientKey = Object.keys(clientDB)
        for (var i = 0; i < clientKey.length; i++) {
            if (clientDB[clientKey[i]].email == email) {
                return response(res, 403, 'forbidden', 'Client With This Email Is Already Exist', undefined, 'A-4.1.3')
            } else if (i == clientKey.length - 1) {
                firebase.database().ref('/admin/clients/').push(pushData)
                return response(res, 200, 'success', 'User created successfully', undefined, 'A-4.1.4')
            }
        }

    }
    firebase.database().ref('/admin/clients/').push(pushData).then(() => {
        return response(res, 200, 'success', 'User created successfully', undefined, 'A-4.1.5')

    })
});

// 4.2 Profile Update
clientAPI.post('/update', (req, res) => {

    if (req.body.client_id) {
        var clientID = String(req.body.client_id)
    } else {
        return response(res, 400, 'required', 'Client ID is required', undefined, 'A-4.2.1')
    }

    if (dbAdminSnapshot.clients && dbAdminSnapshot.clients[clientID] && !dbAdminSnapshot.clients[clientID].deleted) {
        var clientDB = dbAdminSnapshot.clients[clientID]

        if (req.body.name) {
            var name = String(req.body.name).trim()
            clientDB.name = name
        }

        if (req.body.email) {
            var email = String(req.body.email).trim().toLowerCase(),
                clientKey = Object.keys(dbAdminSnapshot.clients)
            for (var i = 0; i < clientKey.length; i++) {
                if (dbAdminSnapshot.clients[clientKey[i]].email == email && clientKey[i] != clientID) {
                    return response(res, 409, 'duplicate', 'Client With This Email Is Already Exist', undefined, 'A-4.2.2')
                } else if (i == clientKey.length - 1) {
                    clientDB.email = email
                }
            }
        }

        clientDB.lastModifiedOn = String(new Date())
        clientDB.lastModifiedBy = "ADMIN"
        firebase.database().ref(`/admin/clients/${clientID}`).update(clientDB).then(() => {
            return response(res, 200, 'success', 'Profile Updated Successfully', undefined, 'A-4.2.3')
        })
    } else {
        return response(res, 404, 'notFound', 'Incorrect Client ID', undefined, 'A-4.2.4')
    }

});

// 4.3 DELETE CLIENT
clientAPI.get('/remove', (req, res) => {
    if (req.query.client_id) {
        var clientID = String(req.query.client_id)
    } else {
        return response(res, 400, 'required', 'Client ID is required', undefined, 'A-4.3.1')
    }

    if (dbAdminSnapshot.clients && dbAdminSnapshot.clients[clientID] && !dbAdminSnapshot.clients[clientID].deleted) {
        var tempClient = dbAdminSnapshot.clients[clientID]

        tempClient.deleted = true
        tempClient.lastModifiedOn = String(new Date())
        tempClient.lastModifiedBy = "ADMIN"

        firebase.database().ref(`/admin/clients/${clientID}/`).update(tempClient).then(() => {
            return response(res, 200, 'success', 'Profile Updated Successfully', undefined, 'A-4.3.2')
        })
    } else {
        return response(res, 404, 'notFound', 'Incorrect Client ID. Client not found', undefined)
    }
});

// 4.4 ADD PLAN
clientAPI.post('/plan/add', (req, res) => {
    if (!dbAdminSnapshot.clients) {
        return response(res, 404, 'notFound', 'Incorrect Client ID', undefined, 'A-4.4.1')
    }
    var pushData = {},
        clientDB = dbAdminSnapshot.clients,
        clientKey = Object.keys(clientDB),
        plan_id = Math.floor(new Date().valueOf() * Math.random())
    if (!req.body.plan || !req.body.start_date || !req.body.duration || !req.body.clientID) {
        return response(res, 400, 'invalid', 'Input Data properly', undefined, 'A-4.4.2')
    }
    var clientID = String(req.body.clientID).trim()
    if (!clientKey.includes(clientID)) {
        return response(res, 400, 'invalid', 'invalid Client Key', undefined, 'A-4.4.3')
    }
    var plan = String(req.body.plan),
        startDate = String(req.body.start_date),
        duration = String(req.body.duration)
    if (String(new Date(startDate)) == "Invalid Date") {
        return response(res, 400, 'invalid', 'Invalid Date', undefined, 'A-4.4.4')
    }
    if (req.body.price) {
        var price = String(req.body.price)
        if (isNaN(price)) {
            return response(res, 400, 'invalid', 'Price Value invalid', undefined, 'A-4.4.5')
        }
        pushData = {
            price: price
        }
    }
    if (isNaN(duration)) {
        return response(res, 400, 'invalid', 'Duration Value invalid', undefined, 'A-4.4.6')
    }
    pushData = {
        start_date: startDate,
        plan: plan,
        duration: duration,
        createdBy: "ADMIN",
        createdOn: String(new Date()),
        project_id: plan_id
    }
    firebase.database().ref(`/admin/clients/${clientID}/plans/`).push(pushData).then(() => {
        return response(res, 200, 'success', 'Profile Updated Successfully', undefined, 'A-4.4.7')
    })
});

// 4.5 UPDATE PLAN
clientAPI.post('/plan/update', (req, res) => {
    if (!dbAdminSnapshot.clients) {
        return response(res, 404, 'notFound', 'Not Found Client', undefined, 'A-4.5.1')
    }
    var clientDB = dbAdminSnapshot.clients,
        clientKey = Object.keys(clientDB),
        clientID = String(req.body.clientID),
        pushData = {}
    if (!req.body.clientID || !clientKey.includes(clientID)) {
        return response(res, 400, 'invalid', 'invalid Client Key', undefined, 'A-4.5.2')
    }
    var planDB = clientDB[clientID].plans,
        planKey = Object.keys(planDB),
        planID = String(req.body.planID)
    if (!req.body.planID || !planKey.includes(planID)) {
        return response(res, 400, 'invalid', 'invalid Plan Key', undefined, 'A-4.5.3')
    }
    if (req.body.plan) {
        var plan = String(req.body.plan)
        pushData.plan = plan
    }
    if (req.body.start_date) {
        if (String(new Date(req.body.start_date)) == "Invalid Date") {
            return response(res, 400, 'invalid', 'Invalid Date', undefined, 'A-4.5.5')
        }
        var startDate = String(req.body.start_date)
        pushData.start_date = startDate
    }
    if (req.body.duration) {
        var duration = String(req.body.duration)
        if (isNaN(duration)) {
            return response(res, 400, 'invalid', 'Duration Value invalid', undefined, 'A-4.5.4')
        }
        pushData.duration = duration
    }
    if (req.body.price) {
        var price = String(req.body.price)
        if (isNaN(price)) {
            return response(res, 400, 'invalid', 'Price Value invalid', undefined, 'A-4.5.6')
        }
        pushData.price = price
    }

    if (!clientDB[clientID].plans[planID].deleted) {
        pushData.lastModifiedOn = String(new Date())
        pushData.lastModifiedBy = "ADMIN"
        firebase.database().ref(`/admin/clients/${clientID}/plans/${planID}/`).update(pushData).then(() => {
            return response(res, 200, 'success', 'Plan Successfully Updated', undefined, 'A-4.5.7')
        })
    } else {
        return response(res, 403, 'forbidden', 'Plan Is Deleted Or Not Available', undefined, 'A-4.5.8')
    }
});

// 4.6 DELETE PLAN
clientAPI.post('/plan/remove', (req, res) => {
    if (!dbAdminSnapshot.clients) {
        return response(res, 404, 'notFound', 'Not Found Client', undefined, 'A-4.6.1')
    }
    var clientDB = dbAdminSnapshot.clients,
        clientKey = Object.keys(clientDB),
        clientID = String(req.body.clientID),
        pushData = {
            deleted: true,
            lastModifiedOn: String(new Date()),
            lastModifiedBy: "ADMIN"
        }
    if (!req.body.clientID || !clientKey.includes(clientID)) {
        return response(res, 400, 'invalid', 'invalid Client Key', undefined, 'A-4.6.2')
    }
    var planDB = clientDB[clientID].plans,
        planKey = Object.keys(planDB),
        planID = String(req.body.planID)
    if (!req.body.planID || !planKey.includes(planID)) {
        return response(res, 400, 'invalid', 'invalid Plan Key', undefined, 'A-4.6.3')
    }
    firebase.database().ref(`/admin/clients/${clientID}/plans/${planID}/`).update(pushData).then(() => {
        return response(res, 200, 'success', 'Plan Successfully Removed', undefined, 'A-4.6.4')
    })

});

// 4.7 GET ALL CLIENT / SINGLE CLIENT DETAIL
clientAPI.get('/get', (req, res) => {
    if (!dbAdminSnapshot.clients) {
        return response(res, 404, 'notFound', 'Not Found Client', undefined, 'A-4.7.1')
    }

    var clientDB = dbAdminSnapshot.clients,
        clientKey = Object.keys(clientDB),
        pushData = []

    for (var i = 0; i < clientKey.length; i++) {

        var tempClient = clientDB[clientKey[i]]

        if (!tempClient.deleted) {

            if (tempClient.plans) {
                var plansDB = tempClient.plans,
                    planKeys = Object.keys(plansDB),
                    postPlan = []
                for (var j = 0; j < planKeys.length; j++) {
                    var tempPlan = plansDB[planKeys[j]],
                        status = "expired",
                        startDate = new Date(tempPlan.startDate),
                        endDate = new Date(tempPlan.startDate)
                    endDate.setDate(startDate.getDate() + parseInt(tempPlan.duration))

                    if (startDate > new Date()) {
                        status = "scheduled"
                    } else if (new Date() >= startDate && new Date() <= endDate) {
                        status = "running"
                    }
                    postPlan.push({
                        project_id: tempPlan.project_id,
                        plan_name: tempPlan.plan,
                        status: status
                    })
                }
            }

            var tempObj = {
                client_id: clientKey[i],
                email: tempClient.email,
                name: tempClient.name,
                createdOn: tempClient.createdOn,
                createdBy: tempClient.createdBy,
                lastModifiedOn: tempClient.createdOn,
                lastModifiedBy: tempClient.createdBy
            }

            if (postPlan.length > 0) {
                tempObj.plans = postPlan;
            }

            // SINGLE CLIENT DETAIL
            if (req.query.client_id) {
                if (String(req.query.client_id) == clientKey[i]) {
                    return response(res, 200, 'success', undefined, tempObj, 'A-4.7.2')
                }
            } else {
                pushData.push(tempObj)
            }
        }

        if (i == clientKey.length - 1) {
            if (req.query.client_id) {
                return response(res, 404, 'notfound', 'Incorrect Client ID', undefined, 'A-4.7.4')
            } else {
                return response(res, 200, 'success', 'Client Details', pushData, 'A-4.7.3')
            }
        }
    }
})

// 4.8 CHANGE PASSWORD
clientAPI.post('/change-password', (req, res) => {
    // CHECK BODY 
    if (req.body.password) {
        var password = String(req.body.password)
    } else {
        return response(res, 400, 'required', 'Password is required', undefined, 'A-4.8.1')
    }
    if (req.body.client_id) {
        var clientID = String(req.body.client_id)
    } else {
        return response(res, 400, 'required', 'Password is required', undefined, 'A-4.8.2')
    }

    //Check Client
    if (dbAdminSnapshot.clients) {
        var clientDB = dbAdminSnapshot.clients,
            clientKeys = Object.keys(clientDB)
        for (var i = 0; i < clientKeys.length; i++) {
            var tempClient = clientDB[clientKeys[i]]

            if (clientKeys[i] == clientID && !tempClient.deleted) {
                password = bcryptHash(password);
                // Password and Token update + LOG update
                tempClient.password = password
                tempClient.authToken = (Math.floor(Math.random() * (99999 - 11111) + 11111))
                tempClient.lastModifiedBy = "ADMIN"
                tempClient.lastModifiedOn = new Date()
                return firebase.database().ref(`/admin/clients/${clientID}/`).update(tempClient).then(() => {
                    return response(res, 200, 'success', 'Client Password is updated', undefined, 'A-4.8.3')
                })
            } else if (i == clientKeys.length - 1) {
                return response(res, 404, 'notFound', 'Incorrect Client ID', undefined, 'A-4.8.4')
            }
        }
    } else {
        return response(res, 404, 'notFound', 'Incorrect Client ID', undefined)
    }
})

module.exports = clientAPI;