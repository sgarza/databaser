'use strict';

const deepmerge = require( 'deepmerge' );

module.exports = ( _options = {} ) => {
	const options = deepmerge( {
		nullable: true,
		initial: undefined,
		validate: undefined,
		example: {
			foo: 'bar'
		}
	}, _options, {
		customMerge: ( key ) => {
			if ( key === 'example' ) {
				return ( source, dest ) => ( dest ?? source );
			}
		}
	} );

	return {
		datatype: 'JSON',
		options,
		initial: () => {
			if ( typeof options.initial !== 'undefined' ) {
				return typeof options.initial === 'function' ? options.initial() : options.initial;
			}

			return undefined;
		},
		validate: ( value ) => {
			if ( !options.nullable && value === null ) {
				return 'null value not allowed';
			}
			else if ( options.nullable && value === null ) {
				return;
			}

			try {
				JSON.stringify( value );
			}
			catch( ex ) {
				return 'invalid value format';
			}

			if ( typeof options.validate === 'function' ) {
				const error = options.validate( value );
				if ( error ) {
					return error;
				}
			}
		},
		serialize: ( value ) => ( JSON.stringify( value ) ),
		deserialize: ( value ) => ( JSON.parse( value ) )
	};
};