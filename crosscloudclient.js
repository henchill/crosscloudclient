/**
* This is the CrossCloud Client for acessing user pods. This client leverages rdflib.js
* to make it easier for developers to write CrossCloud Applications.
* 
* Author: Happy Enchill
*
*/



var PROXY = "https://data.fm/proxy?uri={uri}";
var AUTH_PROXY = "https://rww.io/auth-proxy?uri=";
var TIMEOUT = 90000;

// same as Object.create in ECMAScript 5
// return a fresh object whose prototype is o
var createObject = function (o) {
	var F = function () {}
	F.prototype = o;
	return new F();
}

/**
* Client that allows you to read/write to user pods and set ACL.
* 
* Notes about the callback function: The first parameter of the callback function
* is a boolean noting whether the process was successful or not, and the second 
* parameter is either the result or an error object -->
*	{errorType: "type of error that occured",
*	 message: "error message"}
* 
* @params {String} proxy A cross site proxy template.
*
*/
var CrossCloudClient = function (proxy, timeout) {
	// for debuging
	if (!proxy) {
		var proxy = PROXY;
	}
	if (!timeout) {
		var timeout = TIMEOUT;
	}

	// alternative to self
	// var tmp = Object.create(CrossCloudClient.prototype);
	// var self = new tmp();
	var self = createObject(CrossCloudClient.prototype);

    // add CORS proxy
    $rdf.Fetcher.crossSiteProxyTemplate = proxy;

    /**
    * Retrieves information about the user at the given webid. 
    * 
    * @params {String} webid The webid of the user we are fetching
    * @params {Object} shape Object describing the properties we expect the user to have
    * @params {Function} callback Function to execute after fetch is complete
    */
	self.getUserCard = function (webid, shape, callback) {
		var g = $rdf.graph();
    	var f = $rdf.fetcher(g, timeout);

		var docURI = webid.slice(0, webid.indexOf('#'));
        var webidRes = $rdf.sym(webid);
    
        f.nowOrWhenFetched(docURI, undefined, function (ok, body) {
        	if (ok) {
				var userObj = jQuery.extend(true, {}, shape);
				userObj.webid = webid;
				for (var val in shape.properties) {
					var curr = shape.properties[val];
					var tmp = g.any(webidRes, curr.vocab);
					if (tmp) userObj.properties[val].value = tmp.value;
				}
				callback(true, userObj);
			} else {
				// TODO build error message
				callback(false, body);
			}
		});
	}

	/**
	* Retrieves all containers located in a given space. The space is denoted by the uri.
	* If there are multiple workspaces within the given uri then the function fetches for
	* containers in all of those.
	* 
	* @params {String} uri The URI of the container
	* @params {Object} shape Object describing the properties the container should have
	* @params {Function} callback Function to execute when fetch is complete
	* @return {Array[shape]} Returns a list of containers found
	*/
	self.getContainers = function (uri, shape, callback) {
		var g = $rdf.graph();
    	var f = $rdf.fetcher(g, timeout);
		f.nowOrWhenFetched(uri, undefined, function (ok, body) {
			if (ok) {
				var workspaces = g.statementsMatching(undefined, RDF('type'), SIOC('Space'));
				var results = [];
				for (var i in workspaces) {
					var workspace = workspaces[i]['subject']['value'];
					f.nowOrWhenFetched(workspace+".*", undefined, function (ok, body) {
						var containers = g.statementsMatching(undefined, RDF('type'), shape.vocab);
						for (var container in containers) {
							var contObj = containers[container]['subject'];
							var currShape = jQuery.extend(true, {}, shape);
							currShape.uri = contObj.value;

							for (var p in shape.properties) {
								var attr = shape.properties[p];
								if (attr.value instanceof Object) {
									// fetch sub object
									var tmp = g.any(contObj, attr.vocab);
									var subObj = jQuery.extend(true, {}, attr.value);
									currShape.properties[p].value = subObj;
									for (var s in attr.value.properties) {
										var attr2 = attr.value.properties[s];
										var tmp2 = g.any(tmp, attr2.vocab);
										if (tmp2) subObj.properties[s].value = tmp2.value;
									}
								} else {
									var tmp = g.any(contObj, attr.vocab);
									if (tmp) currShape.properties[p].value = tmp.value;
								}
							}
							results.push(currShape);
						}
						callback(true, results);
					});
				}
			} else {
				// TODO build error message
				callback(false, body);
			}
		});
	}

	/**
	* Retrieves the resources at the given uri whose rdf type is the same vocab as that of
	* shape provided. This ignores all other items in that location.
	*
	* @params {String} uri The uri of the container in which you want to retrieve data from
	* @params {Object} shape The properties of the resource you are hoping to retrieve
	* @params {Function} callback The function to execute when the fetch is complete
	* @returns {Array[shape]} Returns list of objects of type shape. 
	*/ 
	self.getResource = function (uri, shape, callback) {
		var g = $rdf.graph();
    	var f = $rdf.fetcher(g, timeout);
		f.nowOrWhenFetched(uri+"*", undefined, function(ok, body) {
			if (ok) {
				var results = [];
				var items = g.statementsMatching(undefined, RDF("type"), shape.vocab);
				for (var i in items) {
					var currentItem = items[i]['subject'];
					var resource = jQuery.extend(true, {}, shape);
					resource.uri = currentItem.uri;
					// resource.containerUri = uri
					for (var p in shape.properties) {
						var attr = shape.properties[p];
						if (attr.value instanceof Object) {
							var tmp = g.any(currentItem, attr.vocab);
							var subObj = jQuery.extend(true, {}, attr.value);
							resource.properties[p].value = subObj;
							for (var s in attr.value.properties) {
								var attr2 = attr.value.properties[s];
								var tmp2 = g.any(tmp, attr2.vocab);
								if (tmp2) subObj.properties[s].value = tmp2.value;
							}
						} else {
							var tmp = g.any(currentItem, attr.vocab);
							if (tmp) resource.properties[p].value = tmp.value;
						}
					}
					results.push(resource);
				}
				callback(true, results);
			} else {
				callback(false, body);
			}
		});
	}

	/**
	* Write the properties of shape to the container as linked data. 
	* 
	* @params {String} container The uri of the container you would like to write to.
	* @params {Object} shape An object describing the properties of the resource
	* @params {Function} callback Function to execute when write is complete.
	* @returns {Object} Returns object containing the uri of the resource you just created.
	*/
	self.writeResource = function (container, shape, callback) {
		var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
		var g = $rdf.graph();

		recursiveAddToGraph(g, "", shape);

		var s = new $rdf.Serializer(g).toN3(g);

		$.ajax({
			type: 'POST',
			url: container,
			contentType: 'text/turtle',
			data: s, 
			processData: false,
			xhrFields: {
				withCredentials: true
			},
			statusCode: genericStatusCode(callback, "Error writing post to container"),
			success: function(d, s, r) {
				var resourceUri = r.getResponseHeader('Location');
				// consider returning the shape with the uri added. 
				callback(true, {'resourceUri': resourceUri});
			}
		});
	}

	/**
	* Write a container to the user pod with the properties in shape. Does a post
	* request on the space to optain a link header for the container that it is 
	* trying to write, then it writes to the metaURI of the container. 
	*
	* @params {String} space The uri of the directory/workspace to write to
	* @params {Object} shape Description of the properties to write.
	* @params {Function} callback Function to execute after write is complete.
	* @returns {Object} Returns an object that holds the acl uri, meta uri, and
	*                   uri of the container that was just written to the pod.
	*/
	self.writeContainer = function (space, shape, callback) {
		
		$.ajax({
			type: "POST", 
			url: space,
			processData: false,
			contentType: 'text/turtle',
			headers: {
				Link: "<http://www.w3.org/ns/ldp#BasicContainer; rel='type'"
			},
			xhrFields: {
				withCredentials: true
			}, 
			statusCode: genericStatusCode(callback, "Error fetching obtaining URI for container"),
			success: function(d, s, r) {
				meta = parseLinkHeader(r.getResponseHeader('Link'));
				metaUri = meta['meta']['href'];
				aclUri = meta['acl']['href'];
				containerUri = r.getResponseHeader('Location');

				var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
				var SIOC = $rdf.Namespace("http://rdfs.org/sioc/ns#");
				var LDPX = $rdf.Namespace("http://ns.rww.io/ldpx#");

				var g = $rdf.graph();
				if (shape.prefix) {
					g.add($rdf.sym(containerUri), LDPX('ldprPrefix'), $rdf.lit(shape.prefix));
				}
				recursiveAddToGraph(g, containerUri, shape);

				var s = new $rdf.Serializer(g).toN3(g);

				if (s.length > 0) {
					$.ajax({
						type: 'POST', 
						url: metaUri,
						contentType: 'text/turtle',
						data: s,
						processData: false,
						xhrFields: {
							withCredentials: true
						},
						statusCode: genericStatusCode(callback, "Error writing to metaURI"),
						success: function (d, s, r) {
							callback(true, {'metaUri': metaUri, 
										'aclUri': aclUri,
										'containerUri': containerUri});
						}
					});
				}
			}
		});
	}

	/**
	* Set the acl for the given uri.
	* Modes include: ['Read', 'Write', 'Append']
	*
	* @params {String} uri The item you would like to set an acl for
	* @params {String} owner The uri of the owner of the item being written
	* @params {Array<String>} modes An array of strings denoting the type of access
	* @params {Array<String>} group List of webids that you would like to apply 
	*                         the list of modes to.
	* @params {Function} callback Function to execute upon completion
	*/
	self.setAcl = function (uri, owner, modes, group, callback) {
		var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
		var WAC = $rdf.Namespace("http://www.w3.org/ns/auth/acl#");
        var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
        // var g = $rdf.graph();
        // var s = new $rdf.Serializer(g).toN3(g);

        $.ajax({
			type: 'HEAD',
			url: uri,
			xhrFields: {
				withCredentials: true
			},
			success: function(d, s, r) {
				var acl = parseLinkHeader(r.getResponseHeader('Link'));
				var aclUri = acl['acl']['href'];
				var metaUri = acl['meta'] ? acl['meta']['href'] : undefined;

				var frag = "#" + basename(uri);

                var g = $rdf.graph();

                // default is read write for owner
                g.add($rdf.sym(''), RDF('type'), WAC('Authorization'));
                g.add($rdf.sym(''), WAC('accessTo'), $rdf.sym(''));
                g.add($rdf.sym(''), WAC('accessTo'), $rdf.sym(uri));

                if (metaUri) g.add($rdf.sym(''), WAC('accessTo'), $rdf.sym(metaUri));

                g.add($rdf.sym(''), WAC('agent'), $rdf.sym(owner));
                g.add($rdf.sym(''), WAC('mode'), WAC('Read'));
                g.add($rdf.sym(''), WAC('mode'), WAC('Write'));

                if (modes) { // specify other acccess control
	                // add post triples
	                g.add($rdf.sym(frag), RDF('type'), WAC('Authorization'));
	                g.add($rdf.sym(frag), WAC('accessTo'), $rdf.sym(uri));

					// add group
	                if (group) {
	                	for (var j in group) {
	                		g.add($rdf.sym(frag), WAC('agent'), $rdf.sym(group[j]));
	                	}
	                } else { // if no group specified then make resource public
	                	g.add($rdf.sym(frag), WAC('agentClass'), FOAF('Agent'));
	                }

	                // add modes
	                for (var i in modes) {
	                	g.add($rdf.sym(frag), WAC('mode'), WAC(firstLetterUpperCase(modes[i])));
	                }
	            }
                
                
                s = new $rdf.Serializer(g).toN3(g);

                if (s && aclUri) {
                	$.ajax({
                		type: 'PUT', // consider using patch
                		url: aclUri,
                		contentType: 'text/turtle',
                		data: s,
                		processData: false,
                		xhrFields: {
                			withCredentials: true
                		},
                		statusCode: genericStatusCode(callback, "Error writing ACL"),
                		success: function(d, s, r) {
                			callback(true);
                		}
                	});
                }
			}
		});
	}

	/**
	* Remove the resource at the given uri. Removes the resource and its ACL
	* 
	* @params {String} uri The URI of the resource.
	* @params {Function} callback Function to execute when delete completes.
	*/
	self.deleteResource = function(uri, callback) {
		$.ajax({
			url: uri,
			type: "delete",
			xhrFields: {
				withCredentials: true
			},
			statusCode: genericStatusCode(callback, "Failed to delete resource"),
			success: function (d, s, r) {
				var acl = parseLinkHeader(r.getResponseHeader('Link'));
				var aclUri = acl['acl']['href'];

				$.ajax({
					url: aclUri,
					type: "delete",
					xhrFields: {
						withCredentials: true
					},
					statusCode: genericStatusCode(callback, "Failed to delete ACL for resource"),
					success: function (d, s, r) {
						callback(true);
					}
				})
			}
		});
	}

	/**
	* Removes all RESOURCES within a container, the container itself, the ACL for 
	* the container, and the meta for the container. Note a container cannot be 
	* deleted unless it's empty, and this function does not support recursive deletion
	*
	* @params {String} uri The URI of the container you would like to delete
	* @params {Function} callback The function to execute when delete completes
	*/
	self.deleteContainer = function(uri, callback) {
		var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
        var rdfschema = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");

        var g = $rdf.graph();
        var f = $rdf.fetcher(g, TIMEOUT);

        f.nowOrWhenFetched(uri, undefined, function() {
        	var resources = g.statementsMatching(undefined, RDF('type'), rdfschema('Resource'));
        	var length = resources.length;
        	if (resources.length > 0) {
        		for (var r in resources) {
        			var resourceUri = resources[r]['subject']['value'];
        			$.ajax({
        				url: resourceUri,
        				type: 'delete',
        				xhrFields: {
        					withCredentials: true
        				},
        				statusCode: genericStatusCode(callback, "Failed to delete a resource in the container"),
        				success: function (d, s, r) {
        					length -= 1;
        					if (length === 0) {
	        					deleteEmptyContainer(uri, callback);
							}
        				}
        			});
        		}
        	} else {
        		deleteEmptyContainer(uri, callback);
        	}
        });
	}

	/**
	* Helper function to delete a container after all of the resources in it have
	* been deleted. 
	*
	* @params {String} uri The URI of the container being deleted
	* @params {Function} callback Function to execute when delete is complete
	*/
	var deleteEmptyContainer = function (uri, callback) {
		$.ajax({
			url: uri,
			type: 'HEAD',
			xhrFields: {
				withCredentials: true
			},
			statusCode: genericStatusCode(callback, "Failed to fetch information about the container."),
			success: function (d, s, r) {
				var meta = parseLinkHeader(r.getResponseHeader('Link'));
				var aclUri = meta['acl']['href'];
				var metaUri = meta['meta']['href'];

				// delete container
				$.ajax({
					url: uri, 
					type: 'delete',
					xhrFields: {
						withCredentials: true
					},
					statusCode: genericStatusCode(callback, "Failed to delete the container"),
					success: function (d, s, r) {

						var complete = false;

						$.ajax({
							url: aclUri,
							type: 'delete',
							xhrFields: {
								withCredentials: true
							},
							statusCode: genericStatusCode(callback, "Failed to delete the ACL for the container"),
							success: function(d, s, r) {
		        				complete ? callback(): complete = !complete;
							}
						});

						$.ajax({
							url: metaUri,
							type: 'delete',
							xhrFields: {
								withCredentials: true
							},
							statusCode: genericStatusCode(callback, "Failed to delete the meta file the container"),
							success: function(d, s, r) {
		        				complete ? callback(): complete = !complete;
							}
						});
					}
				});
			}
		});
	}

	/**
	* Helper function to provide a generic response to different status codes
	* that may arise during AJAX calls. 
	* 
	* @params {Function} callback Function to execute
	* @params {String} message More information about where the operation failed.
	*/
	var genericStatusCode = function (callback, message) {
		// should add more codes.
		return {
			401: function(data) {
				callback(false, {
					'errorType': 404,
					'message': '401 Unauthorized. ' + message
				});
			},
			403: function(data) {
				callback(false, {
					'errorType': 403, 
					'message': '403 Forbidden. ' + message
				});
			},
			406: function(data) {
				callback(false, {
					'errorType': 406,
					'message': '406 Content-type unacceptable. ' + message
				});
			},
			507: function() {
				callback(false, {
					'errorType': 507,
					'message': '507 Insufficient storage. ' + message
				});
			}
		}
	}

	/**
	* Helper function to recursively add a shape and any sub-shapes that it contains
	* to the graph. 
	* 
	* @params {Object} g An RDF graph to add to
	* @params {String} reference A string to mark the subject of triples for 
	*                  the sub-shape
	* @params {Object} shape The description of properties to convert to triples
	*/
	var recursiveAddToGraph = function(g, reference, shape) {
		var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
		g.add($rdf.sym(reference), RDF('type'), shape.vocab);
		for (var s in shape.properties) {
			var attr = shape.properties[s];
			if (attr.value) {
				if (attr.value instanceof Object && 
					!(attr.value instanceof $rdf.Symbol) && 
					!(attr.value instanceof $rdf.Literal) ) {
					g.add($rdf.sym(""), attr.vocab, $rdf.sym("#" + attr.reference));
					recursiveAddToGraph(g, "#" + attr.reference, attr.value);
				} else {
					g.add($rdf.sym(""), attr.vocab, attr.value_type(attr.value));
				}
			}
		}
	}

	/** 
	* Helper function to convert a string into a string where only the first letter
	* is capitalized.
	* 
	* @params {String} str The string we would like to convert. 
	*/
	var firstLetterUpperCase = function(str) {
		var start = str.slice(0, 1);
		var end = str.slice(1);
		return start.toUpperCase() + end.toLowerCase();
	}

	/**
	* Get the base name of a path (e.g. filename).
	* basename('/root/dir1/file') -> 'file'
	*
	* @params {String} path That path to the file or resource.
	* @returns {String} Returns the basename from the path
	*/
	var basename = function(path) {
	    if (path.substring(path.length - 1) == '/') {
	        path = path.substring(0, path.length - 1);
	    }

	    var a = path.split('/');
	    return a[a.length - 1];
	};

	/**
	* Parse a Link header to create an object that is more manageable.
	*
	* @params {String} header The link header optained from an ajax call
	* @returns {Object} Returns an object that maps each property in the link 
	*                   header to a value.
	*/
	var parseLinkHeader = function(header) {	
		var linkexp = /<[^>]*>\s*(\s*;\s*[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*")))*(,|$)/g;
		var paramexp = /[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*"))/g;

		var matches = header.match(linkexp);
		var rels = {};
		for (i = 0; i < matches.length; i++) {
			var split = matches[i].split('>');
			var href = split[0].substring(1);
			var ps = split[1];
			var link = {};
			link.href = href;
			var s = ps.match(paramexp);
			for (j = 0; j < s.length; j++) {
				var p = s[j];
				var paramsplit = p.split('=');
				var name = paramsplit[0];
				link[name] = unquote(paramsplit[1]);
			}

			if (link.rel !== undefined) {
				rels[link.rel] = link;
			}
		}
	    return rels;
	}

	/**
	* Removes the quotation marks at the beginning and end of a string.
	*
	* @params {String} value The input string
	* @return {String} Returns the input string without quotation marks at 
	*                  the beginning or end
	*/
	var unquote = function(value) {
	    if (value.charAt(0) == '"' && value.charAt(value.length - 1) == '"') {
			return value.substring(1, value.length - 1);
	    }
	    return value;
	}

	Object.freeze(self); // ensures no properties are added or modified
	return self;
}

/**
var UserObject = function(webid, properties) {
	var self = createObject(UserObject.prototype);

	self.webid = webid;

	self.properties = properties ? properties : {};

	self.addPro
}

var ContainerObject = function(uri, properties) {
	
}

var ResourceObject = function(uri, containerUri, properties) {
	
}

*/
