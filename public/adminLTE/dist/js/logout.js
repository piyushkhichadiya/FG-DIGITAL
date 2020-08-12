function logout(){
	Swal.fire({
	  title: 'Are you sure?',
	  text: "You want to Signout this session!",
	  icon: 'warning',
	  showCancelButton: true,
	  confirmButtonColor: '#3085d6',
	  cancelButtonColor: '#d33',
	  confirmButtonText: 'Signout'
	}).then((result) => {
		if (result.value) {
		  $.ajax({ 
		  	url: 'http://localhost/admin/v1/user/logout', 
		  	success: function () {
		  	 document.location = '/admin/login'; 
		  	}, 
		  	error: function () { 
		  		alert('Logout failed'); 
		  	} 
		  }); 
		  return false;
		}
	})
}