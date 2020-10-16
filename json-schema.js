'use strict';

const traverse = require( 'traverse' );

// String values MUST be one of the six primitive types ("null", "boolean", "object", "array", "number", or "string"), or "integer" which matches any number with a zero fractional part. 

const DATATYPE_MAP = {
	boolean: () => ( {
		type: 'boolean'
	} ),
	email: ( field ) => ( {
		type: 'string',
		minLength: field.options.length.min
	} ),
	enum: ( field ) => ( {
		type: 'string',
		enum: field.options.values
	} ),
	integer: () => ( {
		type: 'integer'
	} ),
	ISODate: () => ( {
		type: 'string'
	} ),
	JSON: () => ( {
		type: 'string'
	} ),
	number: () => ( {
		type: 'number'
	} ),
	phone: ( field ) => ( {
		type: 'string',
		maxLength: field.options.length.max
	} ),
	string: ( field ) => {
		const schema = {
			type: 'string'
		};

		if ( typeof field.options.length.min === 'number' ) {
			schema.minLength = field.options.length.min;
		}

		if ( typeof field.options.length.max === 'number' ) {
			schema.maxLength = field.options.length.max;
		}

		return schema;
	},
	UUID: () => ( {
		type: 'string',
		minLength: 36,
		maxLength: 36
	} )
};

module.exports = ( model ) => {
	const schema = {
		type: 'object',
		required: [],
		properties: {}
	};

	const schema_traverser = traverse( schema );

	traverse( model.options.schema ).forEach( function( field ) {
		if ( typeof field === 'object' && !!field && field.datatype ) {
			schema_traverser.set( [ 'properties', ...this.path ], DATATYPE_MAP[ field.datatype ]( field ) );
			if ( field.options.null === false ) {
				schema.required.push( this.path.join( '.' ) );
			}
		}
	} );

	return schema;
};