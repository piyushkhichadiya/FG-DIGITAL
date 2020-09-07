const express = require('express'),
    clientView = express.Router(),
    checkAuth = require('./checkAuth')

//Set Static Directory
clientView.use(express.static('public/adminLTE'))

// ---------- Trailing Slash Static Asset ---------- 

// Basic
var routes = ['/login/', '/profile/']

// Project
routes.push.apply(routes, ['/projects/', '/project/', '/project-activity/', '/project-review', '/project-review-view'])

clientView.use(routes, express.static('public/adminLTE'))

// ------------------ VALIDATE USER ------------------
clientView.use(/^(?!\/login).*/, checkAuth);

//------------------------- CLIENT VIEW ROUTES ----------------------

// Login
clientView.get('/login', (req, res) => { res.sendFile(process.cwd() + '/views/portal/client/login.html') });

// Profile
clientView.get('/profile', (req, res) => { res.sendFile(process.cwd() + '/views/portal/client/profile.html') });

// Project
clientView.get(['/projects', '/project'], (req, res) => { res.sendFile(process.cwd() + '/views/portal/client/projects.html') });
clientView.get('/project-activity', (req, res) => { res.sendFile(process.cwd() + '/views/portal/client/activity.html') });
clientView.get('/project-review', (req, res) => { res.sendFile(process.cwd() + '/views/portal/client/review.html') });
clientView.get('/project-review-view', (req, res) => { res.sendFile(process.cwd() + '/views/portal/client/review-view.html') });

module.exports = clientView;