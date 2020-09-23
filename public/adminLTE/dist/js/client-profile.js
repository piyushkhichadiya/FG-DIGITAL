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

function logout(force) {
    if (force) {
        return session_expire();
    }
    Swal.fire({
        title: 'Are you sure?',
        text: "You have to login again in order to access the portal.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Log out'
    }).then((result) => {
        if (result.value) {
            session_expire()
        }
    })
}

function session_expire() {
    $.get({
        url: '/client/v1/user/logout',
        success: function() {
            window.location.reload()
        },
        error: function(error) {
            error = error.responseJSON
            $(document).Toasts('create', {
                title: 'Error #' + error.code,
                autohide: true,
                delay: 5000,
                body: error.message,
                class: 'bg-danger',
            });
        }
    });
}