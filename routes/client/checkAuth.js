const checkAuth = require('express').Router(),
    { jwtDecode } = require('../../functions/functions');

//Route
checkAuth.all('*', (req, res, next) => {
    if (req.session.clientAuthToken || req.cookies.clientAuthToken) {
        var token = req.session.clientAuthToken || req.cookies.clientAuthToken;
        if (!jwtDecode(token)) {
            req.session.clientAuthToken = undefined
            res.clearCookie('clientAuthToken');
            return res.redirect('/client/login?redirect=' + req.protocol + '://' + req.headers.host + encodeURI(req.originalUrl))
        }
        return next();
    } else {
        req.session.clientAuthToken = undefined
        res.clearCookie('clientAuthToken');
        return res.redirect('/client/login?redirect=' + req.protocol + '://' + req.headers.host + encodeURI(req.originalUrl))
    }
});

module.exports = checkAuth;