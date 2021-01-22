'use strict';

const deepmerge = require( 'deepmerge' );
const string = require( './string.js' );

const DATE_REGEX = /^(\d{4}-[01]\d-[0-3]\d)$/;

module.exports = ( _options = {} ) => {
	const options = deepmerge( {
		nullable: true,
		unique: false,
		initial: undefined,
		validate: undefined,
		length: {
			min: 10,
			max: 10
		},
		example: '2021-01-21'
	}, _options );

	const base_type = string( options );

	return {
		datatype: 'date',
		options,
		initial: () => {
			if ( typeof options.initial !== 'undefined' ) {
				return typeof options.initial === 'function' ? options.initial() : options.initial;
			}

			const now = new Date();
			return `${ now.getFullYear() }-${ String( now.getMonth() + 1 ).padStart( 2, '0' ) }-${ String( now.getDate() ).padStart( 2, '0' ) }`;
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

			if ( typeof value !== 'string' ) {
				return 'invalid type';
			}

			if ( !DATE_REGEX.test( value ) ) {
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