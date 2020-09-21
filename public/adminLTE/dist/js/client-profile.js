const urlParam = new URLSearchParams(window.location.search);
$.get('/client/v1/profile', (data) => {
    profileData = data.data
    if (profileData) {
        $('#lbl_profileName').text(profileData.name);
    }
}).fail(error => {
    error = error.responseJSON
    if (error.status == 404 || error.status == 401) {
        logout(true)
    }
});

if (urlParam.has('plan_id')) {
    $.getJSON(`/client/v1/project/?project_id=${urlParam.get('plan_id')}`, (result) => {
        var projectData = result.data;
        $('#link_navProjects').html(projectData.name || '' + ` (${projectData.project_id})`);
        $('#link_navProjects').attr('href', `/client/project-dashboard/?plan_id=${urlParam.get('plan_id')}`);
    }).fail(error => {
        window.location.href = '/employee/projects'
    });
}

// Table Error Disable
if ($.fn.dataTable && $.fn.dataTable.ext && $.fn.dataTable.ext.errMode) {
    $.fn.dataTable.ext.errMode = 'none';
}