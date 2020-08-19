'use strict';

const extend = require( 'extend' );
const string = require( './string.js' );

const PHONE_REGEX = /^\+(?:[0-9]){6,14}[0-9]$/;

module.exports = ( _options ) => {
	const options = extend( true, {
		null: true,
		length: {
			min: undefined,
			max: 32
		},
		unique: false,
		initial: undefined
	}, _options );

	const base_type = string( options );

	return {
		datatype: 'phone',
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

			return value !== null && !PHONE_REGEX.test( value ) ? 'invalid value format' : undefined;
		}
	};
};