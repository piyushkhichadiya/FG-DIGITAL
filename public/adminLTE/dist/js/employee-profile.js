const urlParam = new URLSearchParams(window.location.search);
$.get('/employee/v1/profile', (data) => {
    profileData = data.data
    if (profileData) {
        $('#lbl_profileName').text(profileData.name);
        $('#img_profileImage').attr('src', `/employee/v1/profile/file/` + profileData.profile_image)
    }
}).fail(error => {
    error = error.responseJSON
    if (error.status == 404 || error.status == 401) {
        logout(true)
    }
});

if (urlParam.has('plan_id')) {
    $.getJSON(`/employee/v1/project/fetch?project_id=${urlParam.get('plan_id')}&scope=info`, (result) => {
        var projectData = result.data.project;
        $('#link_navProjects').html(`${projectData.name || ''} (${urlParam.get('plan_id')})`);
        $('#link_navProjects').attr('href', `/employee/project-dashboard/?plan_id=${urlParam.get('plan_id')}`);
    }).fail(error => {
        window.location.href = '/employee/projects'
    });
}

// Table Error Disable
if ($.fn.dataTable && $.fn.dataTable.ext && $.fn.dataTable.ext.errMode) {
    $.fn.dataTable.ext.errMode = 'none';
}

$.get('/employee/v1/version', (data) => {
    var data = data.data
    $('#lbl_ui_version').html('v' + data.current_version)
});