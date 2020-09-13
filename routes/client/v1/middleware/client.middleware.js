const firebase = require('firebase-admin'),
    { response, jwtDecode } = require('../../../../functions/functions');

module.exports = {
    clientAuthToken: async(req, res, next) => {
        if (req.cookies && req.cookies.clientAuthToken || req.session.clientAuthToken) {
            var jwtToken = req.cookies.clientAuthToken || req.session.clientAuthToken;
            if (jwtDecode(jwtToken)) {
                // Decode Token
                var token = jwtDecode(jwtToken)

                // Validate Token
                if (token.client_key && token.tokenCode && ['T-C-1.1', 'T-C-2.2'].includes(token.tokenCode) && token.authToken) {

                    var dbClient = await firebase.database().ref('/admin/clients/' + token.client_key).once('value').then(snapshot => { return snapshot.val(); });

                    // Verify Admin Account 
                    if (dbClient) {
                        if (!dbClient.deleted) {
                            if (dbClient.authToken != token.authToken) {
                                response(res, 401, 'expired', 'Token Expired', undefined, 'C-MW-5');
                                return false;
                            }

                            var dbAdminSnapshot = await firebase.database().ref('/admin').once('value').then(snapshot => { return snapshot.val() });
                            req.session.dbAdminSnapshot = dbAdminSnapshot;
                            req.session.decode_clientAuthToken = token;
                            return next();
                        } else {
                            response(res, 403, 'accountDeleted', 'Account does not exist', undefined, 'C-MW-6');
                            return false;
                        }

                    } else {
                        response(res, 401, 'unauthorized', 'User is not authorized to make request', undefined, 'C-MW-4');
                        return false;
                    }
                } else {
                    // For not having sufficient data
                    response(res, 401, 'authError', 'Token Expired/Old Version/Invalid', undefined, 'C-MW-3');
                    return false;
                }
            } else {
                // Invalid Token, Failed in JWT Verify
                response(res, 401, 'unauthorized', 'Invalid Token', undefined, 'C-MW-2');
                return false;
            }
        } else {
            // Token not found
            response(res, 401, 'unauthorized', 'Access Token not found', undefined, 'C-MW-1');
            return false;
        }
    }
}