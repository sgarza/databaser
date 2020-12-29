'use strict';

const deepmerge = require( 'deepmerge' );
const string = require( './string.js' );

const PHONE_REGEX = /^\+(?:[0-9]){6,14}[0-9]$/;

module.exports = ( _options = {} ) => {
	const options = deepmerge( {
		nullable: true,
		unique: false,
		initial: undefined,
		validate: undefined,
		length: {
			min: undefined,
			max: 32
		},
		example: '+12135555555'
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

			if ( !options.nullable && value === null ) {
				return 'null value not allowed';
			}
			else if ( options.nullable && value === null ) {
				return;
			}

			if ( !PHONE_REGEX.test( value ) ) {
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