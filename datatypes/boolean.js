'use strict';

const extend = require( 'extend' );

module.exports = ( _options ) => {
	const options = extend( true, {
		null: true,
		initial: undefined,
		validate: undefined,
		example: true
	}, _options );

	return {
		datatype: 'boolean',
		options,
		initial: () => {
			if ( typeof options.initial !== 'undefined' ) {
				return typeof options.initial === 'function' ? options.initial() : options.initial;
			}

			return undefined;
		},
		validate: ( value ) => {
			if ( !options.null && value === null ) {
				return 'null value not allowed';
			}
			else if ( options.null && value === null ) {
				return;
			}

			if ( typeof value !== 'boolean' ) {
				return 'invalid value';
			}

			if ( typeof options.validate === 'function' ) {
				const error = options.validate( value );
				if ( error ) {
					return error;
				}
			}

			return;
		}
	};
};