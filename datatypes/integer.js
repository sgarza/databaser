'use strict';

const deepmerge = require( 'deepmerge' );

module.exports = ( _options = {} ) => {
	const options = deepmerge( {
		nullable: true,
		unique: false,
		range: {
			min: undefined,
			max: undefined
		},
		initial: undefined,
		validate: undefined,
		example: 11
	}, _options );

	return {
		datatype: 'integer',
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

			if ( typeof value !== 'number' ) {
				return 'invalid type';
			}

			if ( !Number.isInteger( value ) ) {
				return 'invalid value';
			}

			if ( options.range.min && value < options.range.min ) {
				return 'value below minumum';
			}

			if ( options.range.max && value > options.range.max ) {
				return 'value above maximum';
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