$.get('/admin/v1/profile', (data) => {
    profileData = data.data
    if (profileData) {
        $('#lbl_profileName').text(profileData.name);
        $('#img_profileImage').attr('src', `/admin/v1/profile/file/` + profileData.profile_image)
    }
}).fail(error => {
    error = error.responseJSON
    if (error.status == 404) {
        $.get({
            url: '/admin/v1/user/logout',
            success: function() {
                window.location.reload()
            },
            error: function() {
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
    } else {
        $(document).Toasts('create', {
            title: 'Error!',
            autohide: true,
            delay: 5000,
            body: 'Profile Not Found',
            class: 'bg-danger',
        });
    }
});