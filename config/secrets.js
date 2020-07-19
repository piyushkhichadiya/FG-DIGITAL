module.exports = {
    jwt: () => {
        return 'MY-SECRET'
    },
    simple_crypto: () => {
        return 'MY-SECRET'
    },
    firebase_admin_sdk: () => {
        return {
            development: {
                sdk: {
                    // PASTE SDK
                    // Put Database URL at databaseURL
                },
                databaseURL: ''
            },
            production: {
                sdk: {
                    // PASTE SDK
                    // Put Database URL at databaseURL
                },
                databaseURL: ''
            }
        }
    }
}
