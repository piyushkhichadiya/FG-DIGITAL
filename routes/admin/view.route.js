const express = require('express'),
    adminView = express.Router(),
    checkAuth = require('./checkAuth')

//Set Static Directory
adminView.use(express.static('public/adminLTE'))

// ---------- Trailing Slash Static Asset ---------- 

// Basic
var routes = ['/login/', '/profile/']

// Plan
routes.push.apply(routes, ['/plan/', '/plan/add'])

// Client & Projects
routes.push.apply(routes, ['/client/', '/client/add',
    '/client/project/', '/client/project-dashboard/', '/client/project-add/', '/client/project-info/',
    '/client/project-service/', '/client/project-team/', '/client/project-social-account/',
    '/client/project-review/', '/client/project-reviews/', '/client/project-review-view/', '/client/project-reviews-view/',
    '/client/project-activity/'
])

// Employee
routes.push.apply(routes, ['/employee/', '/employee/add/', '/employee/view/'])

// Service
routes.push.apply(routes, ['/services/', '/service/create/', '/service/view/'])

adminView.use(routes, express.static('public/adminLTE'))

// ------------------ VALIDATE USER ------------------
adminView.use(/^(?!\/login).*/, checkAuth);

//------------------------- ADMIN VIEW ROUTES ----------------------

// Login
adminView.get('/login', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/login.html') });

// Dashboard
adminView.get('/', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/dashboard.html') });

// Profile
adminView.get('/profile', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/profile.html') });

// Plan
adminView.get('/plan', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/plan.html') });
adminView.get('/plan/add', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/plan-add.html') });

// Clients
adminView.get('/client', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/client.html') });
adminView.get('/client/add', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/client-add.html') });

// Client > Project
adminView.get('/client/project', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/client-project/client-projects.html') });
adminView.get('/client/project-dashboard', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/client-project/client-project-dashboard.html') });
adminView.get('/client/project-add', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/client-project/client-project-add.html') });
adminView.get('/client/project-info', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/client-project/client-project-info.html') });
adminView.get('/client/project-service', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/client-project/project-service.html') });
adminView.get('/client/project-team', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/client-project/project-team.html') });
adminView.get('/client/project-social-account', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/client-project/project-social-account.html') });
adminView.get(['/client/project-review', '/client/project-reviews'], (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/client-project/project-reviews.html') });
adminView.get(['/client/project-review-view', '/client/project-reviews-view'], (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/client-project/project-review-view.html') });
adminView.get('/client/project-activity', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/client-project/project-activity.html') });

// Employee
adminView.get('/employee', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/employee.html') });
adminView.get(['/employee/add', '/employee/view'], (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/employee-add.html') });

// Services
adminView.get('/services', (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/services.html') });
adminView.get(['/service/create', '/service/view'], (req, res) => { res.sendFile(process.cwd() + '/views/portal/admin/service-detail.html') });

module.exports = adminView;