const firebase = require('firebase-admin'),
    { response, jwtDecode } = require('../../../../functions/functions');

module.exports = {
    employeeAuthToken: async(req, res, next) => {
        if (req.cookies && req.cookies.employeeAuthToken || req.session.employeeAuthToken) {
            var jwtToken = req.cookies.employeeAuthToken || req.session.employeeAuthToken;
            if (jwtDecode(jwtToken)) {
                // Decode Token
                var token = jwtDecode(jwtToken)

                // Validate Token
                if (token.employee_key && token.tokenCode && ['T-E-1.1', 'T-E-2.2'].includes(token.tokenCode) && token.authToken) {

                    var dbEmployee = await firebase.database().ref('/admin/employees/' + token.employee_key).once('value').then(snapshot => { return snapshot.val(); });

                    // Verify Admin Account 
                    if (dbEmployee) {
                        if (!dbEmployee.deleted) {
                            if (dbEmployee.authToken != token.authToken) {
                                response(res, 401, 'expired', 'Token Expired', undefined, 'E-MW-5');
                                return false;
                            }

                            var dbAdminSnapshot = await firebase.database().ref('/admin').once('value').then(snapshot => { return snapshot.val() });
                            req.session.dbAdminSnapshot = dbAdminSnapshot;
                            req.session.decode_employeeAuthToken = token;
                            return next();
                        } else {
                            response(res, 403, 'accountDeleted', 'Account does not exist', undefined, 'E-MW-6');
                            return false;
                        }

                    } else {
                        response(res, 401, 'unauthorized', 'User is not authorized to make request', undefined, 'E-MW-4');
                        return false;
                    }
                } else {
                    // For not having sufficient data
                    response(res, 401, 'authError', 'Token Expired/Old Version/Invalid', undefined, 'E-MW-3');
                    return false;
                }
            } else {
                // Invalid Token, Failed in JWT Verify
                response(res, 401, 'unauthorized', 'Invalid Token', undefined, 'E-MW-2');
                return false;
            }
        } else {
            // Token not found
            response(res, 401, 'unauthorized', 'Access Token not found', undefined, 'E-MW-1');
            return false;
        }
    }
}