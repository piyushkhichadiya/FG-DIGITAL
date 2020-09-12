const urlParam = new URLSearchParams(window.location.search);
var plan_id = urlParam.get('plan_id'),
    client_id = urlParam.get('client_id');
if (client_id) {
    $.get('/admin/v1/client/get?client_id=' + client_id, (data) => {
        var name = data.data.name;
        $('#lbl_navClient').html(name)
        $('#lbl_navClient').attr('href', `/admin/client`)
    }).fail(error => {
        error = error.responseJSON
        $(document).Toasts('create', {
            title: 'Error #' + error.code,
            autohide: true,
            delay: 5000,
            body: error.message,
            class: 'bg-danger',
        });
    });
}
if (plan_id) {
    $.get(`/admin/v1/project/fetch/${plan_id}?scope=info`, (data) => {
        var name = data.data.info.project_name
        $('#lbl_navProjectId').html(`${name || ''} (${plan_id})`);
        $('#lbl_navProjectId').attr('href', `/admin/client/project-dashboard?client_id=${client_id}&plan_id=${plan_id}`);
    }).fail(error => {
        error = error.responseJSON
        $(document).Toasts('create', {
            title: 'Error #' + error.code,
            autohide: true,
            delay: 5000,
            body: error.message,
            class: 'bg-danger',
        });
    });
}