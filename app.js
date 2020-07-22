var express = require('express'),
    path = require('path'),
    app = express(),
    bodyParser = require('body-parser'),
    session = require('express-session'),
    multipartParser = require('express-fileupload'),
    cookieParser = require('cookie-parser')

//----------------------------- CONFIGURATION -------------------------------

// Set View File Type and Engine
app.use(express.static('./views/static'))

// Syntax Error Handling [ex. JSON]
app.use(bodyParser.json(), (error, req, res, next) => {
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

// Basic Directory Generate
const directory_gen = require('./config/directory');
directory_gen('admin')

//----------------------------- DATABASE -------------------------------
var firebase = require('./config/database')
var obj_firebase = new firebase()
obj_firebase.initialization()
    // console.log(obj_firebase.status());

//------------------------- SESSION & COOKIE ---------------------------

// Cookie Parser
app.use(cookieParser())

// Portal [SESSION]
app.use(session({ secret: 'MY-SECRET', resave: true, saveUninitialized: true, cookie: { secure: false, sameSite: true } }))

//------------------------- API & VIEW ROUTES --------------------------

// APIs

// v1
app.use('/admin/v1', require('./routes/admin/api.admin'))
app.use('/employee/v1', (req, res) => { return res.status(400).send('UNKNOWN-APIS') })
app.use('/client/v1', (req, res) => { return res.status(400).send('UNKNOWN-APIS') })

// Views
app.get('/', (req, res) => { res.sendFile(process.cwd() + '/views/static/index.html') })
app.use('/admin', require('./routes/admin/adminView.route'))
app.use('/employee', require('./routes/employee/employeeView.route.js'))
app.use('/client', require('./routes/client/clientView.route.js'))

app.use('*', (req, res) => { return res.redirect('/') })

module.exports = app;