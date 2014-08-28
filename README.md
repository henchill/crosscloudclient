CrossCloud Client
-----
This is a Javascript Client that developers can use to build CrossCloud applications. The client allows you to fetch data from user pods, write to user pods, and set access control for data on the user pods. 

Requires rdflib and jQuery

Shape Types
------
The following are the current shape types used by this client. These will most likely be integrated at some point. 

The UserObject defines properties for a user account. 
UserObject = {
	'webid': 'some webid',
	'properties': {
		'prop1': {
			'vocab': 'some rdf vocab ex "DCT('title')"'
			'value': valueOfProp
		}
	}
}

The ContainerObject defines properties for a container.
ContainerObject = {
	'uri': 'https://some.path/goesHere',
	'vocab': 'ex: SIOC("Container")',
	'prefix': 'string prefix for resource added to container',
	'properties': {
		'prop1': {
			'vocab': 'some rdf vocab ex "DCT('title')"'
			'value': valueOfProp
			'value_type': choice between rdf.lit or rdf.sym
		}
	}
}

The ResourceObject defines properties for a resource.
ResourceObject = {
	'uri': 'https://some.path/goesHere',
	'vocab': 'ex: SIOC("Post")',
	'properties': {
		'prop1': {
			'vocab': 'some rdf vocab ex: SIOC("content")'
			'value': valueOfProp
			'value_type': choice between rdf.lit or rdf.sym
		}
	}
}

The SubObject holds a subset of an object to help with caching information. 
SubObject = {
	'vocab': 'ex: SIOC("Contaner")',
	'properties': {
		'prop1': {
			'vocab': 'some rdf vocab ex "DCT('title')"'
			'value': valueOfProp
			'value_type': choice between rdf.lit or rdf.sym
		}
	}
}