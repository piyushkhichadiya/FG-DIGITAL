const { static } = require('express')

const express = require('express'),
    staticView = express.Router()

//Set Static Directory
staticView.use(express.static('public/static'))

// ---------- Trailing Slash Static Asset ---------- 
var trailingRoutes = ['/about/', '/work/', '/blog/', '/blog-details/', '/contact/', '/privacy/']

staticView.use(trailingRoutes, express.static('public/static'));

//------------------------- VIEW ROUTES ----------------------

staticView.get('/', (req, res) => { return res.sendFile(process.cwd() + '/views/static/index.html') })
staticView.get('/about', (req, res) => { return res.sendFile(process.cwd() + '/views/static/about.html') })
staticView.get('/work', (req, res) => { return res.sendFile(process.cwd() + '/views/static/work.html') })
staticView.get('/blog', (req, res) => { return res.sendFile(process.cwd() + '/views/static/blog.html') })
staticView.get('/blog-details', (req, res) => { return res.sendFile(process.cwd() + '/views/static/blog-details.html') })
staticView.get('/contact', (req, res) => { return res.sendFile(process.cwd() + '/views/static/contact.html') })
staticView.get('/privacy', (req, res) => { return res.sendFile(process.cwd() + '/views/static/privacy.html') })

module.exports = staticView;