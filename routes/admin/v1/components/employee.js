const employeeAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    { response, bcryptHash } = require('../functions/functions'),
    { email: isEmail } = require('../functions/regex')

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------
var dbAdminSnapshot, adminAuthToken;
employeeAPI.use((req, res, next) => {
    dbAdminSnapshot = req.session.dbAdminSnapshot
    adminAuthToken = req.session.decode_adminAuthToken
    next();
})

//--------------------------------- ROUTES ----------------------------------

//------------------------------- 5. EMPLOYEE -------------------------------

// 5.1 ADD EMPLOYEE
employeeAPI.post('/add', (req, res) => {

    // Data Validation
    var name, email, password;
    if (req.body.name) {
        name = String(req.body.name).trim();
    } else {
        return response(res, 400, 'required', 'Name is required', undefined, 'A-5.1.1');
    }

    if (req.body.email) {
        email = String(req.body.email).trim().toLowerCase()
        if (!isEmail(email)) {
            return response(res, 403, 'forbidden', 'Email is invalid', undefined, 'A-5.1.3');
        }
    } else {
        return response(res, 400, 'required', 'Email is required', undefined, 'A-5.1.2');
    }

    if (req.body.password) {
        password = bcryptHash(String(req.body.password))
    } else {
        return response(res, 400, 'required', 'Password is Required', undefined, 'A-5.1.4');
    }

    // Check Exist Email Address
    if (dbAdminSnapshot.employees) {
        var dbEmployees = dbAdminSnapshot.employees,
            dbEmployeesKey = Object.keys(dbEmployees);

        for (var i = 0; i < dbEmployeesKey.length; i++) {
            var tempEmployee = dbEmployees[dbEmployeesKey[i]];
            if (tempEmployee.email == email) {
                if (tempEmployee.deleted) {
                    firebase.database().ref('/admin/employees/' + dbEmployeesKey[i]).update({ deleted: false, lastModifiedOn: String(new Date()), lastModifiedBy: 'ADMIN' }).then(() => {
                        return response(res, 200, 'success', 'Existing employee activated', undefined, 'A-5.1.7');
                    })
                } else {
                    return response(res, 409, 'duplicate', 'Employee with same email address found active', undefined, 'A-5.1.5');
                }
            }
            if (i == dbEmployeesKey.length - 1) {
                return createNew(dbEmployeesKey.length + 1);
            }
        }
    } else {
        return createNew(1);
    }

    function createNew(empCount) {
        var pushData = {
            employee_id: String(new Date().getFullYear() + '' + empCount),
            name: name,
            email: email,
            password: password,
            createdOn: String(new Date()),
            createdBy: 'ADMIN'
        }

        firebase.database().ref('/admin/employees').push(pushData).then(() => {
            return response(res, 200, 'success', undefined, { member_id: pushData.employee_id }, 'A-5.1.6');
        })
    }
});

// 5.2 GET
employeeAPI.get(['/', '/get'], (req, res) => {
    /**
     * Query Filter
     * 1. Employee ID
     * 2. Email
     */
    if (dbAdminSnapshot.employees) {
        var dbEmployees = dbAdminSnapshot.employees,
            dbEmployeesKey = Object.keys(dbEmployees),
            postEmployeeData = [];

        for (var i = 0; i < dbEmployeesKey.length; i++) {
            var tempEmployee = dbEmployees[dbEmployeesKey[i]];
            if (!tempEmployee.deleted) {
                var tempObject = {
                    employee_id: tempEmployee.employee_id,
                    name: tempEmployee.name,
                    email: tempEmployee.email,
                    createdOn: tempEmployee.createdOn,
                    createdBy: tempEmployee.createdBy
                }

                //Filter
                if (req.query.employee_id) {
                    if (req.query.employee_id == tempObject.employee_id) {
                        return response(res, 200, 'success', undefined, tempObject, 'A-5.2.2');
                    }
                }
                if (req.query.email) {
                    if (req.query.email == tempObject.email) {
                        return response(res, 200, 'success', undefined, tempObject, 'A-5.2.3');
                    }
                }

                if (!req.query.employee_id && !req.query.email) {
                    postEmployeeData.push(tempObject);
                }
            }
            if (i == dbEmployeesKey.length - 1) {
                if (!req.query.employee_id && !req.query.email) {
                    return response(res, 200, 'success', undefined, postEmployeeData, 'A-5.2.5');
                } else {
                    return response(res, 404, 'notFound', 'No Employees found', undefined, 'A-5.2.4');
                }
            }
        }
    } else {
        return response(res, 200, 'success', 'No Employees found', [], 'A-5.2.1');
    }
});

module.exports = employeeAPI;