'use strict';

const deepmerge = require( 'deepmerge' );
const string = require( './string.js' );

module.exports = ( _options = {} ) => {
	const options = deepmerge( {
		nullable: true,
		unique: false,
		initial: undefined,
		validate: undefined,
		length: {
			min: 5,
			max: undefined
		},
		example: 'you@domain.com'
	}, _options );

	const base_type = string( options );

	return {
		datatype: 'email',
		options,
		initial: () => {
			if ( typeof options.initial !== 'undefined' ) {
				return typeof options.initial === 'function' ? options.initial() : options.initial;
			}

			return undefined;
		},
		validate: ( value ) => {
			const error = base_type.validate( value );
			if ( error ) {
				return error;
			}

			if ( !/^.+@.+\..+$/.test( value ) ) {
				return 'invalid value format';
			}

			if ( typeof options.validate === 'function' ) {
				const error = options.validate( value );
				if ( error ) {
					return error;
				}
			}
		}
	};
};