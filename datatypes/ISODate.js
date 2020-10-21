'use strict';

const deepmerge = require( 'deepmerge' );

const ISO_DATE_REGEX = /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/;

module.exports = ( _options = {} ) => {
	const options = deepmerge( {
		nullable: true,
		initial: undefined,
		example: '2020-10-21T03:53:01.873Z'
	}, _options );

	return {
		datatype: 'ISODate',
		options,
		initial: () => {
			if ( typeof options.initial !== 'undefined' ) {
				return typeof options.initial === 'function' ? options.initial() : options.initial;
			}

			return new Date().toISOString();
		},
		validate: ( value ) => {
			if ( !options.nullable && value === null ) {
				return 'null value not allowed';
			}
			else if ( options.nullable && value === null ) {
				return;
			}

			if ( typeof value !== 'string' ) {
				return 'invalid type';
			}

			return value !== null && !ISO_DATE_REGEX.test( value ) ? 'invalid value format' : undefined;
		}
	};
};