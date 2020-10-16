'use strict';

const { datatypes, model, as_json_schema } = require( '../index.js' );

describe( 'json-schema', () => {
	it( 'should allow converting a model to a JSON Schema', () => {
		const user_model = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					null: false
				} ),
				active: datatypes.boolean(),
				email: datatypes.email(),
				state: datatypes.enum( {
					values: [
						'pending',
						'approved'
					]
				} ),
				age: datatypes.integer(),
				created: datatypes.ISODate(),
				meta: datatypes.JSON(),
				weight: datatypes.number(),
				phone: datatypes.phone(),
				name: datatypes.string( {
					length: {
						min: 2
					}
				} )
			}
		} );
		
		const json_schema = as_json_schema( user_model );

		expect( json_schema ).toMatchObject( {
			type: 'object',
			required: [ 'id' ],
			properties: {
				id: {
					type: 'string',
					minLength: 36,
					maxLength: 36
				},
				active: {
					type: 'boolean'
				},
				email: {
					type: 'string',
					minLength: 5
				},
				state: {
					type: 'string',
					enum: [
						'pending',
						'approved'
					]
				},
				age: {
					type: 'integer'
				},
				created: {
					type: 'string'
				},
				meta: {
					type: 'string'
				},
				weight: {
					type: 'number'
				},
				phone: {
					type: 'string',
					maxLength: 32
				},
				name: {
					type: 'string',
					minLength: 2
				}
			}
		} );
	} );
} );