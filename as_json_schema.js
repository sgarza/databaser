'use strict';

const traverse = require( 'traverse' );

// String values MUST be one of the six primitive types ("null", "boolean", "object", "array", "number", or "string"), or "integer" which matches any number with a zero fractional part. 

const DATATYPE_MAP = {
	boolean: ( field ) => {
		const schema = {
			type: 'boolean',
			example: field.options.example,
			nullable: field.options.nullable
		};

		if ( typeof field.options.description === 'string' ) {
			schema.description = field.options.description;
		}

		return schema;
	},
	date: ( field ) => {
		const schema = {
			type: 'string',
			format: 'date',
			minLength: field.options.length.min,
			maxLength: field.options.length.max,
			nullable: field.options.nullable,
			example: field.options.example
		};

		if ( typeof field.options.description === 'string' ) {
			schema.description = field.options.description;
		}

		return schema;
	},
	email: ( field ) => {
		const schema = {
			type: 'string',
			format: 'email',
			minLength: field.options.length.min,
			example: field.options.example,
			nullable: field.options.nullable
		};

		if ( typeof field.options.description === 'string' ) {
			schema.description = field.options.description;
		}

		return schema;
	},
	enum: ( field ) => {
		const schema = {
			type: 'string',
			enum: field.options.values,
			example: field.options.example,
			nullable: field.options.nullable
		};

		if ( typeof field.options.description === 'string' ) {
			schema.description = field.options.description;
		}

		return schema;
	},
	integer: ( field ) => {
		const schema = {
			type: 'integer',
			example: field.options.example,
			nullable: field.options.nullable
		};

		if ( typeof field.options.description === 'string' ) {
			schema.description = field.options.description;
		}

		return schema;
	},
	ISODate: ( field ) => {
		const schema = {
			type: 'string',
			format: 'date-time',
			example: field.options.example,
			nullable: field.options.nullable
		};

		if ( typeof field.options.description === 'string' ) {
			schema.description = field.options.description;
		}

		return schema;
	},
	JSON: ( field ) => {
		const schema = {
			type: field.options.type ?? 'object',
			example: field.options.example,
			nullable: field.options.nullable,
			additionalProperties: true
		};

		if ( typeof field.options.description === 'string' ) {
			schema.description = field.options.description;
		}

		return schema;
	},
	number: ( field ) => {
		const schema = {
			type: 'number',
			example: field.options.example,
			nullable: field.options.nullable
		};

		if ( typeof field.options.description === 'string' ) {
			schema.description = field.options.description;
		}

		return schema;
	},
	phone: ( field ) => {
		const schema = {
			type: 'string',
			maxLength: field.options.length.max,
			example: field.options.example,
			nullable: field.options.nullable
		};

		if ( typeof field.options.description === 'string' ) {
			schema.description = field.options.description;
		}

		return schema;
	},
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

		if ( typeof field.options.description === 'string' ) {
			schema.description = field.options.description;
		}

		return schema;
	},
	UUID: ( field ) => {
		const schema = {
			type: 'string',
			format: 'uuid',
			minLength: 36,
			maxLength: 36,
			example: field.options.example,
			nullable: field.options.nullable
		};

		if ( typeof field.options.description === 'string' ) {
			schema.description = field.options.description;
		}

		return schema;
	}
};

function property_map( value ) {
	if ( value && value.options && value.options.json_schema === false ) {
		this.remove();
		return;
	}

	if ( Array.isArray( value ) && this.path[ this.path.length - 1 ] === 'required' ) {
		this.update( value );
		return;
	}

	if ( typeof value !== 'object' ) {
		this.update( value );
		return;
	}

	if ( value !== null && value.datatype ) {
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