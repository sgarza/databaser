'use strict';

const { datatypes, model, as_json_schema } = require( '../index.js' );

describe( 'json-schema', () => {
	it( 'should allow converting a model to a JSON Schema', () => {
		const user_model = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false
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
				with_example: datatypes.JSON( {
					example: {
						blah: true
					}
				} ),
				weight: datatypes.number(),
				phone: datatypes.phone(),
				quote: datatypes.string( {
					example: 'this is my quote!'
				} ),
				description: datatypes.string(),
				array: datatypes.JSON( {
					type: 'array',
					example: [ 1, 2, 3 ]
				} ),
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
							nullable: false
						} )
					}
				}
			}
		} );
		
		const json_schema = as_json_schema( user_model );

		expect( json_schema ).toMatchObject( {
			type: 'object',
			description: 'user',
			required: [ 'id' ],
			properties: {
				id: {
					type: 'string',
					minLength: 36,
					maxLength: 36,
					example: '8bb846ee-a778-4378-9635-34b54956675d',
					nullable: false
				},
				active: {
					type: 'boolean',
					example: true,
					nullable: true
				},
				email: {
					type: 'string',
					format: 'email',
					minLength: 5,
					example: 'you@domain.com',
					nullable: true
				},
				state: {
					type: 'string',
					enum: [
						'pending',
						'approved'
					],
					example: 'pending',
					nullable: true
				},
				age: {
					type: 'integer',
					example: 11,
					nullable: true
				},
				created: {
					type: 'string',
					format: 'date-time',
					example: '2020-10-21T03:53:01.873Z',
					nullable: true
				},
				meta: {
					type: 'object',
					example: { 
						foo: 'bar'
					},
					nullable: true,
					additionalProperties: true
				},
				with_example: {
					type: 'object',
					example: { 
						blah: true
					},
					nullable: true,
					additionalProperties: true
				},
				weight: {
					type: 'number',
					example: 11.11,
					nullable: true
				},
				phone: {
					type: 'string',
					maxLength: 32,
					example: '+12135555555',
					nullable: true
				},
				quote: {
					type: 'string',
					example: 'this is my quote!',
					nullable: true
				},
				description: {
					type: 'string',
					example: 'hello',
					nullable: true
				},
				array: {
					type: 'array',
					nullable: true,
					example: [ 1, 2, 3 ],
					additionalProperties: true
				},
				name: {
					type: 'object',
					properties: {
						first: {
							type: 'string',
							minLength: 2,
							example: 'First',
							nullable: true
						},
						last: {
							type: 'string',
							minLength: 2,
							example: 'Last',
							nullable: true
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
									example: 'hello',
									nullable: false
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