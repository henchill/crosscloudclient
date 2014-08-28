var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
var SPACE = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
var ACL = $rdf.Namespace("http://www.w3.org/ns/auth/acl#");
var DCT = $rdf.Namespace("http://purl.org/dc/terms/");
var SIOC = $rdf.Namespace("http://rdfs.org/sioc/ns#");

var createObject = function (o) {
	var Shape = function () {}
	Shape.prototype = o;
	return new Shape();
}

var UserAccount = function() { // UserObject example
	var self = createObject(UserAccount.prototype);

	self.webid = undefined;

	self.properties =  {
		'name': {
			'vocab': FOAF('name'),
			'value': undefined
		},

		'pic': {
			'vocab': FOAF('img'),
			'value': undefined
		},

		'depic': {
			'vocab': FOAF('depiction'),
			'value': undefined
		},

		'storage': {
			'vocab': SPACE('storage'),
			'value': undefined
		}
	}
	Object.seal(self);
	return self;
}

var Creator = function() { // SubObject example
	var self = createObject(Creator.prototype);

	self.vocab = SIOC('UserAccount');

	self.properties = {
		'name': {
			'vocab': FOAF('name'),
			'value': undefined,
			'value_type': $rdf.lit
		},

		'webid': {
			'vocab': SIOC('account_of'),
			'value': undefined,
			'value_type': $rdf.sym
		},

		'pic': {
			'vocab': SIOC('avatar'),
			'value': undefined,
			'value_type': $rdf.sym
		}
	}
	
	Object.seal(self);
	return self;
}

var Channel = function (params) { // ContainerObject example
	var self = createObject(Channel.prototype);

	self.uri = undefined;

	self.vocab = SIOC('Container');

	self.prefix = 'post';

	self.properties = {
		'title': {
			'vocab': DCT('title'),
			'value': undefined,
			'value_type': $rdf.lit
		},

		'owner': {
			'vocab': SIOC('has_creator'),
			'value': Creator(),
			'reference': "author"
		}
	};

	if (params) {
		for (var attr in params) {
			self.properties[attr]['value'] = params[attr];
		}
	} 

	Object.seal(self);
	return self;
}

var Post = function (params) { // ResourceObject Example
	var self = createObject(Post.prototype);

	self.uri = undefined;

	self.vocab = SIOC('Post');

	self.properties = {
		'date': {
			'vocab': DCT('created'),
			'value': $rdf.lit(Date.now(), '', $rdf.Symbol.prototype.XSDdateTime),
			'value_type': $rdf.lit
		},

		'owner': {
			'vocab': SIOC('has_creator'),
			'value': Creator(),
			'reference': "author"
		},

		'body': {
			'vocab': SIOC('content'),
			'value': undefined,
			'value_type': $rdf.lit
		}

	}

	if (params) {
		for (var attr in params) {
			self.properties[attr]['value'] = params[attr];
		}
	} 
	
	Object.seal(self);
	return self;
}