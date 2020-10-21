'use strict';

const deepmerge = require( 'deepmerge' );
const {
	v4: uuidv4
} = require( 'uuid' );

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = ( _options = {} ) => {
	const options = deepmerge( {
		nullable: true,
		unique: false,
		initial: undefined,
		example: '8bb846ee-a778-4378-9635-34b54956675d'
	}, _options );

	return {
		datatype: 'UUID',
		options,
		initial: () => {
			if ( typeof options.initial !== 'undefined' ) {
				return typeof options.initial === 'function' ? options.initial() : options.initial;
			}

			return uuidv4();
		},
		validate: ( value ) => {
			if ( !options.nullable && value === null ) {
				return {
					error: 'null value not allowed'
				};
			} else if ( options.nullable && value === null ) {
				return;
			}

			return value !== null && !UUID_REGEX.test( value ) ? 'invalid value format' : undefined;
		}
	};
};