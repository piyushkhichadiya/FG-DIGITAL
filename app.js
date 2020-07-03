var express = require('express'),
    path = require('path'),
    app = express();

//configuration
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');
app.use(express.static('./views/static'));

app.use('/', (req, res) => {
    return res.redirect('index.html');
})

module.exports = app;