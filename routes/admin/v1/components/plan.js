const planAPI = require('express').Router(),
    firebase = require('firebase-admin'),
    { response } = require('../functions/functions')

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------
var dbAdminSnapshot, adminAuthToken;
planAPI.use((req, res, next) => {
    dbAdminSnapshot = req.session.dbAdminSnapshot
    adminAuthToken = req.session.decode_adminAuthToken
    next();
})

//--------------------------------- ROUTES ----------------------------------

//--------------------------------- 3. PLAN ---------------------------------

// 3.1 ADD PLAN
planAPI.post('/add', (req, res) => {
    if (!req.body.plan_name || !req.body.price || !req.body.days) {
        return response(res, 400, 'required', 'Plan name, Price and Day are required', undefined, 'A-3.1.1');
    }

    if (isNaN(req.body.price) || isNaN(req.body.days)) {
        return response(res, 400, 'invalid', 'Price/Day must be number', undefined, 'A-3.1.2');
    }

    var plan_name = String(req.body.plan_name).trim(),
        price = parseInt(req.body.price),
        days = parseInt(req.body.days);

    if (days <= 0) {
        return response(res, 403, 'forbidden', 'Days must be greater than 0', undefined, 'A-3.1.3');
    }

    if (price <= 0) {
        return response(res, 403, 'forbidden', 'Price must be greater than 0', undefined, 'A-3.1.4');
    }

    var postData = {
        plan_name: plan_name,
        price: String(price),
        days: String(days),
        createdOn: String(new Date())
    }

    return firebase.database().ref('/admin/plans').push(postData).then(() => {
        return response(res, 200, 'success', undefined, undefined, 'A-3.1.5');
    });
});

// 3.2 UPDATE PLAN
planAPI.post('/update', (req, res) => {
    if (!req.body.plan_id) {
        return response(res, 400, 'required', 'Plan ID is required', undefined, 'A-3.2.1');
    }

    if (dbAdminSnapshot.plans && dbAdminSnapshot.plans[req.body.plan_id] && !dbAdminSnapshot.plans[req.body.plan_id].deleted) {
        var dbPlan = dbAdminSnapshot.plans[req.body.plan_id];

        if (req.body.plan_name) {
            dbPlan.plan_name = String(req.body.plan_name);
        }

        if (req.body.price) {
            if (isNaN(req.body.price) || parseInt(req.body.price) <= 0) {
                return response(res, 403, 'forbidden', 'Price must be integer and greater than 0', undefined, 'A-3.2.3');
            }
            dbPlan.price = String(req.body.price).trim()
        }

        if (req.body.days) {
            if (isNaN(req.body.days) || parseInt(req.body.days) <= 0) {
                return response(res, 403, 'forbidden', 'days must be integer and greater than 0', undefined, 'A-3.2.4');
            }
            dbPlan.days = String(req.body.days).trim()
        }

        dbPlan.lastModifiedOn = String(new Date());

        firebase.database().ref('/admin/plans/' + req.body.plan_id).update(dbPlan).then(() => {
            return response(res, 200, 'success', undefined, undefined, 'A-3.2.5');
        })
    } else {
        return response(res, 404, 'notFound', 'Incorrect Plan ID', undefined, 'A-3.2.2');
    }
});

// 3.3 REMOVE PLAN
planAPI.get('/remove', (req, res) => {
    if (!req.query.plan_id) {
        return response(res, 400, 'required', 'Plan ID is required', undefined, 'A-3.3.1');
    }

    if (dbAdminSnapshot.plans && dbAdminSnapshot.plans[req.query.plan_id] && !dbAdminSnapshot.plans[req.query.plan_id].deleted) {
        var dbPlan = dbAdminSnapshot.plans[req.query.plan_id];

        dbPlan.lastModifiedOn = String(new Date());
        dbPlan.deleted = true;

        firebase.database().ref('/admin/plans/' + req.query.plan_id).set(dbPlan).then(() => {
            return response(res, 200, 'success', undefined, undefined, 'A-3.3.3');
        })
    } else {
        return response(res, 404, 'notFound', 'Incorrect Plan ID', undefined, 'A-3.3.2');
    }
});

// 3.4 GET PLAN
planAPI.get(['/', '/get'], (req, res) => {
    if (dbAdminSnapshot.plans) {
        var dbPlans = dbAdminSnapshot.plans,
            dbPlansKey = Object.keys(dbPlans)
        var postPlans = [];
        for (var i = 0; i < dbPlansKey.length; i++) {
            var tempPlan = dbPlans[dbPlansKey[i]];

            if (!tempPlan.deleted) {
                var tempObj = {
                    plan_id: dbPlansKey[i],
                    plan_name: tempPlan.plan_name,
                    price: tempPlan.price,
                    days: tempPlan.days,
                    createdOn: tempPlan.createdOn,
                    lastModifiedOn: tempPlan.lastModifiedOn,
                }

                postPlans.push(tempObj);
            }
        }
        return response(res, 200, 'success', undefined, postPlans, 'A-3.4.1')
    } else {
        return response(res, 200, 'success', 'No Plans found', [], 'A-3.4.2');
    }
});

module.exports = planAPI;