var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    session = require('express-session'),
    multipartParser = require('express-fileupload'),
    cookieParser = require('cookie-parser'),
    swaggerUI = require('swagger-ui-express'),
    packageInfo = require('./package.json'),
    { ConvertKeysToLowerCase } = require('./functions/functions')

//--------------------------- CONFIGURATION ---------------------------

// Set Static Assets
app.use(express.static('public'))

// Syntax Error Handling [ex. JSON]
app.use(bodyParser.json(), bodyParser.urlencoded({ extended: false }), (error, req, res, next) => {
    if (error instanceof SyntaxError) {
        return res.status(400).json({ status: 400, response: 'badContent', message: 'SyntaxError: Incorrect Body' })
    }
    if (error instanceof ReferenceError) {
        return res.status(400).json({ status: 400, response: 'badContent', message: 'ReferenceError: Incorrect Reference. [REPORT TO DEVELOPER]' })
    }
    next();
});

// URI Error Handling
app.use((req, res, next) => {
    try {
        decodeURIComponent(req.path);
        next();
    } catch {
        return res.status(400).json({ status: 400, response: 'badContent', message: 'URIError: Incorrect URI/ URL. URI/ URL may contain invalid character.' })
    }
})

// Multipart Body Parsing [JSON BODY, FILE(s)]
app.use(multipartParser())

// Convert All JSON Body keys to lowercase & Remove Empty strings
app.use((req, res, next) => {
    req.body = ConvertKeysToLowerCase(req.body);
    next();
})

// Basic Directory Generate
const directory_gen = require('./config/directory');
directory_gen('admin')
directory_gen('employee')

// Console Clear
console.clear();
console.log(`npm start: ${packageInfo.scripts.start}

Port: ${process.env.PORT || 80}
Environment: ${process.env.NODE_ENV||'development'}
App Version: ${packageInfo.version}`)

//----------------------------- DATABASE ------------------------------
var firebase = require('./config/database')
var obj_firebase = new firebase()
obj_firebase.initialization()

console.log(`Database: ${obj_firebase.status().status}`);

//------------------------- SESSION & COOKIE ---------------------------

// Cookie Parser
app.use(cookieParser())

// Portal [SESSION]
app.use(session({ secret: 'MY-SECRET', resave: true, saveUninitialized: true, cookie: { secure: false, sameSite: true } }))

//-------------------- API DOCUMENTATION [SWAGGER] ---------------------

let SwaggerOptions = {
    explorer: false,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "APIs - FG Digital",
    customfavIcon: "/adminLTE/images/favicon.ico",
    swaggerOptions: {
        docExpansion: "none",
    }
}

// v1
if ((process.env.NODE_ENV == 'dev' || process.env.NODE_ENV == 'development') && (process.env.PORT == 80 || !process.env.PORT)) {


    // ADMIN
    app.use('/api/admin', swaggerUI.serve, swaggerUI.setup(require('./routes/admin/v1/admin.swagger.json'), {
        explorer: false,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: "Admin APIs v1.0",
        customfavIcon: "/adminLTE/images/favicon.ico",
        swaggerOptions: {
            docExpansion: "none",
        }
    }));

    // EMPLOYEE
    app.use('/api/employee', swaggerUI.serve, swaggerUI.setup(require('./routes/admin/v1/admin.swagger.json'), {
        explorer: false,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: "Employee APIs v1.0",
        customfavIcon: "/adminLTE/images/favicon.ico",
        swaggerOptions: {
            docExpansion: "none",
        }
    }));

    // CLIENT
    app.use('/api/client', swaggerUI.serve, swaggerUI.setup(require('./routes/admin/v1/admin.swagger.json'), {
        explorer: false,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: "Client APIs v1.0",
        customfavIcon: "/adminLTE/images/favicon.ico",
        swaggerOptions: {
            docExpansion: "none",
        }
    }));

    console.log(`Swagger Ui: Success`);
} else {
    console.log(`Swagger Ui: FAILED => Environment: ${process.env.NODE_ENV||''} > Port: ${process.env.PORT||80}`)
}

console.log(`------------------------------- FG Digital [${packageInfo.name}] -------------------------------`);

//------------------------- API & VIEW ROUTES --------------------------

// APIs

// v1
app.use('/admin/v1', require('./routes/admin/api.admin'))
app.use('/employee/v1', (req, res) => { return res.status(400).send('UNKNOWN-APIS') })
app.use('/client/v1', (req, res) => { return res.status(400).send('UNKNOWN-APIS') })

// Views
app.use('/', require('./routes/static.view'))
app.use('/admin', require('./routes/admin/view.route'))
app.use('/employee', require('./routes/employee/view.route.js'))
app.use('/client', require('./routes/client/view.route.js'))

app.use('*', (req, res) => { res.sendFile(process.cwd() + '/views/404.html') }) // 404 Not Found

module.exports = app;