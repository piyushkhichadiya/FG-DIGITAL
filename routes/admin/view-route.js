const adminView = require('express').Router(),
    checkAuth = require('./checkAuth')

//Set Static Directory
adminView.use(express.static('public'))

// Trailing Slash Static Asset
var routes = []
adminView.use(routes, express.static('public'), express.static('public'))

// No Cache
// adminView.use((req, res, next) => {
//     res.set('Cache-Control', 'no-store')
//     next();
// })

//------------------------- ADMIN VIEW ROUTES ----------------------

module.exports = adminView;