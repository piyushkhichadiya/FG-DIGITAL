const userAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    { response, bcryptHash, bcryptHashCompare, jwtSign } = require('../functions/functions')

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

//--------------------------------- ROUTES -----------------------------------

//------------------------------- 1. USER ACCOUNT -------------------------------

// 1.1 CREATE ADMIN
userAPI.post('/create', (req, res) => {
    if (!req.body.email || !req.body.password) {
        return response(res, 400, 'required', 'Email and Password are required.', undefined, 'A-1.1.1');
    }

    var email = String(req.body.email).toLowerCase().trim(),
        password = String(req.body.password);

    firebase.database().ref('/admin/users').once('value', snapshot => {
        if (snapshot.exists()) {
            var dbAdminUser = snapshot.val(),
                dbAdminUserKey = Object.keys(dbAdminUser);

            for (var i = 0; i < dbAdminUserKey.length; i++) {
                var tempUser = dbAdminUser[dbAdminUserKey[i]];
                if (!tempUser.deleted && tempUser.email == email) {
                    return response(res, 409, 'duplicate', 'User exist with same email address', undefined, 'A-1.1.3');
                } else if (i == dbAdminUserKey.length - 1) {
                    var pushData = {
                        email: email,
                        password: bcryptHash(password),
                        authToken: (Math.floor(Math.random() * (99999 - 11111) + 11111)),
                        createdOn: String(new Date())
                    }

                    firebase.database().ref('/admin/users').push(pushData)
                    return response(res, 200, 'success', undefined, undefined, 'A-1.1.4');
                }
            }
        } else {
            // 1st Admin
            var pushData = {
                email: email,
                password: bcryptHash(password),
                authToken: (Math.floor(Math.random() * (99999 - 11111) + 11111)),
                createdOn: String(new Date())
            }

            firebase.database().ref('/admin/users').push(pushData)
            return response(res, 200, 'success', undefined, undefined, 'A-1.1.2');
        }
    });
});

// 1.2 LOGIN
userAPI.post('/login', (req, res) => {
    if (!req.body.email || !req.body.password) {
        return response(res, 400, 'required', 'Email and Password are required.', undefined, 'A-1.2.1');
    }

    var email = String(req.body.email).toLowerCase().trim(),
        password = String(req.body.password);

    firebase.database().ref('/admin/users').once('value', async snapshot => {
        if (snapshot.exists()) {
            var dbAdminUser = snapshot.val(),
                dbAdminUserKey = Object.keys(dbAdminUser);

            for (var i = 0; i < dbAdminUserKey.length; i++) {
                var tempUser = dbAdminUser[dbAdminUserKey[i]];
                if (tempUser.email == email && await bcryptHashCompare(password, tempUser.password)) {
                    // Store Auth Token in Cookie and Session

                    // Generate Token Using JWT
                    var jsonObject = {
                        user_key: dbAdminUserKey[i],
                        authToken: tempUser.authToken,
                        tokenCode: 'T-A-1.2',
                        generatedOn: String(new Date())
                    }
                    var token = jwtSign(jsonObject);

                    // Session
                    req.session.adminAuthToken = token;

                    // Cookie
                    if (req.body.remember) {
                        res.cookie('adminAuthToken', token, { maxAge: 1000 * 60 * 60 * 24 * 30 }) // 30 Days
                    }

                    return response(res, 200, 'success', undefined, undefined, 'A-1.2.2');
                } else if (i == dbAdminUserKey.length - 1) {
                    return response(res, 401, 'authError', 'Incorrect Username or Password', undefined, 'A-1.2.3');
                }
            }
        } else {
            return response(res, 401, 'authError', 'Incorrect Username or Password', undefined, 'A-1.2.4');
        }
    });
});

module.exports = userAPI;