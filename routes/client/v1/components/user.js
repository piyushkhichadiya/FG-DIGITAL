const userAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    { response, bcryptHashCompare, jwtSign } = require('../../../../functions/functions')

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

//--------------------------------- ROUTES ----------------------------------

//------------------------------- 1. USER ---------------------------

// 1.1 LOGIN
userAPI.post('/login', (req, res) => {
    if (!req.body.email || !req.body.password) {
        return response(res, 400, 'required', 'Email and Password are required.', undefined, 'C-1.1.1');
    }

    var email = String(req.body.email).toLowerCase().trim(),
        password = String(req.body.password);

    firebase.database().ref('/admin/clients').once('value', async snapshot => {
        if (snapshot.exists()) {
            var dbClients = snapshot.val(),
                dbClientsKeys = Object.keys(dbClients);

            for (var i = 0; i < dbClientsKeys.length; i++) {
                var tempClient = dbClients[dbClientsKeys[i]];

                if (!tempClient.deleted && tempClient.email == email && await bcryptHashCompare(password, tempClient.password)) {
                    // Store Auth Token in Cookie and Session

                    // Generate Token Using JWT
                    var jsonObject = {
                        client_key: dbClientsKeys[i],
                        authToken: tempClient.authToken,
                        tokenCode: 'T-C-1.1',
                        generatedOn: String(new Date())
                    }
                    var token = jwtSign(jsonObject);

                    // Session
                    req.session.clientAuthToken = token;

                    // Cookie
                    if (req.body.remember) {
                        res.cookie('clientAuthToken', token, { maxAge: 1000 * 60 * 60 * 24 * 30 }) // 30 Days
                    }

                    return response(res, 200, 'success', undefined, undefined, 'C-1.1.2');
                } else if (i == dbClientsKeys.length - 1) {
                    return response(res, 401, 'authError', 'Incorrect Email or Password', undefined, 'C-1.1.3');
                }
            }
        } else {
            return response(res, 401, 'authError', 'Incorrect Email or Password', undefined, 'C-1.1.4');
        }
    });
});

// 1.2 LOGOUT
userAPI.get('/logout', (req, res) => {
    req.session.clientAuthToken = undefined
    res.clearCookie('clientAuthToken')
    return response(res, 200, 'success', 'Logout Successfully', undefined, 'C-1.2.1')
})

module.exports = userAPI;