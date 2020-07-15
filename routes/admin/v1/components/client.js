const client = require('express').Router(),
    firebase = require('firebase-admin'),
    { response } = require('../functions/functions'),
    fs = require('fs'),
    regex = require('../functions/regex')


//----------------------------- CONFIGURATION ------------------------------

//---------------------------- GLOBAL VARIABLE -----------------------------

//--------------------------------- ROUTES ---------------------------------

//------------------------------- 3. CLIENT -------------------------------

//3.1 CREATE CLIENT ID
client.post('/create', async(req, res) => {
    if (!req.body.name || !req.body.email || !req.body.password) {
        return response(res, 400, 'Body required', 'name,email or password missing')
    }
    var name = String(req.body.name),
        email = String(req.body.email),
        password = String(req.body.password)
    if (!regex.text(name)) {
        return response(res, 400, 'Invalid', 'Name invalid')
    }
    if (!regex.email(email)) {
        return response(res, 400, 'Invalid', 'Email value is invalid')
    }
    var pushData = {
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        createdOn: String(new Date()),
        createdBy: "Admin"
    }
    await firebase.database().ref('/admin/clients/').once('value', (snapshot) => {
        if (snapshot) {
            var clientDB = snapshot.val(),
                clientKey = Object.keys(clientDB)
            for (var i = 0; i < clientKey.length; i++) {
                if (clientDB[clientKey[i]].email == email) {
                    return response(res, 403, 'Forbidden', 'Client With This Email Is Already Exist')
                } else if (i == clientKey.length - 1) {
                    firebase.database().ref('/admin/clients/').push(pushData)
                    return response(res, 200, 'success', 'User created successfully')
                }
            }
        }
    })




})

//3.2 Profile Update
/**
 * -----profile update-----
name
update mail
client mail
client plan 
payment 
start time
day time 

 */
client.post('/update', async(req, res) => {
        var pushData = {},
            snapshot = await firebase.database().ref('/admin/clients/').once('value').then((snapshot) => {
                if (snapshot.exists()) {
                    return snapshot.val()
                }
            }),
            clientDB = snapshot,
            clientKey = Object.keys(clientDB)
        if (!req.body.clientID) {
            return response(res, 400, 'Invalid', 'Invalid Client Key')

        }
        var clientID = String(req.body.clientID).trim()
        if (snapshot) {
            var clientID = req.body.clientID
            if (!clientKey.includes(clientID)) {
                return response(res, 400, 'Invalid', 'Invalid Client Key')
            }
        }

        if (req.body.name) {
            var name = String(req.body.name)
            if (!regex.text(name)) {
                return response(res, 400, 'Invalid', 'Name invalid')
            }
            pushData.name = name
        }
        if (req.body.email) {
            var email = String(req.body.email)
            if (!regex.email(email)) {
                return response(res, 400, 'Invalid', 'Email Invalid')
            }

            if (snapshot) {

                for (var i = 0; i < clientKey.length; i++) {
                    if (clientDB[clientKey[i]].email == email && !clientDB[clientKey[i]].deleted) {
                        return response(res, 403, 'Forbidden', 'Client With This Email Is Already Exist')
                    } else if (i == clientKey.length - 1) {
                        pushData.email = email
                    }
                }
            }
        }

        if (req.body.plan) {
            var plan = String(req.body.plan)
            pushData.plan = plan

        }
        if (req.body.price) {
            var price = String(req.body.price)
            if (!regex.regexNumber(price)) {
                return response(res, 400, 'Invalid', 'Price Value Invalid')
            }
            pushData.price = price

        }
        if (req.body.planStartDate) {
            var startDate = String(req.body.planStartDate)
            pushData.startDate = startDate

        }
        if (req.body.duration) {
            var duration = String(req.body.duration)
            pushData.duration = duration
            if (!regex.regexNumber(duration)) {
                return response(res, 400, 'Invalid', 'Duration Value Invalid')
            }
        }
        if (pushData) {
            pushData.lastModifiedOn = String(new Date())
            pushData.lastModifiedBy = "Admin"

            firebase.database().ref(`/admin/clients/${clientID}/`).update(pushData).then(() => {
                return response(res, 200, 'success', 'Profile Updated Successfully')

            })
        }
    })
    //3.3 DELETE CLIENT
client.post('/delete', async(req, res) => {
    var snapshot = await firebase.database().ref('/admin/clients/').once('value').then((snapshot) => {
            if (snapshot.exists()) {
                return snapshot.val()
            }
        }),
        clientDB = snapshot,
        clientKey = Object.keys(clientDB)
    if (!req.body.clientID) {
        return response(res, 400, 'Invalid', 'Invalid Client Key')
    }
    var clientID = String(req.body.clientID).trim()
    if (snapshot) {
        var clientID = req.body.clientID
        if (!clientKey.includes(clientID)) {
            return response(res, 400, 'Invalid', 'Invalid Client Key')
        }
        if (clientDB[clientID].deleted) {
            return response(res, 403, 'Forbidden', 'Client Account is already deleted')

        }
    }

    firebase.database().ref(`/admin/clients/${clientID}/`).update({ "deleted": true }).then(() => {
        return response(res, 200, 'success', 'Profile Updated Successfully')

    })
})
module.exports = client;