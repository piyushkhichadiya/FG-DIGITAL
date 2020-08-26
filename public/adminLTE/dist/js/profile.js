$(document).ready(() => {
    $(document).ready(() => {
        $.get('/admin/v1/profile', (data) => {
            profileData = data.data
            if (profileData) {
                $('#lbl_profileName').text(profileData.name);
                $('#img_profileImage').attr('src', `/admin/v1/profile/file/` + profileData.profile_image)
            }
        });
    });
});