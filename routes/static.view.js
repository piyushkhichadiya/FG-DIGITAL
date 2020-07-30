const express = require('express'),
    staticView = express.Router()

//Set Static Directory
staticView.use(express.static('public/static'))

// ---------- Trailing Slash Static Asset ---------- 

//------------------------- VIEW ROUTES ----------------------

staticView.get(['/', '/index.html'], (req, res) => { return res.sendFile(process.cwd() + '/views/static/index.html') })
staticView.get(['/about', '/about.html'], (req, res) => { return res.sendFile(process.cwd() + '/views/static/about.html') })
staticView.get(['/work', '/work.html'], (req, res) => { return res.sendFile(process.cwd() + '/views/static/work.html') })
staticView.get(['/contact', '/contact.html'], (req, res) => { return res.sendFile(process.cwd() + '/views/static/contact.html') })

// NOT FOUND
staticView.get('*', (req, res) => { res.redirect('/') });

module.exports = staticView;