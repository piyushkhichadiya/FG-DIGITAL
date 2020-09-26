const profileAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    fs = require('fs'),
    { response, bcryptHash, jwtSign, storageDirectory } = require('../../../../functions/functions')

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

var dbAdminSnapshot, clientAuthToken, dbClientAccount;
profileAPI.use((req, res, next) => {
    dbAdminSnapshot = req.session.dbAdminSnapshot
    clientAuthToken = req.session.decode_clientAuthToken
    dbClientAccount = dbAdminSnapshot.clients[clientAuthToken.client_key];
    next();
});

//--------------------------------- ROUTES ----------------------------------

//------------------------------- 2. Client Profile -----------------------

// 2.1 Get Profile
profileAPI.get('/', (req, res) => {

    var tempObj = {
        client_key: clientAuthToken.client_key,
        email: dbClientAccount.email,
        name: dbClientAccount.name,
        mobile: dbClientAccount.mobile
    }

    return response(res, 200, 'success', undefined, tempObj, 'C-2.1.1');
});

// 2.2 Change Password
profileAPI.post('/password', async(req, res) => {
    if (!req.body.password) {
        return response(res, 400, 'required', 'Password is required', undefined, 'C-2.2.1');
    }

    var password = String(req.body.password),
        hash = await bcryptHash(password);

    dbClientAccount.password = hash;
    dbClientAccount.lastModifiedOn = String(new Date());
    dbClientAccount.lastModifiedBy = 'CLIENT';
    dbClientAccount.authToken = (Math.floor(Math.random() * (99999 - 11111) + 11111));

    // New Token
    // Store Auth Token in Cookie and Session

    // Generate Token Using JWT
    var jsonObject = {
        client_key: clientAuthToken.client_key,
        authToken: dbClientAccount.authToken,
        tokenCode: 'T-C-2.2',
        generatedOn: String(new Date())
    }
    var token = jwtSign(jsonObject);
    // Session
    req.session.clientAuthToken = token;

    // Cookie
    if (req.cookies.clientAuthToken) {
        res.cookie('clientAuthToken', token, { maxAge: 1000 * 60 * 60 * 24 * 30 }) // 30 Days
    } else {
        res.clearCookie('clientAuthToken')
    }

    firebase.database().ref('/admin/clients/' + clientAuthToken.client_key).update(dbClientAccount).then(() => {
        return response(res, 200, 'success', 'Password successfully changed', undefined, 'C-2.2.2');
    });
})

// 2.3 Update Profile
profileAPI.post('/update', (req, res) => {

    if (req.body.name) {
        dbClientAccount.name = String(req.body.name);
    } else {
        return response(res, 400, 'required', 'Name is required', undefined, 'C-2.3.2')
    }

    dbClientAccount.lastModifiedBy = 'CLIENT'
    dbClientAccount.lastModifiedOn = String(new Date())

    // DB
    firebase.database().ref('/admin/clients/' + clientAuthToken.client_key).update(dbClientAccount);
    return response(res, 200, 'success', undefined, undefined, 'C-2.3.1');
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