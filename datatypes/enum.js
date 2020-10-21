'use strict';

const deepmerge = require( 'deepmerge' );

module.exports = ( _options = {} ) => {
	const options = deepmerge( {
		nullable: true,
		initial: undefined,
		values: [],
		validate: undefined,
		example: undefined
	}, _options );

	return {
		datatype: 'enum',
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

			if ( !options.values.includes( value ) ) {
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