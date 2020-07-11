const checkAuth = require('express').Router()

//Route
checkAuth.all('*', (req, res, next) => {
    if (req.session.adminAuthToken || req.cookies.adminAuthToken) {
        var token = req.session.adminAuthToken || req.cookies.adminAuthToken;
        return next();
    } else {
        return res.redirect('/admin/login?redirect=' + req.protocol + '://' + req.headers.host + encodeURI(req.originalUrl))
    }
});

module.exports = checkAuth;