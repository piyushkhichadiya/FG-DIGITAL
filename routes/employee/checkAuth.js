const checkAuth = require('express').Router(),
    { jwtDecode } = require('./v1/functions/functions');

//Route
checkAuth.all('*', (req, res, next) => {
    if (req.session.employeeAuthToken || req.cookies.employeeAuthToken) {
        var token = req.session.employeeAuthToken || req.cookies.employeeAuthToken;
        if (!jwtDecode(token)) {
            req.session.employeeAuthToken = undefined
            res.clearCookie('employeeAuthToken');
            return res.redirect('/employee/login?redirect=' + req.protocol + '://' + req.headers.host + encodeURI(req.originalUrl))
        }
        return next();
    } else {
        req.session.employeeAuthToken = undefined
        res.clearCookie('employeeAuthToken');
        return res.redirect('/employee/login?redirect=' + req.protocol + '://' + req.headers.host + encodeURI(req.originalUrl))
    }
});

module.exports = checkAuth;