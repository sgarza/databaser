'use strict';

const deepmerge = require( 'deepmerge' );

module.exports = ( _options = {} ) => {
	const options = deepmerge( {
		nullable: true,
		initial: undefined,
		example: {
			foo: 'bar'
		}
	}, _options );

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
				return undefined;
			}
			catch( ex ) {
				return 'invalid value format';
			}
		},
		serialize: ( value ) => ( JSON.stringify( value ) ),
		deserialize: ( value ) => ( JSON.parse( value ) )
	};
};