const clientProjectAPI = require('express').Router(),
    firebase = require('firebase-admin').database(),
    fs = require('fs'),
    { response } = require('../../../../functions/functions')

//----------------------------- CONFIGURATION -------------------------------

//---------------------------- GLOBAL VARIABLE ------------------------------

var dbAdminSnapshot, clientAuthToken, dbClientAccount;
clientProjectAPI.use((req, res, next) => {
    dbAdminSnapshot = req.session.dbAdminSnapshot
    clientAuthToken = req.session.decode_clientAuthToken
    dbClientAccount = dbAdminSnapshot.clients[clientAuthToken.client_key];
    next();
});

//--------------------------------- ROUTES ----------------------------------

//----------------------------- 3. CLIENT PROJECT ---------------------------

// 3.1 Get All Project 
clientProjectAPI.get(['/', '/get'], (req, res) => {
    if (dbClientAccount.plans) {
        var dbClientPlan = dbClientAccount.plans,
            dbClientPlanKey = Object.keys(dbClientPlan),
            postProject = []

        for (var i = 0; i < dbClientPlanKey.length; i++) {
            var tempPlan = dbClientPlan[dbClientPlanKey[i]];

            if (tempPlan.deleted) { continue }

            var tempObj = {
                project_id: tempPlan.project_id,
                createdOn: tempPlan.createdOn,
                createdBy: tempPlan.createdBy,
                plan_name: tempPlan.plan,
                price: parseInt(tempPlan.price),
                duration: parseInt(tempPlan.duration),
                project_name: tempPlan.project_name,
                project_description: tempPlan.project_description,
                start_date: tempPlan.start_date,
                end_date: String(new Date(new Date(tempPlan.start_date).setDate(new Date(tempPlan.start_date).getDate() + parseInt(tempPlan.duration))))
            }

            if (new Date(tempPlan.start_date) > new Date()) {
                tempObj.status = 'scheduled'
            } else if (new Date() >= new Date(tempPlan.start_date) && new Date() <= new Date(tempPlan.start_date).setDate(new Date(tempPlan.start_date).getDate() + parseInt(tempPlan.duration))) {
                tempObj.status = 'running'
            } else {
                tempObj.status = 'expired'
            }

            postProject.push(tempObj)
            if (parseInt(req.query.project_id) == parseInt(tempObj.project_id)) {
                return response(res, 200, 'success', undefined, tempObj, 'C-3.1.1')
            }
        }

        if (req.query.project_id) {
            return response(res, 404, 'notFound', 'Incorrect Project ID', undefined, 'C-3.1.2')
        }
        return response(res, 200, 'success', undefined, postProject, 'C-3.1.3')
    } else {
        return response(res, 200, 'success', 'No Projects found', undefined, 'C-3.1.4')
    }

});

module.exports = clientProjectAPI;