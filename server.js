var http = require('http'),
    port = process.env.PORT || 80;

http.createServer(require('./app')).listen(port);