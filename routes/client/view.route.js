const express = require('express'),
    adminView = express.Router(),
    checkAuth = require('./checkAuth')

//Set Static Directory
adminView.use(express.static('public/adminLTE'))

// ---------- Trailing Slash Static Asset ---------- 

// Basic
var routes = ['/login/']

adminView.use(routes, express.static('public/adminLTE'))

// ------------------ VALIDATE USER ------------------
// adminView.use(/^(?!\/login).*/, checkAuth);

//------------------------- ADMIN VIEW ROUTES ----------------------

// Login
adminView.get('/login', (req, res) => { res.sendFile(process.cwd() + '/views/portal/client/login.html') });

module.exports = adminView;