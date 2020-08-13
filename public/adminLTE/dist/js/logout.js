function logout(force){
	if(force){
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
function session_expire(){
	$.get({ 
		  	url: '/admin/v1/user/logout', 
		  	success: function () {
		  	 window.location.reload()
		  	}, 
		  	error: function () {
		  		error=error.responseJSON 
		  		$(document).Toasts('create', {
	                title: 'Error #'+error.code,
	                autohide: true,
	                delay: 5000,
	                body: error.message,
	                class: 'bg-danger',
	            }); 
		  	} 
		  });
}