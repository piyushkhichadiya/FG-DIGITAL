const profileAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    fs = require('fs'),
    { response, bcryptHash, jwtSign, storageDirectory, randomString } = require('../../../../functions/functions')

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

var dbAdminSnapshot, employeeAuthToken, dbEmployeeAccount;
profileAPI.use((req, res, next) => {
    dbAdminSnapshot = req.session.dbAdminSnapshot
    employeeAuthToken = req.session.decode_employeeAuthToken
    dbEmployeeAccount = dbAdminSnapshot.employees[employeeAuthToken.employee_key];
    next();
});

//--------------------------------- ROUTES ----------------------------------

//------------------------------- 2. Employee Profile -----------------------

// 2.1 Get Profile
profileAPI.get('/', (req, res) => {

    var tempObj = {
        employee_id: dbEmployeeAccount.employee_id,
        email: dbEmployeeAccount.email,
        createdOn: dbEmployeeAccount.createdOn,
        name: dbEmployeeAccount.name,
        profile_image: dbEmployeeAccount.profile_image,
        mobile: dbEmployeeAccount.mobile,
        position: dbEmployeeAccount.position,
        skill: dbEmployeeAccount.skill
    }

    if (dbEmployeeAccount.social_accounts) {
        var dbEmployeeSocialAccount = dbEmployeeAccount.social_accounts,
            dbEmployeeSocialAccountKey = Object.keys(dbEmployeeSocialAccount),
            tempSocialAccountObj = []

        for (var i = 0; i < dbEmployeeSocialAccountKey.length; i++) {
            var tempAccount = dbEmployeeSocialAccount[dbEmployeeSocialAccountKey[i]]

            if (tempAccount.deleted) { continue }

            tempSocialAccountObj.push({
                account_key: tempAccount.social_accounts,
                account_name: tempAccount.account_name,
                reference: tempAccount.reference
            })
        }

        if (tempSocialAccountObj.length > 0) {
            tempObj.social_accounts = tempSocialAccountObj
        }
    }

    return response(res, 200, 'success', undefined, tempObj, 'E-2.1.1');
});

// 2.2 Change Password
profileAPI.post('/password', async(req, res) => {
    if (!req.body.password) {
        return response(res, 400, 'required', 'Password is required', undefined, 'E-2.2.1');
    }

    var password = String(req.body.password),
        hash = await bcryptHash(password);

    dbEmployeeAccount.password = hash;
    dbEmployeeAccount.lastModifiedOn = String(new Date());
    dbEmployeeAccount.lastModifiedBy = 'EMPLOYEE';
    dbEmployeeAccount.authToken = (Math.floor(Math.random() * (99999 - 11111) + 11111));

    // New Token
    // Store Auth Token in Cookie and Session

    // Generate Token Using JWT
    var jsonObject = {
        employee_key: employeeAuthToken.employee_key,
        authToken: dbEmployeeAccount.authToken,
        tokenCode: 'T-E-2.2',
        generatedOn: String(new Date())
    }
    var token = jwtSign(jsonObject);
    // Session
    req.session.employeeAuthToken = token;

    // Cookie
    if (req.cookies.employeeAuthToken) {
        res.cookie('employeeAuthToken', token, { maxAge: 1000 * 60 * 60 * 24 * 30 }) // 30 Days
    } else {
        res.clearCookie('employeeAuthToken')
    }

    firebase.database().ref('/admin/employees/' + employeeAuthToken.employee_key).update(dbEmployeeAccount).then(() => {
        return response(res, 200, 'success', 'Password successfully changed', undefined, 'E-2.2.2');
    });
})

// 2.3 Update Profile
profileAPI.post('/update', (req, res) => {

    if (req.body.name) {
        dbEmployeeAccount.name = String(req.body.name);
    }

    if (req.files && req.files.profile_image) {

        if (Array.isArray(req.files.profile_image)) {
            return response(res, 400, 'badContent', 'Too many files.', undefined, 'E-2.3.1');
        }

        var file = req.files.profile_image,
            filename;

        if ((file.size / 1024) > 100) {
            return response(res, 400, 'badContent', 'File size limit exceed 100 KB (1 MB)', undefined, 'E-2.3.2');
        }

        switch (file.mimetype) {
            case 'image/jpeg':
            case 'image/jpg':
                filename = `EMPLOYEE-PROFILE-${dbEmployeeAccount.employee_id} ` + randomString(10) + '.jpeg';
                break;
            case 'image/png':
                filename = `EMPLOYEE-PROFILE-${dbEmployeeAccount.employee_id} ` + randomString(10) + '.png';
                break;
            default:
                return response(res, 400, 'badContent', 'Invalid File Type. (JPEG/JPG/PNG) is only valid', undefined, 'E-2.3.3');
        }

        // Remove OLD Profile
        if (dbEmployeeAccount.profile_image) {
            try {
                fs.unlinkSync(storageDirectory() + '/employee/' + dbEmployeeAccount.profile_image);
            } catch {}
        }

        dbEmployeeAccount.profile_image = filename;

        // File Upload
        file.mv(storageDirectory() + '/employee/' + dbEmployeeAccount.profile_image);
    }

    dbEmployeeAccount.lastModifiedBy = 'EMPLOYEE'
    dbEmployeeAccount.lastModifiedOn = String(new Date())

    // DB
    firebase.database().ref('/admin/employees/' + employeeAuthToken.employee_key).update(dbEmployeeAccount);
    return response(res, 200, 'success', undefined, undefined, 'E-2.3.4');

})

// 2.4 GET FILE
profileAPI.get('/file/:filename', async(req, res) => {
    var path = storageDirectory() + '/',
        filename = String(req.params.filename)

    if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true })
    }
    try {
        var finder = finder = require('findit')(path),
            finder_flag = false;
        finder.on('directory', function(dir, stat, stop) {
            var newPath = dir + '/'
            if (fs.existsSync(newPath + filename)) {
                finder_flag = true;
                return res.sendFile(newPath + filename)
            }
        });

        finder.on('end', function() {
            if (!finder_flag) return res.status(404).send('FILE NOT FOUND');
        });
    } catch {}
});

module.exports = profileAPI