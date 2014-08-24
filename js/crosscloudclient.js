var PROXY = "https://data.fm/proxy?uri={uri}";
var AUTH_PROXY = "https://rww.io/auth-proxy?uri=";
var TIMEOUT = 90000;

var createObject = function (o) {
	var F = function () {}
	F.prototype = o;
	return new F();
}

var CrossCloudClient = function () {
	var self = createObject(CrossCloudClient.prototype);
    var g = $rdf.graph();
    var f = $rdf.fetcher(g, TIMEOUT);
    // add CORS proxy
    $rdf.Fetcher.crossSiteProxyTemplate=PROXY;

	self.getUserCard = function (webid, shape, callback) {
		var docURI = webid.slice(0, webid.indexOf('#'));
        var webidRes = $rdf.sym(webid);
        var results = [];
        f.nowOrWhenFetched(docURI, undefined, function (ok, body) {
        	if (ok) {
				var userObj = jQuery.extend(true, {}, shape);
				userObj.webid = webid;
				for (var val in shape.properties) {
					var curr = shape.properties[val];
					var tmp = g.any(webidRes, curr.vocab);
					if (tmp) userObj.properties[val].value = tmp.value;
				}
				results.push(userObj);
				callback(results);
			} else {
				callback([], body);
			}
		});
	}

	self.getContainers = function (uri, shape, callback) {
		f.nowOrWhenFetched(uri, undefined, function (ok, body) {
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
					callback(results);
				});
			}			
		});
	}

	// TODO: consider writing a recursive function for sub objects.
	self.getResource = function (uri, shape, callback) {
		f.nowOrWhenFetched(uri+"*", undefined, function(ok, body) {
			var results = [];
			var items = g.statementsMatching(undefined, RDF("type"), shape.vocab);
			for (var i in items) {
				var currentItem = items[i]['subject'];
				var resource = jQuery.extend(true, {}, shape);
				resource.uri = currentItem.uri;
				resource.containerUri = uri
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
			callback(results);
		});
	}

	self.writeResource = function (container, shape, onSuccess) {
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
			// status code stuff
			success: function(d, s, r) {
				var resourceUri = r.getResponseHeader('Location');
				onSuccess({'resourceUri': resourceUri});
			}
		});
	}

	self.writeContainer = function (space, shape, onSuccess) {
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
			// TODO: include status code behavior
			success: function(d, s, r) {
				meta = parseLinkHeader(r.getResponseHeader('Link'));
				metaUri = meta['meta']['href'];
				aclUri = meta['acl']['href'];
				containerUri = r.getResponseHeader('Location');

				var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
				var SIOC = $rdf.Namespace("http://rdfs.org/sioc/ns#");

				var g = $rdf.graph();
				if (shape.prefix) {
					g.add($rdf.sym(containerUri), shape.prefix.vocab, shape.prefix.value);
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
						// include status code behavior
						success: onSuccess({'metaUri': metaUri, 
											'aclUri': aclUri,
											'containerUri': containerUri})
					});
				}
			}
		});
	}

	// currently only sets public and private access. 
	self.setAcl = function (uri) {
		var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
        var g = $rdf.graph();
        var s = new $rdf.Serializer(g).toN3(g);

        $.ajax({
			type: 'HEAD',
			url: uri,
			xhrFields: {
				withCredentials: true
			},
			success: function(d, s, r) {
				var acl = parseLinkHeader(r.getResponseHeader('Link'));
				var aclUri = acl['acl']['href'];

				var frag = "#" + basename(uri);

				var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
                var WAC = $rdf.Namespace("http://www.w3.org/ns/auth/acl#");
                var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");

                var webid = "https://henchill.rww.io/profile/card#me";
                var g = $rdf.graph();
                // add document triples
                g.add($rdf.sym(''), RDF('type'), WAC('Authorization'));
                g.add($rdf.sym(''), WAC('accessTo'), $rdf.sym(''));
                g.add($rdf.sym(''), WAC('accessTo'), $rdf.sym(uri));
                g.add($rdf.sym(''), WAC('agent'), $rdf.sym(webid));
                g.add($rdf.sym(''), WAC('mode'), WAC('Read'));
                g.add($rdf.sym(''), WAC('mode'), WAC('Write'));

                // add post triples
                g.add($rdf.sym(frag), RDF('type'), WAC('Authorization'));
                g.add($rdf.sym(frag), WAC('accessTo'), $rdf.sym(uri));

                // public visibility
                g.add($rdf.sym(frag), WAC('agentClass'), FOAF('Agent'));
                g.add($rdf.sym(frag), WAC('mode'), WAC('Read'));
                
                s = new $rdf.Serializer(g).toN3(g);

                if (s && aclUri) {
                	$.ajax({
                		type: 'PUT',
                		url: aclUri,
                		contentType: 'text/turtle',
                		data: s,
                		processData: false,
                		xhrFields: {
                			withCredentials: true
                		},
                		// include status code
                	});
                }
			}
		});
	}

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
	
	// get the base name of a path (e.g. filename)
	// basename('/root/dir1/file') -> 'file'
	var basename = function(path) {
	    if (path.substring(path.length - 1) == '/') {
	        path = path.substring(0, path.length - 1);
	    }

	    var a = path.split('/');
	    return a[a.length - 1];
	};

	// parse a Link header
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
			// console.log(link.href); //debug
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


	var unquote = function(value) {
	    if (value.charAt(0) == '"' && value.charAt(value.length - 1) == '"') {
			return value.substring(1, value.length - 1);
	    }
	    return value;
	}

	Object.freeze(self);
	return self;
}