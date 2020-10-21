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
					],
					example: 'pending'
				} ),
				age: datatypes.integer(),
				created: datatypes.ISODate(),
				meta: datatypes.JSON(),
				weight: datatypes.number(),
				phone: datatypes.phone(),
				quote: datatypes.string( {
					example: 'this is my quote!'
				} ),
				description: datatypes.string(),
				name: {
					first: datatypes.string( {
						length: {
							min: 2
						},
						example: 'First'
					} ),
					last: datatypes.string( {
						length: {
							min: 2
						},
						example: 'Last'
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
					maxLength: 36,
					example: '8bb846ee-a778-4378-9635-34b54956675d'
				},
				active: {
					type: 'boolean',
					example: true
				},
				email: {
					type: 'string',
					format: 'email',
					minLength: 5,
					example: 'you@domain.com'
				},
				state: {
					type: 'string',
					enum: [
						'pending',
						'approved'
					],
					example: 'pending'
				},
				age: {
					type: 'integer',
					example: 11
				},
				created: {
					type: 'string',
					format: 'date-time',
					example: '2020-10-21T03:53:01.873Z'
				},
				meta: {
					type: 'string',
					example: '{ "foo": "bar" }'
				},
				weight: {
					type: 'number',
					example: 11.11
				},
				phone: {
					type: 'string',
					maxLength: 32,
					example: '+12135555555'
				},
				quote: {
					type: 'string',
					example: 'this is my quote!'
				},
				description: {
					type: 'string',
					example: 'hello'
				},
				name: {
					type: 'object',
					properties: {
						first: {
							type: 'string',
							minLength: 2,
							example: 'First'
						},
						last: {
							type: 'string',
							minLength: 2,
							example: 'Last'
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
									type: 'string',
									example: 'hello'
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