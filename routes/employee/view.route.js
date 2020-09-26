const express = require('express'),
    employeeView = express.Router(),
    checkAuth = require('./checkAuth')

//Set Static Directory
employeeView.use(express.static('public/adminLTE'))

// ---------- Trailing Slash Static Asset ---------- 

// Basic
var routes = ['/login/', '/profile/']

// Projects
routes.push.apply(routes, ['/projects/'])

// Client & Projects
routes.push.apply(routes, ['/project/', '/projects/', '/project-dashboard/', '/project-add/', '/project-info/',
    '/project-service/', '/project-team/', '/project-accounts/', '/project-review-create/', '/project-review-view/',
    '/project-review/', '/project-activity/'
])

employeeView.use(routes, express.static('public/adminLTE'))

// ------------------ VALIDATE USER ------------------
employeeView.use(/^(?!\/login).*/, checkAuth);

//------------------------- EMPLOYEE VIEW ROUTES ----------------------

// Login
employeeView.get('/login', (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/login.html') });

// Profile
employeeView.get('/profile', (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/profile.html') });

// Dashboard
employeeView.get('/', (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/dashboard.html') })

// Client Project
employeeView.get(['/projects', '/project'], (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/projects.html') })
employeeView.get('/project-dashboard', (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/project-dashboard.html') })
employeeView.get('/project-info', (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/project-info.html') })
employeeView.get('/project-client', (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/project-client.html') })
employeeView.get('/project-review', (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/project-review.html') })
employeeView.get(['/project-review-create', '/project-review-view'], (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/project-review-view.html') })
employeeView.get('/project-activity', (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/project-activity.html') })
employeeView.get('/project-team', (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/project-team.html') })
employeeView.get('/project-service', (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/project-service.html') })
employeeView.get('/project-accounts', (req, res) => { res.sendFile(process.cwd() + '/views/portal/employee/project-accounts.html') })

module.exports = employeeView;