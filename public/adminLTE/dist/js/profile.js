$.get('/admin/v1/profile', (data) => {
    profileData = data.data
    if (profileData) {
        $('#lbl_profileName').text(profileData.name);
        $('#img_profileImage').attr('src', `/admin/v1/profile/file/` + profileData.profile_image)
    }
}).fail(error => {
    error = error.responseJSON
    if (error.status == 404 || error.status == 401) {
        logout(true)
    }
});