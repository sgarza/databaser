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
				name: {
					first: datatypes.string( {
						length: {
							min: 2
						}
					} ),
					last: datatypes.string( {
						length: {
							min: 2
						}
					} )
				},
				foo: {
					bar: {
						baz: datatypes.string( {
							null: false
						} )
					}
				}
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
					format: 'email',
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
					type: 'string',
					format: 'date-time'
				},
				meta: {
					type: 'string'
				},
				weight: {
					type: 'number'
				},
				phone: {
					type: 'string',
					format: 'phone',
					maxLength: 32
				},
				name: {
					type: 'object',
					properties: {
						first: {
							type: 'string',
							minLength: 2
						},
						last: {
							type: 'string',
							minLength: 2
						}
					},
					required: []
				},
				foo: {
					type: 'object',
					properties: {
						bar: {
							type: 'object',
							properties: {
								baz: {
									type: 'string'
								}
							},
							required: [ 'baz' ]
						}
					},
					required: []
				}
			}
		} );
	} );
} );