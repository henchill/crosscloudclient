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
				var emptyObj = {};
				for (var val in shape) {
					var curr = shape[val];
					var tmp = g.any(webidRes, curr.vocab);
					emptyObj[val] = !tmp ? curr.default : tmp.value;
				}
				results.push(emptyObj);
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
					var containers = g.statementsMatching(undefined, RDF('type'), SIOC('Container'));
					for (var container in containers) {
						var contObj = containers[container]['subject'];
						var currCont = {};
						for (var val in shape) {
							var curr = shape[val];
							if (curr.vocab === undefined) {
								currCont[val] = contObj.value;
							} else if (curr.shape) {
								var tmp = g.any(contObj, curr.vocab);
								console.log(tmp);
								var subObj = {};
								for (var s in curr.shape) {
									var tmp2 = g.any(tmp, curr.shape[s].vocab);
									console.log(tmp2);
									subObj[s] = !tmp2 ? curr.shape[s].default : tmp2.value;
								}
								currCont[val] = subObj;
							} else {
								var tmp = g.any(contObj, curr.vocab);
								currCont[val] = !tmp ? curr.default : tmp.value;
							}
						}
						results.push(currCont);
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
				var resource = {};
				for (var s in shape) {
					if (s === 'containerUri') {
						resource[s] = uri;
					} else if (s !== 'vocab') {
						var currObj = shape[s];
						if (currObj.vocab === undefined) {
							resource[s] = currentItem.uri;
						} else if (currObj.shape) {
							var tmp = g.any(currentItem, currObj.vocab);
							var subObj = {};
							for (var t in currObj.shape) {
								var tmp2 = g.any(tmp, currObj.shape[t].vocab);
								subObj[t] = !tmp2 ? currObj.shape[t].default : tmp2.value;
							}
							resource[s] = subObj;
						} else {
							var tmp = g.any(currentItem, currObj.vocab);
							resource[s] = !tmp ? currObj.default : tmp.value;
						}
					}
				}
				results.push(resource);
			}
			callback(results);
		});
	}

	Object.freeze(self);
	return self;
}