var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
var SPACE = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
var ACL = $rdf.Namespace("http://www.w3.org/ns/auth/acl#");
var DCT = $rdf.Namespace("http://purl.org/dc/terms/");
var SIOC = $rdf.Namespace("http://rdfs.org/sioc/ns#");

var createObject = function (o) {
	var F = function () {}
	F.prototype = o;
	return new F();
}

var User = function() {
	var self = createObject(User.prototype);

	self.name = {
		'identifier': 'name',
		'vocab': FOAF('name'),
		'default': "Unknown"
	};

	self.webid = {
		'vocab': SIOC('account_of'),
		'default': "Unknown"
	}

	self.pic = {
		'identifier': "pic",
		'vocab': SIOC('avatar'),
		'default': "Unknown"
	};

	self.depic = {
		'identifier': 'depic',
		'vocab': FOAF('depiction'),
		'default': "Unknown"
	};

	self.storage = {
		'identifier': 'storage',
		'vocab': SPACE('storage'),
		'default': "Unknown"
	};
	Object.freeze(self);
	return self;
}

var Channel = function () {
	// console.log("channel create");
	var self = createObject(Channel.prototype);

	self.uri = {
		'vocab': undefined,
		'default': "Unknown"
	};

	self.title = {
		'vocab': DCT('title'),
		'default': 'Unknown'
	};

	self.owner = {
		'vocab': SIOC('has_creator'),
		'shape': User(),
		'default': {}
	};

	Object.freeze(self);
	// console.log(self);
	return self;
}

var Post = function () {
	var self = createObject(Post.prototype); 

	self.vocab = SIOC('Post');

	self.uri = {
		'vocab': undefined,
		'default': "Unknown"
	};

	self.containerUri = undefined;

	self.date = {
		'vocab': DCT('created'),
		'default': "Unknown"
	};

	self.owner = {
		'vocab': SIOC('has_creator'),
		'shape': User(),
		'default': {}
	};

	self.body = {
		'vocab': SIOC('content'),
		'default': ""
	};

	Object.freeze(self);
	return self;
}