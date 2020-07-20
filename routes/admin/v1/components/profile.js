const profileAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    { response, randomString, storageDirectory, bcryptHash, jwtSign, bcryptHashCompare } = require('../functions/functions'),
    fs = require('fs')

//----------------------------- CONFIGURATION ------------------------------

//---------------------------- GLOBAL VARIABLE -----------------------------
var dbAdminSnapshot, adminAuthToken, dbUser;
profileAPI.use((req, res, next) => {
    dbAdminSnapshot = req.session.dbAdminSnapshot
    adminAuthToken = req.session.decode_adminAuthToken
    dbUser = dbAdminSnapshot.users[adminAuthToken.user_key];
    next();
});

//--------------------------------- ROUTES ---------------------------------

//------------------------------- 2. PROFILE -------------------------------


// 2.1 GET PROFILE 
profileAPI.get('/', (req, res) => {

    var postData = {
        email: dbUser.email,
        createdOn: dbUser.createdOn,
        name: dbUser.name,
        profile_image: dbUser.profile_image
    }

    return response(res, 200, 'success', 'profile', postData, 'A-2.1.1');
});

// 2.2 UPDATE PROFILE
profileAPI.post('/update', (req, res) => {

    dbUser.lastModifiedOn = String(new Date());

    if (req.body.name) {
        dbUser.name = String(req.body.name);
    }
    if (req.files && req.files.profile_image) {

        if (Array.isArray(req.files.profile_image)) {
            return response(res, 400, 'badContent', 'Too many files.', undefined, 'A-2.2.1');
        }

        var file = req.files.profile_image,
            filename;

        if ((file.size / 1024) > 1024) {
            return response(res, 400, 'badContent', 'File size limit exceed 1024 KB (1 MB)', undefined, 'A-2.2.2');
        }

        switch (file.mimetype) {
            case 'image/jpeg':
            case 'image/jpg':
                filename = 'ADMIN_PROFILE_IMAGE ' + randomString(10) + '.jpeg';
                break;
            case 'image/png':
                filename = 'ADMIN_PROFILE_IMAGE ' + randomString(10) + '.jpeg';
                break;
            default:
                return response(res, 400, 'badContent', 'Invalid File Type. (JPEG/JPG/PNG) is only valid', undefined, 'A-2.2.3');
        }

        // Remove OLD Profile
        if (dbUser.profile_image) {
            try {
                fs.unlinkSync(storageDirectory() + '/admin/' + dbUser.profile_image);
            } catch {}
        }

        dbUser.profile_image = filename;

        // File Upload
        file.mv(storageDirectory() + '/admin/' + dbUser.profile_image);
    }


    // DB
    firebase.database().ref('/admin/users/' + adminAuthToken.user_key + '/').update(dbUser);
    return response(res, 200, 'success', undefined, 'A-2.2.4');
});

// 2.3 CHANGE PASSWORD
profileAPI.post('/password', async(req, res) => {

    if (!req.body.password) {
        return response(res, 400, 'required', 'Password is required', undefined, 'A-2.3.1');
    }

    var password = String(req.body.password),
        hash = await bcryptHash(password);

    dbUser.password = hash;
    dbUser.lastModifiedOn = String(new Date());
    dbUser.authToken = (Math.floor(Math.random() * (99999 - 11111) + 11111));

    // New Token
    // Store Auth Token in Cookie and Session

    // Generate Token Using JWT
    var jsonObject = {
        user_key: adminAuthToken.user_key,
        authToken: dbUser.authToken,
        tokenCode: 'T-A-2.3',
        generatedOn: String(new Date())
    }
    var token = jwtSign(jsonObject);

    // Session
    req.session.adminAuthToken = token;

    // Cookie
    if (req.cookies.adminAuthToken) {
        res.cookie('adminAuthToken', token, { maxAge: 1000 * 60 * 60 * 24 * 30 }) // 30 Days
    }

    firebase.database().ref('/admin/users/' + adminAuthToken.user_key + '/').update(dbUser).then(() => {
        return response(res, 200, 'success', 'Password successfully changed', undefined, 'A-2.3.1');
    });
});

module.exports = profileAPI;