const checkAuth = require('express').Router(),
    { jwtDecode } = require('../../functions/functions');

//Route
checkAuth.all('*', (req, res, next) => {
    if (req.session.adminAuthToken || req.cookies.adminAuthToken) {
        var token = req.session.adminAuthToken || req.cookies.adminAuthToken;
        if (!jwtDecode(token)) {
            req.session.adminAuthToken = undefined
            res.clearCookie('adminAuthToken');
            return res.redirect('/admin/login?redirect=' + req.protocol + '://' + req.headers.host + encodeURI(req.originalUrl))
        }
        return next();
    } else {
        req.session.adminAuthToken = undefined
        res.clearCookie('adminAuthToken');
        return res.redirect('/admin/login?redirect=' + req.protocol + '://' + req.headers.host + encodeURI(req.originalUrl))
    }
});

module.exports = checkAuth;