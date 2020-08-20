const employeeAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    fs = require('fs'),
    { response, bcryptHash, storageDirectory } = require('../../../../functions/functions'),
    { email: isEmail } = require('../../../../functions/regex')

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
                        return response(res, 200, 'success', 'Existing employee activated', { employee_id: tempEmployee.employee_id }, 'A-5.1.7');
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
            authToken: (Math.floor(Math.random() * (99999 - 11111) + 11111)),
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
                    createdBy: tempEmployee.createdBy,
                    profile_image: tempEmployee.profile_image,
                    skills: tempEmployee.skills,
                    position: tempEmployee.position,
                    mobile: tempEmployee.mobile
                }

                // Social Account
                if (tempEmployee.social_accounts) {
                    var dbSocialAccount = tempEmployee.social_accounts,
                        dbSocialAccountKeys = Object.keys(dbSocialAccount),
                        postSocialAccount = []

                    for (var j = 0; j < dbSocialAccountKeys.length; j++) {
                        var tempAccount = dbSocialAccount[dbSocialAccountKeys[j]]
                        if (!tempAccount.deleted) {
                            postSocialAccount.push({
                                account_id: dbSocialAccountKeys[j],
                                account_name: tempAccount.account_name,
                                reference: tempAccount.reference,
                                createdOn: tempAccount.createdOn,
                                createdBy: tempAccount.createdBy,
                                createdBy_id: tempAccount.createdBy_id,
                                lastModifiedOn: tempAccount.lastModifiedOn,
                                lastModifiedBy: tempAccount.lastModifiedBy,
                                lastModifiedBy_id: tempAccount.lastModifiedBy_id
                            })
                        }
                    }
                    if (postSocialAccount.length > 0) {
                        tempObject.social_accounts = postSocialAccount;
                    }
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
        return response(res, 200, 'success', 'No Employees found', undefined, 'A-5.2.1');
    }
});

// 5.3 UPDATE
employeeAPI.post('/update/:id', (req, res) => {
    if (dbAdminSnapshot.employees) {
        var dbEmployees = dbAdminSnapshot.employees,
            dbEmployeesKey = Object.keys(dbEmployees)

        for (var i = 0; i < dbEmployeesKey.length; i++) {
            if (!dbEmployees[dbEmployeesKey[i]].deleted && dbEmployees[dbEmployeesKey[i]].employee_id == req.params.id) {
                var tempEmployee = dbEmployees[dbEmployeesKey[i]];

                // Name
                if (req.body.name) {
                    tempEmployee.name = String(req.body.name).trim();
                }

                // Position
                if (req.body.position) {
                    var validPosition = ['Website Developer', 'Marketing Specialist', 'Application Developer', 'Content Writer', 'SEO Specialist', 'Social Media Manager', 'Graphics Designer', 'Videographer', 'Video Editor']
                    var position = String(req.body.position).trim();
                    if (!validPosition.includes(position)) {
                        return response(res, 403, 'forbidden', 'Invalid Position.', { valid_positions: validPosition }, 'A-5.3.1');
                    }
                    tempEmployee.position = position
                }

                // Skill
                if (req.body.skills) {
                    tempEmployee.skills = String(req.body.skills).trim();
                }

                // Contact [Mobile]
                if (req.body.mobile) {
                    tempEmployee.mobile = String(req.body.mobile).trim();
                }

                // Profile Image
                if (req.files && req.files.profile_image) {
                    var file_profile = req.files.profile_image,
                        old_filename = tempEmployee.profile_image;

                    if (!['image/png', 'image/jpg', 'image/jpeg'].includes(file_profile.mimetype)) {
                        return response(res, 400, 'badContent', 'Unsupported Profile Image File', { valid_file_type: ['image/png', 'image/jpg', 'image/jpeg'] }, 'A-5.3.2')
                    }

                    if (file_profile.size / 1024 > 100) {
                        return response(res, 400, 'badContent', 'File size limit exceed. 100 KB Max. allowed', undefined, 'A-5.3.3');
                    }
                    switch (file_profile.mimetype) {
                        case 'image/jpeg':
                        case 'image/jpg':
                            tempEmployee.profile_image = `EMPLOYEE-PROFILE-${tempEmployee.employee_id} ` + Math.floor(new Date().valueOf() * Math.random()) + '.jpg'
                            break;
                        case 'image/png':
                            tempEmployee.profile_image = `EMPLOYEE-PROFILE-${tempEmployee.employee_id} ` + Math.floor(new Date().valueOf() * Math.random()) + '.png'
                            break;
                    }
                }

                // Email
                if (req.body.email) {
                    var email = String(req.body.email).trim().toLowerCase();
                    for (var j = 0; j < dbEmployeesKey.length; j++) {
                        if (dbEmployees[dbEmployeesKey[j]].email == email && dbEmployees[dbEmployeesKey[j]].employee_id != req.params.id) {
                            return response(res, 409, 'duplicate', 'Account already exist with this email address. You cannot create or update details with using email address', undefined, 'A-5.3.4');
                        }
                    }
                    tempEmployee.email = email;
                }
                if (file_profile) {
                    try {
                        fs.unlinkSync(storageDirectory() + '/employee/' + old_filename)
                    } catch {}

                    file_profile.mv(storageDirectory() + '/employee/' + tempEmployee.profile_image)
                }

                tempEmployee.lastModifiedOn = String(new Date())
                tempEmployee.lastModifiedBy = 'ADMIN'

                return firebase.database().ref(`/admin/employees/${dbEmployeesKey[i]}/`).update(tempEmployee).then(() => {
                    return response(res, 200, 'success', undefined, undefined, 'A-5.3.5');
                });
            } else if (i == dbEmployeesKey.length - 1) {
                return response(res, 404, 'notFound', 'Incorrect Employee ID', undefined, 'A-5.3.6');
            }
        }
    } else {
        return response(res, 404, 'notFound', 'Incorrect Employee ID', undefined, 'A-5.3.7');
    }
})

// 5.4 CHANGE PASSWORD
employeeAPI.post('/change-password', (req, res) => {

    // Validate Body
    if (req.body.password) {
        var password = String(req.body.password)
    } else {
        return response(res, 400, 'required', 'Password is required', undefined, 'A-5.4.1')
    }

    if (req.body.employee_id) {
        var employee_id = String(req.body.employee_id).trim()
    } else {
        return response(res, 400, 'required', 'Employee ID is required', undefined, 'A-5.4.2')
    }

    // Hash Password
    password = bcryptHash(password)

    // DB
    if (dbAdminSnapshot.employees) {
        var dbEmployees = dbAdminSnapshot.employees,
            dbEmployeesKey = Object.keys(dbEmployees)

        for (var i = 0; i < dbEmployeesKey.length; i++) {
            var tempEmployee = dbEmployees[dbEmployeesKey[i]]

            if (!tempEmployee.deleted && tempEmployee.employee_id == employee_id) {

                // Change Password & authToken
                tempEmployee.authToken = (Math.floor(Math.random() * (99999 - 11111) + 11111))
                tempEmployee.password = password

                //Log
                tempEmployee.lastModifiedOn = String(new Date())
                tempEmployee.lastModifiedBy = 'ADMIN'
                delete tempEmployee.lastModifiedBy_id

                return firebase.database().ref(`/admin/employees/${dbEmployeesKey[i]}`).update(tempEmployee).then(() => {
                    return response(res, 200, 'success', 'Password changed successfully', undefined, 'A-5.4.3');
                })
            } else if (i == dbEmployeesKey.length - 1) {
                return response(res, 404, 'notFound', 'Employee not found. Incorrect Employee ID', undefined, 'A-5.4.4')
            }
        }
    } else {
        return response(res, 404, 'notFound', 'Employee not found. Incorrect Employee ID', undefined, 'A-5.4.5')
    }
})

// 5.5 REMOVE
employeeAPI.get('/remove', (req, res) => {

    if (req.query.employee_id) {
        var employee_id = String(req.query.employee_id)
    } else {
        return response(res, 400, 'required', 'Employee ID is required', undefined, 'A-5.5.1')
    }

    if (dbAdminSnapshot.employees) {
        var dbEmployees = dbAdminSnapshot.employees,
            dbEmployeesKey = Object.keys(dbEmployees)

        for (var i = 0; i < dbEmployeesKey.length; i++) {
            var tempEmployee = dbEmployees[dbEmployeesKey[i]]

            if (!tempEmployee.deleted && tempEmployee.employee_id == employee_id) {

                //Log
                tempEmployee.deleted = true
                tempEmployee.authToken = (Math.floor(Math.random() * (99999 - 11111) + 11111))
                tempEmployee.lastModifiedOn = String(new Date())
                tempEmployee.lastModifiedBy = 'ADMIN'
                delete tempEmployee.lastModifiedBy_id

                return firebase.database().ref(`/admin/employees/${dbEmployeesKey[i]}`).update(tempEmployee).then(() => {
                    return response(res, 200, 'success', 'Employee Removed successfully', undefined, 'A-5.5.2');
                })
            } else if (i == dbEmployeesKey.length - 1) {
                return response(res, 404, 'notFound', 'Employee not found. Incorrect Employee ID', undefined, 'A-5.5.3')
            }
        }
    } else {
        return response(res, 404, 'notFound', 'Employee not found. Incorrect Employee ID', undefined, 'A-5.5.4')
    }
})

// 5.6 SOCIAL ACCOUNT - ADD
employeeAPI.post('/social-account/add', (req, res) => {

    // Validate Body
    if (req.body.employee_id) {
        var employee_id = String(req.body.employee_id)
    } else {
        return response(res, 400, 'required', 'Employee ID is required', undefined, 'A-5.6.1')
    }

    if (req.body.account_name) {
        var account_name = String(req.body.account_name).trim()
    } else {
        return response(res, 400, 'required', 'Account Name is required', undefined, 'A-5.6.2')
    }

    if (req.body.reference) {
        var reference = String(req.body.reference).trim()
    } else {
        return response(res, 400, 'required', 'Reference is required', undefined, 'A-5.6.3')
    }

    // DB
    if (dbAdminSnapshot.employees) {
        var dbEmployees = dbAdminSnapshot.employees,
            dbEmployeesKey = Object.keys(dbEmployees)

        for (var i = 0; i < dbEmployeesKey.length; i++) {
            var tempEmployee = dbEmployees[dbEmployeesKey[i]]

            if (!tempEmployee.deleted && tempEmployee.employee_id == employee_id) {
                var tempObj = {
                    createdOn: String(new Date()),
                    createdBy: 'ADMIN',
                    account_name: account_name,
                    reference: reference
                }

                return firebase.database().ref(`/admin/employees/${dbEmployeesKey[i]}/social_accounts`).push(tempObj).then(() => {
                    return response(res, 200, 'success', 'Social Account added successfully', undefined, 'A-5.6.4')
                })

            } else if (i == dbEmployeesKey.length - 1) {
                return response(res, 404, 'notFound', 'Employee not found. Incorrect Employee ID', undefined, 'A-5.6.5')
            }
        }
    } else {
        return response(res, 404, 'notFound', 'Employee not found. Incorrect Employee ID', undefined, 'A-5.6.6')
    }
})

// 5.7 SOCIAL ACCOUNT - UPDATE
employeeAPI.post('/social-account/update', (req, res) => {

    // Validate Body
    if (req.body.employee_id) {
        var employee_id = String(req.body.employee_id)
    } else {
        return response(res, 400, 'required', 'Employee ID is required', undefined, 'A-5.7.1')
    }

    if (req.body.account_id) {
        var account_id = String(req.body.account_id)
    } else {
        return response(res, 400, 'required', 'Social Account ID is required', undefined, 'A-5.7.2')
    }

    // DB
    if (dbAdminSnapshot.employees) {
        var dbEmployees = dbAdminSnapshot.employees,
            dbEmployeesKey = Object.keys(dbEmployees)

        for (var i = 0; i < dbEmployeesKey.length; i++) {
            var tempEmployee = dbEmployees[dbEmployeesKey[i]]

            if (!tempEmployee.deleted && tempEmployee.employee_id == employee_id) {
                if (tempEmployee.social_accounts && tempEmployee.social_accounts[account_id]) {
                    var tempAccount = tempEmployee.social_accounts[account_id]
                    if (!tempAccount.deleted) {
                        if (!req.body.account_name || !req.body.reference) {
                            return response(res, 403, 'forbidden', 'Nothing to modify', undefined, 'A-5.7.3')
                        }

                        if (req.body.account_name) {
                            tempAccount.account_name = String(req.body.account_name).trim()
                        }

                        if (req.body.reference) {
                            tempAccount.reference = String(req.body.reference).trim()
                        }

                        tempAccount.lastModifiedOn = String(new Date())
                        tempAccount.lastModifiedBy = 'ADMIN'
                        delete tempAccount.lastModifiedBy_id

                        return firebase.database().ref(`/admin/employees/${dbEmployeesKey[i]}/social_accounts/${account_id}`).update(tempAccount).then(() => {
                            return response(res, 200, 'success', 'Social Account details updated successfully', undefined, 'A-5.7.4');
                        })

                    } else {
                        return response(res, 404, 'notFound', 'Incorrect Social Account ID', undefined, 'A-5.7.5')
                    }
                } else {
                    return response(res, 404, 'notFound', 'Incorrect Social Account ID', undefined, 'A-5.7.6')
                }

            } else if (i == dbEmployeesKey.length - 1) {
                return response(res, 404, 'notFound', 'Employee not found. Incorrect Employee ID', undefined, 'A-5.7.7')
            }
        }
    } else {
        return response(res, 404, 'notFound', 'Employee not found. Incorrect Employee ID', undefined, 'A-5.7.8')
    }
})

// 5.8 SOCIAL ACCOUNT - REMOVE
employeeAPI.get('/social-account/remove', (req, res) => {

    // Validate Body
    if (req.query.employee_id) {
        var employee_id = String(req.query.employee_id)
    } else {
        return response(res, 400, 'required', 'Employee ID is required', undefined, 'A-5.8.1')
    }

    if (req.query.account_id) {
        var account_id = String(req.query.account_id)
    } else {
        return response(res, 400, 'required', 'Social Account ID is required', undefined, 'A-5.8.2')
    }

    // DB
    if (dbAdminSnapshot.employees) {
        var dbEmployees = dbAdminSnapshot.employees,
            dbEmployeesKey = Object.keys(dbEmployees)

        for (var i = 0; i < dbEmployeesKey.length; i++) {
            var tempEmployee = dbEmployees[dbEmployeesKey[i]]

            if (!tempEmployee.deleted && tempEmployee.employee_id == employee_id) {
                if (tempEmployee.social_accounts && tempEmployee.social_accounts[account_id]) {
                    var tempAccount = tempEmployee.social_accounts[account_id]
                    if (!tempAccount.deleted) {
                        tempAccount.deleted = true
                        tempAccount.lastModifiedOn = String(new Date())
                        tempAccount.lastModifiedBy = 'ADMIN'
                        delete tempAccount.lastModifiedBy_id

                        return firebase.database().ref(`/admin/employees/${dbEmployeesKey[i]}/social_accounts/${account_id}`).update(tempAccount).then(() => {
                            return response(res, 200, 'success', 'Social Account removed successfully', undefined, 'A-5.8.3');
                        })
                    } else {
                        return response(res, 404, 'notFound', 'Incorrect Social Account ID', undefined, 'A-5.8.4')
                    }
                } else {
                    return response(res, 404, 'notFound', 'Incorrect Social Account ID', undefined, 'A-5.8.5')
                }

            } else if (i == dbEmployeesKey.length - 1) {
                return response(res, 404, 'notFound', 'Employee not found. Incorrect Employee ID', undefined, 'A-5.8.6')
            }
        }
    } else {
        return response(res, 404, 'notFound', 'Employee not found. Incorrect Employee ID', undefined, 'A-5.8.7')
    }
})

module.exports = employeeAPI;