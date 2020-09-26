const userAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    { response, bcryptHashCompare, jwtSign } = require('../../../../functions/functions')

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

//--------------------------------- ROUTES ----------------------------------

//------------------------------- 1. USER ---------------------------

// 1.1 LOGIN
userAPI.post('/login', (req, res) => {
    if (!req.body.username || !req.body.password) {
        return response(res, 400, 'required', 'Email/Employee ID and Password are required.', undefined, 'E-1.1.1');
    }

    var username = String(req.body.username).toLowerCase().trim(),
        password = String(req.body.password);

    firebase.database().ref('/admin/employees').once('value', async snapshot => {
        if (snapshot.exists()) {
            var dbEmployees = snapshot.val(),
                dbEmployeesKeys = Object.keys(dbEmployees);

            for (var i = 0; i < dbEmployeesKeys.length; i++) {
                var tempEmployee = dbEmployees[dbEmployeesKeys[i]];

                if ((tempEmployee.email == username || tempEmployee.employee_id == username) && await bcryptHashCompare(password, tempEmployee.password)) {
                    // Store Auth Token in Cookie and Session

                    // Generate Token Using JWT
                    var jsonObject = {
                        employee_key: dbEmployeesKeys[i],
                        authToken: tempEmployee.authToken,
                        tokenCode: 'T-E-1.1',
                        generatedOn: String(new Date())
                    }
                    var token = jwtSign(jsonObject);

                    // Session
                    req.session.employeeAuthToken = token;

                    // Cookie
                    if (req.body.remember) {
                        res.cookie('employeeAuthToken', token, { maxAge: 1000 * 60 * 60 * 24 * 30 }) // 30 Days
                    }

                    return response(res, 200, 'success', undefined, undefined, 'E-1.1.2');
                } else if (i == dbEmployeesKeys.length - 1) {
                    return response(res, 401, 'authError', 'Incorrect Username or Password', undefined, 'E-1.1.3');
                }
            }
        } else {
            return response(res, 401, 'authError', 'Incorrect Username or Password', undefined, 'E-1.1.4');
        }
    });
});

// 1.2 LOGOUT
userAPI.get('/logout', (req, res) => {
    req.session.employeeAuthToken = undefined
    res.clearCookie('employeeAuthToken')
    return response(res, 200, 'success', 'Logout Successfully', undefined, 'E-1.2.1')
})

module.exports = userAPI;