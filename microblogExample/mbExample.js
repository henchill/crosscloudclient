$(document).ready(function() {

	// listeners for the buttons
	$("#fUser").click(function() {
		if ($("#webid").val() === "") {
			alert("please provide a webid");
		} else {
			fetchUser($("#webid").val());
		}
	});

	$("#nc").click(function() {
		if ($("#space").val() === "") {
			alert("please provide a space to write to");
		} else {
			newChannel($("#space").val());
		}
	});

	$("#np").click(function() {
		if ($("#churi").val() === "") {
			alert("please provide a channel uri");
		} else {
			newPost($("#churi").val());
		}
	});

	$("#fCont").click(function() {
		if ($("#space").val() === "") {
			alert("please provide a space to write to");
		} else {
			fetchChannels($("#space").val());
		}
	});

	$("#fPost").click(function() {
		if ($("#churi").val() === ""){
			alert("please provide a channel uri");
		} else {
			fetchPosts($("#churi").val());
		}
	});

	$("#acl").click(function() {
		if ($("#webid").val() === "" || $("#churi").val() === "") {
			alert("this operation requires a webid and containerUri");
		} else {
			setAcl($("#webid").val(), $("#churi").val());
		}
	})

	//actual functions a code
	var client = CrossCloudClient();

	var savedUser, savedSpace, savedChannel;

	var fetchUser = function (userWebid) {
		client.getUserCard(userWebid, UserAccount(), function(status, result) {
			savedUser = result;
			savedSpace = result.properties.storage.value;
			$("#output").html("<p>" + JSON.stringify(result) + '</p>');
			// $("#space").val(savedSpace);
		});
	}

	var newChannel = function (space) {
		var channel = Channel({'title': 'MB Example JSClient', 'owner': undefined});

		client.writeContainer(space, channel, function(status, result) {
			// TODO: need to set ACL
			savedChannel = result.containerUri;
			$("#output").html("<p>" + JSON.stringify(result) + '</p>');
			$("#churi").val(savedChannel);
		});
	}

	var newPost = function (churi) {
		var post = Post({'body': 'client body for post', 'owner': undefined});
		client.writeResource(churi, post, function(status, result) {
			$("#output").html("<p>" + JSON.stringify(result) + '</p>');
		});
	}

	var fetchChannels = function(space) {
		client.getContainers(space, Channel(), function(status, results) {
			if (status) {
				var out = "";
				for (var i in results) {
					out += JSON.stringify(results[i]);
					out += '<br><br>';
				}
				$("#output").html("<p>" + out + '</p>');
			} else {
				$("#output").html("<p>" + JSON.stringify(results) + '</p>');
			}
		});
	}

	var fetchPosts = function(churi) {
		client.getResource(churi, Post(), function(status, results) {
			if (status) {
				var out = "";
				for (var i in results) {
					out += JSON.stringify(results[i]);
					out += '<br><br>';
				}
				$("#output").html("<p>" + out + '</p>');
			} else {
				$("#output").html("<p>" + JSON.stringify(results) + '</p>');
			}
		});
	}

	var setAcl = function(webid, churi) {
		client.setAcl(churi, webid, undefined, undefined, function(status, result) {
			if (status) {
				$("#output").html("<p>Acl successfully set</p>");
			} else {
				$("#output").html("<p>" + JSON.stringify(result) + "</p>");
			}
		});
	}
});