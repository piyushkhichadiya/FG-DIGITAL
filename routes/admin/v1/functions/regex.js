module.exports = {
    text: (text) => {
        var regText = "^[A-Za-z]+((\s)?((\'|\-|\.)?([A-Za-z])+))*$"
        if (text.match(regText)) {
            return true
        }
        return false

    },
    email: (email) => {
        var regEmail = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        if (email.match(regEmail)) {
            return true
        }
        return false
    },
    regexNumber: (number) => {
        var regNum = /^[0-9]*$/
        if (number.match(regNum)) {
            return true
        }
        return false

    }
}