'use strict';

const traverse = require( 'traverse' );

// String values MUST be one of the six primitive types ("null", "boolean", "object", "array", "number", or "string"), or "integer" which matches any number with a zero fractional part. 

const DATATYPE_MAP = {
	boolean: ( field ) => ( {
		type: 'boolean',
		example: field.options.example,
		nullable: field.options.nullable
	} ),
	email: ( field ) => ( {
		type: 'string',
		format: 'email',
		minLength: field.options.length.min,
		example: field.options.example,
		nullable: field.options.nullable
	} ),
	enum: ( field ) => ( {
		type: 'string',
		enum: field.options.values,
		example: field.options.example,
		nullable: field.options.nullable
	} ),
	integer: ( field ) => ( {
		type: 'integer',
		example: field.options.example,
		nullable: field.options.nullable
	} ),
	ISODate: ( field ) => ( {
		type: 'string',
		format: 'date-time',
		example: field.options.example,
		nullable: field.options.nullable
	} ),
	JSON: ( field ) => ( {
		type: field.options.type ?? 'object',
		example: field.options.example,
		nullable: field.options.nullable
	} ),
	number: ( field ) => ( {
		type: 'number',
		example: field.options.example,
		nullable: field.options.nullable
	} ),
	phone: ( field ) => ( {
		type: 'string',
		maxLength: field.options.length.max,
		example: field.options.example,
		nullable: field.options.nullable
	} ),
	string: ( field ) => {
		const schema = {
			type: 'string',
			example: field.options.example,
			nullable: field.options.nullable
		};

		if ( typeof field.options.length.min === 'number' ) {
			schema.minLength = field.options.length.min;
		}

		if ( typeof field.options.length.max === 'number' ) {
			schema.maxLength = field.options.length.max;
		}

		return schema;
	},
	UUID: ( field ) => ( {
		type: 'string',
		format: 'uuid',
		minLength: 36,
		maxLength: 36,
		example: field.options.example,
		nullable: field.options.nullable
	} )
};

function property_map( value ) {
	if ( Array.isArray( value ) && this.path[ this.path.length - 1 ] === 'required' ) {
		this.update( value );
		return;
	}

	if ( typeof value !== 'object' ) {
		this.update( value );
		return;
	}

	if ( value.datatype ) {
		this.update( DATATYPE_MAP[ value.datatype ]( value ), true );
		return;
	}

	if ( value !== null && value.type && value.properties ) {
		this.update( value );
		return;
	}

	if ( value !== null && value.__processed ) {
		this.update( value );
		return;
	}

	if ( value !== null ) {

		const schema = {
			type: 'object',
			properties: Object.assign( {}, value, { __processed: true } ),
			required: Object.keys( value ).reduce( ( _required, key ) => {
				if ( typeof value[ key ] === 'object' && !!value[ key ] && value[ key ].datatype && value[ key ].options.nullable === false ) {
					_required.push( key );
				}
				return _required;
			}, [] )
		};

		this.update( schema );
		return;
	}

	this.update( value );
}

module.exports = ( model ) => {
	const first_pass_schema = traverse( model.options.schema ).map( property_map );
	const schema = traverse( first_pass_schema ).map( function() { 
		const name = this.path[ this.path.length - 1 ];
		if ( name === '__processed' ) {
			this.remove();
		}
	} );

	schema.description = model.options.name;

	return schema;
};