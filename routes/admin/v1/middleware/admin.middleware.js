const firebase = require('firebase-admin'),
    { response, jwtDecode } = require('../../../../functions/functions');

module.exports = {
    adminAuthToken: async(req, res, next) => {
        if (req.cookies && req.cookies.adminAuthToken || req.session.adminAuthToken) {
            var jwtToken = req.cookies.adminAuthToken || req.session.adminAuthToken;
            if (jwtDecode(jwtToken)) {
                // Decode Token
                var token = jwtDecode(jwtToken)

                // Validate Token
                if (token.user_key && token.tokenCode && ['T-A-1.2', 'T-A-2.3'].includes(token.tokenCode) && token.authToken) {

                    var dbUser = await firebase.database().ref('/admin/users/' + token.user_key).once('value').then(snapshot => { return snapshot.val(); });

                    // Verify Admin Account 
                    if (dbUser) {
                        var dbUser;
                        if (!dbUser.deleted) {
                            if (dbUser.authToken != token.authToken) {
                                response(res, 401, 'expired', 'Token Expired', undefined, 'A-MW-5');
                                return false;
                            }

                            var dbAdminSnapshot = await firebase.database().ref('/admin').once('value').then(snapshot => { return snapshot.val() });
                            req.session.dbAdminSnapshot = dbAdminSnapshot;
                            req.session.decode_adminAuthToken = token;
                            return next();
                        } else {
                            response(res, 403, 'accountDeleted', 'Account does not exist', undefined, 'A-MW-6');
                            return false;
                        }

                    } else {
                        response(res, 401, 'unauthorized', 'User is not authorized to make request', undefined, 'A-MW-4');
                        return false;
                    }
                } else {
                    // For not having sufficient data
                    response(res, 401, 'authError', 'Token Expired/Old Version/Invalid', undefined, 'A-MW-3');
                    return false;
                }
            } else {
                // Invalid Token, Failed in JWT Verify
                response(res, 401, 'unauthorized', 'Invalid Token', undefined, 'A-MW-2');
                return false;
            }
        } else {
            // Token not found
            response(res, 401, 'unauthorized', 'Access Token not found', undefined, 'A-MW-1');
            return false;
        }
    }
}